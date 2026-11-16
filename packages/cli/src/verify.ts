import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

const endpoint = 'https://mcp.tenhaw.com/mcp';
const maximumBytes = 1024 * 1024;
const protocolVersion = '2025-11-25';
const pureTools = ['assess_ai_readiness', 'estimate_ai_project_cost', 'estimate_ai_roi', 'generate_operating_model', 'generate_usecase_register', 'score_delivery_health'];
const localTools = ['collect_delivery_events', 'scaffold_internal_tool'];
type ObjectValue = Record<string, unknown>;
type Request = (method: string, params?: ObjectValue) => Promise<unknown>;
type Notify = (method: string) => Promise<void>;
type Context = { spawn?: typeof spawn; fetch?: typeof fetch };
export type VerificationOptions = { transport: 'local' | 'remote'; directory: string; version: string; timeoutMs?: number };
export type VerificationResult = { status: 'passed' | 'failed'; transport: string; serverVersion?: string; tools?: string[]; error?: string };

function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('MCP returned an invalid response.');
  return value as ObjectValue;
}

async function exercise(request: Request, notify: Notify, options: VerificationOptions) {
  const initial = object(await request('initialize', {
    protocolVersion, capabilities: {}, clientInfo: { name: 'tenhaw-install-check', version: options.version },
  }));
  const server = object(initial.serverInfo);
  if (server.name !== 'Tenhaw Kit' || server.version !== options.version) throw new Error('MCP server identity or version does not match the pinned installation.');
  if (initial.protocolVersion !== protocolVersion) throw new Error('MCP protocol negotiation did not select the requested version.');
  await notify('notifications/initialized');
  const inventory = object(await request('tools/list'));
  if (!Array.isArray(inventory.tools) || inventory.nextCursor) throw new Error('MCP returned an incomplete tool inventory.');
  const names = inventory.tools.map(tool => object(tool).name);
  const expected = [...pureTools, ...(options.transport === 'local' ? localTools : [])].sort();
  if (names.some(name => typeof name !== 'string') || JSON.stringify([...names].sort()) !== JSON.stringify(expected)) throw new Error('MCP tool inventory does not match the selected transport.');
  const call = object(await request('tools/call', { name: 'assess_ai_readiness', arguments: { responses: { answers: [] } } }));
  if (call.isError) throw new Error('MCP readiness smoke test failed.');
  const report = object(object(call.structuredContent).result);
  if (report.frameworkVersion !== 'v1' || report.coverage !== 0 || report.overall !== null || report.band !== null || !Array.isArray(report.dimensions) || report.dimensions.length !== 6) throw new Error('MCP readiness smoke test returned an unexpected report.');
  return { status: 'passed' as const, transport: options.transport, serverVersion: String(server.version), tools: expected };
}

async function local(options: VerificationOptions, context: Context): Promise<VerificationResult> {
  const args = ['-y', `@tenhaw/mcp@${options.version}`];
  // Windows cannot execute .cmd files with shell:false. Launch npm's JS entry through Node.
  const command = process.platform === 'win32' ? process.execPath : 'npx';
  const launchArgs = process.platform === 'win32' ? [join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'), ...args] : args;
  const env: NodeJS.ProcessEnv = { ...process.env, TENHAW_NO_ATTRIBUTION: '1' };
  // The smoke test exercises calculations only; collectors have no need for credentials.
  for (const name of ['GITHUB_TOKEN', 'JIRA_API_TOKEN', 'JIRA_EMAIL', 'JIRA_BASE_URL']) delete env[name];
  const child = (context.spawn ?? spawn)(command, launchArgs, { cwd: options.directory, env, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let id = 0, bytes = 0, buffered = '', failure: Error | undefined;
  const fail = (message: string) => {
    failure ??= new Error(message);
    for (const current of pending.values()) current.reject(failure);
    pending.clear();
  };
  const stop = () => {
    if (!child.pid) return;
    try {
      if (process.platform === 'win32') {
        const cleanup = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { shell: false, stdio: 'ignore', windowsHide: true });
        cleanup.on('error', () => child.kill());
      } else process.kill(-child.pid, 'SIGTERM');
    } catch { child.kill(); }
  };
  const timeout = setTimeout(() => { fail('MCP verification timed out. Check the package-manager network access and retry.'); stop(); }, options.timeoutMs ?? 45000);
  child.on('error', () => fail('Could not start the pinned MCP package. Check Node.js and npm are available.'));
  child.on('exit', () => fail('MCP process stopped before verification completed.'));
  child.stdin?.on('error', () => fail('Could not write to the MCP process.'));
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maximumBytes) { fail('MCP verification response exceeded the size limit.'); stop(); return; }
    buffered += chunk;
    let newline: number;
    while ((newline = buffered.indexOf('\n')) !== -1) {
      const line = buffered.slice(0, newline).trim(); buffered = buffered.slice(newline + 1);
      if (!line) continue;
      try {
        const message = object(JSON.parse(line));
        if (message.jsonrpc !== '2.0') throw new Error();
        const current = pending.get(Number(message.id));
        if (!current) continue;
        pending.delete(Number(message.id));
        if (message.error || !('result' in message)) current.reject(new Error('MCP returned a protocol error.'));
        else current.resolve(message.result);
      } catch { fail('MCP process emitted invalid JSON protocol output.'); }
    }
  });
  const request: Request = (method, params = {}) => new Promise((resolve, reject) => {
    if (failure) { reject(failure); return; }
    const next = ++id;
    pending.set(next, { resolve, reject });
    child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', id: next, method, params })}\n`);
  });
  const notify: Notify = async method => {
    if (failure) throw failure;
    child.stdin?.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  };
  try { return await exercise(request, notify, options); }
  finally { clearTimeout(timeout); stop(); child.stdin?.destroy(); child.stdout?.destroy(); }
}

