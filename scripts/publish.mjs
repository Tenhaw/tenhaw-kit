import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root=resolve('.');
const argv=process.argv.slice(2),option=name=>{const index=argv.indexOf(name);return index<0?undefined:argv[index+1];};
const version=option('--version');
if(!version||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw new Error('Supply --version with the exact reviewed semantic version.');
const dryRun=argv.includes('--dry-run'),verifyOnly=argv.includes('--verify-only'),verifyPython=argv.includes('--verify-python');
const names=['core','ai-readiness','delivery-metrics','ai-roi','usecase-register','opmodel','cli','create','mcp'];
const pythonNames=['tenhaw','tenhaw-ai-readiness','tenhaw-delivery-metrics','tenhaw-ai-roi'];
const env={...process.env,npm_config_cache:process.env.npm_config_cache??join(process.env.RUNNER_TEMP??tmpdir(),'tenhaw-kit-release-npm-cache')};delete env.NODE_AUTH_TOKEN;delete env.NPM_TOKEN;
function run(file,args,cwd=root){try{return execFileSync(file,args,{cwd,env,stdio:'pipe',maxBuffer:8*1024*1024}).toString();}catch(error){const codes=String(error.stderr??'').match(/\bE[A-Z][A-Z0-9_]+\b/g)??[];throw new Error(`${file} ${args[0]} failed (exit ${error.status??'unknown'}${codes.length?`, ${[...new Set(codes)].join(', ')}`:''}). Review tool configuration; child output was suppressed.`);}}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function getJson(url,{missing=false}={}){
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
  if(missing&&response.status===404)return null;
  if(!response.ok)throw new Error(`Public registry returned HTTP ${response.status} for ${new URL(url).pathname}.`);
  return response.json();
}
async function retry(operation){let error;for(let i=0;i<6;i++){try{return await operation();}catch(cause){error=cause;if(i<5)await pause(5000);}}throw error;}
function requireActions(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='Tenhaw/tenhaw-kit'||process.env.GITHUB_REF!=='refs/heads/main')throw new Error('Publishing is restricted to the reviewed Tenhaw/tenhaw-kit main branch in GitHub Actions.');
  if(!process.env.GITHUB_WORKFLOW_REF?.includes('/.github/workflows/release.yml@'))throw new Error('The OIDC publisher must run directly in release.yml.');
  if(process.env.NODE_AUTH_TOKEN||process.env.NPM_TOKEN)throw new Error('Remove npm token environment variables. This release uses OIDC only.');
  const [major,minor,patch]=run('npm',['--version']).trim().split('.').map(Number);
  if(!Number.isFinite(major)||major<11||(major===11&&(minor<5||minor===5&&patch<1)))throw new Error('npm 11.5.1 or later is required for trusted publishing.');
}
async function assertVersionConsistency(){
  for(const directory of names){const pkg=JSON.parse(await readFile(join(root,'packages',directory,'package.json'),'utf8'));if(pkg.version!==version)throw new Error(`Version drift in ${pkg.name}: expected ${version}.`);}
  const server=JSON.parse(await readFile(join(root,'packages/mcp/server.json'),'utf8'));
  if(server.version!==version||server.packages.some(p=>p.version!==version))throw new Error('MCP registry metadata version differs from the release.');
  for(const name of pythonNames){const text=await readFile(join(root,'python',name,'pyproject.toml'),'utf8');if(!new RegExp(`^version\\s*=\\s*"${version.replaceAll('.','\\.')}"\\s*$`,'m').test(text))throw new Error(`Python version drift in ${name}.`);}
  for(const file of ['plugins/claude/tenhaw/.claude-plugin/plugin.json','plugins/openai/tenhaw/plugin.json','plugins/gemini/gemini-extension.json']){const manifest=JSON.parse(await readFile(join(root,file),'utf8'));if(manifest.version!==version)throw new Error(`Plugin version drift in ${file}.`);}
}
async function verifyPythonRelease(){
  const observations=[];
  for(const name of pythonNames){
    const pkg=await retry(async()=>{const value=await getJson(`https://pypi.org/pypi/${name}/${version}/json`);if(value.info.version!==version||!value.urls?.length)throw new Error(`PyPI has not exposed ${name}@${version} yet.`);return value;});
    const local=await readdir(join(root,'artifacts/python'));
    for(const distribution of pkg.urls){
      if(!local.includes(distribution.filename))throw new Error(`PyPI contains an unexpected distribution for ${name}: ${distribution.filename}.`);
      const bytes=await readFile(join(root,'artifacts/python',distribution.filename)),sha=createHash('sha256').update(bytes).digest('hex');
      if(distribution.digests.sha256!==sha)throw new Error(`PyPI integrity mismatch for ${distribution.filename}.`);
      const provenance=await retry(()=>getJson(`https://pypi.org/integrity/${name}/${version}/${encodeURIComponent(distribution.filename)}/provenance`));
      if(!Array.isArray(provenance.attestation_bundles)||!provenance.attestation_bundles.length)throw new Error(`Missing PyPI attestations for ${distribution.filename}.`);
    }
    observations.push({name,version,distributions:pkg.urls.map(u=>u.filename),attestations:true});
  }
  await writeFile('artifacts/pypi-verification.json',JSON.stringify({version,packages:observations},null,2)+'\n');
  console.log(`Verified four PyPI projects at ${version}, exact distribution hashes and attestations.`);
}
await assertVersionConsistency();
if(verifyPython){await verifyPythonRelease();process.exit(0);}

