import { readFile,readdir } from 'node:fs/promises';
import { schemas,validateInput,canonicalJson } from '../packages/core/src/index.js';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { vectorFiles } from './vectors-ts.js';
const ajv=new Ajv2020({strict:false,allErrors:true});addFormats(ajv);
for(const file of await readdir('spec/schemas')){
  if(!file.endsWith('.schema.json'))continue;
  const schema=JSON.parse(await readFile(`spec/schemas/${file}`,'utf8'));ajv.compile(schema);
  const name=file.replace('.schema.json','') as keyof typeof schemas;
  if(canonicalJson(schema)!==canonicalJson(schemas[name]))throw new Error(`Bundled schema differs: ${file}`);
}
const framework=JSON.parse(await readFile('spec/content/readiness-framework.v1.json','utf8'));
const bundled=JSON.parse(await readFile('packages/ai-readiness/src/framework.json','utf8'));
if(canonicalJson(framework)!==canonicalJson(bundled))throw new Error('Bundled framework differs from source');
validateInput('readiness-questionnaire',framework);
const names:Record<string,keyof typeof schemas>={readiness:'readiness-response',roi:'roi-input',delivery:'delivery-events',usecases:'usecase-register',opmodel:'opmodel',cost:'project-cost-input'};
let count=0;
for(const file of await vectorFiles()){
  const vector=JSON.parse(await readFile(file,'utf8')),name=names[vector.tool];
  if(name)validateInput(name,vector.input);
  const reportNames:Record<string,keyof typeof schemas>={readiness:'readiness-report',roi:'roi-report',delivery:'delivery-report',usecases:'usecase-register-report',opmodel:'opmodel-report',cost:'project-cost-report'};
  if(reportNames[vector.tool])validateInput(reportNames[vector.tool]!,vector.expected);
  count++;
}
console.log(`${Object.keys(schemas).length} schemas compiled; ${count} vectors validated; bundled content matches spec.`);
