import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEdits, modify, parseTree, getNodeValue, type Node as JsonNode, type ParseError } from 'jsonc-parser';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { VERSION } from '@tenhaw/core';
import { verifyMcp } from './verify.js';

export const agents = ['codex', 'claude', 'cursor', 'vscode', 'gemini'] as const;
export type Agent = typeof agents[number];
export type Transport = 'local' | 'remote';
export type Integration = 'none' | 'github' | 'jira' | 'github,jira';
export type SetupOptions = {
  agent: Agent; directory?: string; transport?: Transport; integration?: Integration;
  apply?: boolean; check?: boolean; verify?: boolean;
};
const locations: Record<Agent, string> = {
  codex: '.codex/config.toml', claude: '.mcp.json', cursor: '.cursor/mcp.json',
  vscode: '.mcp.json', gemini: '.gemini/settings.json',
};
const maxConfigBytes = 1024 * 1024;
const remoteUrl = 'https://mcp.tenhaw.com/mcp';

export function supportedRuntime(version = process.versions.node) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  return major > 22 || major === 22 && minor >= 14;
}

export function credentialRequirements(integration: Integration, env = process.env) {
  const required = [
    ...(integration.includes('github') ? ['GITHUB_TOKEN'] : []),
    ...(integration.includes('jira') ? ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] : []),
  ];
  const missing = required.filter(name => !env[name]?.trim());
  return {
    required: required.map(name => ({ name, status: env[name]?.trim() ? 'set' : 'missing' })),
    missing,
    storage: 'local-environment-only',
    request: missing.length ? 'Ask the user to set only the missing variables in the local environment that launches the coding agent, then restart it. Never ask them to paste credentials into chat or commit them to project files.' : null,
    permissions: [
      ...(integration.includes('github') ? ['Use a GitHub token restricted to the requested repositories with read access to repository metadata, contents, deployments, pull requests and issues.'] : []),
      ...(integration.includes('jira') ? ['Use a Jira Cloud API token for an account with read access to the requested projects. Collection also needs a JQL query and explicit statusToStage mappings.'] : []),
    ],
  };
}

