import type { ToolDefinition } from '../tools.js';
import { requirements } from './content.js';
import { buildDocx, type DocBlock } from './docx.js';
import provenance from './provenance.json';

const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const categories = [
  { id: 'people', title: 'People and screening', intro: 'Who will work in your systems, how they are vetted and who is accountable.' },
  { id: 'data', title: 'Data, hosting and AI tooling', intro: 'Where processing happens, who can access data and how providers are approved.' },
  { id: 'ip', title: 'Ownership, handover and exit', intro: 'Who owns the deliverables and how your organisation can operate them after the engagement.' },
  { id: 'commercial', title: 'Commercial transparency', intro: 'The basis of fees, technology charges, payment, liability and insurance.' },
  { id: 'assurance', title: 'Evaluation, assurance and governance', intro: 'Acceptance thresholds, release checks, access limits and accountable decisions.' },
  { id: 'evidence', title: 'Evidence and references', intro: 'Evidence a supplier can provide before a contract is signed.' },
  { id: 'sector', title: 'Sector requirements', intro: 'One additional question for the selected sector and the buyer’s own approval process.' },
] as const;
export const sectors = {
  financial: 'Financial services', public: 'Public sector', retail: 'Retail, consumer or media',
  industrial: 'Industrial, energy or infrastructure', other: 'Other',
} as const;
export const defaultCriteria = [
  'people-screening', 'people-team', 'people-substitution',
  'data-location', 'data-residency', 'data-ai', 'data-breach',
  'ip-ownership', 'ip-handover', 'ip-exit', 'com-rates', 'com-model', 'com-liability', 'com-insurance',
  'eval-criteria', 'eval-stop', 'eval-code', 'ev-references', 'ev-certs',
];
const general = requirements.filter(item => item.category !== 'sector');
const generalIds = general.map(item => item.id);
const allIds = requirements.map(item => item.id);
export const criterionCatalogue = general.map(item => ({ id: item.id, name: item.name, category: item.category, defaultSelected: defaultCriteria.includes(item.id), defaultMustHave: item.must }));

export const scale = [
  { score: 0, meaning: 'No answer, or an answer that avoids the question.' },
  { score: 1, meaning: 'A partial answer, with no evidence.' },
  { score: 2, meaning: 'A clear answer that meets the need, with evidence still to check.' },
  { score: 3, meaning: 'A clear answer that meets the need, backed by evidence you have seen.' },
];
export const contentCredit = {
  title: provenance.title, author: provenance.author,
  licence: provenance.licence, licenceUrl: provenance.licenceUrl,
  sourceUrl: provenance.sources[0].url,
  changes: provenance.changes,
};
const instructions = [
  'Put the same questions to every supplier. Agree criteria, must-haves and any weights before reviewing bids.',
  'A must-have is pass or fail. A scored criterion uses the 0 to 3 evidence scale. A high score cannot compensate for an unmet must-have.',
  'Record the supplier’s answer, the evidence reference and the reviewer’s decision. Blank cells mean unassessed, never a zero or an inferred pass.',
  'These criteria are editable procurement prompts. Your organisation determines applicable requirements, contract terms and approval decisions.',
];
const limitations = [
  'No supplier has been evaluated. Scores, pass/fail decisions and evidence fields are deliberately blank.',
  'The selected sector adds a question, not a compliance judgement or guarantee.',
  'A procurement pack supports review; it is not legal advice, certification or a supplier recommendation.',
];

export type ProcurementInput = {
  title: string; brief: string; sector?: keyof typeof sectors; criteria?: string[];
  mustHaveCriteria?: string[]; suppliers?: string[];
};
type Mode = 'must-have' | 'scored';
export type ProcurementCriterion = {
  id: string; number: number; name: string; question: string; goodAnswer: string; why: string;
  score3: string; mode: Mode;
};
export type ProcurementPack = {
  frameworkVersion: 'v1'; title: string; brief: string; sector: { id: keyof typeof sectors; label: string };
  count: number; mustHaveCount: number; scoredCount: number;
  categories: { id: string; title: string; intro: string; criteria: ProcurementCriterion[] }[];
  availableCriteria: typeof criterionCatalogue; scale: typeof scale;
  scorecard: { suppliers: string[]; rows: { criterionId: string; number: number; name: string; mode: Mode; target: string; entries: { supplier: string; score: null; meetsRequirement: null; evidence: string }[] }[]; instructions: string[] };
  document: { filename: string; title: string; mimeType: string }; sources: { title: string; url: string }[];
  contentCredit: typeof contentCredit; limitations: string[];
};

