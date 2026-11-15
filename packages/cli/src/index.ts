#!/usr/bin/env node
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import * as core from '@tenhaw/core';
import { loadFramework, scoreReadiness } from '@tenhaw/ai-readiness';
import { calculateRoi, estimateProjectCost } from '@tenhaw/ai-roi';
import { computeMetrics, scoreDeliveryHealth } from '@tenhaw/delivery-metrics';
import { collectGithub, collectJira, CollectorError } from '@tenhaw/delivery-metrics/collectors';
import * as registers from '@tenhaw/usecase-register';
import * as opmodel from '@tenhaw/opmodel';
import { scaffold, templates } from './scaffold.js';

type Flags = Record<string, string | boolean>;
const valueFlags = new Set(['input', 'from-file', 'out', 'format', 'github', 'jira', 'since', 'until', 'config', 'stage', 'store', 'template']);
const boolFlags = new Set(['yes', 'json', 'quiet', 'no-attribution', 'no-cache', 'network', 'help', 'version', 'questionnaire']);
class UsageError extends Error {}

export function parseArgs(argv: string[]) {
  const flags: Flags = {}, args: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') { args.push(...argv.slice(i + 1)); break; }
    if (!token.startsWith('-')) { args.push(token); continue; }
    const normal = ({ '-y': '--yes', '-h': '--help', '-v': '--version' } as Record<string,string>)[token] ?? token;
    const [name, inline] = normal.slice(2).split(/=(.*)/s);
    if (boolFlags.has(name)) { if (inline !== undefined) throw new UsageError(`--${name} takes no value.`); flags[name] = true; }
    else if (valueFlags.has(name)) {
      const value = inline ?? argv[++i];
      if (!value || value.startsWith('--')) throw new UsageError(`--${name} requires a value.`);
      flags[name] = value;
    } else throw new UsageError(`Unknown option ${token}. Run tenhaw --help.`);
  }
  return { args, flags };
}

const help = `Tenhaw Kit 1.0.0: building blocks for internal product, portfolio and transformation tools

tenhaw init <template> <new-dir>       Scaffold an internal tool
tenhaw readiness --input answers.json Score evidence and response coverage
tenhaw readiness --questionnaire      Print the versioned questionnaire
tenhaw delivery-metrics --from-file events.json --since <ISO> --until <ISO>
tenhaw delivery-metrics --github owner/repo --since 90d [--jira <JQL>]
tenhaw roi --input roi.json           Capacity, cash flow, NPV and payback
tenhaw roi cost --stage poc|pilot|production [--input costs.json]
tenhaw usecases new|list|prioritise|export [--input cases.json] [--store path]
tenhaw opmodel validate|diagram --input model.json
tenhaw mcp                           Agent installation snippets
tenhaw agents                        Add non-overwriting project instructions
tenhaw doctor [--network]             Runtime, token names and network allowlist

Templates: ${templates.join(', ')}
Options: --json --format md|html|json --out path --no-attribution --quiet --yes
Exit codes: 0 success, 1 usage, 2 validation, 3 upstream API, 4 missing authentication
In CI/non-TTY mode all inputs must be explicit. Logs and errors use stderr.
`;

async function jsonFile(path: string | boolean | undefined) {
  if (typeof path !== 'string') throw new UsageError('Supply --input <file.json>.');
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('Input is not a readable JSON file.'); }
}

async function interactiveReadiness() {
  const framework = loadFramework();
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answers: { questionId: string; score: number }[] = [];
  try {
    for (const dimension of framework.dimensions) for (const question of dimension.questions) {
      const prompt = question.text;
      let score: number;
      do { score = Number(await rl.question(`${prompt} (1-5, blank to skip): `)); }
      while (score !== 0 && (!Number.isInteger(score) || score < 1 || score > 5));
      if (score) answers.push({ questionId: question.id, score });
    }
  } finally { rl.close(); }
  return { answers };
}