const artifacts=join(root,'artifacts'),files=(await readdir(artifacts)).filter(name=>name.endsWith('.tgz'));
if(files.length!==names.length)throw new Error(`Expected exactly ${names.length} verified npm tarballs; found ${files.length}. Clean stale artifacts and rerun pack-check.`);
const tarballs=[];
for(const directory of names){
  const expected=JSON.parse(await readFile(join(root,'packages',directory,'package.json'),'utf8'));
  const filename=files.find(file=>file===`${expected.name.replace('@','').replaceAll('/','-')}-${version}.tgz`);
  if(!filename)throw new Error(`Missing tarball for ${expected.name}@${version}.`);
  const path=join(artifacts,filename),manifest=JSON.parse(run('tar',['-xOf',path,'package/package.json']));
  if(manifest.name!==expected.name||manifest.version!==version||manifest.private)throw new Error(`Tarball identity mismatch: ${filename}.`);
  if(JSON.stringify(manifest.dependencies??{}).includes('workspace:')||Object.values(manifest.dependencies??{}).some(value=>String(value).startsWith('file:')))throw new Error(`Unpublishable local dependency in ${filename}.`);
  for(const [name,value] of Object.entries(manifest.dependencies??{}))if((name.startsWith('@tenhaw/')||name==='tenhaw')&&value!==version)throw new Error(`Internal dependency version drift in ${filename}: ${name}.`);
  const integrity='sha512-'+createHash('sha512').update(await readFile(path)).digest('base64');
  tarballs.push({name:manifest.name,version,path,filename,integrity});
}
if(dryRun){
  for(const tarball of tarballs)run('npm',['publish',tarball.path,'--dry-run','--ignore-scripts','--access','public']);
  console.log(`Validated ${tarballs.length} npm release tarballs at ${version}; no publication attempted.`);process.exit(0);
}
if(!verifyOnly)requireActions();
// Inspect every immutable version before the first mutation, making safe reruns possible.
for(const tarball of tarballs){
  const existing=await getJson(`https://registry.npmjs.org/${encodeURIComponent(tarball.name)}/${version}`,{missing:true});
  if(existing&&existing.dist?.integrity!==tarball.integrity)throw new Error(`An immutable, different ${tarball.name}@${version} already exists. Stop and choose a new reviewed version.`);
  tarball.existing=Boolean(existing);
  if(verifyOnly&&!existing)throw new Error(`${tarball.name}@${version} is not published.`);
}
for(const tarball of tarballs){
  if(!tarball.existing){
    try{run('npm',['publish',tarball.path,'--access','public','--provenance','--ignore-scripts']);}
    catch{throw new Error(`npm publication failed for ${tarball.name}@${version}. Check release.yml trusted publisher settings and allowed direct-publish action; no tokens were logged.`);}
  }
  await retry(async()=>{
    const pkg=await getJson(`https://registry.npmjs.org/${encodeURIComponent(tarball.name)}/${version}`);
    if(pkg.version!==version||pkg.dist?.integrity!==tarball.integrity||!pkg.dist?.attestations?.url)throw new Error(`Exact version, integrity or provenance verification pending for ${tarball.name}.`);
  });
}
const scratch=await mkdtemp(join(tmpdir(),'tenhaw-registry-verification-'));
try{
  await writeFile(join(scratch,'package.json'),JSON.stringify({name:'tenhaw-published-verification',private:true,type:'module'}));
  run('npm',['install','--ignore-scripts','--no-audit','--no-fund',...tarballs.map(t=>`${t.name}@${version}`)],scratch);
  run('npm',['audit','signatures'],scratch);
  const observed=run(process.execPath,['node_modules/tenhaw/dist/index.js','--version'],scratch).trim();
  if(observed!==version)throw new Error('Published CLI version does not match the release.');
}finally{await rm(scratch,{recursive:true,force:true});}
await writeFile(join(artifacts,'npm-verification.json'),JSON.stringify({version,packages:tarballs.map(({name,integrity})=>({name,version,integrity,provenance:true})),signatureAudit:'passed'},null,2)+'\n');
console.log(`Verified nine npm packages at ${version}, exact tarball integrity, provenance and registry signatures.`);
