import { afterEach, describe, expect, it } from 'vitest';
import { appendFile, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type ProducerMode = 'prepare' | 'release';
type Identity = { sourceSha: string; version: string; producerRunId: string; producerMode: ProducerMode };
type Archive = { path: string; sha256: string; size: number };
type Manifest = { schemaVersion: number; repository: string; sourceSha: string; version: string; producer: { runId: string; mode: ProducerMode }; archives: Archive[] };
type SourceRun = { id: number; path: string; event: string; repository: { full_name: string }; head_repository: { full_name: string }; head_sha: string; head_branch: string; status: string; conclusion: string };
type SourceArtifact = { id: number; name: string; expired: boolean; digest: string; size_in_bytes: number; workflow_run: { id: number; head_sha: string; head_branch: string } };
type SourceInput = { run: SourceRun; artifacts: SourceArtifact[]; sourceSha: string; version: string; runId: string };
type BundleApi = {
  expectedArchivePaths(version: string): string[];
  createBundle(input: Identity & { directory: string; bundleDirectory: string }): Promise<Manifest>;
  verifyBundle(input: Identity & { directory: string }): Promise<Manifest>;
  stageBundle(input: Identity & { directory: string; bundleDirectory: string }): Promise<Manifest>;
  validateSourceRun(input: SourceInput): { artifactId: string; artifactName: string; artifactDigest: string };
};
const root = fileURLToPath(new URL('../', import.meta.url));
const moduleUrl = pathToFileURL(join(root, 'scripts/release-bundle.mjs')).href;
const { expectedArchivePaths, createBundle, verifyBundle, stageBundle, validateSourceRun } = await import(moduleUrl) as BundleApi;
const identity: Identity = { sourceSha: 'a'.repeat(40), version: '1.0.0', producerRunId: '12345', producerMode: 'prepare' };
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

async function fixture(mode: ProducerMode = 'prepare') {
  const base = await mkdtemp(join(tmpdir(), 'tenhaw-release-bundle-test-'));
  temporary.push(base);
  const directory = join(base, 'build'), bundleDirectory = join(base, 'bundle');
  await mkdir(directory);
  for (const path of expectedArchivePaths(identity.version)) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    // This layer validates immutable bytes. Package-content checks run before bundle creation.
    await writeFile(join(directory, path), `synthetic nonempty archive fixture: ${path}\n`);
  }
  await writeFile(join(directory, 'build-evidence.json'), '{"passed":true}\n');
  await writeFile(join(directory, '.env'), 'FIXTURE_ONLY=never-copy-unlisted-files\n');
  await writeFile(join(directory, 'release-source.json'), JSON.stringify({ commit: 'b'.repeat(40), version: '0.0.1' }));
  return { base, directory, bundleDirectory, expected: { ...identity, producerMode: mode } };
}
async function madeBundle(mode: ProducerMode = 'prepare') {
  const value = await fixture(mode);
  const manifest = await createBundle({ ...value.expected, directory: value.directory, bundleDirectory: value.bundleDirectory });
  return { ...value, manifest };
}
async function filesAt(directory: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) result.push(...await filesAt(join(directory, item.name), path));
    else result.push(path);
  }
  return result.sort();
}
function sourceInput(): SourceInput {
  return {
    runId: identity.producerRunId, sourceSha: identity.sourceSha, version: identity.version,
    run: { id: Number(identity.producerRunId), path: '.github/workflows/release.yml', event: 'workflow_dispatch', repository: { full_name: 'Tenhaw/tenhaw-kit' }, head_repository: { full_name: 'Tenhaw/tenhaw-kit' }, head_sha: identity.sourceSha, head_branch: 'main', status: 'completed', conclusion: 'success' },
    artifacts: [{ id: 67890, name: `verified-distributions-${identity.version}-${identity.sourceSha}`, expired: false, digest: `sha256:${'c'.repeat(64)}`, size_in_bytes: 1024, workflow_run: { id: Number(identity.producerRunId), head_sha: identity.sourceSha, head_branch: 'main' } }],
  };
}

