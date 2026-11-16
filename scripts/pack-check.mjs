import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
const root=resolve('.'),artifacts=join(root,'artifacts');
const names=['core','ai-readiness','delivery-metrics','ai-roi','usecase-register','opmodel','cli','create','mcp'];
const templates=['ai-adoption-dashboard','delivery-metrics-dashboard','ai-usecase-register','product-operating-model','ai-readiness-assessment'];
const version=JSON.parse(await readFile(join(root,'packages/core/package.json'),'utf8')).version;
const packageManager=JSON.parse(await readFile(join(root,'package.json'),'utf8')).packageManager;
await mkdir(artifacts,{recursive:true});
const pnpm=process.env.npm_execpath?.includes('pnpm')?{file:process.execPath,args:[process.env.npm_execpath]}:{file:'pnpm',args:[]};
const run=(file,args,cwd=root,env={...process.env,CI:'true'})=>execFileSync(file,args,{cwd,env,stdio:'pipe',maxBuffer:8*1024*1024}).toString();
async function probeMcp(binary,cwd){return new Promise((done,reject)=>{
  const child=spawn(process.execPath,[binary],{cwd,env:{...process.env,TENHAW_NO_ATTRIBUTION:'1'},stdio:'pipe'});
  const finish=(error,result)=>{clearTimeout(timer);child.kill();error?reject(error):done(result);};
  const timer=setTimeout(()=>finish(new Error('Installed MCP protocol probe timed out.')),12000);
  child.on('error',error=>finish(error));
  createInterface({input:child.stdout}).on('line',line=>{try{const response=JSON.parse(line);if(response.error)return finish(new Error('Installed MCP returned a protocol error.'));if(response.id===1){child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})+'\n');}if(response.id===2){if(response.result.tools.length!==8)return finish(new Error('Installed MCP tool inventory mismatch.'));finish(null,response.result.tools.length);}}catch{finish(new Error('Installed MCP emitted non-JSON stdout.'));}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'installed-package-check',version:'1.0.0'}}})+'\n');
});}
const tarballs=[];
const libraries=new Map();
for(const name of names){
  run(pnpm.file,[...pnpm.args,'--dir',join(root,'packages',name),'pack','--pack-destination',artifacts]);
  const pkg=JSON.parse(await readFile(join(root,'packages',name,'package.json'),'utf8'));
  if(pkg.version!==version)throw new Error(`Package version drift in ${pkg.name}.`);
  const filename=`${pkg.name.replace('@','').replaceAll('/','-')}-${pkg.version}.tgz`;
  tarballs.push(join(artifacts,filename));
  if(!['cli','create','mcp'].includes(name))libraries.set(pkg.name,join(artifacts,filename));
  const archive=run('tar',['-tzf',join(artifacts,filename)]);
  const packedManifest=JSON.parse(run('tar',['-xOf',join(artifacts,filename),'package/package.json']));
  if(JSON.stringify(packedManifest.dependencies??{}).includes('workspace:'))throw new Error(`Unresolved workspace dependency in ${filename}`);
  if(/(?:^|\/)(?:node_modules|\.env(?:\.[^/\n]+)?|\.git|\.tenhaw)(?:\/|$)/m.test(archive.replaceAll('.env.example','example-env')))throw new Error(`Unexpected private/generated files in ${filename}`);
  if(!archive.includes('package/LICENSE'))throw new Error(`Missing licence in ${filename}`);
  if(name==='cli')for(const template of templates){
    const templateManifest=JSON.parse(run('tar',['-xOf',join(artifacts,filename),`package/templates/${template}/package.json`]));
    if(templateManifest.packageManager!==packageManager)throw new Error(`Packaged ${template} lost the reviewed package manager pin.`);
    const policy=run('tar',['-xOf',join(artifacts,filename),`package/templates/${template}/pnpm-workspace.yaml`]);
    if(policy.trim()!=='strictDepBuilds: true\nallowBuilds:\n  esbuild: true')throw new Error(`Packaged ${template} is missing its reviewed strict pnpm build policy.`);
  }
}
const workspace=await mkdtemp(join(tmpdir(),'tenhaw-kit-installed-'));
try{
  const isolatedEnv={...process.env};
  for(const key of Object.keys(isolatedEnv))if(/^(npm|pnpm)_config_/i.test(key)||['NPM_TOKEN','NODE_AUTH_TOKEN','PNPM_HOME','PNPM_PACKAGE_MANAGEMENT_HOME'].includes(key))delete isolatedEnv[key];
  const configDirectory=join(workspace,'config'),npmUserConfig=join(workspace,'npm-user.npmrc'),npmGlobalConfig=join(workspace,'npm-global.npmrc');
  await mkdir(configDirectory);await writeFile(npmUserConfig,'');await writeFile(npmGlobalConfig,'');
  Object.assign(isolatedEnv,{
    CI:'true',NEXT_TELEMETRY_DISABLED:'1',
    npm_config_userconfig:npmUserConfig,npm_config_globalconfig:npmGlobalConfig,npm_config_cache:join(workspace,'npm-cache'),npm_config_registry:'https://registry.npmjs.org',
    pnpm_config_config_dir:configDirectory,pnpm_config_npmrc_auth_file:npmUserConfig,pnpm_config_store_dir:join(workspace,'pnpm-store'),pnpm_config_cache_dir:join(workspace,'pnpm-cache'),pnpm_config_state_dir:join(workspace,'pnpm-state'),pnpm_config_registry:'https://registry.npmjs.org',pnpm_config_strict_dep_builds:'true',pnpm_config_pm_on_fail:'ignore',
  });
  const pnpmVersion=run(pnpm.file,[...pnpm.args,'--version'],workspace,isolatedEnv).trim();
  if(!pnpmVersion.startsWith('11.'))throw new Error('Packaged scaffold regression requires real pnpm 11.');
  await writeFile(join(workspace,'package.json'),JSON.stringify({name:'tenhaw-package-smoke',private:true,type:'module'}));
  run('npm',['install','--ignore-scripts','--no-audit','--no-fund',...tarballs],workspace,isolatedEnv);
  const cli=join(workspace,'node_modules','tenhaw','dist','index.js');
  if(run(process.execPath,[cli,'--version'],workspace).trim()!==version)throw new Error('Installed CLI version mismatch.');
  const questionnaire=JSON.parse(run(process.execPath,[cli,'readiness','--questionnaire','--json'],workspace));
  if(questionnaire.dimensions.length!==6)throw new Error('Installed questionnaire is incomplete.');
  const installedMcpTools=await probeMcp(join(workspace,'node_modules','@tenhaw','mcp','dist','index.js'),workspace);
  const setupClients=['codex','claude','cursor','vscode','gemini'];
  for(const agent of setupClients){
    const project=join(workspace,`setup-${agent}`);await mkdir(project);
    const setupArgs=[cli,'setup','--agent',agent,'--yes','--json','--no-attribution'];
    const configured=JSON.parse(run(process.execPath,setupArgs,project,isolatedEnv));
    if(configured.configuration.status!=='created'||configured.credentials.required.length)throw new Error(`Installed ${agent} setup failed or requested unnecessary credentials.`);
    const repeated=JSON.parse(run(process.execPath,setupArgs,project,isolatedEnv));
    if(repeated.configuration.status!=='unchanged')throw new Error(`Installed ${agent} setup is not idempotent.`);
    const checked=JSON.parse(run(process.execPath,[cli,'setup','--agent',agent,'--check','--json'],project,isolatedEnv));
    if(checked.exitCode!==0||checked.configuration.status!=='unchanged')throw new Error(`Installed ${agent} configuration check failed.`);
  }
  const newTool=join(workspace,'demo');
  JSON.parse(run(process.execPath,[cli,'init','delivery-metrics-dashboard',newTool,'--yes','--json'],workspace,isolatedEnv));
  const manifest=JSON.parse(await readFile(join(newTool,'package.json'),'utf8'));
  if(manifest.packageManager!==packageManager)throw new Error('Generated scaffold lost the reviewed package manager pin.');
  for(const[key,value]of Object.entries(manifest.dependencies??{}))if(key.startsWith('@tenhaw/')){
    if(value!==version||!libraries.has(key))throw new Error(`Packaged scaffold has an invalid internal dependency: ${key}.`);
    manifest.dependencies[key]=`file:${libraries.get(key)}`;
  }
  await writeFile(join(newTool,'package.json'),JSON.stringify(manifest,null,2));
  // Resolve unpublished first-party dependencies to the exact packed archives.
  // Keep the starter's own build approvals unchanged: install must fail if the
  // distributed pnpm policy is missing, even when the monorepo permits esbuild.
  const policyFile=join(newTool,'pnpm-workspace.yaml'),policy=await readFile(policyFile,'utf8');
  if(policy.trim()!=='strictDepBuilds: true\nallowBuilds:\n  esbuild: true')throw new Error('Generated scaffold changed the reviewed pnpm build policy.');
  await writeFile(policyFile,`${policy}\noverrides:\n${[...libraries].map(([name,path])=>`  ${JSON.stringify(name)}: ${JSON.stringify(`file:${path}`)}`).join('\n')}\n`);
  run(pnpm.file,[...pnpm.args,'i'],newTool,isolatedEnv);
  const storePath=run(pnpm.file,[...pnpm.args,'store','path'],newTool,isolatedEnv).trim();
  if(!storePath.startsWith(join(workspace,'pnpm-store')+'/'))throw new Error('Scaffold pnpm install did not use the isolated store.');
  run(pnpm.file,[...pnpm.args,'build'],newTool,isolatedEnv);
  const resolvedPackages={};
  for(const name of Object.keys(manifest.dependencies).filter(name=>name.startsWith('@tenhaw/'))){
    const installed=JSON.parse(await readFile(join(newTool,'node_modules',name,'package.json'),'utf8'));
    if(installed.version!==version)throw new Error(`Scaffold installed an unexpected ${name} version.`);
    resolvedPackages[name]=installed.version;
  }
  const packaged=JSON.parse(run('npm',['pack','--dry-run','--json','--ignore-scripts'],join(root,'packages','cli')))[0];
  if(packaged.unpackedSize>2*1024*1024)throw new Error(`CLI exceeds 2 MB unpacked: ${packaged.unpackedSize}`);
  const result={packages:tarballs.map(path=>path.split('/').at(-1)),installedVersion:version,questionnaireDimensions:6,installedMcpTools,setupClients,setupRepeatAndCheck:'passed',scaffold:'delivery-metrics-dashboard',scaffoldPackageManager:`pnpm@${pnpmVersion}`,scaffoldPackageManagerPin:manifest.packageManager,scaffoldInstall:'passed',scaffoldBuild:'passed',scaffoldStrictDepBuilds:true,scaffoldStoreIsolated:true,scaffoldFirstPartyResolution:'original packed archives through temporary test-only overrides',scaffoldInternalPackages:resolvedPackages,cliUnpackedBytes:packaged.unpackedSize};
  await writeFile(join(artifacts,'pack-verification.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{await rm(workspace,{recursive:true,force:true});}
