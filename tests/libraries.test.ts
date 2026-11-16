import { describe,it,expect,afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { buildUtmUrl,attributionFooter,renderHtml,renderJson,renderMarkdown,renderReport,escapeHtml,generator,canonicalJson,validateInput,ValidationError,round,invariant } from '../packages/core/src/index.js';
import { loadFramework,scoreReadiness,validateResponses,renderReadinessReport } from '../packages/ai-readiness/src/index.js';
import { calculateRoi,estimateProjectCost,renderRoiReport,type RoiInput } from '../packages/ai-roi/src/index.js';
import { computeMetrics,scoreDeliveryHealth,renderDeliveryReport,type DeliveryEvent } from '../packages/delivery-metrics/src/index.js';
import { prioritiseUseCases,exportRegister,parseRegisterCsv,exportCsv,type UseCase } from '../packages/usecase-register/src/index.js';
import { generateOperatingModel,renderMermaid } from '../packages/opmodel/src/index.js';
import { runVector,vectorFiles } from '../scripts/vectors-ts.js';

describe('shared specification',()=>{
  it('passes all 60 versioned golden cases',async()=>{
    const files=await vectorFiles();expect(files.length).toBeGreaterThanOrEqual(60);
    for(const file of files){const v=JSON.parse(await readFile(file,'utf8'));expect(canonicalJson(runVector(v)),file).toBe(canonicalJson(v.expected));}
  });
});

describe('core and safe report rendering',()=>{
  afterEach(()=>{delete process.env.TENHAW_NO_ATTRIBUTION;});
  it('puts encoded UTM parameters before the booking fragment',()=>{
    const url=new URL(buildUtmUrl({source:'a & b',medium:'report',content:'AI / £'}));
    expect(url.hash).toBe('#book');expect(url.searchParams.get('utm_source')).toBe('a & b');expect(url.searchParams.get('utm_campaign')).toBe('tenhaw-kit');
  });
  it('emits all attribution formats and supports suppression',()=>{
    for(const format of ['md','html','text','json'] as const){expect(attributionFooter(format)).toContain('Tenhaw Kit');expect(attributionFooter(format,{attribution:false})).toBe('');}
    expect(generator({source:'cli',medium:'footer',content:'roi'}).url).toContain('utm_source=cli');
    expect(JSON.parse(attributionFooter('json')).version).toBe('1.0.1');
    process.env.TENHAW_NO_ATTRIBUTION='1';expect(attributionFooter('text')).toBe('');expect(JSON.parse(renderJson({value:1}))).toEqual({value:1});
  });
  it('escapes every HTML delimiter and embeds data without executable markup',()=>{
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
    const html=renderHtml({evidence:'</pre><script>alert(1)</script>'});expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('lang="en-GB"');
  });
  it('works without Node process globals and prevents Markdown fence breakout',()=>{
    const saved=globalThis.process;let footer='';try{globalThis.process=undefined as unknown as NodeJS.Process;footer=attributionFooter('text');}finally{globalThis.process=saved;}
    expect(footer).toContain('Tenhaw Kit');expect(renderMarkdown({evidence:'```\n<script>bad</script>'})).toContain('````json');
  });
  it('preserves machine-readable JSON and wraps scalar results',()=>{
    expect(JSON.parse(renderJson([1,2],{attribution:false}))).toEqual({result:[1,2]});
    expect(JSON.parse(renderJson(null,{attribution:false}))).toEqual({result:null});expect(JSON.parse(renderJson({ok:true})).generator.generator).toBe('Tenhaw Kit');
    expect(renderMarkdown({ok:true})).toContain('```json');expect(renderReport({},'md')).toContain('# Tenhaw');expect(renderReport({},'html')).toContain('<!doctype html>');expect(JSON.parse(renderReport({},'json')).generator).toBeDefined();
  });
  it('canonicalises keys and finite numbers and reports validation paths',()=>{
    expect(canonicalJson({z:1.12345678,a:[3.0,{b:2,a:1}]})).toBe('{"a":[3,{"a":1,"b":2}],"z":1.123457}');expect(round(-.1234567)).toBe(-.123457);
    expect(()=>canonicalJson({x:Infinity})).toThrow(ValidationError);expect(()=>round(Infinity)).toThrow('finite numeric range');expect(()=>round(1e308)).toThrow('finite numeric range');expect(()=>invariant(false,'/x','bad')).toThrow('/x: bad');
    expect(()=>validateInput('readiness-response',{answers:[{questionId:'strategy-1',score:9}]})).toThrow('/answers/0/score');
    expect(()=>validateInput('readiness-response',null)).toThrow('/: must be object');
    expect(validateInput('readiness-response',{answers:[]})).toEqual({answers:[]});
  });
});

describe('readiness methodology',()=>{
  const full=(score:number)=>({answers:loadFramework().dimensions.flatMap(d=>d.questions.map(q=>({questionId:q.id,score})))});
  it('has 30 anchored questions and does not expose mutable global framework state',()=>{
    const f=loadFramework();expect(f.dimensions.flatMap(d=>d.questions)).toHaveLength(30);expect(f.dimensions[0]!.questions[0]!.anchors).toHaveLength(5);f.dimensions[0]!.label='changed';expect(loadFramework().dimensions[0]!.label).not.toBe('changed');expect(()=>loadFramework('v2' as 'v1')).toThrow();
  });
  it('distinguishes missing answers from low maturity and requires coverage for a band',()=>{
    const empty=scoreReadiness({answers:[]});expect(empty.overall).toBeNull();expect(empty.dimensions.every(d=>d.score===null)).toBe(true);expect(empty.coverage).toBe(0);
    const single=scoreReadiness({answers:[{questionId:'strategy-1',score:5}]});expect(single.overall).toBe(5);expect(single.band).toBeNull();expect(single.coverage).toBe(.033333);
    expect(scoreReadiness(full(5)).band).toBe('Leading');expect(scoreReadiness(full(1)).band).toBe('Exploring');
  });
  it('validates duplicate answers and custom dimension weights',()=>{
    expect(()=>validateResponses({answers:[{questionId:'strategy-1',score:1},{questionId:'strategy-1',score:2}]})).toThrow('only once');
    expect(()=>scoreReadiness(full(3),{weights:{unknown:.5}})).toThrow('/weights/unknown');expect(()=>scoreReadiness(full(3),{weights:{strategy:-1}})).toThrow();
    expect(()=>scoreReadiness(full(3),{weights:{strategy:1e308,data:1e308}})).toThrow('finite');
    expect(()=>scoreReadiness(full(3),{weights:Object.fromEntries(loadFramework().dimensions.map(d=>[d.id,0]))})).toThrow('positive');
    expect(scoreReadiness(full(3),{weights:{strategy:1}}).overall).toBe(3);
  });
  it('ranks gaps deterministically and retains content attribution when marketing is suppressed',()=>{
    const r=scoreReadiness({answers:[{questionId:'people-1',score:1},{questionId:'data-1',score:1}]});expect(r.gaps[0]!.questionId).toBe('data-1');expect(r.recommendations[0]!.action).toContain('Agree an owner');
    const html=renderReadinessReport(r,'html',{attribution:false});expect(html).toContain('CC BY 4.0');expect(html).not.toContain('Book an AI readiness audit');expect(JSON.parse(renderReadinessReport(r,'json')).contentCredit).toBe(r.contentCredit);expect(renderReadinessReport(r,'md')).toContain('weighted mean');
  });
});

describe('AI ROI separates capacity from cash',()=>{
  const base:RoiInput={useCase:'Example',users:10,minutesPerTask:30,tasksPerUserPerMonth:20,savings:{low:.1,base:.5,high:1},hourlyCost:40,buildCost:1000,monthlyRunCost:100,adoptionMonths:0,horizonMonths:12,annualDiscountRate:0,cashRealisation:0,currency:'GBP'};
  it('does not turn staff time into cash by default',()=>{const s=calculateRoi(base).scenarios.base;expect(s.totalHoursSaved).toBe(600);expect(s.totalCashBenefit).toBe(0);expect(s.recoveredCapacityHours).toBe(600);expect(s.npv).toBe(-2200);expect(s.paybackMonth).toBeNull();});
  it('has hand-calculated cash payback and NPV when benefits are realised',()=>{const report=calculateRoi({...base,cashRealisation:1});const s=report.scenarios.base;expect(s.totalCashBenefit).toBe(24000);expect(s.npv).toBe(21800);expect(s.paybackMonth).toBe(1);expect(s.recoveredCapacityHours).toBe(0);expect(JSON.parse(renderRoiReport(report,'json')).currency).toBe('GBP');});
  it('handles zero denominator and ordered scenarios',()=>{expect(calculateRoi({...base,users:0,buildCost:0,monthlyRunCost:0}).scenarios.base.roiPercent).toBeNull();expect(calculateRoi({...base,users:0}).scenarios.base.costPerTask).toBeNull();expect(()=>calculateRoi({...base,savings:{low:.9,base:.2,high:.3}})).toThrow('/savings');});
  it('increases NPV monotonically with savings without changing cash assumptions',()=>{const r=calculateRoi({...base,cashRealisation:.5,annualDiscountRate:.1});expect(r.scenarios.low.npv).toBeLessThan(r.scenarios.base.npv);expect(r.scenarios.base.npv).toBeLessThan(r.scenarios.high.npv);});
  it('rejects arithmetic overflow instead of serialising Infinity as null',()=>{expect(()=>calculateRoi({...base,users:1e308,cashRealisation:1})).toThrow('finite numeric range');});
  it('exposes transparent stage cost assumptions and validates overrides',()=>{expect(estimateProjectCost({stage:'poc'}).low).toBe(16000);expect(estimateProjectCost({stage:'pilot',people:1,durationWeeks:2,dayRate:100}).high).toBe(1000);expect(()=>estimateProjectCost({stage:'poc',dayRate:0})).toThrow();expect(()=>estimateProjectCost({stage:'unknown' as 'poc'})).toThrow();});
});

describe('linked DORA events and flow',()=>{
  const cfg={since:'2026-01-01T00:00:00Z',until:'2026-01-08T00:00:00Z'};
  const events:DeliveryEvent[]=[{id:'c',type:'commit',timestamp:'2026-01-01T00:00:00Z',service:'a'},{id:'d',type:'deployment',timestamp:'2026-01-02T00:00:00Z',service:'a',environment:'production',commitIds:['c'],status:'success',rework:false}];
  it('uses real commit-to-production observations',()=>{const r=computeMetrics(events,cfg);expect(r.metrics.changeLeadTime.value).toBe(24);expect(r.metrics.deploymentFrequency.value).toBe(.142857);expect(r.metrics.changeFailRate.value).toBe(0);expect(r.metrics.deploymentReworkRate.value).toBe(0);});
  it('excludes proxy deployments and never infers recovery from missing incidents',()=>{const r=computeMetrics([{...events[1]!,proxy:true} as DeliveryEvent],cfg);expect(r.metrics.deploymentFrequency.value).toBeNull();expect(r.metrics.failedDeploymentRecoveryTime.value).toBeNull();expect(r.caveats.join(' ')).toContain('Proxy');expect(scoreDeliveryHealth(r).actions).toHaveLength(3);expect(renderDeliveryReport(r,'md')).toContain('deploymentFrequency');});
  it('links incidents and recovery, uses failed deployment IDs once',()=>{const r=computeMetrics([...events,{id:'i',type:'incident',startedAt:'2026-01-02T01:00:00Z',restoredAt:'2026-01-02T04:00:00Z',service:'a',deploymentId:'d'}],cfg);expect(r.metrics.changeFailRate.value).toBe(100);expect(r.metrics.failedDeploymentRecoveryTime.value).toBe(3);});
  it('rejects contradictory aggregate report periods, negative values and wrong metric units',()=>{const report=computeMetrics(events,cfg);const period=structuredClone(report);period.metrics.changeLeadTime.period={since:'2025-01-01T00:00:00Z',until:cfg.until};expect(()=>scoreDeliveryHealth(period)).toThrow('report period');const negative=structuredClone(report);negative.metrics.changeFailRate.value=-1;expect(()=>scoreDeliveryHealth(negative)).toThrow('>= 0');const unit=structuredClone(report);unit.metrics.changeLeadTime.unit='days';expect(()=>scoreDeliveryHealth(unit)).toThrow('constant');});
  it('requires service scoping and rejects inconsistent periods and event timing',()=>{expect(()=>computeMetrics([...events,{...events[0]!,id:'other',service:'b'}],cfg)).toThrow('separately');expect(computeMetrics([...events,{...events[0]!,id:'other',service:'b'}],{...cfg,service:'a'}).metrics.changeLeadTime.value).toBe(24);expect(()=>computeMetrics(events,{since:cfg.until,until:cfg.since})).toThrow('after');expect(()=>computeMetrics([...events,{id:'c',type:'commit',service:'a',timestamp:'2026-01-03T00:00:00Z'}],cfg)).toThrow('duplicate');expect(()=>computeMetrics([{id:'x',type:'incident',service:'a',deploymentId:'d',startedAt:cfg.until,restoredAt:cfg.since}],cfg)).toThrow('precede');});
  it('deduplicates exact duplicate events and leaves unknown classifications unavailable',()=>{expect(computeMetrics([...events,events[1]!],cfg).metrics.deploymentFrequency.sampleSize).toBe(1);const d={...events[1]!} as Extract<DeliveryEvent,{type:'deployment'}>;delete d.rework;expect(computeMetrics([d],cfg).metrics.deploymentReworkRate.value).toBeNull();});
  it('computes work and PR measures with explicit active time',()=>{const r=computeMetrics([{id:'w',type:'work-item',service:'a',startedAt:cfg.since,completedAt:'2026-01-02T00:00:00Z',activeMinutes:360},{id:'p',type:'pull-request',service:'a',createdAt:cfg.since,firstReviewAt:'2026-01-01T02:00:00Z',mergedAt:'2026-01-03T00:00:00Z',additions:10,deletions:5}],cfg);expect(r.metrics.flowEfficiency.value).toBe(25);expect(r.metrics.cycleTime.value).toBe(24);expect(r.metrics.throughput.value).toBe(1);expect(r.metrics.prReviewTime.value).toBe(2);expect(r.metrics.prSize.value).toBe(15);});
  it('does not count a redeployed commit as a first delivery and requires timezone data',()=>{const r=computeMetrics([...events,{id:'historic',type:'deployment',service:'a',timestamp:'2025-12-31T12:00:00Z',environment:'production',commitIds:['c'],status:'success',rework:false},{id:'c',type:'commit',service:'a',timestamp:'2025-12-31T00:00:00Z'}].filter(e=>e.id!=='c'||('timestamp'in e&&e.timestamp==='2025-12-31T00:00:00Z')) as DeliveryEvent[],cfg);expect(r.metrics.changeLeadTime.value).toBeNull();expect(()=>computeMetrics([],{since:'2026-01-01',until:cfg.until})).toThrow('timezone');});
});

describe('register and operating-model primitives',()=>{
  const u:UseCase={id:'u',title:'Example',problem:'Repeated work',ownerRole:'Product lead',businessUnit:'Example Team A',value:5,feasibility:4,riskTier:'minimal',status:'idea'};
  it('prioritises within governance gates and blocks prohibited use cases',()=>{const r=prioritiseUseCases({useCases:[u,{...u,id:'p',riskTier:'prohibited'},{...u,id:'h',riskTier:'high'}]});expect(r.useCases.map(x=>x.id)).toEqual(['u','h','p']);expect(r.useCases[2]!.governanceGate).toBe('blocked');expect(r.useCases[0]!.priority).toBe(20);});
  it('round-trips CSV including structured fields, quoting, multiline text and safe formula cells',()=>{for(const title of ['=1+1',' =HYPERLINK("https://example.com")',"'=literal",'A, B\n"C"']){const input={useCases:[{...u,title,dependencies:[],kpis:['a'],dataRequired:['b'],valueEstimate:{amount:1}}]};const csv=exportCsv(input);expect(parseRegisterCsv(csv)).toEqual(input);if(title==='=1+1')expect(csv).toContain("'=1+1");}expect(exportRegister(prioritiseUseCases({useCases:[u]}),'md')).toContain('| id |');expect(JSON.parse(exportRegister(prioritiseUseCases({useCases:[]}),'json')).useCases).toEqual([]);});
  it('validates references and malformed CSV',()=>{expect(()=>prioritiseUseCases({useCases:[u,u]})).toThrow('unique');expect(()=>prioritiseUseCases({useCases:[{...u,dependencies:['missing']}]})).toThrow('another');expect(()=>parseRegisterCsv('id,title\nu,"oops')).toThrow('Unclosed');});
  it('identifies missing operating-model owners and outcomes',()=>{const r=generateOperatingModel({teams:[{id:'t',name:'Team',type:'stream-aligned',size:10}],okrs:[{id:'o',objective:'Improve',keyResults:[]}],roadmap:[{id:'r',title:'Work',horizon:'now'}]});expect(r.checks.map(c=>c.code)).toEqual(['team-size','platform-dependency','okr-owner','roadmap-outcome','roadmap-owner']);});
  it('calculates decreasing targets and uses generated Mermaid IDs',()=>{const r=generateOperatingModel({teams:[{id:'unsafe ] --> x',name:'Team <script>"',type:'platform',size:3}],okrs:[{id:'o',teamId:'unsafe ] --> x',objective:'Reduce',keyResults:[{id:'k',description:'Wait',baseline:10,target:5,current:8,confidence:.5}]}]});expect(r.model.okrs[0]!.keyResults[0]!.progress).toBe(.4);const diagram=renderMermaid(r);expect(diagram).toContain('team0');expect(diagram).not.toContain('unsafe ]');expect(diagram).toContain('&lt;script&gt;');});
  it('validates referential integrity and meaningful targets',()=>{expect(()=>generateOperatingModel({teams:[],interactions:[{from:'a',to:'b',mode:'collaboration'}]})).toThrow('distinct');expect(()=>generateOperatingModel({teams:[],okrs:[{id:'o',objective:'x',keyResults:[{id:'k',description:'x',baseline:1,target:1,current:1,confidence:1}]}]})).toThrow('differ');expect(()=>generateOperatingModel({teams:[{id:'a',name:'A',type:'stream-aligned',size:1,platformDependencies:['missing']}]})).toThrow('platform team');});
});