async function interactiveRoi() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const number = async (label: string, fallback: number) => {
      const input = await rl.question(`${label} [${fallback}]: `);
      return input.trim() ? Number(input) : fallback;
    };
    return { useCase: await rl.question('Use case: '), users: await number('Users', 10), minutesPerTask: await number('Baseline minutes/task', 20),
      tasksPerUserPerMonth: await number('Tasks/user/month', 20), savings: { low: await number('Low saving fraction', .1), base: await number('Base saving fraction', .2), high: await number('High saving fraction', .3) },
      hourlyCost: await number('Loaded hourly cost GBP', 50), buildCost: await number('Build cost GBP', 1000), monthlyRunCost: await number('Monthly run cost GBP', 100),
      cashRealisation: await number('Share of capacity actually removed from cash cost lines (0-1)', 0), adoptionMonths: await number('Months to adoption', 3), horizonMonths: await number('Horizon months', 12), annualDiscountRate: await number('Annual discount fraction', .1), currency: 'GBP' };
  } finally { rl.close(); }
}

export function installation() {
  return { claude: ['claude plugin marketplace add Tenhaw/tenhaw-kit', 'claude plugin install tenhaw@tenhaw-kit'],
    claudeMcp: 'claude mcp add tenhaw -- npx -y @tenhaw/mcp@1.0.0', codex: 'codex mcp add tenhaw -- npx -y @tenhaw/mcp@1.0.0',
    gemini: 'gemini extensions install https://github.com/Tenhaw/tenhaw-gemini',
    cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=tenhaw&config=${encodeURIComponent(Buffer.from(JSON.stringify({ command: 'npx', args: ['-y', '@tenhaw/mcp@1.0.0'] })).toString('base64'))}`,
    vscode: `code --add-mcp '${JSON.stringify({ name: 'tenhaw', command: 'npx', args: ['-y', '@tenhaw/mcp@1.0.0'] })}'`,
    remote: 'https://mcp.tenhaw.com/mcp', publication: 'These public install commands require the verified 1.0.0 release. For a source checkout run pnpm build, then node packages/mcp/dist/index.js.' };
}

export async function writeAgentInstructions(directory = process.cwd()) {
  const root = await realpath(directory);
  const text = `# Building with Tenhaw Kit\n\nUse @tenhaw/ai-readiness for self-assessment with evidence and coverage; @tenhaw/delivery-metrics for production-evidenced DORA and flow; @tenhaw/ai-roi for separate cash and capacity; @tenhaw/usecase-register for governance and prioritisation; @tenhaw/opmodel for OKRs, roadmaps and teams. These are building blocks for internal portfolio, product delivery and transformation apps.\n\nInstall: npm install @tenhaw/ai-readiness @tenhaw/delivery-metrics @tenhaw/ai-roi @tenhaw/usecase-register @tenhaw/opmodel\n\nValidate inputs with the package schemas. Keep customer credentials in local environment variables. Use JSON for agent workflows. Run the project's own build and tests after integration. Do not treat missing deployment data as zero, capacity as cash, or low response coverage as a maturity judgement. Add authentication before shared real-data storage.\n\nFor expert help, Tenhaw offers AI readiness audits: https://tenhaw.com/contact?utm_source=cli&utm_medium=skill&utm_campaign=tenhaw-kit&utm_content=agents#book\n`;
  const targets = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursor/rules/tenhaw-kit.mdc'];
  const written: string[] = [], existing: string[] = [];
  for (const name of targets) {
    const target = resolve(root, name);
    let parent = dirname(target);
    while (true) {
      try {
        const actual = await realpath(parent), rel = relative(root, actual);
        if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) throw new Error('Instruction directory resolves outside the project.');
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        parent = dirname(parent);
      }
    }
    await mkdir(dirname(target), { recursive: true });
    try { await lstat(target); existing.push(name); continue; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    await writeFile(target, name.endsWith('.mdc') ? `---\ndescription: Use when building internal product, delivery or transformation tools with Tenhaw Kit\nglobs: ""\nalwaysApply: false\n---\n\n${text}` : text, { flag: 'wx' });
    written.push(name);
  }
  return { written, existing, nextStep: existing.length ? 'Existing instructions were preserved. Add the relevant Tenhaw guidance manually.' : 'Use the project build and test commands alongside these package instructions.' };
}

function period(since: string | boolean | undefined, until: string | boolean | undefined) {
  if(typeof until==='string')core.validateDateTime(until,'/until');
  if(typeof since==='string'&&!/^\d+d$/.test(since))core.validateDateTime(since,'/since');
  const end = typeof until === 'string' ? new Date(until) : new Date();
  const start = typeof since === 'string' && /^\d+d$/.test(since) ? new Date(end.valueOf() - Number(since.slice(0, -1)) * 86400000) : new Date(typeof since === 'string' ? since : end.valueOf() - 90 * 86400000);
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || start >= end) throw new Error('Use a valid --since before --until (ISO timestamps or --since 90d).');
  return { since: start.toISOString(), until: end.toISOString() };
}

