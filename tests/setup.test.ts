import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { agents, credentialRequirements, serverConfiguration, setup, supportedRuntime } from '../packages/cli/src/setup.js';

const temporary: string[] = [];
const requireCli = createRequire(resolve('packages/cli/package.json'));
const parseToml: (text: string) => Record<string, unknown> = requireCli('smol-toml').parse;
const parseJsonc: (text: string) => Record<string, unknown> = requireCli('jsonc-parser').parse;
async function temp() { const path = await mkdtemp(join(tmpdir(), 'tenhaw-setup-')); temporary.push(path); return path; }
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('project MCP installation', () => {
  it('previews without touching the project and checks missing configuration', async () => {
    const directory = await temp();
    const preview = await setup({ agent: 'codex', directory });
    expect(preview.status).toBe('planned'); expect(preview.exitCode).toBe(0); expect(preview.ready).toBe(false);
    expect(preview.credentials.required).toEqual([]); expect(preview.verification.status).toBe('not-run');
    expect(await readdir(directory)).toEqual([]);
    const check = await setup({ agent: 'codex', directory, check: true });
    expect(check.configuration.status).toBe('missing'); expect(check.exitCode).toBe(2);
  });

  for (const agent of agents) for (const transport of ['local', 'remote'] as const) it(`configures ${agent}/${transport} and repeats without changes`, async () => {
    const directory = await temp();
    const options = { agent, directory, transport, apply: true };
    const first = await setup(options);
    expect(first.configuration.status).toBe('created'); expect(first.exitCode).toBe(0); expect(first.ready).toBe(false);
    const file = join(directory, first.configuration.path), before = await readFile(file, 'utf8'), timestamp = (await stat(file)).mtimeMs;
    const config = agent === 'codex' ? parseToml(before) : JSON.parse(before);
    expect((config[agent === 'codex' ? 'mcp_servers' : 'mcpServers'] as Record<string, unknown>).tenhaw).toEqual(serverConfiguration(agent, transport, 'none'));
    const repeat = await setup(options);
    expect(repeat.configuration.status).toBe('unchanged'); expect(await readFile(file, 'utf8')).toBe(before); expect((await stat(file)).mtimeMs).toBe(timestamp);
    expect((await setup({ ...options, apply: false, check: true })).exitCode).toBe(0);
  });

  it('preserves JSONC comments, unrelated servers, settings and permissions', async () => {
    const directory = await temp(); await mkdir(join(directory, '.gemini'));
    const file = join(directory, '.gemini/settings.json');
    await writeFile(file, '{\n // Keep this comment\n "model": {"name":"existing"},\n "mcpServers": {"other":{"command":"other-server"},},\n}\n', { mode: 0o640 });
    const result = await setup({ agent: 'gemini', directory, apply: true });
    expect(result.configuration.status).toBe('updated');
    const text = await readFile(file, 'utf8'); expect(text).toContain('// Keep this comment');
    expect(parseJsonc(text)).toMatchObject({ model: { name: 'existing' }, mcpServers: { other: { command: 'other-server' } } });
    expect((await stat(file)).mode & 0o777).toBe(0o640);
  });

  it('reuses the portable server across Claude and Copilot without duplication', async () => {
    const directory = await temp();
    await setup({ agent: 'vscode', directory, apply: true });
    expect((await setup({ agent: 'claude', directory, apply: true })).configuration.status).toBe('unchanged');
    const otherDirectory = await temp();
    await setup({ agent: 'claude', directory: otherDirectory, apply: true });
    expect((await setup({ agent: 'vscode', directory: otherDirectory, apply: true })).configuration.status).toBe('unchanged');
  });

  it('appends a validated TOML table without rewriting existing bytes', async () => {
    const directory = await temp(); await mkdir(join(directory, '.codex'));
    const file = join(directory, '.codex/config.toml'), original = '# Keep this\nmodel = "existing"\n[mcp_servers.other]\ncommand = "other"\n';
    await writeFile(file, original);
    expect((await setup({ agent: 'codex', directory, apply: true })).configuration.status).toBe('updated');
    expect((await readFile(file, 'utf8')).startsWith(original)).toBe(true);
    expect(parseToml(await readFile(file, 'utf8'))).toMatchObject({ model: 'existing', mcp_servers: { other: { command: 'other' } } });
  });

  for (const original of [
    '{"mcpServers":{"tenhaw":{"command":"private-server","env":{"TOKEN":"never-print-this"}}}}',
    '{"mcpServers":{"tenhaw":{}},"mcpServers":{}}',
    '{"mcpServers":[]}', '{"mcpServers":null}', '{broken',
  ]) it('refuses conflicts and invalid or ambiguous JSON without leaking contents', async () => {
    const directory = await temp(), file = join(directory, '.mcp.json'); await writeFile(file, original);
    const result = await setup({ agent: 'claude', directory, apply: true });
    expect(result.configuration.status).toBe('conflict'); expect(result.exitCode).toBe(2);
    expect(JSON.stringify(result)).not.toContain('never-print-this'); expect(await readFile(file, 'utf8')).toBe(original);
    expect(await readdir(directory)).toEqual(['.mcp.json']);
  });

  it('refuses TOML inline table extensions instead of producing invalid config', async () => {
    const directory = await temp(); await mkdir(join(directory, '.codex'));
    const file = join(directory, '.codex/config.toml'), original = 'mcp_servers = { other = { command = "other" } }\n'; await writeFile(file, original);
    expect((await setup({ agent: 'codex', directory, apply: true })).exitCode).toBe(2);
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('rejects directory and file symlinks and leaves outside files untouched', async () => {
    const directory = await temp(), outside = await temp(); await symlink(outside, join(directory, '.codex'));
    expect((await setup({ agent: 'codex', directory, apply: true })).exitCode).toBe(2); expect(await readdir(outside)).toEqual([]);
    const original = join(outside, 'original.json'); await writeFile(original, '{}'); await symlink(original, join(directory, '.mcp.json'));
    expect((await setup({ agent: 'claude', directory, apply: true })).exitCode).toBe(2); expect(await readFile(original, 'utf8')).toBe('{}');
  });

  it('does not steal a setup lock or partially rewrite a file', async () => {
    const directory = await temp(), file = join(directory, '.mcp.json'); await writeFile(file, '{}'); await writeFile(`${file}.tenhaw-setup.lock`, 'active');
    expect((await setup({ agent: 'claude', directory, apply: true })).exitCode).toBe(2); expect(await readFile(file, 'utf8')).toBe('{}'); expect(await readFile(`${file}.tenhaw-setup.lock`, 'utf8')).toBe('active');
  });

  it('reports only selected credentials and never embeds their values', () => {
    const env = { GITHUB_TOKEN: 'test-only-secret', JIRA_API_TOKEN: 'test-only-jira', JIRA_EMAIL: 'private@example.test' };
    expect(credentialRequirements('none', env).required).toEqual([]);
    expect(credentialRequirements('github', env).missing).toEqual([]);
    expect(credentialRequirements('jira', env).missing).toEqual(['JIRA_BASE_URL']);
    const report = credentialRequirements('github,jira', env);
    expect(JSON.stringify(report)).not.toContain('test-only'); expect(JSON.stringify(report)).not.toContain('private@example.test');
    for (const agent of agents) {
      const config = serverConfiguration(agent, 'local', 'github,jira');
      expect(JSON.stringify(config)).not.toContain('test-only');
      if (agent === 'codex') expect(config).toHaveProperty('env_vars', ['GITHUB_TOKEN', 'JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN']);
      else expect((config as { env: Record<string, string> }).env.GITHUB_TOKEN).toBe(agent === 'cursor' ? '${env:GITHUB_TOKEN}' : '${GITHUB_TOKEN}');
    }
  });

  it('rejects local collectors on remote transport before writing anything', async () => {
    const directory = await temp();
    await expect(setup({ agent: 'codex', directory, transport: 'remote', integration: 'github', apply: true })).rejects.toThrow('local transport');
    expect(await readdir(directory)).toEqual([]);
  });

  it('enforces the exact runtime lower bound', () => {
    for (const version of ['20.19.4', '22.0.0', '22.13.9']) expect(supportedRuntime(version)).toBe(false);
    for (const version of ['22.14.0', '22.23.1', '24.0.0']) expect(supportedRuntime(version)).toBe(true);
  });

  it('emits a machine-readable credential request with exit 4 without waiting for input', async () => {
    const directory = await temp();
    const result = spawnSync(process.execPath, [resolve('packages/cli/dist/index.js'), 'setup', '--agent', 'codex', '--integration', 'github', '--yes', '--json', '--no-attribution'], {
      cwd: directory, env: { ...process.env, GITHUB_TOKEN: '', CI: 'true' }, encoding: 'utf8', timeout: 15000,
    });
    expect(result.status, result.stderr).toBe(4); expect(result.stderr).toBe('');
    const report = JSON.parse(result.stdout); expect(report.credentials.missing).toEqual(['GITHUB_TOKEN']); expect(report.configuration.status).toBe('created'); expect(report.ready).toBe(false);
  });
});
