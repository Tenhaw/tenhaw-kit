import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJson } from '../packages/core/src/index.js';
import { vectorFiles, runVector } from './vectors-ts.js';
const python=spawnSync('uv',['run','python','scripts/vectors.py','--json'],{encoding:'utf8',env:{...process.env,UV_CACHE_DIR:process.env.UV_CACHE_DIR??join(tmpdir(),'tenhaw-kit-uv-cache')}});
if(python.status!==0)throw new Error(`Python parity runner failed: ${python.stderr}`);
const actual=JSON.parse(python.stdout) as Record<string,unknown>;
let count=0;
for(const file of await vectorFiles()){
  const vector=JSON.parse(await readFile(file,'utf8'));
  if(!['readiness','roi','delivery','cost'].includes(vector.tool))continue;
  const key=file.replaceAll('\\','/').split('/spec/vectors/')[1];
  const result=actual[key]??actual[vector.id]??actual[file];
  if(result===undefined||canonicalJson(result)!==canonicalJson(runVector(vector)))throw new Error(`Cross-language mismatch: ${key}`);
  count++;
}
console.log(`${count} TypeScript/Python canonical JSON results match.`);