function invariant(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new Error(`${path}: ${message}`);
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function string(value: unknown, path: string, maximum: number) {
  invariant(typeof value === 'string' && value.length <= maximum && value.trim().length > 0, path, `Use non-empty text up to ${maximum} characters.`);
  return value.trim();
}
function list(value: unknown, path: string, maximum: number, allowed?: string[]) {
  invariant(Array.isArray(value) && value.length <= maximum, path, `Use an array of at most ${maximum} entries.`);
  const result = value.map((item, index) => string(item, `${path}/${index}`, 120));
  invariant(new Set(result.map(item => item.toLowerCase())).size === result.length, path, 'Entries must be unique.');
  if (allowed) invariant(result.every((item, index) => item === value[index] && allowed.includes(item)), path, 'Use only the documented criterion identifiers.');
  return result;
}

/** Build only the buyer-supplied brief and selected framework questions. Never infer supplier evidence. */
export function buildProcurementPack(value: unknown): ProcurementPack {
  invariant(object(value), '/', 'Use a procurement input object.');
  invariant(Object.keys(value).every(key => ['title', 'brief', 'sector', 'criteria', 'mustHaveCriteria', 'suppliers'].includes(key)), '/', 'Unknown procurement field.');
  const title = string(value.title, '/title', 160), brief = string(value.brief, '/brief', 4000);
  const sector = value.sector === undefined ? 'other' : value.sector;
  invariant(typeof sector === 'string' && Object.hasOwn(sectors, sector), '/sector', 'Use financial, public, retail, industrial or other.');
  const sectorId = sector as keyof typeof sectors;
  const selected = value.criteria === undefined ? [...defaultCriteria] : list(value.criteria, '/criteria', 25, generalIds);
  if (sectorId !== 'other') selected.push(`sector-${sectorId}`);
  const mustHaves = value.mustHaveCriteria === undefined ? requirements.filter(item => selected.includes(item.id) && item.must).map(item => item.id)
    : list(value.mustHaveCriteria, '/mustHaveCriteria', 26, selected);
  const suppliers = value.suppliers === undefined ? [] : list(value.suppliers, '/suppliers', 5);
  let number = 0;
  const grouped = categories.map(category => ({ ...category, criteria: requirements.filter(item => item.category === category.id && selected.includes(item.id)).map(item => ({
    id: item.id, number: ++number, name: item.name, question: item.question, goodAnswer: item.good,
    why: item.why, score3: item.three, mode: mustHaves.includes(item.id) ? 'must-have' as const : 'scored' as const,
  })) })).filter(category => category.criteria.length);
  const chosen = grouped.flatMap(category => category.criteria);
  const report: ProcurementPack = {
    frameworkVersion: 'v1', title, brief, sector: { id: sectorId, label: sectors[sectorId] }, count: chosen.length,
    mustHaveCount: mustHaves.length, scoredCount: chosen.length - mustHaves.length, categories: grouped,
    availableCriteria: criterionCatalogue.map(item => ({ ...item })), scale: scale.map(item => ({ ...item })),
    scorecard: { suppliers, rows: chosen.map(item => ({ criterionId: item.id, number: item.number, name: item.name, mode: item.mode, target: item.score3,
      entries: suppliers.map(supplier => ({ supplier, score: null, meetsRequirement: null, evidence: '' })) })), instructions: [...instructions] },
    document: { filename: 'ai-procurement-pack.docx', title, mimeType },
    sources: [{ title: 'Original authored AI RFP framework', url: contentCredit.sourceUrl }, { title: 'Framework content licence', url: contentCredit.licenceUrl }],
    contentCredit: { ...contentCredit }, limitations: [...limitations],
  };
  return report;
}

function documentBlocks(report: ProcurementPack): DocBlock[] {
  const blocks: DocBlock[] = [
    { type: 'title', text: report.title }, { type: 'p', text: report.brief },
    { type: 'p', text: `Sector: ${report.sector.label}. ${report.count} selected criteria: ${report.mustHaveCount} must-have and ${report.scoredCount} scored.` },
    { type: 'h1', text: 'How to use this pack' }, ...report.scorecard.instructions.map(text => ({ type: 'bullet' as const, text })),
    { type: 'h1', text: 'Questions for suppliers' },
  ];
  if (!report.count) blocks.push({ type: 'p', text: 'No criteria were selected. Choose criteria before sending this pack to suppliers.' });
  for (const category of report.categories) {
    blocks.push({ type: 'h2', text: category.title }, { type: 'p', text: category.intro, keepWithNext: true });
    for (const item of category.criteria) blocks.push(
      { type: 'h3', text: `Q${item.number}. ${item.name}${item.mode === 'must-have' ? ' (must-have)' : ''}` },
      { type: 'p', text: item.question }, { type: 'p', text: `A good answer contains: ${item.goodAnswer}` },
      { type: 'p', text: `Why it matters: ${item.why}` },
    );
  }
  blocks.push({ type: 'h1', text: 'Evidence scale' }, ...report.scale.map(entry => ({ type: 'bullet' as const, text: `${entry.score}: ${entry.meaning}` })));
  // A separate compact sheet per supplier leaves room for reviewers' own evidence.
  for (const supplier of report.scorecard.suppliers.length ? report.scorecard.suppliers : ['[Supplier name]']) {
    blocks.push({ type: 'h1', text: `Scorecard: ${supplier}`, pageBreakBefore: true }, { type: 'p', text: 'Reviewer: ____________________    Review date: ____________________', keepWithNext: true });
    blocks.push({ type: 'table', header: ['Q', 'Criterion', 'Type', 'Score or pass/fail', 'Evidence reference'], widths: [800, 2600, 1300, 1700, 3200],
      rows: report.scorecard.rows.map(row => [`Q${row.number}`, row.name, row.mode === 'must-have' ? 'Must-have' : 'Scored 0–3', '', '']) });
  }
  blocks.push({ type: 'h1', text: 'Framework and limitations', pageBreakBefore: true }, ...report.limitations.map(text => ({ type: 'p' as const, text })),
    { type: 'p', text: `${report.contentCredit.title} by ${report.contentCredit.author}, ${report.contentCredit.licence}. ${report.contentCredit.licenceUrl}` },
    { type: 'p', text: `Source: ${report.contentCredit.sourceUrl}` }, { type: 'p', text: `Changes: ${report.contentCredit.changes}` });
  return blocks;
}

/** Return editable OOXML bytes for private tool-result metadata or a direct file response. */
export function buildProcurementDocx(report: ProcurementPack): Uint8Array {
  return buildDocx({ ...report.document, blocks: documentBlocks(report) });
}

const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength, pattern: '\\S' });
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const array = (items: unknown, maxItems: number) => ({ type: 'array', items, maxItems });
const mode = { type: 'string', enum: ['must-have', 'scored'] };
const criterionSchema = obj({ id: { type: 'string', enum: allIds }, number: { type: 'integer', minimum: 1, maximum: 26 }, name: text(160), question: text(1200), goodAnswer: text(1600), why: text(1600), score3: text(1600), mode });
export const procurementInputSchema = obj({
  title: text(160), brief: text(4000), sector: { type: 'string', enum: Object.keys(sectors) },
  criteria: { ...array({ type: 'string', enum: generalIds }, 25), uniqueItems: true, description: 'Selected general criteria. Omit for the 19-criterion baseline. The chosen sector question is added automatically.' },
  mustHaveCriteria: { ...array({ type: 'string', enum: allIds }, 26), uniqueItems: true, description: 'Optional pass/fail criterion IDs. Each must already be selected, including any automatically added sector question.' },
  suppliers: { ...array(text(120), 5), uniqueItems: true, description: 'Supplier names only, for blank scorecards. No scores, evidence or recommendation is invented.' },
}, ['title', 'brief']);
export const procurementReportSchema = obj({
  frameworkVersion: { const: 'v1' }, title: text(160), brief: text(4000), sector: obj({ id: { type: 'string', enum: Object.keys(sectors) }, label: text(100) }),
  count: { type: 'integer', minimum: 0, maximum: 26 }, mustHaveCount: { type: 'integer', minimum: 0, maximum: 26 }, scoredCount: { type: 'integer', minimum: 0, maximum: 26 },
  categories: array(obj({ id: { type: 'string', enum: categories.map(item => item.id) }, title: text(160), intro: text(300), criteria: array(criterionSchema, 26) }), 7),
  availableCriteria: array(obj({ id: { type: 'string', enum: generalIds }, name: text(160), category: text(30), defaultSelected: { type: 'boolean' }, defaultMustHave: { type: 'boolean' } }), 25),
  scale: array(obj({ score: { type: 'integer', minimum: 0, maximum: 3 }, meaning: text(300) }), 4),
  scorecard: obj({ suppliers: array(text(120), 5), rows: array(obj({ criterionId: { type: 'string', enum: allIds }, number: { type: 'integer', minimum: 1, maximum: 26 }, name: text(160), mode, target: text(1600),
    entries: array(obj({ supplier: text(120), score: { type: 'null' }, meetsRequirement: { type: 'null' }, evidence: { const: '' } }), 5) }), 26), instructions: array(text(500), 6) }),
  document: obj({ filename: { const: 'ai-procurement-pack.docx' }, title: text(160), mimeType: { const: mimeType } }),
  sources: array(obj({ title: text(160), url: { type: 'string', format: 'uri', maxLength: 300 } }), 3),
  contentCredit: obj(Object.fromEntries(Object.entries(contentCredit).map(([key, value]) => [key, { const: value }]))), limitations: array(text(500), 5),
});

export const procurementDefinition: ToolDefinition = {
  name: 'build_ai_procurement_pack',
  description: 'Build a vendor-neutral AI delivery procurement pack from a buyer-supplied brief and selected criteria. Returns supplier questions, must-have gates, an evidence rubric, blank supplier scorecards and an editable Word document layout. No supplier evaluation, legal judgement or pricing recommendation is inferred.',
  inputSchema: procurementInputSchema,
  outputSchema: obj({ result: procurementReportSchema, generator: obj({ generator: { const: 'Tenhaw Kit' }, version: { type: 'string' }, url: { type: 'string', format: 'uri' } }) }, ['result']),
  execute: async input => buildProcurementPack(input),
};
