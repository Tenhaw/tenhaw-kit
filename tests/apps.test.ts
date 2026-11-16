import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { appIds, appTools, appResourceUri, createAppServer, getAppProfile, runAppTool, registerAppTools } from '../packages/mcp/src/apps.js';
import { computeMetrics } from '../packages/delivery-metrics/src/index.js';
import { POST } from '../apps/mcp-remote/app/mcp/apps/[app]/route.js';
import { POST as developerPost } from '../apps/mcp-remote/app/mcp/route.js';
import { secureRequest } from '../apps/mcp-remote/src/security.js';
import { appDomainProof } from '../apps/mcp-remote/src/domain-proof.js';
import { VERSION } from '../packages/core/src/index.js';

afterEach(() => vi.unstubAllEnvs());
async function vector(name: string) { return JSON.parse(await readFile(`spec/vectors/${name}`, 'utf8')).input; }
async function sample(id: string) {
  switch (id) {
    case 'business-case': return vector('roi/01-capacity-only.json');
    case 'readiness': return { responses: { answers: [] } };
    case 'usecase-prioritiser': return vector('usecases/02-minimal.json');
    case 'delivery-health': return { metrics: computeMetrics([], { since: '2026-01-01T00:00:00Z', until: '2026-02-01T00:00:00Z' }) };
    case 'operating-model': return vector('opmodel/02-one-team.json');
    case 'procurement': return { title: 'Synthetic procurement', brief: 'Compare suppliers for a bounded internal knowledge workflow.', sector: 'other', suppliers: ['Supplier A', 'Supplier B'] };
    default: throw new Error('Missing sample');
  }
}

describe('focused hosted products', () => {
  it('builds six distinct servers and rejects unknown applications', () => {
    expect(appIds).toHaveLength(6);
    for (const id of appIds) {
      expect(() => createAppServer(id)).not.toThrow();
      expect(appTools(id).map(tool => tool.name)).toEqual(getAppProfile(id).tools);
      expect(appResourceUri(id)).toBe(`ui://tenhaw/${id}/${VERSION}.html`);
    }
    expect(() => createAppServer('developer-kit')).toThrow('Unknown');
    expect(() => createAppServer('__proto__')).toThrow('Unknown');
  });

  for (const id of appIds) it(`${id} reuses its engine for an authoritative rendered report`, async () => {
    const profile = getAppProfile(id), input = await sample(id);
    const result = await runAppTool(id, profile.primaryTool, input);
    expect(result.result).toBeTruthy(); expect(result).not.toHaveProperty('generator');
    expect(await runAppTool(id, profile.renderTool, input)).toEqual(result);
    await expect(runAppTool(id, profile.primaryTool, { arbitrary: 'invalid input' })).rejects.toThrow();
    for (const name of ['collect_delivery_events', 'scaffold_internal_tool', 'approve_investment', ...appTools(id === 'readiness' ? 'procurement' : 'readiness').map(tool => tool.name)]) {
      await expect(runAppTool(id, name, input)).rejects.toThrow('unavailable');
    }
  });

  it('keeps raw events and credentials out of the hosted delivery input schema', async () => {
    const definition = appTools('delivery-health')[0];
    expect(definition.inputSchema).toHaveProperty('properties.metrics');
    expect(definition.inputSchema).not.toHaveProperty('properties.events');
    await expect(runAppTool('delivery-health', definition.name, { events: [], GITHUB_TOKEN: 'synthetic-token' })).rejects.toThrow();
  });

  it('associates UI only with render tools and exposes no outbound UI domains', async () => {
    for (const id of appIds) {
      const registrations: { name: string; config: any }[] = [], resources: { uri: string; callback: () => Promise<any> }[] = [];
      const stub = { registerTool(name: string, config: any) { registrations.push({ name, config }); }, registerResource(_name: string, uri: string, _config: any, callback: () => Promise<any>) { resources.push({ uri, callback }); } };
      registerAppTools(stub as any, id);
      const render = getAppProfile(id).renderTool;
      expect(registrations.filter(item => item.config._meta?.ui).map(item => item.name)).toEqual([render]);
      for (const registration of registrations) expect(registration.config.annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
      const widget = await resources.find(item => item.uri === appResourceUri(id))!.callback();
      expect(widget.contents[0]._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [], frameDomains: [] });
      expect(widget.contents[0]._meta.ui.domain).toBe(getAppProfile(id).uiDomain);
      expect(widget.contents[0].mimeType).toBe('text/html;profile=mcp-app');
    }
  });
});

