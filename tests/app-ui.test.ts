import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { renderAppUi } from '../packages/mcp/src/app-ui.js';
import { runTool } from '../packages/mcp/src/tools.js';
import { buildProcurementPack } from '../packages/mcp/src/procurement/index.js';

class Element {
  children: Element[] = []; parent: Element | null = null; style: Record<string, string> = {}; attributes: Record<string, string> = {}; handlers: Record<string, ((event: any) => void)[]> = {};
  value = ''; type = ''; id = ''; className = ''; disabled = false; required = false; checked = false; maxLength = 0; open = false; private content = '';
  constructor(public tagName: string) {}
  get textContent(): string { return this.content + this.children.map(child => child.textContent).join(' '); }
  set textContent(value: string) { this.content = String(value); this.children = []; }
  set innerHTML(_value: string) { throw new Error('Untrusted HTML insertion is forbidden.'); }
  get lastElementChild(): Element | null { return this.children.at(-1) ?? null; }
  append(...nodes: Element[]) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes: Element[]) { this.children = []; this.content = ''; this.append(...nodes); }
  setAttribute(name: string, value: string) { this.attributes[name] = String(value); }
  addEventListener(name: string, handler: (event: any) => void) { (this.handlers[name] ??= []).push(handler); }
  emit(name: string) { for (const handler of this.handlers[name] ?? []) handler({ preventDefault() {}, target: this }); }
  click() { this.emit('click'); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  reportValidity() { return true; }
}
class Input extends Element {}
const flush = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };
function fixture(profile: string) {
  const root = new Element('main'), messages: any[] = [], blobs: Blob[] = [], timers = new Map<number, () => void>(), handlers: ((event: any) => void)[] = []; let nextTimer = 0;
  const parent = { postMessage: (message: unknown, origin: string) => messages.push({ message, origin }) };
  const window = { parent, addEventListener: (name: string, handler: (event: any) => void) => { if (name === 'message') handlers.push(handler); } };
  const document = { getElementById: () => root, createElement: (tag: string) => tag === 'input' ? new Input(tag) : new Element(tag) };
  const html = renderAppUi(profile), script = html.match(/<script>([\s\S]+)<\/script>/)![1];
  runInNewContext(script, { window, document, HTMLInputElement: Input, Blob, URL: { createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:local-export'; }, revokeObjectURL() {} }, Intl, Uint8Array, atob, setTimeout: (callback: () => void) => { const id = ++nextTimer; timers.set(id, callback); return id; }, clearTimeout: (id: number) => timers.delete(id) });
  const send = (data: any, source: unknown = parent, origin = 'https://chat.example') => { for (const handler of handlers) handler({ source, origin, data }); };
  const respond = async (request: any, result: any) => { send({ jsonrpc: '2.0', id: request.id, result }); await flush(); };
  const walk = (node = root): Element[] => [node, ...node.children.flatMap(child => walk(child))];
  const find = (tag: string, text: string) => { const match = walk().find(node => node.tagName === tag && node.textContent === text); if (!match) throw new Error(`Missing ${tag}: ${text}`); return match; };
  const set = (label: string, value: string) => { const input = walk().find(node => node.tagName === 'label' && node.textContent.startsWith(label))?.children.find(node => ['input', 'select', 'textarea'].includes(node.tagName)); if (!input) throw new Error('Missing input ' + label); input.value = value; input.emit(input.tagName === 'select' ? 'change' : 'input'); };
  return { root, messages, blobs, timers, send, respond, walk, find, set };
}
const profiles = ['business-case', 'readiness', 'usecase-prioritiser', 'delivery-health', 'operating-model', 'procurement'];
describe('self-contained MCP Apps views', () => {
  it('renders six deterministic resources, rejects unknown IDs and ships no remote assets or HTML sinks', () => {
    for (const profile of profiles) {
      const html = renderAppUi(profile);
      expect(renderAppUi(profile)).toBe(html);
      expect(html).toContain('ui/initialize'); expect(html).toContain('ui/notifications/initialized'); expect(html).toContain('ui/notifications/tool-result'); expect(html).toContain('tools/call');
      expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|\bfetch\(|innerHTML\s*=|localStorage|document\.write/);
      expect(html.match(/<script>/g)).toHaveLength(1);
    }
    expect(() => renderAppUi('</script><script>alert(1)</script>')).toThrow('Unknown');
  });
  it('initialises only from its parent, pins the host origin and handles timeouts accessibly', async () => {
    const app = fixture('business-case'), initialise = app.messages[0].message;
    expect(initialise).toMatchObject({ method: 'ui/initialize', params: { protocolVersion: '2026-01-26' } });
    app.send({ jsonrpc: '2.0', id: initialise.id, result: {} }, {}); await flush();
    expect(app.find('button', 'Calculate business case').disabled).toBe(true);
    await app.respond(initialise, {});
    expect(app.messages.at(-1)).toMatchObject({ origin: 'https://chat.example', message: { method: 'ui/notifications/initialized' } });
    app.find('form', app.walk().find(node => node.tagName === 'form')!.textContent).emit('submit');
    const call = app.messages.at(-1)!.message;
    expect(call).toMatchObject({ method: 'tools/call', params: { name: 'estimate_ai_roi' } });
    app.send({ jsonrpc: '2.0', id: call.id, result: {} }, undefined, 'https://unrelated.example'); await flush();
    expect(app.find('button', 'Working…').disabled).toBe(true);
    for (const callback of [...app.timers.values()]) callback(); await flush();
    expect(app.root.textContent).toContain('The request could not be completed');
    expect(app.find('button', 'Calculate business case').disabled).toBe(false);
  });
  it.each(profiles)('calls the real %s data tool and renders domain results', async profile => {
    const app = fixture(profile); await app.respond(app.messages[0].message, {});
    if (profile === 'procurement') { app.set('What are you buying', 'A controlled AI delivery pilot.'); app.set('Supplier names', 'Supplier A, Supplier B'); }
    if (profile === 'readiness') {
      app.find('button', 'Load the 30 questions').click(); await flush(); const call = app.messages.at(-1)!.message;
      await app.respond(call, { structuredContent: await runTool('assess_ai_readiness', { mode: 'questionnaire' }) });
      expect(app.root.textContent).not.toContain('[object Object]'); app.set('Score for strategy-1', '3'); app.set('Evidence for strategy-1', 'An approved outcome and accountable owner.');
    }
    app.walk().find(node => node.tagName === 'form')!.emit('submit'); await flush();
    const call = app.messages.at(-1)!.message;
    expect(call.method).toBe('tools/call');
    expect(call.params.arguments).not.toHaveProperty('events');
    const result = profile === 'procurement' ? { result: buildProcurementPack(call.params.arguments) } : await runTool(call.params.name, call.params.arguments);
    await app.respond(call, { structuredContent: result, _meta: { app: { id: profile, input: call.params.arguments } } });
    const text = app.root.textContent;
    const expected = { 'business-case': 'Recovered capacity', readiness: 'Response coverage', 'usecase-prioritiser': 'Governance gate', 'delivery-health': 'Next evidence-collection actions', 'operating-model': 'Ownership checks', procurement: 'Working supplier scorecard' }[profile];
    expect(text).toContain(expected); expect(text).toContain('Export result JSON'); expect(text).toContain('Export CSV');
    if (profile === 'readiness') expect(text).toContain('Withheld');
    if (profile === 'delivery-health') expect(text).toContain('Unavailable');
    if (profile === 'procurement') {
      const rating = app.walk().find(node => node.tagName === 'select' && node.attributes['aria-label'] === 'Evidence score')!;
      expect(rating.children.map(node => node.value)).toEqual(['', '0', '1', '2', '3']);
    }
  });
  it('renders hostile supplied strings as text, preserves edits and ignores another app’s result', async () => {
    const app = fixture('usecase-prioritiser'); await app.respond(app.messages[0].message, {});
    const title = '</script><img src=x onerror=alert(1)>', input = { useCases: [{ id: 'one', title, problem: 'Example', ownerRole: 'Owner', businessUnit: 'Team', value: 3, feasibility: 4, riskTier: 'unknown', status: 'idea' }] };
    app.send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: await runTool('generate_usecase_register', input), _meta: { app: { id: 'usecase-prioritiser', input } } } });
    expect(app.root.textContent).toContain(title); expect(app.walk().some(node => node.tagName === 'img')).toBe(false);
    app.set('Title', 'My unsent edit');
    app.send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: await runTool('generate_usecase_register', input), _meta: { app: { id: 'usecase-prioritiser', input } } } });
    expect(app.walk().find(node => node.tagName === 'input' && node.value === 'My unsent edit')).toBeDefined();
    app.send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: { result: { dimensions: [] } }, _meta: { app: { id: 'readiness' } } } });
    expect(app.root.textContent).toContain(title);
  });
  it('escapes formula cells with leading whitespace or quotes in actual CSV downloads', async () => {
    const app = fixture('usecase-prioritiser'); await app.respond(app.messages[0].message, {});
    const input = { useCases: [{ id: 'one', title: '  =1+1', problem: 'Example', ownerRole: "'Example owner", businessUnit: 'Team', value: 3, feasibility: 4, riskTier: 'unknown', status: 'idea' }] };
    app.send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: await runTool('generate_usecase_register', input), _meta: { app: { id: 'usecase-prioritiser', input } } } });
    app.find('button', 'Export CSV').click();
    const csv = await app.blobs.at(-1)!.text();
    expect(csv).toContain('"\'  =1+1"'); expect(csv).toContain('"\'\'Example owner"');
  });
});
