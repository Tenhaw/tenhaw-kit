import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const pythonProjects = ['tenhaw', 'tenhaw-ai-readiness', 'tenhaw-delivery-metrics', 'tenhaw-ai-roi'];
const publishPredicate = 'https://docs.pypi.org/attestations/publish/v1';
const archiveMetadata = `
import email.parser, json, sys, tarfile, zipfile
results = []
for filename in sys.argv[1:]:
    if filename.endswith('.whl'):
        with zipfile.ZipFile(filename) as archive:
            paths = [p for p in archive.namelist() if p.endswith('.dist-info/METADATA')]
            if len(paths) != 1 or paths[0].count('/') != 1:
                raise ValueError('Expected one top-level wheel METADATA')
            raw = archive.read(paths[0])
    else:
        with tarfile.open(filename, 'r:gz') as archive:
            paths = [p for p in archive.getmembers() if p.name.endswith('/PKG-INFO') and p.name.count('/') == 1]
            if len(paths) != 1 or not paths[0].isfile():
                raise ValueError('Expected one root sdist PKG-INFO')
            raw = archive.extractfile(paths[0]).read()
    metadata = email.parser.BytesParser().parsebytes(raw)
    if len(metadata.get_all('Name', [])) != 1 or len(metadata.get_all('Version', [])) != 1:
        raise ValueError('Expected single Name and Version headers')
    results.append({'name': metadata['Name'], 'version': metadata['Version']})
print(json.dumps(results))
`;
const normalise = name => name.toLowerCase().replace(/[-_.]+/g, '-');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function selectedPythonProjects(project = 'all') {
  if (project === 'all') return [...pythonProjects];
  if (!pythonProjects.includes(project)) throw new Error('Select --python-project all or one of the four Tenhaw Python projects.');
  return [project];
}

function filenames(name, version) {
  const distribution = name.replaceAll('-', '_');
  return [`${distribution}-${version}-py3-none-any.whl`, `${distribution}-${version}.tar.gz`];
}

async function requireDirectory(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Python release paths must be real directories, without symlinks.');
}

export async function loadPythonDistributions({ root = '.', version, project = 'all' }) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) throw new Error('Supply an exact reviewed Python release version.');
  const selected = selectedPythonProjects(project);
  const artifacts = join(resolve(root), 'artifacts');
  const directory = join(artifacts, 'python');
  await requireDirectory(artifacts);
  await requireDirectory(directory);
  const allowed = new Set(pythonProjects.flatMap(name => filenames(name, version)));
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !allowed.has(entry.name)) throw new Error(`Unexpected Python release artifact: ${entry.name}.`);
  }
  const present = new Set(entries.map(entry => entry.name));
  const distributions = [];
  for (const name of selected) {
    for (const filename of filenames(name, version)) {
      if (!present.has(filename)) throw new Error(`Missing expected Python distribution: ${filename}.`);
      const path = join(directory, filename);
      distributions.push({ name, version, filename, path, sha256: sha256(await readFile(path)) });
    }
  }
  let metadata;
  try {
    metadata = JSON.parse(execFileSync('python3', ['-c', archiveMetadata, ...distributions.map(file => file.path)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 }));
  } catch {
    throw new Error('Python release archive metadata is invalid or unreadable; python3 is required.');
  }
  for (const [index, file] of distributions.entries()) {
    if (normalise(metadata[index]?.name ?? '') !== file.name || metadata[index]?.version !== version) throw new Error(`Python archive metadata does not match ${file.name}@${version}: ${file.filename}.`);
  }
  return distributions;
}

