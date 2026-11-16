import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'Tenhaw/tenhaw-kit';
const workflowPath = '.github/workflows/release.yml';
const manifestFile = 'release-bundle.json';
const sourceFile = 'release-source.json';
const npmNames = ['tenhaw', 'create-tenhaw', '@tenhaw/core', '@tenhaw/ai-readiness', '@tenhaw/delivery-metrics', '@tenhaw/ai-roi', '@tenhaw/usecase-register', '@tenhaw/opmodel', '@tenhaw/mcp'];
const pythonNames = ['tenhaw', 'tenhaw-ai-readiness', 'tenhaw-delivery-metrics', 'tenhaw-ai-roi'];
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const runPattern = /^[1-9]\d*$/;
const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
function keys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) fail(`Invalid ${label} fields.`);
}
function identity({ sourceSha, version, producerRunId, producerMode }) {
  if (!shaPattern.test(sourceSha ?? '')) fail('Supply the exact lowercase source commit SHA.');
  if (!versionPattern.test(version ?? '')) fail('Supply the exact reviewed release version.');
  if (typeof producerRunId !== 'string' || !runPattern.test(producerRunId)) fail('Supply a canonical positive producer run ID.');
  if (!['prepare', 'release'].includes(producerMode)) fail('Only prepare or release can produce a bundle.');
}
export function expectedArchivePaths(version) {
  if (!versionPattern.test(version ?? '')) fail('Invalid archive version.');
  return [
    ...npmNames.map(name => `${name.replace('@', '').replaceAll('/', '-')}-${version}.tgz`),
    ...pythonNames.flatMap(name => {
      const prefix = `${name.replaceAll('-', '_')}-${version}`;
      return [`python/${prefix}-py3-none-any.whl`, `python/${prefix}.tar.gz`];
    }),
  ].sort();
}
async function directoryOnly(directory) {
  const stat = await lstat(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('Bundle directory must be a real directory.');
}
async function fileBytes(directory, path) {
  const location = join(directory, path);
  const stat = await lstat(location);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size <= 0 || stat.size > 100 * 1024 * 1024) fail(`Invalid bundle file: ${path}.`);
  const bytes = await readFile(location);
  if (bytes.length !== stat.size) fail(`Bundle file changed while reading: ${path}.`);
  return bytes;
}
async function inventory(directory, prefix = '') {
  await directoryOnly(directory);
  const files = [];
  for (const name of await readdir(directory)) {
    const path = `${prefix}${name}`;
    const stat = await lstat(join(directory, name));
    if (stat.isSymbolicLink()) fail(`Symlink in release bundle: ${path}.`);
    if (stat.isDirectory()) {
      if (path !== 'python') fail(`Unexpected bundle directory: ${path}.`);
      files.push(...await inventory(join(directory, name), 'python/'));
    } else if (stat.isFile()) files.push(path);
    else fail(`Unexpected bundle entry: ${path}.`);
  }
  return files.sort();
}
function validateManifest(manifest, expected) {
  identity(expected);
  keys(manifest, ['schemaVersion', 'repository', 'sourceSha', 'version', 'producer', 'archives'], 'bundle manifest');
  keys(manifest.producer, ['runId', 'mode'], 'bundle producer');
  if (manifest.schemaVersion !== 1 || manifest.repository !== repository || manifest.sourceSha !== expected.sourceSha || manifest.version !== expected.version || manifest.producer.runId !== expected.producerRunId || manifest.producer.mode !== expected.producerMode) fail('Release bundle source, version or producer identity mismatch.');
  const paths = expectedArchivePaths(expected.version);
  if (!Array.isArray(manifest.archives) || manifest.archives.length !== paths.length) fail('Release bundle must contain exactly 17 archive records.');
  for (const [index, archive] of manifest.archives.entries()) {
    keys(archive, ['path', 'sha256', 'size'], 'archive');
    if (archive.path !== paths[index] || !digestPattern.test(archive.sha256 ?? '') || !Number.isSafeInteger(archive.size) || archive.size <= 0 || archive.size > 100 * 1024 * 1024) fail('Invalid, duplicated or unexpected release archive record.');
  }
}
async function writeBundle(directory, files) {
  await mkdir(directory);
  await mkdir(join(directory, 'python'));
  for (const [path, bytes] of files) await writeFile(join(directory, path), bytes, { flag: 'wx' });
}
export async function createBundle(options) {
  identity(options);
  await directoryOnly(options.directory);
  await directoryOnly(join(options.directory, 'python'));
  const files = new Map();
  const archives = [];
  for (const path of expectedArchivePaths(options.version)) {
    const bytes = await fileBytes(options.directory, path);
    files.set(path, bytes);
    archives.push({ path, sha256: sha256(bytes), size: bytes.length });
  }
  const manifest = { schemaVersion: 1, repository, sourceSha: options.sourceSha, version: options.version, producer: { runId: options.producerRunId, mode: options.producerMode }, archives };
  files.set(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  files.set(sourceFile, JSON.stringify({ commit: options.sourceSha, version: options.version }) + '\n');
  await writeBundle(options.bundleDirectory, files);
  await verifyBundle({ ...options, directory: options.bundleDirectory });
  return manifest;
}
export async function verifyBundle(options) {
  identity(options);
  const expectedFiles = [...expectedArchivePaths(options.version), manifestFile, sourceFile].sort();
  if (JSON.stringify(await inventory(options.directory)) !== JSON.stringify(expectedFiles)) fail('Release bundle contains missing or unexpected files.');
  const manifest = JSON.parse((await fileBytes(options.directory, manifestFile)).toString('utf8'));
  validateManifest(manifest, options);
  const source = JSON.parse((await fileBytes(options.directory, sourceFile)).toString('utf8'));
  keys(source, ['commit', 'version'], 'source identity');
  if (source.commit !== options.sourceSha || source.version !== options.version) fail('Release source identity mismatch.');
  for (const archive of manifest.archives) {
    const bytes = await fileBytes(options.directory, archive.path);
    if (bytes.length !== archive.size || sha256(bytes) !== archive.sha256) fail(`Release archive integrity mismatch: ${archive.path}.`);
  }
  return manifest;
}
export async function stageBundle(options) {
  const manifest = await verifyBundle(options);
  const files = new Map();
  for (const path of [...expectedArchivePaths(options.version), manifestFile, sourceFile]) files.set(path, await fileBytes(options.directory, path));
  await writeBundle(options.bundleDirectory, files);
  await verifyBundle({ ...options, directory: options.bundleDirectory });
  return manifest;
}
export function validateSourceRun({ run, artifacts, sourceSha, version, runId }) {
  identity({ sourceSha, version, producerRunId: runId, producerMode: 'prepare' });
  if (!run || String(run.id) !== runId || run.repository?.full_name !== repository || run.head_repository?.full_name !== repository || run.path !== workflowPath || run.event !== 'workflow_dispatch' || run.head_branch !== 'main' || run.head_sha !== sourceSha || run.status !== 'completed' || run.conclusion !== 'success') fail('Source bundle must come from a successful release.yml prepare run on this exact reviewed main commit.');
  const artifactName = `verified-distributions-${version}-${sourceSha}`;
  const matches = Array.isArray(artifacts) ? artifacts.filter(artifact => artifact.name === artifactName) : [];
  if (matches.length !== 1) fail('Expected one immutable source distribution artifact.');
  const artifact = matches[0];
  if (!Number.isSafeInteger(artifact.id) || artifact.id <= 0 || artifact.expired !== false || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') || String(artifact.workflow_run?.id) !== runId || artifact.workflow_run?.head_branch !== 'main' || artifact.workflow_run?.head_sha !== sourceSha) fail('Source artifact identity, digest or availability is invalid.');
  return { artifactId: String(artifact.id), artifactName, artifactDigest: artifact.digest };
}
async function githubJson(path) {
  const token = process.env.GH_TOKEN;
  if (!token) fail('GitHub read token is required for source-run verification.');
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) fail(`GitHub source-run verification returned HTTP ${response.status}.`);
  return response.json();
}
async function checkSourceRun(options) {
  const runId = options.sourceRunId;
  identity({ ...options, producerRunId: runId, producerMode: 'prepare' });
  const run = await githubJson(`actions/runs/${runId}`);
  const artifacts = [];
  for (let page = 1; page <= 20; page++) {
    const response = await githubJson(`actions/runs/${runId}/artifacts?per_page=100&page=${page}`);
    if (!Array.isArray(response.artifacts) || !Number.isSafeInteger(response.total_count) || response.total_count > 2000) fail('Invalid source artifact inventory.');
    artifacts.push(...response.artifacts);
    if (artifacts.length >= response.total_count) break;
    if (page === 20) fail('Source artifact inventory is incomplete.');
  }
  const result = validateSourceRun({ run, artifacts, sourceSha: options.sourceSha, version: options.version, runId });
  if (!process.env.GITHUB_OUTPUT) fail('Source-run verification must expose its result through GitHub Actions outputs.');
  await writeFile(process.env.GITHUB_OUTPUT, `artifact_id=${result.artifactId}\nartifact_name=${result.artifactName}\nartifact_digest=${result.artifactDigest}\n`, { flag: 'a' });
  console.log(`Verified source run ${runId} and immutable distribution artifact ${result.artifactId}.`);
}
async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  const allowed = new Set(['--directory', '--bundle-directory', '--source-sha', '--version', '--producer-run-id', '--producer-mode', '--source-run-id']);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!allowed.has(key) || args[index + 1] === undefined || Object.hasOwn(values, key)) fail('Invalid or duplicated bundle command argument.');
    values[key] = args[index + 1];
  }
  const options = { directory: values['--directory'], bundleDirectory: values['--bundle-directory'], sourceSha: values['--source-sha'], version: values['--version'], producerRunId: values['--producer-run-id'], producerMode: values['--producer-mode'], sourceRunId: values['--source-run-id'] };
  if (command === 'check-run') return checkSourceRun(options);
  if (!options.directory || (['create', 'stage'].includes(command) && !options.bundleDirectory)) fail('Supply the bundle input and output directories.');
  const operation = { create: createBundle, verify: verifyBundle, stage: stageBundle }[command];
  if (!operation) fail('Choose create, verify, stage or check-run.');
  await operation(options);
  console.log(`Release bundle ${command} passed: 17 archive hashes, exact source and producer identity.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