async function responseMessage(response: Response, id: number, signal: AbortSignal): Promise<ObjectValue> {
  if (!response.body) throw new Error('MCP returned an empty response.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const sse = response.headers.get('content-type')?.includes('text/event-stream');
  let text = '', bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) throw new Error('MCP verification response exceeded the size limit.');
      text += decoder.decode(value, { stream: true });
      if (sse) {
        text = text.replaceAll('\r\n', '\n');
        let end: number;
        while ((end = text.indexOf('\n\n')) !== -1) {
          const event = text.slice(0, end); text = text.slice(end + 2);
          const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (!data) continue;
          const message = object(JSON.parse(data));
          if (message.id === id) return message;
        }
      }
    }
    if (sse) throw new Error('MCP stream ended before the matching response.');
    const message = object(JSON.parse(text + decoder.decode()));
    if (message.id !== id) throw new Error('MCP response identifier did not match the request.');
    return message;
  } finally { await reader.cancel().catch(() => undefined); }
}

async function remote(options: VerificationOptions, context: Context): Promise<VerificationResult> {
  const controller = new AbortController(), fetcher = context.fetch ?? fetch;
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45000);
  let session: string | undefined, id = 0;
  const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': protocolVersion, ...(session ? { 'MCP-Session-Id': session } : {}) });
  const post = async (message: ObjectValue) => {
    const response = await fetcher(endpoint, { method: 'POST', headers: headers(), redirect: 'error', signal: controller.signal, body: JSON.stringify(message) });
    session ??= response.headers.get('MCP-Session-Id') ?? undefined;
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Remote MCP returned HTTP ${response.status}.`); }
    return response;
  };
  const request: Request = async (method, params = {}) => {
    const next = ++id, response = await post({ jsonrpc: '2.0', id: next, method, params });
    const message = await responseMessage(response, next, controller.signal);
    if (message.jsonrpc !== '2.0' || message.error || !('result' in message)) throw new Error('MCP returned a protocol error.');
    return message.result;
  };
  const notify: Notify = async method => { const response = await post({ jsonrpc: '2.0', method }); await response.body?.cancel(); };
  try { return await exercise(request, notify, options); }
  finally {
    clearTimeout(timeout);
    if (session) await fetcher(endpoint, { method: 'DELETE', headers: headers(), redirect: 'error', signal: AbortSignal.timeout(1500) }).then(response => response.body?.cancel()).catch(() => undefined);
    controller.abort();
  }
}

/** Verify only the canonical, pinned Tenhaw MCP using synthetic input and no collector calls. */
export async function verifyMcp(options: VerificationOptions, context: Context = {}): Promise<VerificationResult> {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.version)) return { status: 'failed', transport: options.transport, error: 'Use an exact semantic package version for verification.' };
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > 60000)) return { status: 'failed', transport: options.transport, error: 'Verification timeout must be between 1 and 60000 milliseconds.' };
  try { return await (options.transport === 'remote' ? remote(options, context) : local(options, context)); }
  catch (error) {
    // Never forward package-manager stderr, response bodies or arbitrary exception text.
    const known = error instanceof Error ? error.message : '';
    const safe = /^(?:MCP |Remote MCP returned HTTP \d+\.|Could not (?:start the pinned MCP package|write to the MCP process))/.test(known) ? known : 'MCP verification failed. Check connectivity and retry.';
    return { status: 'failed', transport: options.transport, error: safe };
  }
}