export function serverConfiguration(agent: Agent, transport: Transport, integration: Integration) {
  if (transport === 'remote') return agent === 'codex' ? { url: remoteUrl }
    : agent === 'gemini' ? { httpUrl: remoteUrl }
    : { type: 'http', url: remoteUrl, ...(agent === 'vscode' ? { tools: ['*'] } : {}) };
  const required = credentialRequirements(integration, {}).required.map(item => item.name);
  const env = Object.fromEntries(required.map(name => [name, agent === 'cursor' ? `\${env:${name}}` : `\${${name}}`]));
  return {
    ...(agent === 'claude' || agent === 'cursor' || agent === 'vscode' ? { type: 'stdio' } : {}),
    command: 'npx', args: ['-y', `@tenhaw/mcp@${VERSION}`],
    ...(required.length ? agent === 'codex' ? { env_vars: required } : { env } : {}),
    ...(agent === 'vscode' ? { tools: ['*'] } : {}),
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  if (object(left) && object(right)) return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
  return left === right;
}

function sameServer(existing: unknown, desired: Record<string, unknown>, agent: Agent) {
  if (!object(existing)) return false;
  const normalise = (value: Record<string, unknown>) => {
    const result = { ...value };
    if (result.type === 'stdio') delete result.type;
    // Claude and Copilot share .mcp.json. An unrestricted tool list is the default.
    if ((agent === 'claude' || agent === 'vscode') && sameValue(result.tools, ['*'])) delete result.tools;
    return result;
  };
  return sameValue(normalise(existing), normalise(desired));
}

function assertUniqueKeys(node: JsonNode) {
  if (node.type === 'object') {
    const keys = node.children?.map(property => property.children![0].value) ?? [];
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate configuration keys require manual review.');
  }
  for (const child of node.children ?? []) assertUniqueKeys(child);
}

function configurationEdit(original: string | null, agent: Agent, desired: Record<string, unknown>) {
  let document: Record<string, unknown>;
  const text = original ?? (agent === 'codex' ? '' : '{}\n');
  try {
    if (agent === 'codex') document = parseToml(text, { integersAsBigInt: 'asNeeded' });
    else {
      const errors: ParseError[] = [];
      const tree = parseTree(text, errors, { allowTrailingComma: true });
      if (!tree || errors.length || tree.type !== 'object') throw new Error();
      assertUniqueKeys(tree);
      document = getNodeValue(tree);
    }
  } catch { throw new Error('Agent configuration is invalid or ambiguous. Review it locally; its contents were not printed.'); }
  const group = agent === 'codex' ? 'mcp_servers' : 'mcpServers';
  if (document[group] !== undefined && !object(document[group])) throw new Error('The MCP server group must be an object. Existing configuration was preserved.');
  const servers = document[group] as Record<string, unknown> | undefined;
  if (servers && Object.hasOwn(servers, 'tenhaw')) {
    if (!sameServer(servers.tenhaw, desired, agent)) throw new Error('A different tenhaw server is already configured. Review it locally; setup never replaces an existing definition.');
    return { text, changed: false };
  }
  let updated: string;
  if (agent === 'codex') {
    updated = `${text}${text.endsWith('\n') || !text ? '' : '\n'}\n${stringifyToml({ mcp_servers: { tenhaw: desired } })}`;
    // Appending to an inline TOML table is invalid. Validate before writing anything.
    try { parseToml(updated, { integersAsBigInt: 'asNeeded' }); }
    catch { throw new Error('This TOML layout needs a manual merge. Existing configuration was preserved.'); }
  } else {
    updated = applyEdits(text, modify(text, [group, 'tenhaw'], desired, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: text.includes('\r\n') ? '\r\n' : '\n' } }));
  }
  return { text: updated, changed: true };
}

async function assertContainedPath(root: string, file: string) {
  let current = root;
  for (const component of relative(root, file).split(sep)) {
    current = join(current, component);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error('Agent configuration paths must not contain symbolic links.');
      if (current !== file && !info.isDirectory() || current === file && !info.isFile()) throw new Error('Agent configuration path is not a regular file or directory.');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}

async function readConfiguration(file: string) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxConfigBytes) throw new Error('Agent configuration must be a regular file under 1 MiB.');
    return { text: await handle.readFile('utf8'), mode: info.mode & 0o777 };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { text: null, mode: 0o600 };
    throw error;
  } finally { await handle?.close(); }
}

async function saveConfiguration(root: string, file: string, original: string | null, text: string, mode: number) {
  await assertContainedPath(root, file);
  await mkdir(dirname(file), { recursive: true });
  await assertContainedPath(root, file);
  const lock = `${file}.tenhaw-setup.lock`;
  let handle;
  try { handle = await open(lock, 'wx', 0o600); }
  catch { throw new Error('Another setup write may be in progress. Review the adjacent .tenhaw-setup.lock file before retrying.'); }
  const staging = `${file}.tenhaw-${process.pid}-${Date.now()}`;
  try {
    await assertContainedPath(root, file);
    if ((await readConfiguration(file)).text !== original) throw new Error('Agent configuration changed during setup. Retry after reviewing it.');
    const staged = await open(staging, 'wx', mode);
    try { await staged.writeFile(text); await staged.sync(); } finally { await staged.close(); }
    await assertContainedPath(root, file);
    if ((await readConfiguration(file)).text !== original) throw new Error('Agent configuration changed during setup. Retry after reviewing it.');
    await rename(staging, file);
  } finally { await handle.close(); await rm(staging, { force: true }); await rm(lock, { force: true }); }
}

