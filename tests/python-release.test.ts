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
  return { version: 1, attestation_bundles: [{ publisher: { kind: 'GitHub', repository: 'Tenhaw/tenhaw-kit', workflow: 'release.yml', environment: 'release' }, attestations: [{ version: 1, envelope: { signature: 'fixture-signature', statement: Buffer.from(JSON.stringify({ _type: 'https://in-toto.io/Statement/v1', predicateType: 'https://docs.pypi.org/attestations/publish/v1', subject: [{ name: file.filename, digest: { sha256: file.sha256 } }] })).toString('base64') }, verification_material: { certificate: 'fixture-certificate', transparency_entries: [{ fixture: true }] } }] }] };
}

describe('Python release preparation and exact verification', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tenhaw-python-release-test-'));
    execFileSync('python3', ['-c', makeArchives, root, JSON.stringify(pythonProjects)], { stdio: 'pipe' });
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });
  const options = () => ({ root, version, project });

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
    await expect(verifyPythonRelease({ ...options(), getJson: async () => registry(project, [files[0]]) })).rejects.toThrow('both expected distributions');
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
    await expect(verifyPythonRelease({ ...options(), getJson: async url => {
      const file = files.find(file => url.includes(`/${file.filename}/`));
      if (!file) return registry(project, files);
      const result = provenance(file);
      if (kind === 'missing') result.attestation_bundles = [];
      if (kind === 'publisher') result.attestation_bundles[0].publisher.environment = 'another-environment';
      if (kind === 'subject') result.attestation_bundles[0].attestations[0].envelope.statement = Buffer.from(JSON.stringify({ subject: [{ name: file.filename, digest: { sha256: '0'.repeat(64) } }] })).toString('base64');
      return result;
    } })).rejects.toThrow('Missing matching PyPI publish attestation');
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
});
