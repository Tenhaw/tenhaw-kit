import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
const root=resolve('.'),artifacts=join(root,'artifacts');
const names=['core','ai-readiness','delivery-metrics','ai-roi','usecase-register','opmodel','cli','create','mcp'];
await mkdir(artifacts,{recursive:true});
const pnpm=process.env.npm_execpath?.includes('pnpm')?{file:process.execPath,args:[process.env.npm_execpath]}:{file:'pnpm',args:[]};
const run=(file,args,cwd=root)=>execFileSync(file,args,{cwd,env:{...process.env,CI:'true'},stdio:'pipe',maxBuffer:8*1024*1024}).toString();
async function probeMcp(binary,cwd){return new Promise((done,reject)=>{
  const child=spawn(process.execPath,[binary],{cwd,env:{...process.env,TENHAW_NO_ATTRIBUTION:'1'},stdio:'pipe'});
  const finish=(error,result)=>{clearTimeout(timer);child.kill();error?reject(error):done(result);};
  const timer=setTimeout(()=>finish(new Error('Installed MCP protocol probe timed out.')),12000);
  child.on('error',error=>finish(error));
  createInterface({input:child.stdout}).on('line',line=>{try{const response=JSON.parse(line);if(response.error)return finish(new Error('Installed MCP returned a protocol error.'));if(response.id===1){child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})+'\n');}if(response.id===2){if(response.result.tools.length!==8)return finish(new Error('Installed MCP tool inventory mismatch.'));finish(null,response.result.tools.length);}}catch{finish(new Error('Installed MCP emitted non-JSON stdout.'));}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'installed-package-check',version:'1.0.0'}}})+'\n');
});}
const tarballs=[];
for(const name of names){
  run(pnpm.file,[...pnpm.args,'--dir',join(root,'packages',name),'pack','--pack-destination',artifacts]);
  const pkg=JSON.parse(await readFile(join(root,'packages',name,'package.json'),'utf8'));
  const filename=`${pkg.name.replace('@','').replaceAll('/','-')}-${pkg.version}.tgz`;
  tarballs.push(join(artifacts,filename));
  const archive=run('tar',['-tzf',join(artifacts,filename)]);
  const packedManifest=JSON.parse(run('tar',['-xOf',join(artifacts,filename),'package/package.json']));
  if(JSON.stringify(packedManifest.dependencies??{}).includes('workspace:'))throw new Error(`Unresolved workspace dependency in ${filename}`);
  if(/(?:^|\/)(?:node_modules|\.env(?:\.[^/\n]+)?|\.git|\.tenhaw)(?:\/|$)/m.test(archive.replaceAll('.env.example','example-env')))throw new Error(`Unexpected private/generated files in ${filename}`);
  if(!archive.includes('package/LICENSE'))throw new Error(`Missing licence in ${filename}`);
}
const workspace=await mkdtemp(join(tmpdir(),'tenhaw-kit-installed-'));
try{
  await writeFile(join(workspace,'package.json'),JSON.stringify({name:'tenhaw-package-smoke',private:true,type:'module'}));
  run('npm',['install','--ignore-scripts','--no-audit','--no-fund','--cache',join(tmpdir(),'tenhaw-kit-npm-cache'),...tarballs],workspace);
  const cli=join(workspace,'node_modules','tenhaw','dist','index.js');
  if(run(process.execPath,[cli,'--version'],workspace).trim()!=='1.0.0')throw new Error('Installed CLI version mismatch.');
  const questionnaire=JSON.parse(run(process.execPath,[cli,'readiness','--questionnaire','--json'],workspace));
  if(questionnaire.dimensions.length!==6)throw new Error('Installed questionnaire is incomplete.');
  const installedMcpTools=await probeMcp(join(workspace,'node_modules','@tenhaw','mcp','dist','index.js'),workspace);
  const newTool=join(workspace,'internal-portfolio');
  JSON.parse(run(process.execPath,[cli,'init','product-operating-model',newTool,'--yes','--json'],workspace));
  const manifest=JSON.parse(await readFile(join(newTool,'package.json'),'utf8'));
  for(const[key,value]of Object.entries(manifest.dependencies??{}))if(key.startsWith('@tenhaw/'))manifest.dependencies[key]=`file:${tarballs.find(file=>file.endsWith(`${key.replace('@','').replace('/','-')}-1.0.0.tgz`))}`;
  await writeFile(join(newTool,'package.json'),JSON.stringify(manifest,null,2));
  // Install all matching local packages together so no unpublished registry package is required.
  run('npm',['install','--ignore-scripts','--no-audit','--no-fund','--cache',join(tmpdir(),'tenhaw-kit-npm-cache'),...tarballs.filter(path=>!/(?:tenhaw|create-tenhaw|tenhaw-mcp)-1/.test(path.split('/').at(-1)))],newTool);
  run('npm',['run','build'],newTool);
  const packaged=JSON.parse(run('npm',['pack','--dry-run','--json','--ignore-scripts'],join(root,'packages','cli')))[0];
  if(packaged.unpackedSize>2*1024*1024)throw new Error(`CLI exceeds 2 MB unpacked: ${packaged.unpackedSize}`);
  const result={packages:tarballs.map(path=>path.split('/').at(-1)),installedVersion:'1.0.0',questionnaireDimensions:6,installedMcpTools,scaffold:'product-operating-model',scaffoldBuild:'passed',cliUnpackedBytes:packaged.unpackedSize};
  await writeFile(join(artifacts,'pack-verification.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{await rm(workspace,{recursive:true,force:true});}