export async function setup(options: SetupOptions) {
  const transport = options.transport ?? 'local', integration = options.integration ?? 'none';
  if (!agents.includes(options.agent)) throw new Error(`Choose an agent: ${agents.join(', ')}.`);
  if (!['local', 'remote'].includes(transport)) throw new Error('Choose local or remote transport.');
  if (!['none', 'github', 'jira', 'github,jira'].includes(integration)) throw new Error('Choose integration none, github, jira or github,jira.');
  if (transport === 'remote' && integration !== 'none') throw new Error('GitHub/Jira collection requires local transport. Remote MCP accepts aggregate reports only.');
  if (options.apply && options.check) throw new Error('Choose --yes to apply or --check to inspect.');
  const directory = await realpath(options.directory ?? process.cwd());
  if (!(await lstat(directory)).isDirectory()) throw new Error('Choose an existing project directory.');
  const runtime = { node: process.version, required: '>=22.14.0', supported: supportedRuntime() };
  const credentials = credentialRequirements(integration);
  const desired = serverConfiguration(options.agent, transport, integration);
  const file = join(directory, locations[options.agent]);
  let configuration: { path: string; status: string; server: Record<string, unknown>; error?: string } = {
    path: locations[options.agent], status: 'planned', server: desired,
  };
  try {
    await assertContainedPath(directory, file);
    const original = await readConfiguration(file);
    const edit = configurationEdit(original.text, options.agent, desired);
    if (!edit.changed) configuration.status = 'unchanged';
    else if (options.apply && runtime.supported) {
      await saveConfiguration(directory, file, original.text, edit.text, original.mode);
      configuration.status = original.text === null ? 'created' : 'updated';
    } else configuration.status = options.check ? 'missing' : 'planned';
  } catch (error) {
    configuration = { ...configuration, status: 'conflict', error: error instanceof Error && !('code' in error) ? error.message : 'Unable to read or write project configuration. Check local file permissions.' };
  }
  const configured = ['created', 'updated', 'unchanged'].includes(configuration.status);
  const verification = options.verify && runtime.supported && configuration.status !== 'conflict'
    ? await verifyMcp({ transport, directory, version: VERSION })
    : { status: 'not-run', transport };
  // Reuse this exact executable for both source checkouts and installed releases.
  const baseArgs = [fileURLToPath(new URL('./index.js', import.meta.url)), 'setup', '--agent', options.agent, '--transport', transport, '--integration', integration, '--json'];
  const actions = [
    ...(!configured ? [{ kind: 'configure', command: process.execPath, args: [...baseArgs, '--yes'], cwd: directory }] : []),
    ...(verification.status !== 'passed' ? [{ kind: 'verify', command: process.execPath, args: [...baseArgs, '--check', '--verify'], cwd: directory }] : []),
  ];
  const exitCode = !runtime.supported || configuration.status === 'conflict' || options.check && !configured ? 2
    : credentials.missing.length ? 4 : verification.status === 'failed' ? 3 : 0;
  return {
    schemaVersion: '1.0', version: VERSION, agent: options.agent, directory, transport,
    status: exitCode === 2 ? 'blocked' : credentials.missing.length ? 'requires-credentials' : verification.status === 'failed' ? 'verification-failed' : configured ? 'configured' : 'planned',
    ready: configured && runtime.supported && !credentials.missing.length && verification.status === 'passed',
    runtime, configuration, credentials, verification, actions, exitCode,
    activation: options.agent === 'codex' ? 'Trust this project and restart the coding agent so it reads .codex/config.toml. Then list Tenhaw tools and run assess_ai_readiness with responses.answers=[].'
      : options.agent === 'vscode' ? 'Use the Copilot harness, reload the workspace and enable Tenhaw in its MCP servers. Then run assess_ai_readiness with responses.answers=[].'
      : 'Reload or restart the coding agent, accept its MCP trust prompt, then list Tenhaw tools and run assess_ai_readiness with responses.answers=[].',
    verificationScope: 'The distribution probe tests the pinned server directly. Confirm the tool call inside your coding agent to verify its environment and trust settings.',
  };
}
