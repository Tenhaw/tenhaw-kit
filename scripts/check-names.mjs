import { mkdir, writeFile } from 'node:fs/promises';
const names=[['npm','tenhaw'],['npm','create-tenhaw'],...['core','ai-readiness','delivery-metrics','ai-roi','usecase-register','opmodel','mcp'].map(n=>['npm',`@tenhaw/${n}`]),...['tenhaw','tenhaw-ai-readiness','tenhaw-delivery-metrics','tenhaw-ai-roi'].map(n=>['pypi',n])];
const results=[];
for(const[registry,name]of names){
  const url=registry==='npm'?`https://registry.npmjs.org/${encodeURIComponent(name)}`:`https://pypi.org/pypi/${name}/json`;
  try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});let owner=null,version=null;if(response.status===200){const data=await response.json();version=registry==='npm'?data['dist-tags']?.latest:data.info?.version;owner=registry==='npm'?data.maintainers?.map(m=>m.name)??null:null;}
    results.push({registry,name,httpStatus:response.status,status:response.status===404?'not registered; availability is not guaranteed':response.ok?'registered':'unverified',version,owner});
  }catch{results.push({registry,name,status:'unverified: network error'});}
}
await mkdir('docs/metrics',{recursive:true});const report={checkedAt:new Date().toISOString(),results,note:'No names were claimed. A pending PyPI publisher does not reserve a name. A 404 is not proof that a name is publishable. Verify account and scope ownership before publication.'};
await writeFile('docs/metrics/name-check.json',JSON.stringify(report,null,2)+'\n');
for(const item of results)console.log(`${item.registry} ${item.name}: ${item.status}${item.version?` (${item.version})`:''}`);
if(results.some(r=>r.status.startsWith('unverified')))process.exitCode=1;
