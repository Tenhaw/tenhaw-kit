import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildProcurementDocx, buildProcurementPack, criterionCatalogue, defaultCriteria, procurementDefinition, procurementInputSchema, procurementReportSchema, sectors } from '../packages/mcp/src/procurement/index.js';

const ajv = new Ajv2020({ allErrors: true }); addFormats(ajv);
const inputValid = ajv.compile(procurementInputSchema), outputValid = ajv.compile(procurementReportSchema);
const basic = { title: 'Document triage pilot', brief: 'Procure a delivery partner for a controlled pilot using synthetic test records.' };

describe('vendor-neutral AI procurement pack', () => {
  it('builds the source baseline with explicit provenance and blank evidence', () => {
    const report = buildProcurementPack(basic);
    expect(inputValid(basic)).toBe(true); expect(outputValid(report), JSON.stringify(outputValid.errors)).toBe(true);
    expect(report.count).toBe(19); expect(report.count).toBe(defaultCriteria.length);
    expect(report.count).toBe(report.mustHaveCount + report.scoredCount);
    expect(report.availableCriteria).toHaveLength(25); expect(criterionCatalogue).toHaveLength(25);
    expect(report.scale.map(entry => entry.score)).toEqual([0, 1, 2, 3]);
    expect(report.scorecard.suppliers).toEqual([]); expect(report.scorecard.rows.every(row => row.entries.length === 0)).toBe(true);
    expect(report.contentCredit).toMatchObject({ licence: 'CC BY 4.0', author: 'Tenhaw' });
    expect(report.contentCredit.changes).toContain('Supplier answers and prices removed');
    expect(JSON.stringify(report)).not.toMatch(/utm_|Ask us on a call|£|James Rooney|Contract term on request|How Tenhaw answers/);
    expect(report.document.filename).toBe('ai-procurement-pack.docx');
  });

  it.each(Object.keys(sectors))('adds exactly the selected sector question: %s', sector => {
    const report = buildProcurementPack({ ...basic, sector });
    expect(outputValid(report), JSON.stringify(outputValid.errors)).toBe(true);
    const sectorItems = report.categories.find(category => category.id === 'sector')?.criteria ?? [];
    expect(sectorItems.map(item => item.id)).toEqual(sector === 'other' ? [] : [`sector-${sector}`]);
    expect(report.count).toBe(sector === 'other' ? 19 : 20);
  });

  it('uses explicit criteria and must-have choices in stable source order', () => {
    const input = { ...basic, sector: 'financial', criteria: ['eval-criteria', 'ip-ownership', 'data-ai', 'people-team'], mustHaveCriteria: ['data-ai', 'ip-ownership', 'sector-financial'], suppliers: ['Supplier A', 'Supplier B'] };
    const report = buildProcurementPack(input);
    expect(inputValid(input)).toBe(true); expect(outputValid(report), JSON.stringify(outputValid.errors)).toBe(true);
    expect(report.count).toBe(5); expect(report.mustHaveCount).toBe(3); expect(report.scoredCount).toBe(2);
    expect(report.categories.flatMap(category => category.criteria).map(item => item.id)).toEqual(['people-team', 'data-ai', 'ip-ownership', 'eval-criteria', 'sector-financial']);
    for (const row of report.scorecard.rows) {
      expect(row.entries).toEqual(['Supplier A', 'Supplier B'].map(supplier => ({ supplier, score: null, meetsRequirement: null, evidence: '' })));
    }
    expect(report).not.toHaveProperty('ranking');
  });

  it('preserves an intentionally empty general selection and never creates initiatives or evidence', () => {
    const empty = buildProcurementPack({ ...basic, criteria: [], mustHaveCriteria: [], suppliers: ['Potential bidder'] });
    expect(empty.count).toBe(0); expect(empty.categories).toEqual([]); expect(empty.scorecard.rows).toEqual([]);
    expect(empty.document).not.toHaveProperty('blocks');
    expect(outputValid(empty), JSON.stringify(outputValid.errors)).toBe(true);
    const sectorOnly = buildProcurementPack({ ...basic, sector: 'public', criteria: [], mustHaveCriteria: [] });
    expect(sectorOnly.count).toBe(1); expect(sectorOnly.mustHaveCount).toBe(0);
  });

  it.each([
    { ...basic, criteria: ['unknown'] }, { ...basic, criteria: ['sector-financial'] },
    { ...basic, criteria: ['data-ai', 'data-ai'] },
    { ...basic, criteria: ['data-ai'], mustHaveCriteria: ['ip-ownership'] },
    { ...basic, sector: 'financial', mustHaveCriteria: ['sector-public'] },
    { ...basic, suppliers: ['Supplier A', 'supplier a'] },
    { ...basic, suppliers: Array.from({ length: 6 }, (_, index) => `Supplier ${index}`) },
    { ...basic, suppliers: ['   '] }, { ...basic, title: '' }, { ...basic, brief: ' ' },
    { ...basic, brief: 'x'.repeat(4001) }, { ...basic, title: 'x'.repeat(161) },
    { ...basic, sector: 'healthcare' }, { ...basic, sector: null }, { ...basic, criteria: [' data-ai '] }, { ...basic, supplierScores: { invented: 3 } },
    { ...basic, apiKey: 'test-not-a-real-key' }, { ...basic, criteria: null },
  ])('rejects unknown, ambiguous or oversized input without echoing values: %j', input => {
    expect(() => buildProcurementPack(input)).toThrow();
    try { buildProcurementPack(input); } catch (error) { expect(String(error)).not.toContain('test-not-a-real-key'); }
  });

  it('does not change later packs when a caller edits an earlier report', () => {
    const first = buildProcurementPack(basic); first.availableCriteria[0].name = 'Edited locally'; first.scale[0].meaning = 'Edited locally'; first.contentCredit.author = 'Edited locally';
    const second = buildProcurementPack(basic);
    expect(second.availableCriteria[0].name).toBe('Screening before access'); expect(second.scale[0].meaning).not.toBe('Edited locally'); expect(second.contentCredit.author).toBe('Tenhaw');
  });

  it('exposes bounded strict tool schemas and produces the expected report', async () => {
    expect(procurementDefinition.name).toBe('build_ai_procurement_pack');
    expect(procurementInputSchema.additionalProperties).toBe(false);
    const report = await procurementDefinition.execute({ ...basic, sector: 'industrial' }, 'remote') as ReturnType<typeof buildProcurementPack>;
    expect(report.count).toBe(20); expect(outputValid(report), JSON.stringify(outputValid.errors)).toBe(true);
    const outputEnvelope = ajv.compile(procurementDefinition.outputSchema);
    expect(outputEnvelope({ result: report }), JSON.stringify(outputEnvelope.errors)).toBe(true);
  });

  it('creates deterministic editable Word archives with safe XML and no supplier endorsements', async () => {
    const report = buildProcurementPack({ title: 'Pilot <scope> & evaluation', brief: 'Review synthetic <records> & compare evidence.', sector: 'retail', suppliers: ['Example & Partners'] });
    const bytes = buildProcurementDocx(report);
    expect(bytes).toBeInstanceOf(Uint8Array); expect(Buffer.from(bytes).subarray(0, 2).toString()).toBe('PK');
    expect(Buffer.from(buildProcurementDocx(report))).toEqual(Buffer.from(bytes));
    const directory = await mkdtemp(join(tmpdir(), 'tenhaw-procurement-docx-'));
    try {
      const file = join(directory, 'pack.docx'); await writeFile(file, bytes);
      const names = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' });
      expect(names).toContain('word/document.xml'); expect(names).toContain('[Content_Types].xml');
      execFileSync('unzip', ['-t', file], { encoding: 'utf8' });
      const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
      expect(xml).toContain('Pilot &lt;scope&gt; &amp; evaluation'); expect(xml).toContain('Example &amp; Partners');
      expect(xml).toContain('Evidence reference'); expect(xml).toContain('CC BY 4.0'); expect(xml).toContain('No supplier has been evaluated.');
      expect(xml).not.toContain('How Tenhaw answers'); expect(xml).not.toContain('utm_');
      expect(xml).toContain('<w:tblHeader/>'); expect(xml).toContain('w:fill="E7EBF0"');
      expect(xml).toContain('<w:pStyle w:val="Normal"/>'); expect(xml).toContain('<w:pageBreakBefore/>'); expect(xml).toContain('<w:cantSplit/>');
      const styles = execFileSync('unzip', ['-p', file, 'word/styles.xml'], { encoding: 'utf8' });
      expect(styles).toContain('w:default="1" w:styleId="Normal"'); expect(styles).toContain('w:ascii="Arial"');
      expect(styles).toContain('<w:b w:val="0"/>');
      expect((await readFile(file)).byteLength).toBeGreaterThan(4000);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
