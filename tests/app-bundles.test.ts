import { afterEach, describe, expect, it } from 'vitest';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = resolve('.'), temporary: string[] = [];
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const run = (directory: string, check = false) => spawnSync(process.execPath, [join(root, 'scripts/package-apps.mjs'), '--root', directory, '--json', ...(check ? ['--check'] : [])], { cwd: root, encoding: 'utf8', timeout: 15000 });
async function temp() { const directory = await mkdtemp(join(tmpdir(), 'tenhaw-app-bundle-')); temporary.push(directory); return directory; }
async function fixture() {
  const directory = await temp();
  for (const path of ['spec/content/app-products.json', 'packages/core/package.json', 'plugins/assets/icon.png', 'plugins/openai', 'launch/apps', '.agents/plugins/marketplace.json', 'tools/plugin-schemas', 'LICENSE', 'LICENSE-CONTENT']) {
    await mkdir(join(directory, path, '..'), { recursive: true }); await cp(join(root, path), join(directory, path), { recursive: true, dereference: false });
  }
  return directory;
}
function unzip(path: string) {
  const result = spawnSync('python3', ['-c', 'import hashlib,json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({"badMember":z.testzip(),"files":[{"path":i.filename,"bytes":i.file_size,"sha256":hashlib.sha256(z.read(i.filename)).hexdigest(),"timestamp":list(i.date_time),"compression":i.compress_type} for i in z.infolist()],"manifest":json.loads(z.read("plugin.json")) if "plugin.json" in z.namelist() else None}))', path], { encoding: 'utf8', timeout: 15000 });
  expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout);
}
afterEach(async () => { await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('reproducible app upload bundles', () => {
  it('packages seven directly rooted upload ZIPs, complete review plans and verifiable hashes', async () => {
    const directory = await fixture(), packaged = run(directory);
    expect(packaged.status, packaged.stderr).toBe(0);
    const report = JSON.parse(packaged.stdout), manifest = JSON.parse(await readFile(join(directory, report.manifest), 'utf8'));
    expect(report.products).toBe(7); expect(report.status).toBe('source-candidate-unsubmitted'); expect(manifest.products).toHaveLength(7);
    for (const product of manifest.products) {
      const path = join(directory, 'artifacts/apps', product.archive), bytes = await readFile(path), archive = unzip(path);
      expect(product.sha256).toBe(digest(bytes)); expect(product.bytes).toBe(bytes.length); expect(archive.badMember).toBeNull();
      expect(archive.manifest).toMatchObject({ name: product.pluginName, version: report.version });
      expect(archive.files.map((file: { path: string }) => file.path)).toContain('plugin.json');
      expect(archive.files.map((file: { path: string }) => file.path)).toContain('LICENSE');
      expect(archive.files.map((file: { path: string }) => file.path)).toContain('LICENSE-CONTENT');
      expect(archive.files.map((file: { path: string }) => file.path)).toContain('assets/icon.png');
      expect(archive.files.every((file: { timestamp: number[]; compression: number }) => JSON.stringify(file.timestamp) === JSON.stringify([1980, 1, 1, 0, 0, 0]) && file.compression === 0)).toBe(true);
      expect(archive.files.map(({ path, bytes, sha256 }: { path: string; bytes: number; sha256: string }) => ({ path, bytes, sha256 }))).toEqual([...product.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      if (product.productId === 'developer-kit') {
        expect(product.pluginName).toBe('tenhaw-developer-tools');
        expect(archive.manifest.extensions['com.openai'].requires_local_executor).toBe(true);
        expect(archive.manifest.extensions['com.openai'].review.test_cases.positive).toHaveLength(5);
        expect(archive.manifest.extensions['com.openai'].review.test_cases.negative).toHaveLength(3);
        expect(archive.files.map((file: { path: string }) => file.path)).toContain('mcp.json'); expect(product.endpoint).toBe('https://mcp.tenhaw.com/mcp'); expect(product.tools).toHaveLength(6);
      } else {
        expect(archive.files.map((file: { path: string }) => file.path)).toContain('mcp.json');
        expect(product.uiDomain).toBe(`https://${product.productId}.apps.tenhaw.com`);
        expect(product.endpoint).toBe(`${product.uiDomain}/mcp/apps/${product.productId}`);
      }
      expect(archive.files.map((file: { path: string }) => file.path)).not.toContain('.agents/plugins/marketplace.json');
    }
    const aggregate = await readFile(join(directory, report.aggregate)), archive = unzip(join(directory, report.aggregate));
    expect(digest(aggregate)).toBe(report.aggregateSha256); expect(archive.badMember).toBeNull();
    expect(archive.files).toHaveLength(30);
    for (const product of manifest.products) expect(archive.files.map((file: { path: string }) => file.path)).toContain(product.archive);
    expect(archive.files.map((file: { path: string }) => file.path)).toContain('manifest.json');
    expect(archive.files.map((file: { path: string }) => file.path)).toContain('submission-plans/procurement/submission.json');
    expect(await readFile(join(directory, `${report.aggregate}.sha256`), 'utf8')).toContain(report.aggregateSha256);
  });

  it('is byte-for-byte repeatable, supports read-only drift checks and preserves unrelated artifacts', async () => {
    const directory = await fixture(), first = run(directory); expect(first.status, first.stderr).toBe(0);
    const report = JSON.parse(first.stdout), path = join(directory, report.aggregate), before = await readFile(path), timestamp = (await stat(path)).mtimeMs;
    await writeFile(join(directory, 'artifacts/keep-this.txt'), 'unrelated');
    expect(run(directory, true).status).toBe(0); expect(run(directory).status).toBe(0);
    expect(await readFile(path)).toEqual(before); expect((await stat(path)).mtimeMs).toBe(timestamp); expect(await readFile(join(directory, 'artifacts/keep-this.txt'), 'utf8')).toBe('unrelated');
    await writeFile(path, 'changed archive'); const check = run(directory, true); expect(check.status).toBe(1); expect(await readFile(path, 'utf8')).toBe('changed archive');
    expect(run(directory).status).toBe(0); expect(await readFile(path)).toEqual(before);
  });

  it.each(['.env.local', 'node_modules/package.json', '.git/config', 'unexpected.txt'])('refuses private or unexpected sources before writing any archive: %s', async name => {
    const directory = await fixture(), path = join(directory, 'plugins/openai/tenhaw', name); await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, 'private fixture');
    const result = run(directory); expect(result.status).toBe(1); await expect(stat(join(directory, 'artifacts'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects credential material without printing it or writing an archive', async () => {
    const directory = await fixture(), path = join(directory, 'plugins/openai/tenhaw/skills/ai-readiness-assessment/SKILL.md');
    const secret = `ghp_${'x'.repeat(35)}`; await writeFile(path, `${await readFile(path, 'utf8')}\n${secret}\n`);
    const result = run(directory); expect(result.status).toBe(1); expect(result.stderr).toContain('Potential credential material'); expect(result.stderr + result.stdout).not.toContain(secret);
    await expect(stat(join(directory, 'artifacts'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects source and output symlinks without touching their destination', async () => {
    const directory = await fixture(), outside = await temp(), path = join(directory, 'plugins/openai/tenhaw/assets/icon.png');
    await rm(path); await symlink(join(root, 'plugins/assets/icon.png'), path);
    expect(run(directory).status).toBe(1); await expect(stat(join(directory, 'artifacts'))).rejects.toMatchObject({ code: 'ENOENT' });
    const outputFixture = await fixture(); await mkdir(join(outputFixture, 'artifacts')); await symlink(outside, join(outputFixture, 'artifacts/apps'));
    expect(run(outputFixture).status).toBe(1); expect(await readdir(outside)).toEqual([]);
  });

  it('rejects generated metadata drift and a substituted local developer MCP component before packaging', async () => {
    const directory = await fixture(), hosted = join(directory, 'plugins/openai/tenhaw-business-case/plugin.json'); await writeFile(hosted, '{}');
    expect(run(directory).status).toBe(1); await expect(stat(join(directory, 'artifacts'))).rejects.toMatchObject({ code: 'ENOENT' });
    const desktop = await fixture(); await writeFile(join(desktop, 'plugins/openai/tenhaw/mcp.json'), '{"$schema":"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json","mcpServers":{"tenhaw-developer-tools":{"type":"stdio","command":"npx","args":["@tenhaw/mcp"]}}}');
    expect(run(desktop).status).toBe(1); await expect(stat(join(desktop, 'artifacts'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('requires one actual remote connection and complete MCP review cases for the hybrid developer package', async () => {
    const directory = await fixture(), path = join(directory, 'plugins/openai/tenhaw/plugin.json');
    const developer = JSON.parse(await readFile(path, 'utf8'));
    delete developer.extensions['com.openai'].review;
    await writeFile(path, JSON.stringify(developer));
    const result = run(directory);
    expect(result.status).toBe(1); expect(result.stderr).toContain('A single MCP connection requires five positive and three negative review cases.');
    await expect(stat(join(directory, 'artifacts'))).rejects.toMatchObject({ code: 'ENOENT' });
    const empty = await fixture(); await writeFile(join(empty, 'plugins/openai/tenhaw/mcp.json'), '{"$schema":"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json","mcpServers":{}}');
    const missing = run(empty); expect(missing.status).toBe(1); expect(missing.stderr).toContain('MCP app packages need exactly one declared remote connection.');
    await expect(stat(join(empty, 'artifacts'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
