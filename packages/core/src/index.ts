import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schemas } from './schemas.js';
export { schemas };

export const VERSION = '1.0.0';
export const AUDIT_URL = 'https://tenhaw.com/contact#book';
export const round = (value: number): number => {
  invariant(Number.isFinite(value) && Number.isFinite(value*1e6), '/', 'Calculation exceeded the finite numeric range');
  return Math.round(value * 1e6) / 1e6;
};
const ajv = new Ajv2020({ allErrors: true, strict: false, strictNumbers: true, messages: true });
addFormats(ajv);
const dateTimeValidator = ajv.compile({type:'string',format:'date-time'});
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(public readonly issues: { path: string; message: string }[]) {
    super(issues.map(i => `${i.path}: ${i.message}`).join('; '));
    this.name = 'ValidationError';
  }
}
export function validateInput<T>(name: keyof typeof schemas, input: unknown): T {
  // JSON.parse can overflow an otherwise legal JSON number such as 1e999.
  // Inspect arbitrary nested content too, including open-ended evidence maps.
  const pending:{value:unknown;path:string}[]=[{value:input,path:'/'}],seen=new WeakSet<object>();
  while(pending.length){
    const {value,path}=pending.pop()!;
    if(typeof value==='number')invariant(Number.isFinite(value),path,'Numbers must be finite');
    else if(value&&typeof value==='object'&&!seen.has(value)){
      seen.add(value);for(const[key,child]of Object.entries(value))pending.push({value:child,path:`${path==='/'?'':path}/${key}`});
    }
  }
  let validator = validators.get(name);
  if (!validator) { validator = ajv.compile(schemas[name]); validators.set(name, validator); }
  if (!validator(input)) throw new ValidationError(validator.errors!.map(e => ({ path: e.instancePath || '/', message: e.message! })));
  return input as T;
}
export function validateDateTime(value:unknown,path='/date'):asserts value is string{
  invariant(typeof value==='string'&&/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)&&dateTimeValidator(value)&&Number.isFinite(Date.parse(value)),path,'Use a valid RFC 3339 timestamp with timezone');
}
export function invariant(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new ValidationError([{ path, message }]);
}
export type AttributionOptions = { source?: string; medium?: string; content?: string; attribution?: boolean };
export function buildUtmUrl({source, medium, content}: {source: string; medium: string; content: string}): string {
  const url = new URL(AUDIT_URL);
  url.searchParams.set('utm_source', source); url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', 'tenhaw-kit'); url.searchParams.set('utm_content', content);
  return url.toString();
}
export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
function enabled(options: AttributionOptions): boolean {
  return options.attribution !== false && !(typeof process !== 'undefined' && process.env.TENHAW_NO_ATTRIBUTION === '1');
}
export function generator(options: AttributionOptions = {}) {
  return { generator: 'Tenhaw Kit', version: VERSION, url: buildUtmUrl({source:options.source ?? 'github', medium:options.medium ?? 'report', content:options.content ?? 'kit'}) };
}
export function attributionFooter(format: 'md'|'html'|'text'|'json', options: AttributionOptions = {}): string {
  if (!enabled(options)) return '';
  const value = generator(options); const label = 'Generated with Tenhaw Kit. Want help acting on this?';
  if (format === 'json') return JSON.stringify(value);
  if (format === 'html') return `<p>${label} <a href="${escapeHtml(value.url)}">Book an AI readiness audit</a>.</p>`;
  if (format === 'md') return `${label} [Book an AI readiness audit](${value.url}).`;
  return `${label} ${value.url}`;
}
export function renderJson(report: unknown, options: AttributionOptions = {}): string {
  const body = report !== null && typeof report === 'object' && !Array.isArray(report) ? report : {result: report};
  return JSON.stringify(enabled(options) ? {...body, generator: generator(options)} : body, null, 2);
}
export function renderMarkdown(report: unknown, options: AttributionOptions = {}): string {
  const json=JSON.stringify(report,null,2),longest=Math.max(0,...(json.match(/`+/g)??[]).map(s=>s.length));
  const fence='`'.repeat(Math.max(3,longest+1));
  return `# Tenhaw Kit report\n\n${fence}json\n${json}\n${fence}\n\n${attributionFooter('md', options)}`.trimEnd() + '\n';
}
export function renderHtml(report: unknown, options: AttributionOptions = {}): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tenhaw Kit report</title></head><body><main><h1>Tenhaw Kit report</h1><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(JSON.stringify(report, null, 2))}</pre>${attributionFooter('html',options)}</main></body></html>`;
}
export function renderReport(report: unknown, format: 'md'|'html'|'json', options: AttributionOptions = {}): string {
  return format === 'html' ? renderHtml(report,options) : format === 'md' ? renderMarkdown(report,options) : renderJson(report,options);
}
export function canonicalJson(value: unknown): string {
  const normalise = (v: unknown): unknown => {
    if (typeof v === 'number') { invariant(Number.isFinite(v), '/', 'Numbers must be finite'); return round(v); }
    if (Array.isArray(v)) return v.map(normalise);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b,'en')).map(([k,x])=>[k,normalise(x)]));
    return v;
  };
  return JSON.stringify(normalise(value));
}