describe('independent app domain ownership proofs', () => {
  it('serves one exact public token per product origin without replacing another proof', async () => {
    const proofs = Object.fromEntries([...appIds, 'developer-kit'].map(id => [id, `synthetic-proof-${id}`]));
    const origins = new Set(appIds.map(id => getAppProfile(id).uiDomain));
    expect(origins.size).toBe(6);
    for (const id of appIds) {
      const profile = getAppProfile(id);
      expect(new URL(profile.endpoint).origin).toBe(profile.uiDomain);
      const result = appDomainProof(new Request(`${profile.uiDomain}/.well-known/openai-apps-challenge`), JSON.stringify(proofs));
      expect(result.status).toBe(200); expect(await result.text()).toBe(`synthetic-proof-${id}`);
      expect(result.headers.get('Content-Type')).toBe('text/plain; charset=utf-8'); expect(result.headers.get('Cache-Control')).toBe('no-store');
    }
    const developer = appDomainProof(new Request('https://mcp.tenhaw.com/.well-known/openai-apps-challenge'), JSON.stringify(proofs));
    expect(developer.status).toBe(200); expect(await developer.text()).toBe('synthetic-proof-developer-kit');
    const unknown = appDomainProof(new Request('https://unrelated.tenhaw.com/.well-known/openai-apps-challenge'), JSON.stringify(proofs));
    expect(unknown.status).toBe(404);
    expect(appDomainProof(new Request(`${getAppProfile('readiness').uiDomain}/.well-known/openai-apps-challenge`), 'invalid').status).toBe(503);
    expect(appDomainProof(new Request(`${getAppProfile('readiness').uiDomain}/.well-known/openai-apps-challenge`), '{"readiness":"not an exact token"}').status).toBe(404);
  });
});

describe('developer plugin calculation reports', () => {
  it('returns useful results without promotional output in JSON, Markdown and HTML', async () => {
    for (const format of ['json', 'md', 'html']) {
      const response = await developerPost(new Request('http://localhost/mcp', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'x-forwarded-for': `developer-format-${format}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'assess_ai_readiness', arguments: { responses: { answers: [] }, format } } }),
      }));
      expect(response.status).toBe(200);
      const body = await response.text();
      const message = response.headers.get('Content-Type')?.includes('text/event-stream')
        ? body.split('\n').filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5))).find(item => item.id === 1)
        : JSON.parse(body);
      expect(message.result.isError).not.toBe(true);
      expect(message.result.structuredContent.result).toHaveProperty('coverage');
      expect(message.result.structuredContent).not.toHaveProperty('generator');
      expect(message.result.content[0].text).not.toMatch(/Want help|utm_|tenhaw\.com\/contact/);
    }
  });
});

describe('real Streamable HTTP app routes', () => {
  let nextId = 0;
  async function rpc(app: string, method: string, params: unknown = {}) {
    const requestId = ++nextId;
    const response = await POST(new Request(`http://localhost/mcp/apps/${app}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'x-forwarded-for': `test-${app}` }, body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) }), { params: Promise.resolve({ app }) });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.status).toBe(200);
    const body = await response.text();
    return response.headers.get('Content-Type')?.includes('text/event-stream')
      ? body.split('\n').filter(line => line.startsWith('data:')).map(line => JSON.parse(line.slice(5))).find(message => message.id === requestId)
      : JSON.parse(body);
  }

  for (const id of appIds) it(`${id} negotiates, lists scoped tools, renders results and rejects cross-app calls`, async () => {
    const profile = getAppProfile(id), input = await sample(id);
    const init = await rpc(id, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'app-suite-test', version: '1.0.0' } });
    expect(init.result.serverInfo.name).toBe(profile.displayName);
    const list = await rpc(id, 'tools/list'); expect(list.result.tools.map((tool: any) => tool.name)).toEqual(profile.tools);
    const rendered = await rpc(id, 'tools/call', { name: profile.renderTool, arguments: input });
    expect(rendered.result.isError).not.toBe(true); expect(rendered.result.structuredContent.result).toBeTruthy();
    expect(rendered.result._meta.app).toMatchObject({ id, input });
    if (id === 'procurement') {
      expect(rendered.result._meta.document.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(Buffer.from(rendered.result._meta.document.base64, 'base64').subarray(0, 2).toString()).toBe('PK');
      expect(rendered.result.structuredContent).not.toHaveProperty('document.base64');
    }
    const resource = await rpc(id, 'resources/read', { uri: appResourceUri(id) });
    expect(resource.result.contents[0].text).toContain('ui/initialize');
    const denied = await rpc(id, 'tools/call', { name: 'collect_delivery_events', arguments: {} });
    expect(denied.error || denied.result?.isError).toBeTruthy();
  });

  it('returns 404 for an unconfigured product', async () => {
    const response = await POST(new Request('http://localhost/mcp/apps/unknown', { method: 'POST' }), { params: Promise.resolve({ app: 'unknown' }) });
    expect(response.status).toBe(404);
  });

  it('keeps app traffic closed until the expanded native rate-limit rule is verified', async () => {
    vi.stubEnv('TENHAW_RATE_LIMIT_PROVIDER', 'vercel'); vi.stubEnv('VERCEL', '1'); vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('TENHAW_APPS_RATE_LIMIT_CONFIGURED', '');
    const request = () => new Request('https://mcp.tenhaw.com/mcp/apps/readiness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect((await secureRequest(request(), async () => Response.json({ ok: true }))).status).toBe(503);
    vi.stubEnv('TENHAW_APPS_RATE_LIMIT_CONFIGURED', 'true');
    expect((await secureRequest(request(), async () => Response.json({ ok: true }))).status).toBe(200);
  });
});
