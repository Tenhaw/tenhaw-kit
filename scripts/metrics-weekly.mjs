import { mkdir,writeFile } from 'node:fs/promises';
import { join,resolve } from 'node:path';
const npmNames=['tenhaw','create-tenhaw','@tenhaw/core','@tenhaw/ai-readiness','@tenhaw/delivery-metrics','@tenhaw/ai-roi','@tenhaw/usecase-register','@tenhaw/opmodel','@tenhaw/mcp'];
const pythonNames=['tenhaw','tenhaw-ai-readiness','tenhaw-delivery-metrics','tenhaw-ai-roi'];
const repoNames=['tenhaw-kit','tenhaw-gemini','template-ai-adoption-dashboard','template-delivery-metrics-dashboard','template-ai-usecase-register','template-product-operating-model','template-ai-readiness-assessment'];
const args=process.argv.slice(2),index=args.indexOf('--out'),out=resolve(index<0?'artifacts/metrics':args[index+1]);
function isoWeek(value){const date=new Date(Date.UTC(value.getUTCFullYear(),value.getUTCMonth(),value.getUTCDate()));date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));const year=date.getUTCFullYear(),week=Math.ceil((((date-new Date(Date.UTC(year,0,1)))/86400000)+1)/7);return `${year}-${String(week).padStart(2,'0')}`;}
async function observation(url,project){
  try{
    const headers={Accept:'application/json','User-Agent':'Tenhaw-Kit-public-metrics'};
    if(new URL(url).hostname==='api.github.com'&&process.env.GH_TOKEN)headers.Authorization=`Bearer ${process.env.GH_TOKEN}`;
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
    if(!response.ok)return {project,value:null,status:response.status===404?'not-found':'unavailable',reason:`Public API returned HTTP ${response.status}.`,source:url};
    return {project,data:await response.json(),source:url};
  }catch{return {project,value:null,status:'unavailable',reason:'Public API request failed or timed out.',source:url};}
}
const now=new Date(),report={period:isoWeek(now),observedAt:now.toISOString(),npm:[],pypi:[],github:[],registry:null,geminiGallery:{status:'unverified',value:null,reason:'No supported public gallery status API has been verified. Check the gallery manually.'},templateUses:{value:null,reason:'GitHub has no verified public template-use counter. Forks are recorded separately.'},deploys:{value:null,reason:'No public deployment-use counter has been verified. Clicks are not deployments.'}};
for(const name of npmNames){const result=await observation(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,name);report.npm.push('data'in result?{project:name,downloads:Number.isInteger(result.data.downloads)?result.data.downloads:null,start:result.data.start??null,end:result.data.end??null,source:result.source}:result);}
for(const name of pythonNames){const result=await observation(`https://pypistats.org/api/packages/${name}/recent`,name);report.pypi.push('data'in result?{project:name,downloadsLastWeek:Number.isInteger(result.data.data?.last_week)?result.data.data.last_week:null,source:result.source}:result);}
for(const name of repoNames){const result=await observation(`https://api.github.com/repos/Tenhaw/${name}`,`Tenhaw/${name}`);if('data'in result){if(result.data.private)throw new Error('Refusing to include private repository metadata.');report.github.push({project:`Tenhaw/${name}`,stars:result.data.stargazers_count??null,forks:result.data.forks_count??null,isTemplate:result.data.is_template??null,source:result.source});}else report.github.push(result);}
const registry=await observation('https://registry.modelcontextprotocol.io/v0.1/servers?search=com.tenhaw%2Fkit','com.tenhaw/kit');
report.registry='data'in registry?{project:'com.tenhaw/kit',present:Array.isArray(registry.data.servers)?registry.data.servers.some(entry=>(entry.server??entry).name==='com.tenhaw/kit'):null,source:registry.source}:registry;
await mkdir(out,{recursive:true});
await writeFile(join(out,`${report.period}.json`),JSON.stringify(report,null,2)+'\n');
const show=value=>value===null||value===undefined?'Unavailable':String(value);
const md=[`# Tenhaw Kit public metrics, ${report.period}`,'',`Observed ${report.observedAt}. Public observations only. Missing, unpublished or unverified measurements remain unavailable. Package downloads include CI and repeated installs; they are not unique users.`,'','## npm downloads','',...report.npm.map(row=>`- ${row.project}: ${show(row.downloads)}${row.start?` (${row.start} to ${row.end})`:''}. [Source](${row.source}).`),'','## PyPI downloads','',...report.pypi.map(row=>`- ${row.project}: ${show(row.downloadsLastWeek)} last week. [Source](${row.source}).`),'','## GitHub','',...report.github.map(row=>`- ${row.project}: ${show(row.stars)} stars, ${show(row.forks)} forks. [Source](${row.source}).`),'','## Distribution coverage','',`- Official registry presence: ${show(report.registry.present)}. [Source](${report.registry.source}).`,`- Gemini gallery: ${report.geminiGallery.reason}`,`- Template uses: ${report.templateUses.reason}`,`- Deploys: ${report.deploys.reason}`,'','No installs, template uses, conversions or bookings are inferred from these public counts.'].join('\n')+'\n';
await writeFile(join(out,`${report.period}.md`),md);
console.log(`Saved public observations to ${out}/${report.period}.{json,md}; unavailable measurements remain null.`);
