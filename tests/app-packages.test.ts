import { afterEach, describe, expect, it } from 'vitest';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { appTools, runAppTool } from '../packages/mcp/src/apps.js';
import { runTool, toolsFor } from '../packages/mcp/src/tools.js';

type ReviewCase = { id: string; executionStatus: string; calls: { tool: string; arguments: unknown }[]; expectedAssertions: string[] };
type Product = { id: string; kind: 'hosted' | 'desktop'; packagePath: string; pluginName: string; endpoint: string | null; uiDomain?: string; tools: string[]; skillName?: string; requiresLocalExecutor: boolean; reviewCases: { positive: ReviewCase[]; negative: ReviewCase[] } };
const root = resolve('.'), temporary: string[] = [];
const catalog = JSON.parse(await readFile(join(root, 'spec/content/app-products.json'), 'utf8')) as { products: Product[] };
const hosted = catalog.products.filter(product => product.kind === 'hosted');
const run = (directory = root, check = false) => spawnSync(process.execPath, [join(root, 'scripts/generate-app-plugins.mjs'), '--root', directory, '--json', ...(check ? ['--check'] : [])], { cwd: root, encoding: 'utf8', timeout: 15000 });
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
const pluginSchema = ajv.compile(JSON.parse(await readFile(join(root, 'tools/plugin-schemas/agent-plugin.schema.json'), 'utf8')));
const mcpSchema = ajv.compile(JSON.parse(await readFile(join(root, 'tools/plugin-schemas/agent-mcp.schema.json'), 'utf8')));
async function temp() { const directory = await mkdtemp(join(tmpdir(), 'tenhaw-app-package-')); temporary.push(directory); return directory; }
async function fixture() {
  const directory = await temp();
  for (const path of ['spec/content/app-products.json', 'packages/core/package.json', 'plugins/assets/icon.png', 'LICENSE', 'LICENSE-CONTENT']) {
    await mkdir(join(directory, path, '..'), { recursive: true }); await cp(join(root, path), join(directory, path));
  }
  return directory;
}
afterEach(async () => { await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('focused ChatGPT app packages', () => {
  it('contains exactly six scoped hosted products and a truthful remote-plus-desktop developer product', () => {
    expect(hosted).toHaveLength(6); expect(catalog.products).toHaveLength(7);
    expect(new Set(catalog.products.map(product => product.id)).size).toBe(7);
    const developer = catalog.products.find(product => product.kind === 'desktop')!;
    expect(developer).toMatchObject({ id: 'developer-kit', pluginName: 'tenhaw-developer-tools', packagePath: 'plugins/openai/tenhaw', endpoint: 'https://mcp.tenhaw.com/mcp', requiresLocalExecutor: true });
    expect([...developer.tools].sort()).toEqual(toolsFor('remote').map(tool => tool.name).sort());
  });

  for (const product of hosted) it(`ships a portable focused ${product.id} package with honest reviewer metadata`, async () => {
    const directory = join(root, product.packagePath);
    const manifest = JSON.parse(await readFile(join(directory, 'plugin.json'), 'utf8'));
    const mcp = JSON.parse(await readFile(join(directory, 'mcp.json'), 'utf8'));
    expect(pluginSchema(manifest), ajv.errorsText(pluginSchema.errors)).toBe(true);
    expect(mcpSchema(mcp), ajv.errorsText(mcpSchema.errors)).toBe(true);
    expect(manifest.name).toBe(product.pluginName);
    expect(Object.keys(mcp.mcpServers)).toEqual([product.pluginName]);
    expect(product.uiDomain).toBe(`https://${product.id}.apps.tenhaw.com`);
    expect(mcp.mcpServers[product.pluginName]).toEqual({ type: 'streamable-http', url: `${product.uiDomain}/mcp/apps/${product.id}` });
    const extension = manifest.extensions['com.openai'], ui = extension.interface;
    expect(ui.displayName.length).toBeLessThanOrEqual(30); expect(ui.shortDescription.length).toBeLessThanOrEqual(30);
    expect(ui.termsOfServiceURL).toBe('https://kit.tenhaw.com/terms/');
    expect(ui.websiteURL).toBe(`https://kit.tenhaw.com/apps/${product.id}/`);
    expect(extension).not.toHaveProperty('hooks'); expect(extension).not.toHaveProperty('apps'); expect(extension).not.toHaveProperty('requires_local_executor', true);
    expect(extension.review.test_cases.positive).toHaveLength(5); expect(extension.review.test_cases.negative).toHaveLength(3);
    expect(extension.review).not.toHaveProperty('demo_recording_url'); expect(extension.review).not.toHaveProperty('test_credentials');
    expect(extension.publication.release_notes).toBeTypeOf('string');
    const entries = await readdir(join(directory, 'skills')); expect(entries).toEqual([product.skillName]);
    const skill = await readFile(join(directory, 'skills', product.skillName!, 'SKILL.md'), 'utf8');
    expect(skill).toContain(`name: ${product.skillName}`);
    expect(skill).not.toMatch(/\bnpx\b|packages\/cli|--input|process\.env/);
    for (const tool of product.tools) expect(skill).toContain(tool);
    const icon = await readFile(join(directory, ui.composerIcon)); expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(await readFile(join(directory, 'LICENSE'), 'utf8')).toContain('MIT License');
    expect(await readFile(join(directory, 'LICENSE-CONTENT'), 'utf8')).toContain('CC BY');
    const review = JSON.parse(await readFile(join(root, 'launch/apps', product.id, 'review-cases.json'), 'utf8'));
    expect(review.status).toBe('not-run');
    expect([...review.positive, ...review.negative].every((test: ReviewCase) => test.executionStatus === 'not-run' && test.expectedAssertions.length > 0)).toBe(true);
    for (const test of review.positive) expect(test.calls.every((call: { tool: string }) => product.tools.includes(call.tool))).toBe(true);
    const submission = JSON.parse(await readFile(join(root, 'launch/apps', product.id, 'submission.json'), 'utf8'));
    expect(submission.status).toBe('draft-unsubmitted'); expect(submission.videoRecordingUrl).toBeNull();
    expect(submission.uiDomain).toBe(product.uiDomain);
    expect(submission.ownerGates.find((gate: { id: string }) => gate.id === 'service-terms').status).toBe('pending-owner-scope-approval');
    expect(submission.ownerGates.find((gate: { id: string }) => gate.id === 'dedicated-origin-dns-tls').status).toBe('pending-owner-deployment');
  });

  for (const product of hosted) it(`executes the ${product.id} synthetic positive inputs against its scoped data and render operations`, async () => {
    const tools = appTools(product.id);
    expect(tools.map(tool => tool.name).sort()).toEqual([...product.tools].sort());
    for (const scenario of product.reviewCases.positive) {
      const outputs = [];
      for (const call of scenario.calls) {
        const definition = tools.find(tool => tool.name === call.tool)!;
        const validator = new Ajv2020({ allErrors: true, strict: false }); addFormats(validator);
        const validate = validator.compile(definition.outputSchema);
        const output = await runAppTool(product.id, call.tool, call.arguments);
        expect(validate(output), `${product.id}/${scenario.id}: ${validator.errorsText(validate.errors)}`).toBe(true);
        outputs.push(output);
      }
      if (outputs.length === 2 && JSON.stringify(scenario.calls[0].arguments) === JSON.stringify(scenario.calls[1].arguments)) expect(outputs[1]).toEqual(outputs[0]);
      if (product.id === 'readiness' && ['P2', 'P3'].includes(scenario.id)) expect(outputs[0]).toMatchObject({ result: { band: null } });
      if (product.id === 'usecase-prioritiser' && scenario.id === 'P2') expect(outputs[0]).toMatchObject({ result: { useCases: [{ priority: 12 }] } });
      if (product.id === 'usecase-prioritiser' && scenario.id === 'P5') expect(outputs[0]).toMatchObject({ result: { useCases: [{ governanceGate: 'blocked' }] } });
      if (product.id === 'delivery-health' && scenario.id === 'P2') expect(outputs[0]).toMatchObject({ result: { metrics: { changeLeadTime: { value: 48, sampleSize: 1 } } } });
      if (product.id === 'procurement' && scenario.id === 'P2') expect(outputs[0]).toMatchObject({ result: { count: 5, mustHaveCount: 3, scoredCount: 2 } });
      if (product.id === 'procurement' && scenario.id === 'P3') expect(outputs[0]).toMatchObject({ result: { count: 0 } });
    }
  });

  it('executes every developer MCP review input through the six actual remote tools', async () => {
    const developer = catalog.products.find(product => product.kind === 'desktop')!, definitions = toolsFor('remote');
    const covered = new Set<string>();
    for (const scenario of developer.reviewCases.positive) for (const call of scenario.calls) {
      const definition = definitions.find(tool => tool.name === call.tool)!;
      expect(definition, scenario.id).toBeDefined(); covered.add(call.tool);
      const validator = new Ajv2020({ allErrors: true, strict: false }); addFormats(validator);
      const validate = validator.compile(definition.outputSchema);
      const output = await runTool(call.tool, call.arguments, 'remote');
      expect(validate(output), `${scenario.id}/${call.tool}: ${validator.errorsText(validate.errors)}`).toBe(true);
      if (call.tool === 'score_delivery_health') expect(output).toMatchObject({ result: { metrics: { changeLeadTime: { value: 48, sampleSize: 1 } } } });
    }
    expect([...covered].sort()).toEqual([...developer.tools].sort());
    const manifest = JSON.parse(await readFile(join(root, developer.packagePath, 'plugin.json'), 'utf8'));
    const extension = manifest.extensions['com.openai']; expect(extension.requires_local_executor).toBe(true);
    expect(extension.review.test_cases.positive).toHaveLength(5); expect(extension.review.test_cases.negative).toHaveLength(3);
    const declared = new Set(extension.review.test_cases.positive.flatMap((test: { tools_triggered: string }) => test.tools_triggered.split(',').map(name => name.trim())));
    expect([...declared].sort()).toEqual([...developer.tools].sort());
    expect(extension.review).not.toHaveProperty('demo_recording_url');
    const mcp = JSON.parse(await readFile(join(root, developer.packagePath, 'mcp.json'), 'utf8'));
    expect(mcp.mcpServers).toEqual({ 'tenhaw-developer-tools': { type: 'streamable-http', url: 'https://mcp.tenhaw.com/mcp' } });
    const sources = await Promise.all((await readdir(join(root, developer.packagePath, 'skills'))).map(name => readFile(join(root, developer.packagePath, 'skills', name, 'SKILL.md'), 'utf8')));
    for (const tool of developer.tools) expect(sources.some(source => source.includes(tool)), tool).toBe(true);
    expect(sources.every(source => source.includes('Connected calculation and validation') && source.includes('Preserve the host repository'))).toBe(true);
  });

  it('generates deterministic output and detects changed or missing managed files without writing', async () => {
    const directory = await fixture();
    expect(run(directory).status).toBe(0); expect(run(directory, true).status).toBe(0);
    const file = join(directory, hosted[0].packagePath, 'plugin.json'); await writeFile(file, 'changed');
    const check = run(directory, true); expect(check.status).toBe(1); expect(JSON.parse(check.stdout).changed).toContain(`${hosted[0].packagePath}/plugin.json`); expect(await readFile(file, 'utf8')).toBe('changed');
    expect(run(directory).status).toBe(0); expect(run(directory, true).status).toBe(0);
  });

  it('generates a reviewable seven-product repository marketplace with root-relative sources', async () => {
    const directory = await fixture(); expect(run(directory).status).toBe(0);
    const file = join(directory, '.agents/plugins/marketplace.json'), marketplace = JSON.parse(await readFile(file, 'utf8'));
    expect(marketplace.name).toBe('tenhaw-apps'); expect(marketplace.interface.displayName).toBe('Tenhaw Apps');
    expect(marketplace.plugins).toHaveLength(7);
    for (const product of catalog.products) {
      expect(marketplace.plugins.find((entry: { name: string }) => entry.name === product.pluginName)).toEqual({
        name: product.pluginName, source: { source: 'local', path: `./${product.packagePath}` },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity',
      });
    }
    await writeFile(file, '{}'); const check = run(directory, true); expect(check.status).toBe(1); expect(await readFile(file, 'utf8')).toBe('{}');
    expect(JSON.parse(check.stdout).changed).toContain('.agents/plugins/marketplace.json');
  });

  it('rejects a shared or mismatched hosted UI origin', async () => {
    const directory = await fixture(), file = join(directory, 'spec/content/app-products.json');
    const modified = JSON.parse(await readFile(file, 'utf8')); modified.products[1].uiDomain = modified.products[0].uiDomain; await writeFile(file, JSON.stringify(modified));
    expect(run(directory).status).toBe(1); expect(await readdir(join(directory, 'plugins'))).toEqual(['assets']);
  });

  it('rejects a manipulated output path before creating any app package', async () => {
    const directory = await fixture(), file = join(directory, 'spec/content/app-products.json');
    const modified = JSON.parse(await readFile(file, 'utf8')); modified.products[0].packagePath = '../outside'; await writeFile(file, JSON.stringify(modified));
    expect(run(directory).status).toBe(1); expect(await readdir(join(directory, 'plugins'))).toEqual(['assets']);
  });

  it('rejects symlinked sources and destinations before the first output mutation', async () => {
    const directory = await fixture(), outside = await temp();
    await mkdir(join(directory, 'plugins/openai')); await symlink(outside, join(directory, hosted[0].packagePath));
    expect(run(directory).status).toBe(1); expect(await readdir(outside)).toEqual([]);
    const sourceFixture = await fixture(); await rm(join(sourceFixture, 'plugins/assets/icon.png')); await symlink(join(root, 'plugins/assets/icon.png'), join(sourceFixture, 'plugins/assets/icon.png'));
    expect(run(sourceFixture).status).toBe(1); expect(await readdir(join(sourceFixture, 'plugins'))).toEqual(['assets']);
  });

  it('refuses to use a directory as a managed output before writing other outputs', async () => {
    const directory = await fixture(); await mkdir(join(directory, 'launch/apps/procurement/submission.json'), { recursive: true });
    expect(run(directory).status).toBe(1); expect(await readdir(join(directory, 'plugins'))).toEqual(['assets']);
  });
});
