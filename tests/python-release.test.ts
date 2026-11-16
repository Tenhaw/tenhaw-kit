import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadPythonDistributions, preparePythonRelease, pythonProjects, selectedPythonProjects, verifyPythonRelease, type PythonDistribution } from '../scripts/python-release.mjs';

const version = '1.0.0', project = 'tenhaw-ai-readiness';
const makeArchives = `
import io, json, pathlib, sys, tarfile, zipfile
root = pathlib.Path(sys.argv[1]) / 'artifacts' / 'python'
root.mkdir(parents=True)
for name in json.loads(sys.argv[2]):
    distribution = name.replace('-', '_')
    prefix = distribution + '-1.0.0'
    metadata = ('Metadata-Version: 2.4\\nName: ' + name + '\\nVersion: 1.0.0\\n').encode()
    with zipfile.ZipFile(root / (prefix + '-py3-none-any.whl'), 'w') as archive:
        archive.writestr(prefix + '.dist-info/METADATA', metadata)
    with tarfile.open(root / (prefix + '.tar.gz'), 'w:gz') as archive:
        member = tarfile.TarInfo(prefix + '/PKG-INFO')
        member.size = len(metadata)
        archive.addfile(member, io.BytesIO(metadata))
`;
function registry(name: string, files: PythonDistribution[]) {
  return { info: { name, version }, urls: files.filter(file => file.name === name).map(file => ({ filename: file.filename, digests: { sha256: file.sha256 }, yanked: false })) };
}
function provenance(file: PythonDistribution) {
  return { version: 1, attestation_bundles: [{ publisher: { kind: 'GitHub', repository: 'Tenhaw/tenhaw-kit', workflow: 'release.yml', environment: 'release' }, attestations: [{ version: 1, envelope: { signature: Buffer.from('fixture-signature').toString('base64'), statement: Buffer.from(JSON.stringify({ _type: 'https://in-toto.io/Statement/v1', predicateType: 'https://docs.pypi.org/attestations/publish/v1', subject: [{ name: file.filename, digest: { sha256: file.sha256 } }] })).toString('base64') }, verification_material: { certificate: Buffer.from('fixture-certificate').toString('base64'), transparency_entries: [{ fixture: true }] } }] }] };
}
function visibilityClock() {
  let current = 0;
  const pauses: number[] = [], reports: string[] = [];
  return {
    now: () => current,
    pause: async (milliseconds: number) => { pauses.push(milliseconds); current += milliseconds; },
    report: (message: string) => { reports.push(message); },
    pauses, reports,
  };
}

