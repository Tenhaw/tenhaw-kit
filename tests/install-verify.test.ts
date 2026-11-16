import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMcp } from '../packages/cli/src/verify.js';
import { VERSION } from '../packages/core/src/index.js';

const version = VERSION;
const pure = ['assess_ai_readiness', 'estimate_ai_project_cost', 'estimate_ai_roi', 'generate_operating_model', 'generate_usecase_register', 'score_delivery_health'];
const extra = ['collect_delivery_events', 'scaffold_internal_tool'];
const initial = { protocolVersion: '2025-11-25', serverInfo: { name: 'Tenhaw Kit', version } };
const report = { structuredContent: { result: { frameworkVersion: 'v1', coverage: 0, overall: null, band: null, dimensions: Array.from({ length: 6 }, () => ({})) } } };
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });
async function directory() { const path = await mkdtemp(join(tmpdir(), 'tenhaw-verify-')); temporary.push(path); return path; }

function localContext(mode = 'valid') {
  const launches: { command: string; args: readonly string[]; options: unknown }[] = [];
  const source = `
    const readline = require('node:readline');
    const mode = ${JSON.stringify(mode)};
    readline.createInterface({input:process.stdin}).on('line', line => {
      const call = JSON.parse(line);
      if (!call.id) return;
      if (mode === 'hang') return;
      if (mode === 'invalid') { process.stdout.write('secret-not-a-protocol-response\\n'); return; }
      if (mode === 'oversized') { process.stdout.write('x'.repeat(1024 * 1024 + 1)); return; }
      if (mode === 'exit') { process.stderr.write('private-value-do-not-log'); process.exit(1); }
      let result;
      if (call.method === 'initialize') result = ${JSON.stringify(initial)};
      if (mode === 'wrong-version' && call.method === 'initialize') result.serverInfo.version = '0.0.0';
      if (call.method === 'tools/list') result = {tools:${JSON.stringify([...pure, ...extra].map(name => ({ name })))}};
      if (mode === 'wrong-inventory' && call.method === 'tools/list') result.tools.pop();
      if (call.method === 'tools/call') {
        if (call.params.name !== 'assess_ai_readiness' || JSON.stringify(call.params.arguments) !== JSON.stringify({responses:{answers:[]}})) process.exit(2);
        result = ${JSON.stringify(report)};
        if (mode === 'tool-error') result = {isError:true,content:[{text:'private-value-do-not-log'}]};
      }
      process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:call.id,result})+'\\n');
    });
  `;
  const launch = ((command: string, args: readonly string[], options: Parameters<typeof spawn>[2]) => {
    launches.push({ command, args, options });
    return spawn(process.execPath, ['-e', source], options);
  }) as typeof spawn;
  return { context: { spawn: launch }, launches };
}

function remoteContext(options: { sse?: boolean; mode?: string } = {}) {
  const requests: { method: string; headers: Headers; call?: Record<string, any> }[] = [];
  const fetcher = (async (url: string | URL | globalThis.Request, init: RequestInit = {}) => {
    expect(String(url)).toBe('https://mcp.tenhaw.com/mcp');
    expect(init.redirect).toBe('error');
    const headers = new Headers(init.headers), method = init.method ?? 'GET';
    const call = init.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, headers, call });
    if (method === 'DELETE' || !call?.id) return new Response(null, { status: 202 });
    if (options.mode === 'http-error') return new Response('private-value-do-not-log', { status: 429 });
    if (options.mode === 'hang') return await new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('private-value-do-not-log', 'AbortError')), { once: true }));
    let result: unknown;
    if (call.method === 'initialize') result = initial;
    if (call.method === 'tools/list') result = { tools: pure.map(name => ({ name })) };
    if (call.method === 'tools/call') {
      expect(call.params).toEqual({ name: 'assess_ai_readiness', arguments: { responses: { answers: [] } } });
      result = options.mode === 'tool-error' ? { isError: true, content: [{ text: 'private-value-do-not-log' }] } : report;
    }
    const body = JSON.stringify({ jsonrpc: '2.0', id: options.mode === 'wrong-id' ? 99 : call.id, result });
    return new Response(options.mode === 'oversized' ? 'x'.repeat(1024 * 1024 + 1) : options.sse ? `: keepalive\n\nevent: message\ndata: ${body}\n\n` : body, { headers: { 'Content-Type': options.sse ? 'text/event-stream' : 'application/json', 'MCP-Session-Id': 'test-session' } });
  }) as typeof fetch;
  return { context: { fetch: fetcher }, requests };
}

describe('installation MCP verification', () => {
  it('starts only the pinned local command and exercises a synthetic calculation', async () => {
    const { context, launches } = localContext();
    const result = await verifyMcp({ transport: 'local', directory: await directory(), version }, context);
    expect(result).toEqual({ status: 'passed', transport: 'local', serverVersion: version, tools: [...pure, ...extra].sort() });
    expect(launches).toHaveLength(1);
    expect(launches[0].args.slice(-2)).toEqual(['-y', `@tenhaw/mcp@${version}`]);
    expect(launches[0].options).toMatchObject({ shell: false, stdio: ['pipe', 'pipe', 'ignore'] });
    const env = (launches[0].options as { env: NodeJS.ProcessEnv }).env;
    for (const name of ['GITHUB_TOKEN', 'JIRA_API_TOKEN', 'JIRA_EMAIL', 'JIRA_BASE_URL']) expect(env).not.toHaveProperty(name);
  });
  it.each(['invalid', 'oversized', 'exit', 'wrong-version', 'wrong-inventory', 'tool-error'])('rejects unsafe or incomplete local responses: %s', async mode => {
    const result = await verifyMcp({ transport: 'local', directory: await directory(), version, timeoutMs: 3000 }, localContext(mode).context);
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private-value');
    expect(JSON.stringify(result)).not.toContain('secret-not');
  });
  it('bounds local verification time and stops an unresponsive process', async () => {
    const result = await verifyMcp({ transport: 'local', directory: await directory(), version, timeoutMs: 100 }, localContext('hang').context);
    expect(result).toMatchObject({ status: 'failed', error: expect.stringContaining('timed out') });
  });
  it.each([false, true])('verifies remote JSON/SSE responses and closes the session: sse=%s', async sse => {
    const { context, requests } = remoteContext({ sse });
    const result = await verifyMcp({ transport: 'remote', directory: '.', version }, context);
    expect(result).toEqual({ status: 'passed', transport: 'remote', serverVersion: version, tools: [...pure].sort() });
    expect(requests.map(request => request.call?.method ?? request.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/call', 'DELETE']);
    for (const request of requests.slice(1)) expect(request.headers.get('MCP-Session-Id')).toBe('test-session');
    for (const request of requests) expect(request.headers.get('Authorization')).toBeNull();
  });
  it.each(['http-error', 'wrong-id', 'oversized', 'tool-error'])('fails remote protocol checks without exposing upstream bodies: %s', async mode => {
    const result = await verifyMcp({ transport: 'remote', directory: '.', version, timeoutMs: 1000 }, remoteContext({ mode }).context);
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('private-value');
  });
  it('bounds remote verification time and rejects non-exact versions before launching', async () => {
    const remote = await verifyMcp({ transport: 'remote', directory: '.', version, timeoutMs: 50 }, remoteContext({ mode: 'hang' }).context);
    expect(remote.status).toBe('failed');
    const { context, launches } = localContext();
    expect((await verifyMcp({ transport: 'local', directory: '.', version: 'latest' }, context)).status).toBe('failed');
    expect(launches).toEqual([]);
  });
});
