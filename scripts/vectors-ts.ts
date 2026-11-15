import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalJson } from '../packages/core/src/index.js';
import { scoreReadiness } from '../packages/ai-readiness/src/index.js';
import { calculateRoi, estimateProjectCost } from '../packages/ai-roi/src/index.js';
import { computeMetrics } from '../packages/delivery-metrics/src/index.js';
import { prioritiseUseCases } from '../packages/usecase-register/src/index.js';
import { generateOperatingModel } from '../packages/opmodel/src/index.js';
export function runVector(vector:any):unknown {
  switch(vector.tool){
    case 'readiness': return scoreReadiness(vector.input,vector.config);
    case 'roi': return calculateRoi(vector.input);
    case 'cost': return estimateProjectCost(vector.input);
    case 'delivery': return computeMetrics(vector.input,vector.config);
    case 'usecases': return prioritiseUseCases(vector.input);
    case 'opmodel': return generateOperatingModel(vector.input);
    default: throw new Error(`Unknown vector tool: ${vector.tool}`);
  }
}
export async function vectorFiles(root=resolve('spec/vectors')):Promise<string[]>{
  const files:string[]=[];
  for(const entry of await readdir(root,{withFileTypes:true})){
    if(entry.isDirectory())files.push(...await vectorFiles(join(root,entry.name)));
    else if(entry.name.endsWith('.json'))files.push(join(root,entry.name));
  }
  return files.sort();
}
async function main(){
  const update=process.argv.includes('--update');let count=0;
  for(const file of await vectorFiles()){
    const vector=JSON.parse(await readFile(file,'utf8')),actual=runVector(vector);
    if(update){vector.expected=actual;await writeFile(file,JSON.stringify(vector,null,2)+'\n');}
    else if(canonicalJson(actual)!==canonicalJson(vector.expected))throw new Error(`Golden vector mismatch: ${file}`);
    count++;
  }
  console.log(`${count} TypeScript golden vectors ${update?'updated':'passed'}.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
