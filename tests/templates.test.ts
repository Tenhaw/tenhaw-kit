import { describe,expect,it } from 'vitest';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schemas } from '../packages/core/src/index';
import { scoreReadiness } from '../packages/ai-readiness/src/index';
import { calculateRoi } from '../packages/ai-roi/src/index';
import { computeMetrics,scoreDeliveryHealth } from '../packages/delivery-metrics/src/index';
import { generator } from '../packages/core/src/index';
import { toolsFor } from '../packages/mcp/src/tools';
const root=new URL('../',import.meta.url);
describe('published reference contracts',()=>{
 it('accepts CLI delivery metadata exactly like the MCP transport and rejects unrelated fields',async()=>{
  const document=JSON.parse(await readFile(new URL('apps/docs/public/openapi.json',root),'utf8'));
  const transport=document.paths['/api/v1/delivery/health'].post.requestBody.content['application/json'].schema;
  const mcp=toolsFor('remote').find(tool=>tool.name==='score_delivery_health')!.inputSchema as {properties:{metrics:unknown}};
  expect(transport).toEqual(mcp.properties.metrics);
  const ajv=new Ajv2020({strict:false});addFormats(ajv);const validate=ajv.compile(transport);
  const report=computeMetrics([],{since:'2026-10-01T00:00:00Z',until:'2026-11-01T00:00:00Z'});
  expect(validate(report)).toBe(true);
  expect(validate({...report,generator:generator({source:'cli'})})).toBe(true);
  for(const candidate of [
   {...report,generator:{...generator(),token:'must-not-be-accepted'}},
   {...report,generator:{...generator(),generator:'Another generator'}},
   {...report,generator:{generator:'Tenhaw Kit'}},
   {...report,generator:{...generator(),url:'invalid URI'}},
   {...report,events:[]},
   {...report,GITHUB_TOKEN:'must-not-be-accepted'},
  ])expect(validate(candidate),JSON.stringify(candidate)).toBe(false);
  const pure=ajv.compile(schemas['delivery-report']);
  expect(pure({...report,generator:generator()})).toBe(false);
 });
 it('documents REST response wrappers that validate the real calculation outputs',async()=>{
  const document=JSON.parse(await readFile(new URL('apps/docs/public/openapi.json',root),'utf8'));
  const roi=JSON.parse(await readFile(new URL('apps/docs/public/examples/roi.json',root),'utf8'));
  const ajv=new Ajv2020({strict:false});addFormats(ajv);for(const schema of Object.values(schemas))ajv.addSchema(schema);
  const outputs:Record<string,unknown>={
   '/api/v1/readiness/score':scoreReadiness({answers:[]}),
   '/api/v1/delivery/health':scoreDeliveryHealth(computeMetrics([],{since:'2026-10-01T00:00:00Z',until:'2026-11-01T00:00:00Z'})),
   '/api/v1/roi/estimate':calculateRoi(roi)
  };
  for(const [path,result] of Object.entries(outputs)){
   const schema=document.paths[path].post.responses['200'].content['application/json'].schema;
   const validate=ajv.compile(schema);expect(validate({result,generator:generator()}),JSON.stringify(validate.errors)).toBe(true);expect(validate(result)).toBe(false);
  }
 });
});