describe('immutable release bundle', () => {
  it.each<ProducerMode>(['prepare', 'release'])('stages only the reviewed 17 archives for %s, with exact source/run/hash identity', async mode => {
    const value = await madeBundle(mode);
    const manifest = await verifyBundle({ ...value.expected, directory: value.bundleDirectory });
    expect(manifest).toEqual(value.manifest);
    expect(manifest).toMatchObject({ schemaVersion: 1, repository: 'Tenhaw/tenhaw-kit', sourceSha: identity.sourceSha, version: identity.version, producer: { runId: identity.producerRunId, mode } });
    expect(manifest.archives).toHaveLength(17);
    expect(manifest.archives.map(item => item.path).sort()).toEqual(expectedArchivePaths(identity.version));
    expect(await filesAt(value.bundleDirectory)).toEqual([...expectedArchivePaths(identity.version), 'release-bundle.json', 'release-source.json'].sort());
    expect(JSON.parse(await readFile(join(value.bundleDirectory, 'release-source.json'), 'utf8'))).toEqual({ commit: identity.sourceSha, version: identity.version });
    for (const archive of manifest.archives) {
      const bytes = await readFile(join(value.bundleDirectory, archive.path));
      expect(archive.size).toBe(bytes.length);
      expect(archive.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
    const staged = join(value.base, 'publisher-input');
    expect(await stageBundle({ ...value.expected, directory: value.bundleDirectory, bundleDirectory: staged })).toEqual(manifest);
    for (const file of await filesAt(staged)) expect(await readFile(join(staged, file))).toEqual(await readFile(join(value.bundleDirectory, file)));
  });

  it.each(['missing', 'empty', 'symlink'])('refuses to create a bundle with a %s expected build archive', async fault => {
    const value = await fixture();
    const path = join(value.directory, expectedArchivePaths(identity.version)[0]!);
    if (fault === 'empty') await writeFile(path, '');
    else {
      await unlink(path);
      if (fault === 'symlink') {
        const outside = join(value.base, 'outside-archive');
        await writeFile(outside, 'unlisted bytes');
        await symlink(outside, path);
      }
    }
    await expect(createBundle({ ...value.expected, directory: value.directory, bundleDirectory: value.bundleDirectory })).rejects.toThrow();
  });

  it.each(['missing', 'changed-size', 'same-size-tamper'])('rejects a %s bundle archive before staging publisher inputs', async fault => {
    const value = await madeBundle();
    const path = join(value.bundleDirectory, value.manifest.archives[0]!.path);
    if (fault === 'missing') await unlink(path);
    else if (fault === 'changed-size') await appendFile(path, 'changed');
    else {
      const bytes = await readFile(path); bytes[0] = bytes[0]! ^ 1; await writeFile(path, bytes);
    }
    await expect(verifyBundle({ ...value.expected, directory: value.bundleDirectory })).rejects.toThrow();
    await expect(stageBundle({ ...value.expected, directory: value.bundleDirectory, bundleDirectory: join(value.base, 'publisher-input') })).rejects.toThrow();
  });

  it.each(['extra.tgz', 'python/extra.whl', 'release-source.json.bak', 'python/nested/unlisted'])('rejects unlisted content %s', async extra => {
    const value = await madeBundle();
    await mkdir(dirname(join(value.bundleDirectory, extra)), { recursive: true });
    await writeFile(join(value.bundleDirectory, extra), 'unlisted');
    await expect(verifyBundle({ ...value.expected, directory: value.bundleDirectory })).rejects.toThrow();
  });

  it.each(['archive', 'python-directory'])('rejects a symlink replacing the %s even when bytes match', async target => {
    const value = await madeBundle();
    const source = target === 'archive' ? join(value.bundleDirectory, value.manifest.archives[0]!.path) : join(value.bundleDirectory, 'python');
    const outside = join(value.base, 'relocated');
    await rename(source, outside); await symlink(outside, source);
    await expect(verifyBundle({ ...value.expected, directory: value.bundleDirectory })).rejects.toThrow();
  });

  it.each(['release-bundle.json', 'release-source.json'])('rejects missing or malformed %s', async file => {
    const value = await madeBundle();
    const path = join(value.bundleDirectory, file);
    const original = await readFile(path);
    await unlink(path);
    await expect(verifyBundle({ ...value.expected, directory: value.bundleDirectory })).rejects.toThrow();
    await writeFile(path, '{invalid json');
    await expect(verifyBundle({ ...value.expected, directory: value.bundleDirectory })).rejects.toThrow();
    await writeFile(path, original);
    expect(await verifyBundle({ ...value.expected, directory: value.bundleDirectory })).toEqual(value.manifest);
  });

  const manifestFaults: [string, (manifest: any) => void][] = [
    ['unknown top-level field', m => { m.extra = true; }],
    ['unknown producer field', m => { m.producer.extra = true; }],
    ['wrong schema', m => { m.schemaVersion = 2; }],
    ['wrong repository', m => { m.repository = 'Other/tenhaw-kit'; }],
    ['wrong source SHA', m => { m.sourceSha = 'b'.repeat(40); }],
    ['wrong version', m => { m.version = '1.0.1'; }],
    ['wrong producer run', m => { m.producer.runId = '99999'; }],
    ['wrong producer mode', m => { m.producer.mode = 'release'; }],
    ['missing archive record', m => { m.archives.pop(); }],
    ['duplicate archive record', m => { m.archives[1] = m.archives[0]; }],
    ['extra archive record', m => { m.archives.push({ ...m.archives[0], path: 'extra.tgz' }); }],
    ['traversal path', m => { m.archives[0].path = '../outside.tgz'; }],
    ['absolute path', m => { m.archives[0].path = '/tmp/outside.tgz'; }],
    ['wrong hash', m => { m.archives[0].sha256 = '0'.repeat(64); }],
    ['malformed hash', m => { m.archives[0].sha256 = 'not-a-digest'; }],
    ['zero size', m => { m.archives[0].size = 0; }],
    ['string size', m => { m.archives[0].size = String(m.archives[0].size); }],
    ['unknown archive field', m => { m.archives[0].extra = true; }],
  ];
  it.each(manifestFaults)('rejects manifest %s', async (_name, mutate) => {
    const value = await madeBundle();
    const manifest = structuredClone(value.manifest); mutate(manifest);
    await writeFile(join(value.bundleDirectory, 'release-bundle.json'), JSON.stringify(manifest));
    await expect(verifyBundle({ ...value.expected, directory: value.bundleDirectory })).rejects.toThrow();
  });

  it('does not trust source metadata over the externally expected release identity', async () => {
    const value = await madeBundle();
    for (const source of [{ commit: 'b'.repeat(40), version: identity.version }, { commit: identity.sourceSha, version: '1.0.1' }, { commit: identity.sourceSha, version: identity.version, extra: true }]) {
      await writeFile(join(value.bundleDirectory, 'release-source.json'), JSON.stringify(source));
      await expect(verifyBundle({ ...value.expected, directory: value.bundleDirectory })).rejects.toThrow();
    }
  });

  it.each([{ sourceSha: 'b'.repeat(40) }, { version: '1.0.1' }, { producerRunId: '99999' }, { producerMode: 'release' as const }])('rejects an expected identity that differs from the bundle: %j', async change => {
    const value = await madeBundle();
    await expect(verifyBundle({ ...value.expected, ...change, directory: value.bundleDirectory })).rejects.toThrow();
  });

  it.each([{ sourceSha: '../escape' }, { version: '../escape' }, { producerRunId: '0' }, { producerRunId: '012345' }, { producerRunId: ' 12345' }, { producerRunId: '1e4' }, { producerMode: 'bootstrap' }])('rejects malformed external release identity %j', async change => {
    const value = await fixture();
    await expect(createBundle({ ...value.expected, ...change, directory: value.directory, bundleDirectory: value.bundleDirectory } as Parameters<BundleApi['createBundle']>[0])).rejects.toThrow();
  });

  it('never overwrites an existing staging destination', async () => {
    const value = await madeBundle();
    const output = join(value.base, 'existing'); await mkdir(output);
    await writeFile(join(output, 'keep'), 'retain this file');
    await expect(stageBundle({ ...value.expected, directory: value.bundleDirectory, bundleDirectory: output })).rejects.toThrow();
    expect(await readFile(join(output, 'keep'), 'utf8')).toBe('retain this file');
  });
});

describe('prepare run and artifact binding', () => {
  it('returns one immutable artifact ID and digest from the successful main-branch release workflow run', () => {
    const input = sourceInput();
    expect(validateSourceRun(input)).toEqual({ artifactId: '67890', artifactName: input.artifacts[0]!.name, artifactDigest: input.artifacts[0]!.digest });
  });
  const runFaults: [string, (run: SourceRun) => void][] = [
    ['wrong run ID', r => { r.id++; }],
    ['wrong workflow', r => { r.path = '.github/workflows/ci.yml'; }],
    ['pull-request event', r => { r.event = 'pull_request'; }],
    ['foreign repository', r => { r.repository.full_name = 'Other/tenhaw-kit'; }],
    ['fork source repository', r => { r.head_repository.full_name = 'Other/tenhaw-kit'; }],
    ['different source commit', r => { r.head_sha = 'b'.repeat(40); }],
    ['non-main branch', r => { r.head_branch = 'feature'; }],
    ['incomplete run', r => { r.status = 'in_progress'; }],
    ['failed run', r => { r.conclusion = 'failure'; }],
  ];
  it.each(runFaults)('rejects %s even if an expected-name artifact exists', (_name, mutate) => {
    const input = sourceInput(); mutate(input.run); expect(() => validateSourceRun(input)).toThrow();
  });
  const artifactFaults: [string, (artifact: SourceArtifact) => void][] = [
    ['invalid ID', a => { a.id = 0; }],
    ['unsafe ID', a => { a.id = Number.MAX_SAFE_INTEGER + 1; }],
    ['different name', a => { a.name += '-other'; }],
    ['expired artifact', a => { a.expired = true; }],
    ['missing SHA256 digest', a => { a.digest = ''; }],
    ['malformed SHA256 digest', a => { a.digest = 'sha256:bad'; }],
    ['empty artifact', a => { a.size_in_bytes = 0; }],
    ['different producer run', a => { a.workflow_run.id++; }],
    ['different artifact source SHA', a => { a.workflow_run.head_sha = 'b'.repeat(40); }],
    ['different artifact branch', a => { a.workflow_run.head_branch = 'feature'; }],
  ];
  it.each(artifactFaults)('rejects %s', (_name, mutate) => {
    const input = sourceInput(); mutate(input.artifacts[0]!); expect(() => validateSourceRun(input)).toThrow();
  });
  it.each(['missing', 'duplicate'])('rejects a %s expected artifact instead of choosing one implicitly', fault => {
    const input = sourceInput();
    input.artifacts = fault === 'missing' ? [] : [input.artifacts[0]!, structuredClone(input.artifacts[0]!)];
    expect(() => validateSourceRun(input)).toThrow();
  });
  it.each(['0', '012345', '-1', '1e4', '12345\n'])('rejects noncanonical requested run ID %j', runId => {
    expect(() => validateSourceRun({ ...sourceInput(), runId })).toThrow();
  });
});

function workflowJobs(text: string) {
  const section = text.split('\njobs:\n')[1];
  if (!section) throw new Error('Workflow jobs section missing');
  const entries = [...section.matchAll(/^  ([\w-]+):\s*$/gm)];
  return Object.fromEntries(entries.map((match, index) => [match[1]!, section.slice(match.index!, entries[index + 1]?.index ?? section.length)]));
}
function guarded(job: string, mode: string, sync = 'github-app', statuses: Record<string, string> = {}, cancelled = false) {
  const guard = job.match(/^    if:\s*\$\{\{\s*(.*?)\s*\}\}\s*$/m)?.[1];
  if (!guard) throw new Error('Publishing job must declare an explicit mode guard');
  // Evaluate only the small boolean grammar used by GitHub job gates, never workflow shell code.
  const tokens = [...guard.matchAll(/'[^']*'|inputs\.(?:mode|satellite_sync)|needs\.(?:publish-npm|publish-python|satellites)\.result|cancelled\(\)|&&|\|\||==|!|\(|\)|\s+/g)].map(match => match[0]);
  if (tokens.join('') !== guard) throw new Error('Unsupported job gate expression');
  const expression = tokens.map(token => {
    if (token.startsWith("'")) return JSON.stringify(token.slice(1, -1));
    if (token === 'inputs.mode') return JSON.stringify(mode);
    if (token === 'inputs.satellite_sync') return JSON.stringify(sync);
    if (token === 'cancelled()') return String(cancelled);
    if (token.startsWith('needs.')) return JSON.stringify(statuses[token.split('.')[1]!] ?? 'success');
    return token;
  }).join('');
  return Function(`return Boolean(${expression});`)() as boolean;
}
const workflowText = await readFile(join(root, '.github/workflows/release.yml'), 'utf8');
const jobs = workflowJobs(workflowText);

describe('staged release workflow boundaries', () => {
  it('defaults to preparation and requires explicit mode gates on every publisher', () => {
    const modeInput = workflowText.match(/^      mode:\n([\s\S]*?)(?=^      \w+:|^permissions:)/m)?.[1];
    expect(modeInput).toMatch(/^        default: prepare$/m);
    for (const mode of ['prepare', 'python-bootstrap', 'release', 'unknown']) {
      expect(guarded(jobs['publish-npm']!, mode), `npm mode=${mode}`).toBe(mode === 'release');
      expect(guarded(jobs['publish-python']!, mode), `PyPI mode=${mode}`).toBe(['release', 'python-bootstrap'].includes(mode));
      expect(guarded(jobs.satellites!, mode), `satellites mode=${mode}`).toBe(mode === 'release');
      expect(guarded(jobs['github-release']!, mode), `GitHub Release mode=${mode}`).toBe(mode === 'release');
    }
    expect(jobs.verify).not.toMatch(/^      id-token: write$/m);
    for (const name of ['publish-npm', 'publish-python']) {
      expect(jobs[name]).toMatch(/^    needs: verify$/m);
      expect(jobs[name]).toMatch(/^    environment: release$/m);
      expect(jobs[name]).toMatch(/^      id-token: write$/m);
    }
  });

  it('never records a release unless both package publishers and the selected satellite path succeeded', () => {
    const job = jobs['github-release']!;
    expect(guarded(job, 'release', 'owner-cli', { satellites: 'skipped' })).toBe(true);
    expect(guarded(job, 'release', 'github-app', { satellites: 'success' })).toBe(true);
    for (const provider of ['publish-npm', 'publish-python']) {
      for (const status of ['failure', 'skipped', 'cancelled']) expect(guarded(job, 'release', 'owner-cli', { [provider]: status, satellites: 'skipped' })).toBe(false);
    }
    expect(guarded(job, 'release', 'github-app', { satellites: 'skipped' })).toBe(false);
    expect(guarded(job, 'release', 'github-app', { satellites: 'failure' })).toBe(false);
    expect(guarded(job, 'release', 'owner-cli', { satellites: 'skipped' }, true)).toBe(false);
  });

  it('binds reused bytes to the successful run and exact artifact before staging without rebuilding', () => {
    const steps = jobs.verify!.split(/^      - /m).slice(1);
    const sourceIndex = steps.findIndex(step => step.includes('release-bundle.mjs check-run'));
    const downloadIndex = steps.findIndex(step => step.includes('artifact-ids:'));
    const stageIndex = steps.findIndex(step => step.includes('release-bundle.mjs stage'));
    expect(sourceIndex).toBeGreaterThanOrEqual(0);
    expect(downloadIndex).toBeGreaterThan(sourceIndex);
    expect(stageIndex).toBeGreaterThan(downloadIndex);
    expect(steps[sourceIndex]).toContain('--source-run-id "$SOURCE_RUN_ID" --source-sha "$GITHUB_SHA"');
    const download = steps[downloadIndex]!;
    expect(download).toContain('artifact-ids: ${{ steps.source.outputs.artifact_id }}');
    expect(download).toContain('run-id: ${{ inputs.source_run_id }}');
    expect(download).toContain('github-token: ${{ github.token }}');
    expect(download).toContain('digest-mismatch: error');
    expect(steps[stageIndex]).toContain('--producer-run-id "$SOURCE_RUN_ID" --producer-mode prepare');
    for (const step of steps.filter(step => step.includes('release-bundle.mjs create') || step.includes('uses: ./.github/actions/verify') || step.includes('scripts/publish.mjs --version "$RELEASE_VERSION" --dry-run'))) {
      expect(step).toContain("if: ${{ inputs.mode == 'prepare' }}");
    }
    expect(jobs.verify).toContain('[[ "$SOURCE_RUN_ID" =~ ^[1-9][0-9]*$ ]]');
  });

  it('verifies the immutable bundle before each publisher and fails on artifact digest mismatch', () => {
    for (const name of ['publish-npm', 'publish-python']) {
      const steps = jobs[name]!.split(/^      - /m).slice(1);
      const downloadIndex = steps.findIndex(step => step.includes('uses: actions/download-artifact@'));
      const verifyIndex = steps.findIndex(step => step.includes('release-bundle.mjs verify'));
      const publishIndex = steps.findIndex(step => name === 'publish-python' ? step.includes('uses: pypa/gh-action-pypi-publish@') : step.includes('run: node scripts/publish.mjs --version "$RELEASE_VERSION"\n'));
      expect(downloadIndex, name).toBeGreaterThanOrEqual(0);
      expect(verifyIndex, name).toBeGreaterThan(downloadIndex);
      expect(publishIndex, name).toBeGreaterThan(verifyIndex);
      expect(steps[downloadIndex], name).toContain('digest-mismatch: error');
      expect(steps[verifyIndex], name).toContain('--source-sha "$GITHUB_SHA"');
      expect(steps[verifyIndex], name).toContain('--producer-run-id "$SOURCE_RUN_ID" --producer-mode prepare');
    }
  });
});
