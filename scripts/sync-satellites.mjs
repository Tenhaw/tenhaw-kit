import { execFileSync,spawnSync } from 'node:child_process';
import { cp,mkdtemp,readdir,readFile,writeFile,rm,lstat,realpath,stat } from 'node:fs/promises';
import { join,resolve,relative,sep,isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
const root=resolve('.'),args=process.argv.slice(2),index=args.indexOf('--version'),version=index<0?undefined:args[index+1],apply=args.includes('--apply'),localBootstrap=args.includes('--local-bootstrap');
if(!version||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw new Error('Supply --version with the published package version.');
const templates=['ai-adoption-dashboard','delivery-metrics-dashboard','ai-usecase-register','product-operating-model','ai-readiness-assessment'];
const targets=[...templates.map(name=>({repo:`template-${name}`,source:`templates/${name}`,template:true})),{repo:'tenhaw-gemini',source:'plugins/gemini',template:false}];
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(JSON.parse(await readFile(join(root,'packages/core/package.json'),'utf8')).version!==version)throw new Error('Source package version does not match the requested release.');
if(process.env.TENHAW_SOURCE_SHA&&process.env.TENHAW_SOURCE_SHA!==sha)throw new Error('Checked-out source does not match the requested immutable commit.');
if(!apply){console.log(JSON.stringify({version,sourceCommit:sha,targets,mode:localBootstrap?'local-bootstrap-dry-run':'dry-run'},null,2));process.exit(0);}
if(localBootstrap){if(process.env.GITHUB_ACTIONS==='true')throw new Error('Local bootstrap uses the owner’s existing gh authentication outside GitHub Actions.');}
else if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='Tenhaw/tenhaw-kit'||!process.env.GH_TOKEN)throw new Error('Apply requires the reviewed source workflow and a short-lived satellite GitHub App token, or explicit --local-bootstrap.');
const state=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'});if(state.trim())throw new Error('Satellite source checkout must be clean.');
const auth=localBootstrap?{
  GIT_CONFIG_COUNT:'3',
  GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:'',
  GIT_CONFIG_KEY_1:'credential.https://github.com.helper',GIT_CONFIG_VALUE_1:'',
  GIT_CONFIG_KEY_2:'credential.https://github.com.helper',GIT_CONFIG_VALUE_2:'!gh auth git-credential'
}:{GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:`AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.GH_TOKEN}`).toString('base64')}`};
const env={...process.env,...auth,GIT_TERMINAL_PROMPT:'0',GH_PROMPT_DISABLED:'1',GIT_AUTHOR_NAME:'Tenhaw Kit sync',GIT_AUTHOR_EMAIL:'hello@tenhaw.com',GIT_COMMITTER_NAME:'Tenhaw Kit sync',GIT_COMMITTER_EMAIL:'hello@tenhaw.com'};
for(const name of ['GIT_TRACE','GIT_TRACE_CURL','GIT_CURL_VERBOSE','GH_DEBUG'])delete env[name];
function run(file,argv,cwd=root){try{return execFileSync(file,argv,{cwd,env,encoding:'utf8',stdio:'pipe',maxBuffer:4*1024*1024});}catch{throw new Error(`${file} operation failed while synchronising a satellite. No credential-bearing diagnostic was printed.`);}}
function api(path,method='GET',body){const argv=['api',path,'--method',method];if(body)argv.push('--input','-');try{return JSON.parse(execFileSync('gh',argv,{env,encoding:'utf8',input:body?JSON.stringify(body):undefined,stdio:['pipe','pipe','pipe']}));}catch{throw new Error(`GitHub API operation failed for ${path}. Verify the target exists and the App installation has access.`);}}
if(localBootstrap){
  if(api('user').login?.toLowerCase()!=='tenhaw')throw new Error('Local bootstrap requires the authenticated Tenhaw owner account.');
  const remote=run('git',['remote','get-url','origin']).trim();
  if(!['https://github.com/Tenhaw/tenhaw-kit.git','git@github.com:Tenhaw/tenhaw-kit.git'].includes(remote))throw new Error('Local bootstrap requires the canonical Tenhaw/tenhaw-kit origin.');
  run('git',['fetch','--no-tags','origin','refs/heads/main:refs/remotes/origin/main']);
  try{run('git',['merge-base','--is-ancestor',sha,'origin/main']);}catch{throw new Error('Local bootstrap source must be reviewed origin/main history.');}
  const pulls=api(`repos/Tenhaw/tenhaw-kit/commits/${sha}/pulls`);
  if(!Array.isArray(pulls)||!pulls.some(p=>p.merged_at&&p.base?.ref==='main'&&p.base?.repo?.full_name?.toLowerCase()==='tenhaw/tenhaw-kit'))throw new Error('The selected source commit must belong to a merged Tenhaw/tenhaw-kit main-branch pull request.');
  const names=[];
  for(const directory of ['core','ai-readiness','delivery-metrics','ai-roi','usecase-register','opmodel','cli','create','mcp']){
    const pkg=JSON.parse(await readFile(join(root,'packages',directory,'package.json'),'utf8'));
    if(pkg.version!==version)throw new Error(`Source version drift in ${pkg.name}.`);
    names.push(pkg.name);
  }
  await Promise.all(names.map(async name=>{
    let response;try{response=await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});}catch{throw new Error(`Could not verify the public ${name}@${version} registry version.`);}
    if(response.status===404)throw new Error(`${name}@${version} is not published; satellite source publication must wait.`);
    if(!response.ok)throw new Error(`Registry verification failed for ${name}@${version}: HTTP ${response.status}.`);
    const pkg=await response.json();
    if(pkg.name!==name||pkg.version!==version||typeof pkg.dist?.tarball!=='string')throw new Error(`The public registry did not verify the exact ${name}@${version} distribution.`);
  }));
  console.log(`Verified owner-authenticated local bootstrap: reviewed source ${sha} and nine published npm versions at ${version}.`);
}
function reconcileMetadata(target){
  if(target.template)api(`repos/Tenhaw/${target.repo}`,'PATCH',{is_template:true});
  const existing=api(`repos/Tenhaw/${target.repo}/topics`).names??[];
  const required=target.template?['tenhaw-kit','internal-tools','nextjs-template','vercel-template']:['gemini-cli-extension','tenhaw-kit','internal-tools'];
  api(`repos/Tenhaw/${target.repo}/topics`,'PUT',{names:[...new Set([...required,...existing])].slice(0,20)});
  const release=spawnSync('gh',['release','view',version,'--repo',`Tenhaw/${target.repo}`],{env,stdio:'pipe'});
  if(release.status!==0)run('gh',['release','create',version,'--repo',`Tenhaw/${target.repo}`,'--verify-tag','--title',`Tenhaw Kit ${version}`,'--notes',`Generated from Tenhaw/tenhaw-kit commit ${sha}. Source: ${target.source}.`]);
}
const excluded=path=>path.split(sep).some(part=>['node_modules','.next','out','dist','.git','.vercel','.tenhaw','test-results','playwright-report','tsconfig.tsbuildinfo'].includes(part)||part.startsWith('.env')&&part!=='.env.example');
async function verifySourceTree(target){
  const source=resolve(root,target.source),base=await realpath(source),fromRoot=relative(await realpath(root),base);
  if(fromRoot==='..'||fromRoot.startsWith(`..${sep}`)||isAbsolute(fromRoot))throw new Error(`Satellite source must remain inside the reviewed checkout: ${target.source}.`);
  async function visit(path){
    if(excluded(relative(source,path)))return;
    const info=await lstat(path);
    if(info.isSymbolicLink()){
      const actual=await realpath(path),rel=relative(base,actual);
      if(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel)||!(await stat(actual)).isFile())throw new Error(`Satellite source symlinks must resolve to files inside their own source tree: ${target.source}.`);
    }else if(info.isDirectory())for(const entry of await readdir(path))await visit(join(path,entry));
  }
  await visit(source);
}
for(const target of targets){
  const project=api(`repos/Tenhaw/${target.repo}`);if(project.private||project.owner?.login.toLowerCase()!=='tenhaw')throw new Error('Satellite targets must be the dedicated public Tenhaw repositories.');
  await verifySourceTree(target);
}
for(const target of targets){
  const temporary=await mkdtemp(join(tmpdir(),'tenhaw-satellite-')),checkout=join(temporary,'checkout');
  try{
    run('git',['clone',`https://github.com/Tenhaw/${target.repo}.git`,checkout]);
    run('git',['checkout','-B','main'],checkout);
    let previous;try{previous=JSON.parse(await readFile(join(checkout,'SYNCED-FROM.json'),'utf8'));}catch{/* First synchronisation has no generated source marker. */}
    if(previous?.version===version&&previous.commit===sha){
      const tagMarker=JSON.parse(run('git',['show',`refs/tags/${version}:SYNCED-FROM.json`],checkout));
      if(tagMarker.version!==version||tagMarker.commit!==sha)throw new Error('The immutable satellite tag does not identify this source snapshot.');
      if(run('git',['rev-parse',`refs/tags/${version}^{commit}`],checkout).trim()!==run('git',['rev-parse','HEAD'],checkout).trim())throw new Error('Satellite main has changed since its immutable version tag.');
      reconcileMetadata(target);
      console.log(`Verified existing ${target.repo} version ${version} from ${sha}; no source regeneration or push needed.`);
      continue;
    }
    for(const entry of await readdir(checkout))if(entry!=='.git')await rm(join(checkout,entry),{recursive:true,force:true});
    const source=resolve(root,target.source);
    await cp(source,checkout,{recursive:true,dereference:true,filter:path=>!excluded(relative(source,path))});
    for(const licence of ['LICENSE','LICENSE-CONTENT'])await cp(join(root,licence),join(checkout,licence));
    await writeFile(join(checkout,'.gitignore'),'node_modules/\n.next/\nout/\ndist/\n.env\n.env.*\n!.env.example\n.vercel/\n.tenhaw/\ntest-results/\nplaywright-report/\n*.tsbuildinfo\n');
    if(target.template){
      const file=join(checkout,'package.json'),manifest=JSON.parse(await readFile(file,'utf8'));
      for(const group of ['dependencies','devDependencies'])for(const[name,value]of Object.entries(manifest[group]??{}))if(String(value).startsWith('workspace:'))manifest[group][name]=version;
      manifest.packageManager=JSON.parse(await readFile(join(root,'package.json'),'utf8')).packageManager;
      await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
      run('pnpm',['install','--lockfile-only','--ignore-scripts','--no-frozen-lockfile'],checkout);
    }else{
      const manifest=JSON.parse(await readFile(join(checkout,'gemini-extension.json'),'utf8'));if(manifest.version!==version)throw new Error('Gemini manifest version must exactly match its release tag.');
    }
    await writeFile(join(checkout,'SYNCED-FROM.json'),JSON.stringify({repository:'https://github.com/Tenhaw/tenhaw-kit',commit:sha,version,source:target.source},null,2)+'\n');
    run('git',['add','--all'],checkout);
    const changed=spawnSync('git',['diff','--cached','--quiet'],{cwd:checkout,env,stdio:'pipe'});
    if(changed.status!==0&&changed.status!==1)throw new Error('Could not inspect satellite changes.');
    const priorTag=run('git',['ls-remote','--tags','origin',`refs/tags/${version}`],checkout).trim();
    if(priorTag&&changed.status===1)throw new Error(`Immutable satellite version ${version} already exists with different content in ${target.repo}.`);
    if(changed.status===1)run('git',['commit','-m',`Sync Tenhaw Kit ${version} from ${sha}`],checkout);
    if(!priorTag)run('git',['tag','-a',version,'-m',`Tenhaw Kit ${version}, source ${sha}`],checkout);
    run('git',['push','--atomic','origin','main',`refs/tags/${version}`],checkout);
    reconcileMetadata(target);
    console.log(`Verified ${target.repo}: source ${sha}, version ${version}, template=${target.template}.`);
  }finally{await rm(temporary,{recursive:true,force:true});}
}