export async function getRegistryJson(url, { missing = false } = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
  if (missing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Public registry returned HTTP ${response.status} for ${new URL(url).pathname}.`);
  return response.json();
}

function checkRegistryFiles(pkg, name, version, expected, requireComplete) {
  if (normalise(pkg?.info?.name ?? '') !== name || pkg?.info?.version !== version || !Array.isArray(pkg?.urls)) throw new Error(`Unexpected PyPI release metadata for ${name}@${version}.`);
  const seen = new Set();
  for (const remote of pkg.urls) {
    const local = expected.find(file => file.filename === remote.filename);
    if (!local || seen.has(remote.filename)) throw new Error(`PyPI contains an unexpected distribution for ${name}@${version}: ${remote.filename}.`);
    if (remote.digests?.sha256 !== local.sha256) throw new Error(`PyPI integrity mismatch for ${remote.filename}. An immutable different file already exists.`);
    if (remote.yanked) throw new Error(`PyPI distribution is yanked: ${remote.filename}. Review the release before retrying.`);
    seen.add(remote.filename);
  }
  if (requireComplete && expected.some(file => !seen.has(file.filename))) throw new Error(`PyPI has not exposed both expected distributions for ${name}@${version}.`);
}

export async function preparePythonRelease({ root = '.', version, project = 'all', getJson = getRegistryJson }) {
  const distributions = await loadPythonDistributions({ root, version, project });
  const selected = selectedPythonProjects(project);
  // Finish every registry conflict check before staging any publishable files.
  for (const name of selected) {
    const existing = await getJson(`https://pypi.org/pypi/${name}/${version}/json`, { missing: true });
    if (existing !== null) checkRegistryFiles(existing, name, version, distributions.filter(file => file.name === name), false);
  }
  const artifacts = join(resolve(root), 'artifacts');
  const destination = join(artifacts, 'python-publish');
  try { await requireDirectory(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = await mkdtemp(join(artifacts, 'python-publish-'));
  try {
    for (const file of distributions) {
      const path = join(temporary, file.filename);
      await copyFile(file.path, path);
      if (sha256(await readFile(path)) !== file.sha256) throw new Error(`Python source artifact changed during staging: ${file.filename}.`);
    }
    await rm(destination, { recursive: true, force: true });
    await rename(temporary, destination);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return { directory: destination, projects: selected, distributions: distributions.map(({ name, filename, sha256 }) => ({ name, filename, sha256 })) };
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function base64String(value) {
  return typeof value === 'string' && value.length > 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value) && Buffer.from(value, 'base64').toString('base64') === value;
}
function checkAttestation(provenance, file) {
  const verified = provenance?.version === 1 && Array.isArray(provenance.attestation_bundles) && provenance.attestation_bundles.some(bundle => {
    if (!record(bundle)) return false;
    const publisher = bundle.publisher;
    if (publisher?.kind !== 'GitHub' || typeof publisher.repository !== 'string' || publisher.repository.toLowerCase() !== 'tenhaw/tenhaw-kit' || publisher.workflow !== 'release.yml' || typeof publisher.environment !== 'string' || publisher.environment.toLowerCase() !== 'release') return false;
    return Array.isArray(bundle.attestations) && bundle.attestations.some(attestation => {
      if (!record(attestation) || attestation.version !== 1 || !record(attestation.envelope) || !record(attestation.verification_material)) return false;
      const envelope = attestation.envelope, material = attestation.verification_material;
      if (!base64String(envelope.signature) || !base64String(envelope.statement) || !base64String(material.certificate) || !Array.isArray(material.transparency_entries) || !material.transparency_entries.length || !material.transparency_entries.every(entry => record(entry) && Object.keys(entry).length > 0)) return false;
      try {
        const statement = JSON.parse(Buffer.from(envelope.statement, 'base64').toString('utf8'));
        return statement?._type === 'https://in-toto.io/Statement/v1' && statement.predicateType === publishPredicate && Array.isArray(statement.subject) && statement.subject.length === 1 && statement.subject[0]?.name === file.filename && statement.subject[0].digest?.sha256 === file.sha256;
      } catch { return false; }
    });
  });
  if (!verified) throw new Error(`Missing matching PyPI publish attestation from the protected release publisher for ${file.filename}.`);
}

export async function verifyPythonRelease({ root = '.', version, project = 'all', getJson = getRegistryJson, retry = operation => operation() }) {
  const distributions = await loadPythonDistributions({ root, version, project });
  const selected = selectedPythonProjects(project);
  const observations = [];
  for (const name of selected) {
    const expected = distributions.filter(file => file.name === name);
    await retry(async () => {
      const pkg = await getJson(`https://pypi.org/pypi/${name}/${version}/json`);
      checkRegistryFiles(pkg, name, version, expected, true);
      for (const file of expected) {
        const provenance = await getJson(`https://pypi.org/integrity/${name}/${version}/${encodeURIComponent(file.filename)}/provenance`);
        checkAttestation(provenance, file);
      }
    });
    observations.push({ name, version, distributions: expected.map(({ filename, sha256 }) => ({ filename, sha256, attestations: true })) });
  }
  const evidence = { version, scope: project === 'all' ? 'all' : 'selected-project', selectedProject: project === 'all' ? null : project, allPythonProjectsVerified: project === 'all', attestationCheck: 'PyPI Integrity API publisher and publish statement subject', packages: observations };
  await mkdir(join(resolve(root), 'artifacts'), { recursive: true });
  await writeFile(join(resolve(root), 'artifacts/pypi-verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}