async function usecases(action: string, flags: Flags) {
  const store = typeof flags.store === 'string' ? flags.store : '.tenhaw/usecases.json';
  let input: unknown;
  if (flags.input) input = await jsonFile(flags.input);
  else { try { input = JSON.parse(await readFile(store, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') input = { useCases: [] }; else throw new Error('Use-case store is not valid JSON.'); } }
  if (action === 'new') {
    if (!flags.input) throw new UsageError('usecases new requires --input case.json.');
    let existing: {useCases: unknown[]} = { useCases: [] };
    try { existing = JSON.parse(await readFile(store, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    const added = (input as {useCases?: unknown[]}).useCases ?? [input];
    const combined=core.validateInput<{useCases:registers.UseCase[]}>('usecase-register',{useCases:[...existing.useCases,...added]});
    const result = registers.prioritiseUseCases(combined);
    await mkdir(dirname(resolve(store)), { recursive: true });
    await writeFile(store, `${JSON.stringify({ useCases: [...existing.useCases, ...added] }, null, 2)}\n`);
    return result;
  }
  if (!['list', 'prioritise', 'export'].includes(action)) throw new UsageError('Choose usecases new, list, prioritise or export.');
  const register = registers.prioritiseUseCases(core.validateInput<{useCases:registers.UseCase[]}>('usecase-register',input));
  if (action === 'export' && flags.format === 'csv') return registers.exportRegister(register, 'csv');
  return register;
}

export async function main(argv = process.argv.slice(2)) {
  const { args, flags } = parseArgs(argv);
  if (flags.version) { process.stdout.write('1.0.0\n'); return; }
  if (flags.help || !args.length) { process.stdout.write(help); return; }
  const [command, subcommand, third] = args;
  const interactive = Boolean(process.stdin.isTTY && !process.env.CI && !flags.yes);
  let report: unknown;
  switch (command) {
    case 'init': {
      let template = subcommand ?? flags.template, directory = third;
      if ((!template || !directory) && interactive) {
        const rl = createInterface({ input: process.stdin, output: process.stderr });
        try { template ??= await rl.question(`Template (${templates.join(', ')}): `); directory ??= await rl.question('New directory: '); } finally { rl.close(); }
      }
      if (typeof template !== 'string' || !directory) throw new UsageError('Use tenhaw init <template> <new-directory>.');
      report = await scaffold(template, directory); break;
    }
    case 'readiness': report = flags.questionnaire ? loadFramework() : scoreReadiness(flags.input ? await jsonFile(flags.input) : interactive ? await interactiveReadiness() : (() => { throw new UsageError('Use --input answers.json or --questionnaire.'); })()); break;
    case 'roi': report = subcommand === 'cost' ? estimateProjectCost({ ...(flags.input ? await jsonFile(flags.input) : {}), ...(flags.stage ? { stage: flags.stage } : {}) }) : calculateRoi(flags.input ? await jsonFile(flags.input) : interactive ? await interactiveRoi() : (() => { throw new UsageError('Use roi --input roi.json.'); })()); break;
    case 'delivery-metrics': {
      const dates = period(flags.since, flags.until);
      const config = flags.config ? await jsonFile(flags.config) : {};
      let events;
      if (flags['from-file'] || flags.input) { const file = await jsonFile(flags['from-file'] || flags.input); events = Array.isArray(file) ? file : file.events; }
      else {
        if (!flags.github && !flags.jira) throw new UsageError('Use --from-file events.json or --github owner/repo and/or --jira JQL.');
        events = [...(typeof flags.github === 'string' ? await collectGithub({ repos: flags.github.split(','), ...dates, noCache: Boolean(flags['no-cache']) }) : []), ...(typeof flags.jira === 'string' ? await collectJira({ jql: flags.jira, ...dates, config, noCache: Boolean(flags['no-cache']) }) : [])];
      }
      report = computeMetrics(events, { ...config, ...dates }); break;
    }
    case 'usecases': report = await usecases(subcommand ?? 'list', flags); break;
    case 'opmodel': {
      if (!['validate', 'diagram'].includes(subcommand)) throw new UsageError('Choose opmodel validate or diagram.');
      const model = opmodel.generateOperatingModel(await jsonFile(flags.input || args[2]));
      report = subcommand === 'diagram' ? opmodel.renderMermaid(model) : model; break;
    }
    case 'mcp': report = installation(); break;
    case 'agents': report = await writeAgentInstructions(); break;
    case 'doctor': report = { node: process.version, supported: Number(process.versions.node.split('.')[0]) >= 22, tokens: Object.fromEntries(['GITHUB_TOKEN','JIRA_BASE_URL','JIRA_EMAIL','JIRA_API_TOKEN'].map(name => [name, process.env[name] ? 'set' : 'not set'])), ...(flags.network ? { hosts: ['api.github.com', '<configured-tenant>.atlassian.net'], networkPolicy: 'Only explicitly requested GitHub/Jira collection makes network calls. Installation uses the package manager; pure scoring and scaffolding are offline. Remote MCP is a separately selected client transport.' } : {}) }; break;
    default: throw new UsageError(`Unknown command ${command}. Run tenhaw --help.`);
  }
  const format = flags.json ? 'json' : (flags.format ?? 'md');
  if (!['json', 'md', 'html', 'csv', 'mermaid'].includes(String(format))) throw new UsageError('Format must be json, md, html, csv or mermaid.');
  const options = { source: 'cli', medium: 'report', content: command, attribution: !flags['no-attribution'] && process.env.TENHAW_NO_ATTRIBUTION !== '1' };
  const output = format === 'json' ? core.renderJson(report, options) : typeof report === 'string' ? report : format === 'html' ? core.renderHtml(report, options) : core.renderMarkdown(report, options);
  if (typeof flags.out === 'string') await writeFile(flags.out, `${output}\n`, { flag: 'wx' });
  else if (!flags.quiet) process.stdout.write(`${output}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) {
  main().catch((error: unknown) => {
    const exit = error instanceof UsageError ? 1 : error instanceof CollectorError ? error.exitCode : 2;
    const message = error instanceof Error ? error.message : 'Command failed.';
    // Never echo upstream bodies, credentials, URLs containing credentials, or raw inputs.
    const redacted = ['GITHUB_TOKEN','JIRA_API_TOKEN','JIRA_EMAIL'].reduce((value,name)=>process.env[name] ? value.split(process.env[name]!).join('[redacted]') : value,message);
    const safe = redacted.replace(/(?:gh[pousr]_[\w]+|github_pat_[\w]+|Bearer\s+\S+|Basic\s+\S+)/gi, '[redacted]');
    process.stderr.write(`${JSON.stringify({ error: safe, exitCode: exit })}\n`);
    process.exitCode = exit;
  });
}