describe('Python release preparation and exact verification', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tenhaw-python-release-test-'));
    execFileSync('python3', ['-c', makeArchives, root, JSON.stringify(pythonProjects)], { stdio: 'pipe' });
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  const options = () => ({ root, version, project, ...visibilityClock() });

  it('stages only the selected pair from the frozen four-project bundle', async () => {
    const requests: string[] = [];
    const result = await preparePythonRelease({ ...options(), getJson: async url => { requests.push(url); return null; } });
    expect(result.projects).toEqual([project]);
    expect(await readdir(result.directory)).toEqual(result.distributions.map(file => file.filename).sort());
    expect(result.distributions).toHaveLength(2);
    expect(await readdir(join(root, 'artifacts/python'))).toHaveLength(8);
    expect(requests).toEqual([`https://pypi.org/pypi/${project}/${version}/json`]);
  });

  it('rejects missing archives before touching the registry or staging', async () => {
    await rm(join(root, 'artifacts/python/tenhaw_ai_readiness-1.0.0.tar.gz'));
    let requested = false;
    await expect(preparePythonRelease({ ...options(), getJson: async () => { requested = true; return null; } })).rejects.toThrow('Missing expected Python distribution');
    expect(requested).toBe(false);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it('checks archive metadata rather than trusting a filename', async () => {
    execFileSync('python3', ['-c', `import sys,zipfile\np=sys.argv[1]\nwith zipfile.ZipFile(p,'w') as z:z.writestr('tenhaw_ai_readiness-1.0.0.dist-info/METADATA','Name: another-project\\nVersion: 1.0.0\\n')`, join(root, 'artifacts/python/tenhaw_ai_readiness-1.0.0-py3-none-any.whl')]);
    await expect(loadPythonDistributions(options())).rejects.toThrow('metadata does not match');
  });

  it('rejects unknown selectors, unexpected artifacts and symlink output paths', async () => {
    expect(() => selectedPythonProjects('../../elsewhere')).toThrow('four Tenhaw Python projects');
    await writeFile(join(root, 'artifacts/python/unreviewed.whl'), 'unreviewed');
    await expect(loadPythonDistributions(options())).rejects.toThrow('Unexpected Python release artifact');
    await rm(join(root, 'artifacts/python/unreviewed.whl'));
    await symlink(join(root, 'artifacts/python'), join(root, 'artifacts/python-publish'));
    await expect(preparePythonRelease({ ...options(), getJson: async () => null })).rejects.toThrow('without symlinks');
    expect(await readdir(join(root, 'artifacts/python'))).toHaveLength(8);
  });

  it('does not interpret a missing explicit selector value as all projects', () => {
    try {
      execFileSync(process.execPath, ['scripts/publish.mjs', '--version', version, '--prepare-python', '--python-project'], { stdio: 'pipe' });
      throw new Error('Expected invalid selector to fail before registry access');
    } catch (error) {
      expect(String((error as { stderr?: Buffer }).stderr)).toContain('--python-project requires an explicit project name or all');
    }
  });

  it('allows a matching registry subset for recovery and replaces stale staging safely', async () => {
    const files = await loadPythonDistributions(options());
    const existing = registry(project, [files[0]]);
    await preparePythonRelease({ ...options(), project: 'tenhaw', getJson: async () => null });
    const result = await preparePythonRelease({ ...options(), getJson: async () => existing });
    expect(await readdir(result.directory)).toEqual(files.map(file => file.filename).sort());
  });

  it.each(['hash', 'extra', 'yanked'] as const)('rejects a registry %s conflict before changing staging', async kind => {
    const files = await loadPythonDistributions(options());
    const existing = registry(project, files);
    if (kind === 'hash') existing.urls[0].digests.sha256 = '0'.repeat(64);
    if (kind === 'extra') existing.urls.push({ filename: 'unreviewed.whl', digests: { sha256: files[0].sha256 }, yanked: false });
    if (kind === 'yanked') existing.urls[0].yanked = true;
    await expect(preparePythonRelease({ ...options(), getJson: async () => existing })).rejects.toThrow(/mismatch|unexpected distribution|yanked/);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it('checks every selected project for conflicts before staging any files', async () => {
    const files = await loadPythonDistributions({ root, version, project: 'all' });
    const requests: string[] = [];
    await expect(preparePythonRelease({ root, version, project: 'all', getJson: async url => {
      const name = new URL(url).pathname.split('/')[2]; requests.push(name);
      const existing = registry(name, files);
      if (name === pythonProjects.at(-1)) existing.urls[0].digests.sha256 = '0'.repeat(64);
      return existing;
    } })).rejects.toThrow('integrity mismatch');
    expect(requests).toEqual(pythonProjects);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it('does not verify a release with only a wheel even if that wheel matches', async () => {
    const files = await loadPythonDistributions(options());
    const time = visibilityClock();
    await expect(verifyPythonRelease({ ...options(), ...time, getJson: async () => registry(project, [files[0]]) })).rejects.toThrow('Timed out waiting for PyPI');
    expect(time.now()).toBe(600_000);
    expect(time.pauses).toHaveLength(40);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it('writes truthful selected-project evidence after checking both files and attestations', async () => {
    const files = await loadPythonDistributions(options());
    const requested: string[] = [];
    const evidence = await verifyPythonRelease({ ...options(), getJson: async url => {
      requested.push(url);
      const file = files.find(file => url.includes(`/${file.filename}/`));
      return file ? provenance(file) : registry(project, files);
    } });
    expect(evidence.scope).toBe('selected-project');
    expect(evidence.allPythonProjectsVerified).toBe(false);
    expect(evidence.selectedProject).toBe(project);
    expect(evidence.packages).toHaveLength(1);
    expect(evidence.packages[0].distributions).toHaveLength(2);
    expect(requested.filter(url => url.includes('/integrity/'))).toHaveLength(2);
    expect(JSON.parse(await readFile(join(root, 'artifacts/pypi-verification.json'), 'utf8'))).toEqual(evidence);
  });

  it.each(['missing', 'publisher', 'subject'] as const)('rejects %s attestations', async kind => {
    const files = await loadPythonDistributions(options());
    const time = visibilityClock();
    await expect(verifyPythonRelease({ ...options(), ...time, getJson: async url => {
      const file = files.find(file => url.includes(`/${file.filename}/`));
      if (!file) return registry(project, files);
      const result = provenance(file);
      if (kind === 'missing') result.attestation_bundles = [];
      if (kind === 'publisher') result.attestation_bundles[0].publisher.environment = 'another-environment';
      if (kind === 'subject') result.attestation_bundles[0].attestations[0].envelope.statement = Buffer.from(JSON.stringify({ subject: [{ name: file.filename, digest: { sha256: '0'.repeat(64) } }] })).toString('base64');
      return result;
    } })).rejects.toThrow('Missing matching PyPI publish attestation');
    expect(time.pauses).toEqual([]);
  });

  const malformedEncodings: [string, string, unknown][] = [
    ['signature', 'object', { malformed: true }],
    ['signature', 'empty', ''],
    ['signature', 'invalid-base64', 'invalid-signature'],
    ['certificate', 'object', { malformed: true }],
    ['certificate', 'invalid-base64', 'invalid-certificate'],
    ['statement', 'object', { malformed: true }],
    ['statement', 'invalid-base64', '!'],
    ['transparency_entries', 'string', 'not-an-array'],
    ['transparency_entries', 'length-object', { length: 1 }],
    ['transparency_entries', 'empty-array', []],
    ['transparency_entries', 'null-entry', [null]],
    ['transparency_entries', 'array-entry', [[]]],
    ['transparency_entries', 'boolean-entry', [true]],
    ['transparency_entries', 'empty-object-entry', [{}]],
  ];
  it.each(malformedEncodings)('rejects malformed %s (%s) before writing evidence', async (field, _label, value) => {
    const files = await loadPythonDistributions(options());
    const time = visibilityClock();
    await expect(verifyPythonRelease({ ...options(), ...time, getJson: async url => {
      const file = files.find(file => url.includes(`/${file.filename}/`));
      if (!file) return registry(project, files);
      const result = provenance(file), attestation = result.attestation_bundles[0].attestations[0];
      Reflect.set(field === 'signature' || field === 'statement' ? attestation.envelope : attestation.verification_material, field, value);
      return result;
    } })).rejects.toThrow('Missing matching PyPI publish attestation');
    expect(time.pauses).toEqual([]);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it('only marks all Python projects verified after all eight expected files pass', async () => {
    const files = await loadPythonDistributions({ root, version, project: 'all' });
    const evidence = await verifyPythonRelease({ root, version, project: 'all', getJson: async url => {
      const file = files.find(file => url.includes(`/${file.filename}/`));
      return file ? provenance(file) : registry(new URL(url).pathname.split('/')[2], files);
    } });
    expect(evidence.scope).toBe('all');
    expect(evidence.allPythonProjectsVerified).toBe(true);
    expect(evidence.selectedProject).toBeNull();
    expect(evidence.packages).toHaveLength(4);
  });

  it('waits beyond the original 25-second window for release JSON visibility without changing archives or staging uploads', async () => {
    const files = await loadPythonDistributions(options()), time = visibilityClock();
    const requests: { url: string; at: number }[] = [];
    const evidence = await verifyPythonRelease({ ...options(), ...time, getJson: async (url, requestOptions) => {
      expect(requestOptions?.missing).toBe(true);
      requests.push({ url, at: time.now() });
      const file = files.find(file => url.includes(`/${file.filename}/`));
      return file ? provenance(file) : time.now() < 45_000 ? null : registry(project, files);
    } });
    expect(time.pauses).toEqual([15_000, 15_000, 15_000]);
    expect(requests.filter(request => !request.url.includes('/integrity/')).map(request => request.at)).toEqual([0, 15_000, 30_000, 45_000]);
    expect(requests.filter(request => request.url.includes('/integrity/'))).toHaveLength(2);
    expect(evidence.selectedProject).toBe(project);
    expect(await loadPythonDistributions(options())).toEqual(files);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['pypi-verification.json', 'python']);
  });

  it('waits for a complete matching archive pair before requesting attestations', async () => {
    const files = await loadPythonDistributions(options()), time = visibilityClock();
    const provenanceTimes: number[] = [];
    await verifyPythonRelease({ ...options(), ...time, getJson: async url => {
      const file = files.find(file => url.includes(`/${file.filename}/`));
      if (file) { provenanceTimes.push(time.now()); return provenance(file); }
      return registry(project, time.now() === 0 ? [files[0]] : files);
    } });
    expect(time.pauses).toEqual([15_000]);
    expect(provenanceTimes).toEqual([15_000, 15_000]);
  });

  it('waits for pending provenance 404s after matching archives become visible', async () => {
    const files = await loadPythonDistributions(options()), time = visibilityClock();
    let provenanceReads = 0;
    const evidence = await verifyPythonRelease({ ...options(), ...time, getJson: async (url, requestOptions) => {
      expect(requestOptions?.missing).toBe(true);
      const file = files.find(file => url.includes(`/${file.filename}/`));
      if (!file) return registry(project, files);
      provenanceReads++;
      return time.now() < 30_000 ? null : provenance(file);
    } });
    expect(time.pauses).toEqual([15_000, 15_000]);
    expect(provenanceReads).toBe(6);
    expect(evidence.packages[0].distributions.every(file => file.attestations)).toBe(true);
  });

  it('shares one deadline across all four projects and does not recheck completed projects', async () => {
    const files = await loadPythonDistributions({ root, version, project: 'all' }), time = visibilityClock();
    const reads: { name: string; at: number }[] = [];
    const evidence = await verifyPythonRelease({ root, version, project: 'all', ...time, getJson: async url => {
      const file = files.find(file => url.includes(`/${file.filename}/`));
      if (file) return provenance(file);
      const name = new URL(url).pathname.split('/')[2], index = pythonProjects.indexOf(name);
      reads.push({ name, at: time.now() });
      return time.now() < index * 15_000 ? null : registry(name, files);
    } });
    expect(reads.filter(read => read.at === 0).map(read => read.name)).toEqual(pythonProjects);
    expect(reads.filter(read => read.name === pythonProjects[0])).toHaveLength(1);
    expect(reads.filter(read => read.name === pythonProjects[3])).toHaveLength(4);
    expect(time.now()).toBe(45_000);
    expect(evidence.allPythonProjectsVerified).toBe(true);
    expect(evidence.packages).toHaveLength(4);
  });

  it('bounds permanent 404s for all projects by one deadline and leaves success evidence unwritten', async () => {
    const time = visibilityClock(); let reads = 0;
    await expect(verifyPythonRelease({ root, version, project: 'all', ...time, timeoutMs: 35_000, getJson: async () => { reads++; return null; } })).rejects.toThrow('do not rebuild or repeat accepted uploads');
    expect(time.pauses).toEqual([15_000, 15_000, 5_000]);
    expect(time.now()).toBe(35_000);
    expect(reads).toBe(12);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it.each(['name', 'version', 'hash', 'unexpected-file', 'duplicate-file', 'yanked', 'format'] as const)('fails immediately on a %s metadata conflict without treating it as propagation', async kind => {
    const files = await loadPythonDistributions(options()), time = visibilityClock();
    const value = registry(project, files);
    if (kind === 'name') value.info.name = 'another-project';
    if (kind === 'version') value.info.version = '1.0.1';
    if (kind === 'hash') value.urls[0].digests.sha256 = '0'.repeat(64);
    if (kind === 'unexpected-file') value.urls[0].filename = 'unreviewed.whl';
    if (kind === 'duplicate-file') value.urls[1] = value.urls[0];
    if (kind === 'yanked') value.urls[0].yanked = true;
    if (kind === 'format') Reflect.set(value, 'urls', {});
    let reads = 0;
    await expect(verifyPythonRelease({ ...options(), ...time, getJson: async () => { reads++; return value; } })).rejects.toThrow(/metadata|integrity|unexpected distribution|yanked/i);
    expect(time.pauses).toEqual([]);
    expect(reads).toBe(1);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it.each(['metadata', 'provenance'] as const)('does not retry a non-404 %s API failure', async endpoint => {
    const files = await loadPythonDistributions(options()), time = visibilityClock();
    const failure = new Error('Registry HTTP 503');
    await expect(verifyPythonRelease({ ...options(), ...time, getJson: async url => {
      if (endpoint === 'metadata' || url.includes('/integrity/')) throw failure;
      return registry(project, files);
    } })).rejects.toBe(failure);
    expect(time.pauses).toEqual([]);
    expect(await readdir(join(root, 'artifacts'))).toEqual(['python']);
  });

  it.each([{ timeoutMs: 0 }, { intervalMs: 0 }, { timeoutMs: Infinity }, { intervalMs: NaN }])('rejects invalid visibility bounds %j before registry access', async bounds => {
    let requested = false;
    await expect(verifyPythonRelease({ ...options(), ...bounds, getJson: async () => { requested = true; return null; } })).rejects.toThrow('Invalid PyPI visibility poll configuration');
    expect(requested).toBe(false);
  });

  it.each([{ values: [NaN] }, { values: [0, NaN] }, { values: [0, 0, NaN] }])('rejects an invalid visibility clock $values', async ({ values }) => {
    let index = 0; const time = visibilityClock();
    await expect(verifyPythonRelease({ ...options(), ...time, now: () => values[Math.min(index++, values.length - 1)], getJson: async () => null })).rejects.toThrow(/clock|deadline/);
    expect(time.pauses).toEqual([]);
  });
});
