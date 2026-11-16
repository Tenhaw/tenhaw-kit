import { cp, mkdir, readFile, readdir, writeFile, chmod, lstat, realpath, rm } from 'node:fs/promises';
import { resolve, join, relative, sep, isAbsolute } from 'node:path';
const root=resolve('.');
const version=JSON.parse(await readFile(join(root,'packages/core/package.json'),'utf8')).version;
for(const entry of await readdir('packages')){
  const directory=join('packages',entry);
  for(const file of ['LICENSE','LICENSE-CONTENT'])await cp(file,join(directory,file));
}
for(const name of ['index.js'])for(const directory of ['cli','create','mcp'])await chmod(`packages/${directory}/dist/${name}`,0o755);
await mkdir('packages/cli/templates',{recursive:true});
for(const name of await readdir('templates')){
  const source=resolve('templates',name),target=resolve('packages/cli/templates',name);
  await rm(target,{recursive:true,force:true});
  await cp(source,target,{recursive:true,force:true,dereference:true,filter:async path=>{
    const parts=relative(source,path).split(sep);
    if(parts.some(p=>['node_modules','.next','out','.git','.vercel','.tenhaw','coverage','test-results','playwright-report','.DS_Store'].includes(p)||p.endsWith('.tsbuildinfo')||p.startsWith('.env')&&p!=='.env.example'))return false;
    if((await lstat(path)).isSymbolicLink()){const actual=await realpath(path),rel=relative(source,actual);if(rel.startsWith('..')||isAbsolute(rel))throw new Error(`Template ${name} has a symlink outside its source tree.`);}
    return true;
  }});
  const file=join(target,'package.json'),pkg=JSON.parse(await readFile(file,'utf8'));
  for(const group of ['dependencies','devDependencies'])for(const[name,value]of Object.entries(pkg[group]??{}))if(String(value).startsWith('workspace:'))pkg[group][name]=version;
  await writeFile(file,JSON.stringify(pkg,null,2)+'\n');
}
await mkdir('packages/cli/instructions',{recursive:true});
await cp('plugins/agents-md','packages/cli/instructions',{recursive:true,force:true});
console.log('Bundled standalone templates, licences and agent instructions.');
