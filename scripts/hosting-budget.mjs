import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const names=['tenhaw-kit-docs','tenhaw-mcp'],budgetUsd=25;
let raw;
try{raw=execFileSync('vercel',['usage','--group-by','project','--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
catch{throw new Error('Could not read Vercel project usage. Sign in to the intended team; no account-wide budget was changed.');}
const source=JSON.parse(raw);
if(source.pricingUnit!=='USD'||source.groupBy?.dimension!=='project'||!Array.isArray(source.groupBy.data))throw new Error('Unexpected Vercel usage schema; no budget figure inferred.');
const projects=names.map(name=>{
  const row=source.groupBy.data.find(row=>row.name===name);
  return {name,effectiveCostUsd:typeof row?.totals?.effectiveCost==='number'?row.totals.effectiveCost:null,billedCostUsd:typeof row?.totals?.billedCost==='number'?row.totals.billedCost:null};
});
const complete=projects.every(project=>project.effectiveCostUsd!==null),total=complete?projects.reduce((sum,project)=>sum+project.effectiveCostUsd,0):null;
const report={period:source.period,budgetUsd,projects,totalEffectiveCostUsd:total,remainingUsd:total===null?null:budgetUsd-total,status:total===null?'unavailable':total>=budgetUsd?'at-or-above-budget':'below-budget',teamAlert:'unchanged',note:'Kit-only report. No account-wide budget or automatic production pause was changed. Usage can be delayed; this is not a hard cap.'};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/hosting-budget.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
