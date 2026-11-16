import { VERSION } from '@tenhaw/core';

const profileIds = ['business-case', 'readiness', 'usecase-prioritiser', 'delivery-health', 'operating-model', 'procurement'] as const;

/** Self-contained MCP Apps UI. Only the allowlisted profile and release version enter the script. */
export function renderAppUi(profileId: string): string {
  if (!profileIds.includes(profileId as typeof profileIds[number])) throw new Error('Unknown Tenhaw app.');
  const config = JSON.stringify({ profileId, version: VERSION }).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tenhaw tools</title><style>
  :root{color-scheme:light dark;font-family:var(--font-sans,system-ui,-apple-system,sans-serif);color:var(--color-text-primary,light-dark(#18212b,#edf1f5));background:var(--color-background-primary,light-dark(#fff,#14191f));font-size:14px;line-height:1.5}*{box-sizing:border-box}body{margin:0}main{padding:20px;max-width:1000px;margin:auto}h1{font-size:23px;line-height:1.2;letter-spacing:-.025em;margin:0 0 8px}h2{font-size:17px;margin:22px 0 12px}h3{font-size:14px;margin:0 0 10px}p{margin:8px 0 14px}.muted,small{color:var(--color-text-secondary,light-dark(#586575,#b1bdcb))}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:650;margin-bottom:8px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.card,fieldset,details{border:1px solid var(--color-border-primary,light-dark(#d7dee6,#3a4654));border-radius:10px;padding:14px;margin:0 0 12px;min-width:0}fieldset{padding-top:10px}legend{font-weight:650;padding:0 5px}.metric strong{display:block;font-size:23px;line-height:1.25;margin:4px 0}.metric small{display:block}label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;min-width:0}input,select,textarea{font:inherit;color:inherit;background:var(--color-background-primary,light-dark(#fff,#14191f));border:1px solid var(--color-border-primary,light-dark(#aebac8,#617083));border-radius:6px;padding:9px;min-width:0;width:100%}textarea{min-height:80px;resize:vertical}input[type=checkbox]{width:auto;align-self:flex-start}button{font:inherit;font-weight:600;padding:9px 13px;border:1px solid var(--color-border-primary,light-dark(#bec9d4,#536173));border-radius:7px;background:var(--color-background-secondary,light-dark(#f2f5f8,#25303c));color:inherit;cursor:pointer}button.primary{background:#ffd400;color:#18212b;border-color:#d1af00}button:disabled{opacity:.55;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid #6595e9;outline-offset:3px}.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:14px 0}.inline{display:flex;gap:8px;align-items:center;flex-direction:row}.inline input{flex:0 0 auto}.status{font-size:12px;min-height:20px;margin:8px 0}.error{color:light-dark(#9e1c23,#ff9aa0)}.badge{display:inline-block;border:1px solid var(--color-border-primary,light-dark(#c3ccd6,#566473));border-radius:20px;font-size:11px;padding:2px 8px}.warn{background:light-dark(#fff3d6,#463b21)}.ok{background:light-dark(#e4f2e8,#203d2b)}.table{overflow:auto;max-width:100%;border-radius:8px}table{border-collapse:collapse;width:100%;font-size:12px}th{text-align:left;font-weight:650}td,th{padding:9px 10px;border-bottom:1px solid var(--color-border-primary,light-dark(#dde3e9,#3b4755));vertical-align:top}td{overflow-wrap:anywhere}summary{font-weight:650;cursor:pointer}details[open]>summary{margin-bottom:12px}.meter{height:7px;border-radius:5px;background:light-dark(#e5eaf0,#374454);overflow:hidden;margin:8px 0}.meter span{height:100%;display:block;background:#6595e9}.list{padding-left:20px}.list li{margin-bottom:7px}.question{padding:12px 0;border-top:1px solid var(--color-border-primary,light-dark(#dde3e9,#3b4755))}.question p{font-size:13px}.code{font-family:ui-monospace,monospace;font-size:12px;min-height:150px}.roadmap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.notice{border-left:3px solid #b59b15;padding-left:12px;font-size:12px}footer{border-top:1px solid var(--color-border-primary,light-dark(#d7dee6,#3a4654));padding-top:12px;margin-top:18px;font-size:11px}.scorecard input{min-width:85px}.scorecard textarea{min-width:150px;min-height:55px}@media(max-width:560px){main{padding:16px}.grid,.roadmap{grid-template-columns:1fr}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:21px}td,th{padding:8px}.card,fieldset,details{padding:12px}}
  </style></head><body><main id="app"></main><script>(${appRuntime})(${config});</script></body></html>`;
}

// Keep browser code in a literal so server bundlers cannot inject inaccessible closure helpers.
const appRuntime = String.raw`function appRuntime(config) {
    const profiles = {
        'business-case': { title: 'AI Business Case', description: 'Test the assumptions behind capacity, cash flow and payback.', tool: 'estimate_ai_roi', action: 'Calculate business case', note: 'Recovered capacity and realised cash savings are shown separately. All defaults are editable synthetic assumptions.' },
        readiness: { title: 'AI Readiness Assessment', description: 'Score explicit evidence across six dimensions and see what to improve.', tool: 'assess_ai_readiness', action: 'Score assessment', note: 'This is an internal self-assessment. Maturity bands require at least 80% response coverage.' },
        'usecase-prioritiser': { title: 'AI Use-case Prioritiser', description: 'Compare value and feasibility while keeping governance gates visible.', tool: 'generate_usecase_register', action: 'Prioritise use cases', note: 'Risk gates precede score ordering. Risk labels support review and are not legal advice.' },
        'delivery-health': { title: 'Delivery Health', description: 'Inspect one service’s aggregate delivery evidence and the next useful action.', tool: 'score_delivery_health', action: 'Assess delivery evidence', note: 'Enter aggregate measures only. Missing observations remain unavailable; raw events and credentials stay local.' },
        'operating-model': { title: 'Product Operating Model', description: 'Connect accountable teams, measurable objectives and roadmap outcomes.', tool: 'generate_operating_model', action: 'Check operating model', note: 'Ownership checks prompt design conversations. The model does not prescribe an organisation.' },
        procurement: { title: 'AI Procurement Pack', description: 'Build a supplier brief, evidence questions and a working evaluation scorecard.', tool: 'build_ai_procurement_pack', action: 'Build procurement pack', note: 'Create the pack, tailor its requirements and record supplier evidence. The Word export contains the generated brief and blank scorecards.' },
    };
    const profile = profiles[config.profileId];
    const root = document.getElementById('app');
    const state = { input: {}, report: null, document: null, questionnaire: null, answers: {}, scores: {}, criteria: null, mustHave: null, dirty: false, connected: false, busy: false, selectedScenario: 'base', gate: 'all' };
    let seq = 0, fieldId = 0, hostOrigin = null;
    const pending = new Map();
    const el = (tag, text, className) => {
        const node = document.createElement(tag);
        if (text !== undefined)
            node.textContent = String(text ?? '');
        if (className)
            node.className = className;
        return node;
    };
    const append = (parent, ...children) => { parent.append(...children); return parent; };
    const button = (text, handler, primary = false) => {
        const node = el('button', text, primary ? 'primary' : '');
        node.type = 'button';
        node.addEventListener('click', handler);
        return node;
    };
    const text = (value) => value === null || value === undefined ? 'Unavailable' : String(value);
    const number = (value, digits = 1) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-GB', { maximumFractionDigits: digits }) : 'Unavailable';
    const percent = (value) => typeof value === 'number' ? number(value * 100) + '%' : 'Unavailable';
    const money = (value, currency = 'GBP') => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'GBP', maximumFractionDigits: 0 }).format(value) : 'Unavailable';
    const field = (parent, label, value, update, options = {}) => {
        const wrapper = el('label', label), id = 'field-' + ++fieldId;
        const input = document.createElement(options.multiline ? 'textarea' : 'input');
        input.id = id;
        wrapper.setAttribute('for', id);
        if (input instanceof HTMLInputElement)
            input.type = options.type ?? 'text';
        input.value = value === null || value === undefined ? '' : String(value);
        if (options.min !== undefined)
            input.setAttribute('min', String(options.min));
        if (options.max !== undefined)
            input.setAttribute('max', String(options.max));
        if (options.step !== undefined)
            input.setAttribute('step', String(options.step));
        input.maxLength = options.maxLength ?? 4000;
        input.required = Boolean(options.required);
        if (options.placeholder)
            input.placeholder = options.placeholder;
        input.addEventListener('input', () => { state.dirty = true; update(options.type === 'number' ? input.value === '' ? null : Number(input.value) : input.value); });
        append(wrapper, input);
        parent.append(wrapper);
        return input;
    };
    const select = (parent, label, value, choices, update) => {
        const wrapper = el('label', label), input = document.createElement('select');
        input.setAttribute('aria-label', label);
        input.id = 'field-' + ++fieldId;
        wrapper.setAttribute('for', input.id);
        for (const choice of choices) {
            const [key, title] = typeof choice === 'string' ? [choice, choice] : choice;
            const option = document.createElement('option');
            option.value = key;
            option.textContent = title;
            input.append(option);
        }
        input.value = String(value ?? '');
        input.addEventListener('change', () => { state.dirty = true; update(input.value); });
        append(wrapper, input);
        parent.append(wrapper);
        return input;
    };
    const check = (parent, label, checked, update) => {
        const wrapper = el('label', undefined, 'inline'), input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;
        input.addEventListener('change', () => { state.dirty = true; update(input.checked); });
        append(wrapper, input, el('span', label));
        parent.append(wrapper);
        return input;
    };
    const card = (parent, label, value, detail) => { const node = el('div', undefined, 'card metric'); append(node, el('small', label), el('strong', value)); if (detail)
        node.append(el('small', detail)); parent.append(node); };
    const list = (parent, title, values) => { if (!values?.length)
        return; parent.append(el('h3', title)); const ul = el('ul', undefined, 'list'); for (const value of values)
        ul.append(el('li', typeof value === 'string' ? value : JSON.stringify(value))); parent.append(ul); };
    const table = (parent, headers, rows) => {
        const wrap = el('div', undefined, 'table'), node = el('table'), head = el('thead'), tr = el('tr'), body = el('tbody');
        if (headers.length > 3) node.style.minWidth = '560px';
        for (const header of headers) {
            const th = el('th', header);
            th.setAttribute('scope', 'col');
            tr.append(th);
        }
        head.append(tr);
        for (const row of rows) {
            const line = el('tr');
            for (const value of row)
                line.append(el('td', value));
            body.append(line);
        }
        append(node, head, body);
        append(wrap, node);
        parent.append(wrap);
        return body;
    };
    const details = (parent, title, open = false) => { const node = document.createElement('details'); node.open = open; node.append(el('summary', title)); parent.append(node); return node; };
    const nextId = (items, prefix) => { let index = 1; while (items.some(item => item.id === prefix + index)) index++; return prefix + index; };
    const meter = (parent, value, label) => { const node = el('div', undefined, 'meter'); node.setAttribute('role', 'img'); node.setAttribute('aria-label', label); const bar = el('span'); bar.style.width = Math.max(0, Math.min(100, value * 100)) + '%'; node.append(bar); parent.append(node); };
    const roiDefault = () => ({ useCase: 'Example: support triage', users: 20, minutesPerTask: 15, tasksPerUserPerMonth: 30, savings: { low: .15, base: .25, high: .35 }, hourlyCost: 50, buildCost: 10000, monthlyRunCost: 200, adoptionMonths: 3, horizonMonths: 12, annualDiscountRate: .1, cashRealisation: 0, currency: 'GBP' });
    const usecaseDefault = () => ({ useCases: [{ id: 'example-1', title: 'Example: support triage', problem: 'Reduce manual routing effort', ownerRole: 'Service owner', businessUnit: 'Operations', value: 4, feasibility: 3, riskTier: 'unknown', status: 'idea' }] });
    const modelDefault = () => ({ teams: [{ id: 'team-1', name: 'Example: product team', type: 'stream-aligned', size: 6, cognitiveLoad: 'medium' }], okrs: [{ id: 'objective-1', objective: 'Example: faster customer resolution', teamId: 'team-1', keyResults: [{ id: 'result-1', description: 'Resolution time in hours', baseline: 48, target: 24, current: 40, confidence: .5 }] }], roadmap: [{ id: 'initiative-1', title: 'Example: simplify triage', horizon: 'now', outcome: 'Reduce avoidable hand-offs', teamId: 'team-1', okrId: 'objective-1' }], interactions: [], products: [] });
    const metricDefs = [['deploymentFrequency', 'Deployment frequency', 'deployments/day'], ['changeLeadTime', 'Change lead time', 'hours'], ['changeFailRate', 'Change fail rate', 'percent'], ['failedDeploymentRecoveryTime', 'Failed deployment recovery time', 'hours'], ['deploymentReworkRate', 'Deployment rework rate', 'percent'], ['cycleTime', 'Cycle time', 'hours'], ['throughput', 'Throughput', 'items/week'], ['wip', 'Work in progress', 'items at period end'], ['flowEfficiency', 'Flow efficiency', 'percent'], ['prReviewTime', 'Pull request review time', 'hours'], ['prSize', 'Pull request size', 'changed lines']];
    const deliveryDefault = () => { const period = { since: '2026-10-01T00:00:00Z', until: '2026-11-01T00:00:00Z' }; return { metrics: { period, metrics: Object.fromEntries(metricDefs.map(([key, , unit]) => [key, { value: null, unit, sampleSize: 0, period: { ...period }, dataSource: 'supplied events', caveats: ['Aggregate supplied by the user; verify production evidence.'] }])), caveats: ['Imported aggregate observations; no raw events are uploaded.'] } }; };
    state.input = config.profileId === 'business-case' ? roiDefault() : config.profileId === 'usecase-prioritiser' ? usecaseDefault() : config.profileId === 'operating-model' ? modelDefault() : config.profileId === 'delivery-health' ? deliveryDefault() : config.profileId === 'procurement' ? { title: 'AI supplier evaluation', brief: '', sector: 'other', suppliers: [] } : { responses: { answers: [] } };
    append(root, el('div', 'Tenhaw / tools', 'eyebrow'), el('h1', profile.title), el('p', profile.description, 'muted'));
    const connection = el('p', 'Connecting to your chat…', 'status');
    connection.setAttribute('role', 'status');
    root.append(connection);
    const form = document.createElement('form');
    form.setAttribute('aria-label', profile.title + ' inputs');
    root.append(form);
    const fields = el('div');
    form.append(fields);
    const actions = el('div', undefined, 'actions'), submit = el('button', profile.action, 'primary');
    submit.type = 'submit';
    submit.disabled = true;
    actions.append(submit);
    form.append(actions);
    const error = el('p', '', 'status error');
    error.setAttribute('role', 'alert');
    form.append(error);
    root.append(el('p', profile.note, 'notice'));
    const output = el('section');
    output.setAttribute('aria-label', 'Results');
    output.setAttribute('aria-live', 'polite');
    root.append(output);
    const exports = el('div', undefined, 'actions');
    root.append(exports);
    const footer = el('footer', 'MIT code · CC BY 4.0 framework content · Inputs are sent only to the connected Tenhaw tool when you run it.', 'muted');
    root.append(footer);
    const notify = (method, params) => window.parent.postMessage({ jsonrpc: '2.0', method, params }, hostOrigin ?? '*');
    const request = (method, params) => new Promise((resolve, reject) => {
        const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('The connected tool did not respond. Retry from this chat.')); }, 20000);
        pending.set(id, { resolve, reject, timer });
        window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, hostOrigin ?? '*');
    });
    const setBusy = (busy) => { state.busy = busy; submit.disabled = busy || !state.connected; submit.textContent = busy ? 'Working…' : profile.action; form.setAttribute('aria-busy', String(busy)); };
    const safeError = () => { error.textContent = 'The request could not be completed. Check the inputs and retry. No result has been replaced.'; };
    const hydrate = (input) => {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            return;
        const valid = config.profileId === 'business-case' ? input.savings && typeof input.useCase === 'string'
            : config.profileId === 'readiness' ? input.mode === 'questionnaire' || Array.isArray(input.responses?.answers)
                : config.profileId === 'usecase-prioritiser' ? Array.isArray(input.useCases)
                    : config.profileId === 'delivery-health' ? input.metrics?.period && input.metrics?.metrics && !('events' in input)
                        : config.profileId === 'operating-model' ? Array.isArray(input.teams)
                            : typeof input.title === 'string' && typeof input.brief === 'string';
        if (!valid)
            throw new Error('Input belongs to a different tool.');
        if (config.profileId === 'readiness' && input.responses) {
            state.answers = {};
            for (const answer of input.responses.answers ?? [])
                state.answers[answer.questionId] = { score: answer.score, evidence: answer.evidence ?? '' };
        }
        if (!(config.profileId === 'readiness' && input.mode === 'questionnaire'))
            state.input = JSON.parse(JSON.stringify(input));
        renderFields();
    };
    const acceptResult = (response) => {
        if (!response || response.isError)
            throw new Error('Tool validation failed.');
        const app = response._meta?.app;
        if (app?.id && app.id !== config.profileId)
            return;
        const report = response.structuredContent?.result;
        if (!report || typeof report !== 'object' || Array.isArray(report))
            return;
        const matches = config.profileId === 'business-case' ? report.scenarios
            : config.profileId === 'readiness' ? Array.isArray(report.dimensions)
                : config.profileId === 'usecase-prioritiser' ? Array.isArray(report.useCases)
                    : config.profileId === 'delivery-health' ? report.metrics && typeof report.status === 'string'
                        : config.profileId === 'operating-model' ? report.model?.teams
                            : Array.isArray(report.categories);
        if (!matches)
            return;
        if (app?.input && !state.dirty)
            hydrate(app.input);
        if (config.profileId === 'readiness' && Array.isArray(report.dimensions) && report.dimensions[0]?.questions) {
            state.questionnaire = report;
            renderFields();
            return;
        }
        state.report = report;
        const doc = response._meta?.document;
        state.document = doc && typeof doc.base64 === 'string' && doc.base64.length <= 16000000 && doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? doc : null;
        if (config.profileId === 'procurement') {
            if (!state.criteria)
                state.criteria = (report.availableCriteria ?? []).filter((item) => item.defaultSelected).map((item) => item.id);
            if (!state.mustHave)
                state.mustHave = report.categories?.flatMap((group) => group.criteria.filter((item) => item.mode === 'must-have').map((item) => item.id)) ?? [];
            renderFields();
        }
        renderResults();
    };
    const call = async (name, input) => {
        if (!state.connected || state.busy)
            return;
        error.textContent = '';
        setBusy(true);
        try {
            const response = await request('tools/call', { name, arguments: input });
            acceptResult(response);
        }
        catch {
            safeError();
        }
        finally {
            setBusy(false);
        }
    };
    const readInput = () => {
        if (config.profileId === 'readiness')
            return { responses: { answers: Object.entries(state.answers).filter(([, value]) => value.score).map(([questionId, value]) => ({ questionId, score: Number(value.score), evidence: value.evidence })) }, ...(state.input.weights ? { weights: state.input.weights } : {}) };
        if (config.profileId === 'procurement')
            return { ...state.input, ...(state.criteria ? { criteria: state.criteria } : {}), ...(state.mustHave ? { mustHaveCriteria: state.mustHave.filter((id) => state.criteria?.includes(id) || id.startsWith('sector-')) } : {}) };
        if (config.profileId === 'delivery-health') {
            const input = JSON.parse(JSON.stringify(state.input));
            for (const metric of Object.values(input.metrics.metrics))
                metric.period = { ...input.metrics.period };
            return input;
        }
        return state.input;
    };
    function renderFields() {
        fields.replaceChildren();
        fieldId = 0;
        const input = state.input;
        if (config.profileId === 'business-case') {
            field(fields, 'Use case', input.useCase, value => input.useCase = value, { required: true });
            const grid = el('div', undefined, 'grid');
            fields.append(grid);
            const items = [['users', 'Users'], ['minutesPerTask', 'Baseline minutes per task'], ['tasksPerUserPerMonth', 'Tasks per user per month'], ['hourlyCost', 'Loaded hourly cost'], ['buildCost', 'Build cost'], ['monthlyRunCost', 'Monthly running cost'], ['adoptionMonths', 'Months to adoption'], ['horizonMonths', 'Forecast months']];
            for (const [key, label] of items)
                field(grid, label, input[key], value => input[key] = value, { type: 'number', min: key === 'horizonMonths' ? 1 : 0, max: key.endsWith('Months') ? 1200 : undefined, step: key.endsWith('Months') ? 1 : 'any', required: true });
            select(grid, 'Currency', input.currency, ['GBP', 'USD', 'EUR'], value => input.currency = value);
            field(grid, 'Cash realisation (%)', input.cashRealisation * 100, value => input.cashRealisation = value / 100, { type: 'number', min: 0, max: 100, step: 'any', required: true });
            const assumptions = details(fields, 'Savings and discount assumptions', true), savings = el('div', undefined, 'grid');
            assumptions.append(savings);
            for (const scenario of ['low', 'base', 'high'])
                field(savings, scenario + ' time saving (%)', input.savings?.[scenario] * 100, value => { input.savings ??= {}; input.savings[scenario] = value / 100; }, { type: 'number', min: 0, max: 100, required: true, step: 'any' });
            field(savings, 'Annual discount rate (%)', input.annualDiscountRate * 100, value => input.annualDiscountRate = value / 100, { type: 'number', min: 0, max: 1000, required: true, step: 'any' });
        }
        else if (config.profileId === 'readiness') {
            fields.append(button(state.questionnaire ? 'Reload questionnaire' : 'Load the 30 questions', () => { void call(profile.tool, { mode: 'questionnaire' }); }));
            fields.append(el('p', 'Leave unknown answers blank. Add evidence for each score. You can also import a responses object below.', 'muted'));
            if (state.questionnaire)
                for (const [index, dimension] of state.questionnaire.dimensions.entries()) {
                    const group = details(fields, dimension.label, index === 0);
                    for (const question of dimension.questions) {
                        const row = el('div', undefined, 'question');
                        row.append(el('p', question.text));
                        const grid = el('div', undefined, 'grid');
                        row.append(grid);
                        const answer = state.answers[question.id] ??= { score: '', evidence: '' };
                        select(grid, 'Score for ' + question.id, answer.score, [['', 'Unknown / skip'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], value => answer.score = value);
                        field(grid, 'Evidence for ' + question.id, answer.evidence, value => answer.evidence = value, { multiline: true });
                        if (Array.isArray(question.anchors)) {
                            const guide = details(row, 'Scoring guide');
                            list(guide, 'Evidence anchors', question.anchors.map((anchor) => anchor.score + ': ' + anchor.label + '. ' + anchor.description));
                        }
                        group.append(row);
                    }
                }
        }
        else if (config.profileId === 'usecase-prioritiser') {
            for (const [index, item] of (input.useCases ?? []).entries()) {
                const group = el('fieldset');
                group.append(el('legend', 'Use case ' + (index + 1)));
                const grid = el('div', undefined, 'grid');
                group.append(grid);
                for (const [key, label] of [['title', 'Title'], ['problem', 'Problem to solve'], ['ownerRole', 'Accountable owner role'], ['businessUnit', 'Business unit']])
                    field(grid, label, item[key], value => item[key] = value, { required: true });
                for (const key of ['value', 'feasibility'])
                    field(grid, key + ' (0–5)', item[key], value => item[key] = value, { type: 'number', min: 0, max: 5, step: 'any', required: true });
                select(grid, 'Risk tier', item.riskTier, ['unknown', 'minimal', 'limited', 'high', 'prohibited'], value => item.riskTier = value);
                select(grid, 'Stage', item.status, ['idea', 'assessed', 'approved', 'PoC', 'pilot', 'production', 'retired'], value => item.status = value);
                group.append(button('Remove use case ' + (index + 1), () => { input.useCases.splice(index, 1); state.dirty = true; renderFields(); }));
                fields.append(group);
            }
            fields.append(button('Add use case', () => { input.useCases ??= []; input.useCases.push({ id: nextId(input.useCases, 'usecase-'), title: '', problem: '', ownerRole: '', businessUnit: '', value: 0, feasibility: 0, riskTier: 'unknown', status: 'idea' }); state.dirty = true; renderFields(); }));
        }
        else if (config.profileId === 'delivery-health') {
            const grid = el('div', undefined, 'grid');
            fields.append(grid);
            for (const [key, label] of [['since', 'Period start (ISO with timezone)'], ['until', 'Period end (ISO with timezone)']])
                field(grid, label, input.metrics?.period?.[key], value => input.metrics.period[key] = value, { required: true });
            for (const [index, [key, label, unit]] of metricDefs.entries()) {
                const parent = index < 5 ? fields : index === 5 ? details(fields, 'Additional flow evidence') : fields.lastElementChild;
                const group = el('fieldset');
                group.append(el('legend', label));
                const values = el('div', undefined, 'grid');
                group.append(values);
                const metric = input.metrics?.metrics?.[key];
                if (!metric)
                    continue;
                field(values, 'Value (' + unit + ')', metric.value, value => metric.value = value, { type: 'number', min: 0, max: unit === 'percent' ? 100 : undefined, step: 'any', placeholder: 'Unknown' });
                field(values, 'Evidence sample size', metric.sampleSize, value => metric.sampleSize = value, { type: 'number', min: 0, step: 1, required: true });
                parent.append(group);
            }
        }
        else if (config.profileId === 'operating-model') {
            for (const [index, team] of (input.teams ?? []).entries()) {
                const group = el('fieldset');
                group.append(el('legend', 'Team ' + (index + 1)));
                const grid = el('div', undefined, 'grid');
                group.append(grid);
                field(grid, 'Team name', team.name, value => team.name = value, { required: true });
                field(grid, 'People', team.size, value => team.size = value, { type: 'number', min: 1, step: 1, required: true });
                select(grid, 'Team type', team.type, ['stream-aligned', 'platform', 'enabling', 'complicated-subsystem'], value => team.type = value);
                select(grid, 'Cognitive load', team.cognitiveLoad ?? 'medium', ['low', 'medium', 'high'], value => team.cognitiveLoad = value);
                group.append(button('Remove team ' + (index + 1), () => { input.teams.splice(index, 1); state.dirty = true; renderFields(); }));
                fields.append(group);
            }
            fields.append(button('Add team', () => { input.teams ??= []; input.teams.push({ id: nextId(input.teams, 'team-'), name: '', size: 5, type: 'stream-aligned', cognitiveLoad: 'medium' }); state.dirty = true; renderFields(); }));
            const group = details(fields, 'Objective and roadmap', true), grid = el('div', undefined, 'grid');
            group.append(grid);
            input.okrs ??= [];
            input.roadmap ??= [];
            if (!input.okrs.length)
                input.okrs.push({ id: 'objective-1', objective: '', keyResults: [{ id: 'result-1', description: '', baseline: 0, target: 1, current: 0, confidence: .5 }] });
            const objective = input.okrs[0];
            objective.keyResults ??= [];
            if (!objective.keyResults.length)
                objective.keyResults.push({ id: 'result-1', description: '', baseline: 0, target: 1, current: 0, confidence: .5 });
            const kr = objective.keyResults[0];
            field(grid, 'Objective', objective.objective, value => objective.objective = value, { required: true });
            select(grid, 'Objective owner', objective.teamId ?? '', [['', 'Unassigned'], ...(input.teams ?? []).map((team) => [team.id, team.name])], value => { if (value)
                objective.teamId = value;
            else
                delete objective.teamId; });
            field(grid, 'Key result measure', kr.description, value => kr.description = value, { required: true });
            for (const key of ['baseline', 'target', 'current'])
                field(grid, key, kr[key], value => kr[key] = value, { type: 'number', step: 'any', required: true });
            field(grid, 'Confidence (%)', kr.confidence * 100, value => kr.confidence = value / 100, { type: 'number', min: 0, max: 100, required: true });
            if (!input.roadmap.length)
                input.roadmap.push({ id: 'initiative-1', title: '', horizon: 'now' });
            const item = input.roadmap[0];
            field(grid, 'Initiative', item.title, value => item.title = value, { required: true });
            field(grid, 'Expected outcome', item.outcome, value => item.outcome = value);
            select(grid, 'Roadmap horizon', item.horizon, ['now', 'next', 'later'], value => item.horizon = value);
            select(grid, 'Initiative owner', item.teamId ?? '', [['', 'Unassigned'], ...(input.teams ?? []).map((team) => [team.id, team.name])], value => { if (value)
                item.teamId = value;
            else
                delete item.teamId; });
        }
        else if (config.profileId === 'procurement') {
            field(fields, 'Pack title', input.title, value => input.title = value, { required: true, maxLength: 160 });
            field(fields, 'What are you buying, and what must it achieve?', input.brief, value => input.brief = value, { multiline: true, required: true });
            const grid = el('div', undefined, 'grid');
            fields.append(grid);
            select(grid, 'Sector', input.sector, [['other', 'General'], ['financial', 'Financial services'], ['public', 'Public sector'], ['retail', 'Retail'], ['industrial', 'Industrial']], value => { input.sector = value; state.mustHave = null; });
            field(grid, 'Supplier names (up to five, comma separated)', (input.suppliers ?? []).join(', '), value => input.suppliers = value.split(',').map((name) => name.trim()).filter(Boolean).slice(0, 5));
            if (state.report?.availableCriteria) {
                const requirements = details(fields, 'Tailor requirements', false);
                for (const criterion of state.report.availableCriteria) {
                    const row = el('div', undefined, 'question');
                    const selection = check(row, criterion.name, state.criteria?.includes(criterion.id), selected => { state.criteria = selected ? [...new Set([...(state.criteria ?? []), criterion.id])] : (state.criteria ?? []).filter((id) => id !== criterion.id); if (!selected) {
                        state.mustHave = (state.mustHave ?? []).filter((id) => id !== criterion.id);
                        must.checked = false;
                    } });
                    const must = check(row, 'Must-have: ' + criterion.name, state.mustHave?.includes(criterion.id), selected => { state.mustHave ??= []; state.mustHave = selected ? [...new Set([...state.mustHave, criterion.id])] : state.mustHave.filter((id) => id !== criterion.id); if (selected && !state.criteria?.includes(criterion.id)) {
                        state.criteria = [...(state.criteria ?? []), criterion.id];
                        selection.checked = true;
                    } });
                    requirements.append(row);
                }
            }
        }
        if (config.profileId !== 'procurement') {
            const advanced = details(fields, 'Import or edit full input JSON');
            const area = field(advanced, 'Tool input JSON', JSON.stringify(readInput(), null, 2), () => { }, { multiline: true, maxLength: 250000 });
            area.className = 'code';
            advanced.append(button('Apply JSON to inputs', () => {
                try {
                    if (area.value.length > 250000)
                        throw new Error();
                    const parsed = JSON.parse(area.value);
                    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || config.profileId === 'delivery-health' && (!parsed.metrics?.metrics || 'events' in parsed))
                        throw new Error();
                    hydrate(parsed);
                    state.dirty = true;
                    error.textContent = '';
                }
                catch {
                    error.textContent = 'Use a valid tool input object. Delivery imports must contain aggregate metrics only.';
                }
            }));
        }
    }
    function renderResults() {
        output.replaceChildren();
        exports.replaceChildren();
        const report = state.report;
        if (!report)
            return;
        output.append(el('h2', 'Result'));
        if (config.profileId === 'business-case' && report.scenarios) {
            const cards = el('div', undefined, 'cards'), base = report.scenarios.base;
            output.append(cards);
            card(cards, 'Base NPV', money(base.npv, report.currency));
            card(cards, 'Recovered capacity', number(base.recoveredCapacityHours) + ' hours', 'Across the forecast, before cash realisation');
            card(cards, 'Realised cash benefit', money(base.totalCashBenefit, report.currency));
            card(cards, 'Payback', base.paybackMonth === null ? 'Not reached' : 'Month ' + base.paybackMonth);
            table(output, ['Scenario', 'NPV', 'Capacity hours', 'Cash benefit', 'Payback month'], ['low', 'base', 'high'].map(name => { const scenario = report.scenarios[name]; return [name, money(scenario.npv, report.currency), number(scenario.recoveredCapacityHours), money(scenario.totalCashBenefit, report.currency), text(scenario.paybackMonth)]; }));
            const flow = details(output, 'Monthly cash flow');
            select(flow, 'Scenario to inspect', state.selectedScenario, ['low', 'base', 'high'], value => { state.selectedScenario = value; renderResults(); });
            const months = report.scenarios[state.selectedScenario].monthlyCashFlow ?? [];
            const keys = months.length ? Object.keys(months[0]) : [];
            table(flow, keys.map(key => key.replace(/([A-Z])/g, ' $1')), months.map((month) => keys.map(key => typeof month[key] === 'number' ? number(month[key]) : text(month[key]))));
        }
        else if (config.profileId === 'readiness' && report.dimensions) {
            const cards = el('div', undefined, 'cards');
            output.append(cards);
            card(cards, 'Response coverage', percent(report.coverage));
            card(cards, 'Overall score', report.overall === null ? 'Unavailable' : number(report.overall) + ' / 5');
            card(cards, 'Maturity band', report.coverage >= .8 ? report.band ?? 'Unavailable' : 'Withheld', 'At least 80% coverage is required');
            const grid = el('div', undefined, 'grid');
            output.append(grid);
            for (const dimension of report.dimensions) {
                const tile = el('div', undefined, 'card');
                append(tile, el('h3', dimension.label), el('p', number(dimension.score) + ' / 5 · ' + dimension.answered + '/' + dimension.total + ' answered'));
                meter(tile, dimension.coverage, dimension.label + ' coverage ' + percent(dimension.coverage));
                grid.append(tile);
            }
            list(output, 'Next evidence and improvement actions', (report.recommendations ?? []).map((item) => item.questionId + ': ' + item.action));
        }
        else if (config.profileId === 'usecase-prioritiser' && report.useCases) {
            const cards = el('div', undefined, 'cards');
            output.append(cards);
            card(cards, 'Use cases', report.useCases.length);
            card(cards, 'Blocked', report.useCases.filter((item) => item.governanceGate === 'blocked').length);
            card(cards, 'Review required', report.useCases.filter((item) => item.governanceGate === 'review-required').length);
            select(output, 'Filter governance gate', state.gate, ['all', 'blocked', 'review-required', 'standard-review'], value => { state.gate = value; renderResults(); });
            table(output, ['Use case', 'Owner', 'Value × feasibility', 'Governance gate', 'Stage'], report.useCases.filter((item) => state.gate === 'all' || item.governanceGate === state.gate).map((item) => [item.title, item.ownerRole, number(item.priority) + ' / 25', item.governanceGate, item.status]));
            output.append(el('p', report.methodology, 'muted'));
        }
        else if (config.profileId === 'delivery-health' && report.metrics) {
            output.append(el('p', report.status, 'badge'));
            const cards = el('div', undefined, 'cards');
            output.append(cards);
            for (const [key, title, unit] of metricDefs.slice(0, 5)) {
                const metric = report.metrics[key];
                card(cards, title, metric?.value === null ? 'Unavailable' : number(metric?.value), unit + ' · n=' + (metric?.sampleSize ?? 0));
            }
            table(output, ['Measure', 'Value', 'Unit', 'Sample', 'Evidence caveats'], metricDefs.map(([key, title]) => { const metric = report.metrics[key]; return [title, number(metric?.value), metric?.unit, metric?.sampleSize ?? 0, (metric?.caveats ?? []).join('; ')]; }));
            list(output, 'Next evidence-collection actions', report.actions ?? []);
        }
        else if (config.profileId === 'operating-model' && report.model) {
            const cards = el('div', undefined, 'cards');
            output.append(cards);
            card(cards, 'Teams', report.model.teams.length);
            card(cards, 'Objectives', report.model.okrs.length);
            card(cards, 'Ownership checks', report.checks.length);
            table(output, ['Team', 'Type', 'People', 'Cognitive load'], report.model.teams.map((team) => [team.name, team.type, team.size, team.cognitiveLoad ?? 'Unspecified']));
            for (const objective of report.model.okrs) {
                const tile = el('div', undefined, 'card');
                tile.append(el('h3', objective.objective));
                for (const kr of objective.keyResults) {
                    tile.append(el('p', kr.description + ': ' + number(kr.current) + ' → ' + number(kr.target) + ' · ' + percent(kr.progress) + ' progress'));
                    meter(tile, kr.progress, kr.description + ' progress ' + percent(kr.progress));
                }
                output.append(tile);
            }
            const roadmap = el('div', undefined, 'roadmap');
            output.append(roadmap);
            for (const horizon of ['now', 'next', 'later']) {
                const column = el('div', undefined, 'card');
                column.append(el('h3', horizon));
                for (const item of report.model.roadmap.filter((item) => item.horizon === horizon))
                    append(column, el('strong', item.title), el('p', item.outcome || 'Outcome not yet stated', 'muted'));
                roadmap.append(column);
            }
            list(output, 'Checks to resolve', report.checks.map((check) => check.entityId + ': ' + check.message));
        }
        else if (config.profileId === 'procurement' && report.categories) {
            const cards = el('div', undefined, 'cards');
            output.append(cards);
            card(cards, 'Requirements', report.count);
            card(cards, 'Must-haves', report.mustHaveCount);
            card(cards, 'Scored requirements', report.scoredCount);
            for (const category of report.categories) {
                const group = details(output, category.title);
                group.append(el('p', category.intro, 'muted'));
                for (const criterion of category.criteria) {
                    const row = el('div', undefined, 'question');
                    append(row, el('h3', criterion.number + '. ' + criterion.name), el('span', criterion.mode, 'badge'), el('p', criterion.question), el('strong', 'Evidence to ask for'), el('p', criterion.goodAnswer), el('small', 'Why: ' + criterion.why));
                    if (criterion.mode === 'scored')
                        row.append(el('p', 'Score 3 target: ' + criterion.score3, 'muted'));
                    group.append(row);
                }
            }
            const scorecard = details(output, 'Working supplier scorecard', true);
            scorecard.append(el('p', 'Scores and evidence stay in this view. Export CSV to keep them. Unknown entries remain blank.', 'muted'));
            if (report.scale)
                table(scorecard, ['Score', 'Evidence standard'], report.scale.map((item) => [item.score, item.meaning]));
            const rows = report.scorecard?.rows ?? [];
            const suppliers = report.scorecard?.suppliers ?? [];
            if (!suppliers.length)
                scorecard.append(el('p', 'Add supplier names above and build the pack to open their scorecards.'));
            for (const supplier of suppliers) {
                const group = details(scorecard, supplier);
                for (const row of rows) {
                    const key = supplier + '\u0000' + row.criterionId, entry = state.scores[key] ??= { supplier, criterionId: row.criterionId, score: '', meetsRequirement: '', evidence: '' };
                    const item = el('div', undefined, 'question');
                    item.append(el('p', row.number + '. ' + row.name));
                    if (row.mode === 'must-have')
                        select(item, 'Meets requirement', entry.meetsRequirement, [['', 'Unknown'], ['yes', 'Yes'], ['no', 'No']], value => entry.meetsRequirement = value);
                    else
                        select(item, 'Evidence score', entry.score, [['', 'Not scored'], ...(report.scale ?? []).map(item => [String(item.score), String(item.score)])], value => entry.score = value);
                    field(item, 'Supplier evidence', entry.evidence, value => entry.evidence = value, { multiline: true });
                    group.append(item);
                }
            }
            list(output, 'Evaluation instructions', report.scorecard?.instructions ?? []);
            if (state.document)
                exports.append(button('Download Word pack', downloadWord, true));
        }
        list(output, 'Method and limitations', report.limitations ?? []);
        if (report.contentCredit)
            output.append(el('small', typeof report.contentCredit === 'string' ? report.contentCredit : Object.values(report.contentCredit).join(' · ')));
        exports.append(button('Export result JSON', () => download(JSON.stringify({ result: state.report, ...(config.profileId === 'procurement' ? { evaluation: state.scores } : {}) }, null, 2), 'application/json', config.profileId + '.json')));
        exports.append(button('Export CSV', exportCsv));
    }
    const download = (body, type, filename) => {
        const url = URL.createObjectURL(new Blob([body], { type })), anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
        root.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    function downloadWord() {
        try {
            const doc = state.document;
            if (!doc || !/^[A-Za-z0-9+/]*={0,2}$/.test(doc.base64))
                throw new Error();
            const bytes = Uint8Array.from(atob(doc.base64), char => char.charCodeAt(0));
            download(bytes, doc.mimeType, String(doc.filename ?? 'ai-procurement-pack.docx'));
        }
        catch {
            error.textContent = 'The Word export is unavailable. Build the pack again to refresh it.';
        }
    }
    function exportCsv() {
        const report = state.report;
        let rows = [];
        if (config.profileId === 'business-case')
            rows = [['scenario', 'npv', 'recovered_capacity_hours', 'cash_benefit', 'payback_month'], ...['low', 'base', 'high'].map(key => [key, report.scenarios[key].npv, report.scenarios[key].recoveredCapacityHours, report.scenarios[key].totalCashBenefit, report.scenarios[key].paybackMonth])];
        if (config.profileId === 'readiness')
            rows = [['dimension', 'score', 'answered', 'total', 'coverage'], ...report.dimensions.map((item) => [item.label, item.score, item.answered, item.total, item.coverage])];
        if (config.profileId === 'usecase-prioritiser')
            rows = [['id', 'title', 'owner_role', 'value', 'feasibility', 'priority', 'governance_gate'], ...report.useCases.map((item) => [item.id, item.title, item.ownerRole, item.value, item.feasibility, item.priority, item.governanceGate])];
        if (config.profileId === 'delivery-health')
            rows = [['measure', 'value', 'unit', 'sample_size'], ...metricDefs.map(([key]) => [key, report.metrics[key]?.value, report.metrics[key]?.unit, report.metrics[key]?.sampleSize])];
        if (config.profileId === 'operating-model')
            rows = [['team_id', 'team', 'type', 'people', 'cognitive_load'], ...report.model.teams.map((item) => [item.id, item.name, item.type, item.size, item.cognitiveLoad])];
        if (config.profileId === 'procurement')
            rows = [['supplier', 'criterion_id', 'requirement', 'mode', 'score', 'meets_requirement', 'evidence'], ...(report.scorecard?.suppliers ?? []).flatMap((supplier) => (report.scorecard.rows ?? []).map((row) => { const entry = state.scores[supplier + '\u0000' + row.criterionId] ?? {}; return [supplier, row.criterionId, row.name, row.mode, entry.score, entry.meetsRequirement, entry.evidence]; }))];
        const csv = rows.map(row => row.map(value => { const raw = String(value ?? ''); const safe = /^'|^\s*[=+\-@]|^[\t\r]/.test(raw) ? "'" + raw : raw; return '"' + safe.replaceAll('"', '""') + '"'; }).join(',')).join('\r\n');
        download(csv, 'text/csv;charset=utf-8', config.profileId + '.csv');
    }
    form.addEventListener('submit', event => { event.preventDefault(); if (!form.reportValidity())
        return; try {
        void call(profile.tool, readInput());
    }
    catch {
        safeError();
    } });
    window.addEventListener('message', event => {
        if (event.source !== window.parent || window.parent === window || hostOrigin && event.origin !== hostOrigin)
            return;
        const message = event.data;
        if (!message || message.jsonrpc !== '2.0')
            return;
        if (typeof message.id === 'number' && !message.method) {
            const current = pending.get(message.id);
            if (!current)
                return;
            if (event.origin && event.origin !== 'null')
                hostOrigin ??= event.origin;
            clearTimeout(current.timer);
            pending.delete(message.id);
            message.error ? current.reject(new Error('Host rejected request.')) : current.resolve(message.result);
            return;
        }
        if (message.method === 'ui/notifications/tool-result') {
            try {
                acceptResult(message.params);
            }
            catch {
                safeError();
            }
        }
        if (message.method === 'ui/notifications/tool-input' && !state.dirty) {
            try {
                hydrate(message.params?.arguments ?? {});
            }
            catch {
                safeError();
            }
        }
    });
    renderFields();
    request('ui/initialize', { appInfo: { name: 'tenhaw-' + config.profileId, version: config.version }, appCapabilities: {}, protocolVersion: '2026-01-26' }).then(() => {
        state.connected = true;
        connection.textContent = 'Connected · edit inputs, then run the tool.';
        submit.disabled = false;
        notify('ui/notifications/initialized', {});
    }).catch(() => { connection.textContent = 'Open this app in its connected chat to run the tools.'; });
}`;
