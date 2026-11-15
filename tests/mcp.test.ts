import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import { runTool, toolsFor } from '../packages/mcp/src/tools.js';
import { localToolsFor } from '../packages/mcp/src/local-tools.js';
import { computeMetrics } from '../packages/delivery-metrics/src/index.js';
import { createServer } from '../packages/mcp/src/server.js';
import { BODY_LIMIT, localRateLimit, secureRequest } from '../apps/mcp-remote/src/security.js';

const processes:ChildProcessWithoutNullStreams[]=[];
afterEach(()=>{for(const child of processes)child.kill();processes.length=0;});
async function client(cwd?:string){
  const child=spawn(process.execPath,[resolve('packages/mcp/dist/index.js')],{cwd,env:{...process.env,GITHUB_TOKEN:'',JIRA_API_TOKEN:'',TENHAW_NO_ATTRIBUTION:'1'},stdio:'pipe'});processes.push(child);
  const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();let id=0;
  createInterface({input:child.stdout}).on('line',line=>{try{const response=JSON.parse(line);const current=pending.get(response.id);if(current){pending.delete(response.id);response.error?current.reject(new Error(JSON.stringify(response.error))):current.resolve(response.result);}}catch{for(const current of pending.values())current.reject(new Error('MCP stdout contained non-JSON output.'));}});
  let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});
  child.on('exit',()=>{for(const current of pending.values())current.reject(new Error(`MCP exited: ${errors}`));});
  const call=(method:string,params:unknown={})=>new Promise<any>((done,reject)=>{const next=++id;const timer=setTimeout(()=>{pending.delete(next);reject(new Error(`MCP ${method} timed out: ${errors}`));},12000);pending.set(next,{resolve:value=>{clearTimeout(timer);done(value);},reject:error=>{clearTimeout(timer);reject(error);}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:next,method,params})+'\n');});
  await call('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'tenhaw-test',version:'1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  return call;
}
const vector=async(name:string)=>JSON.parse(await readFile(resolve(`spec/vectors/${name}`),'utf8'));

describe('MCP agent contracts',()=>{
  it('builds both surfaces with strict schemas and exposes only six aggregate-safe remote tools',async()=>{
    expect(()=>createServer('local')).not.toThrow();expect(()=>createServer('remote')).not.toThrow();
    expect(localToolsFor()).toHaveLength(8);expect(toolsFor('remote')).toHaveLength(6);
    const delivery=toolsFor('remote').find(t=>t.name==='score_delivery_health')!;
    expect(delivery.inputSchema).not.toHaveProperty('properties.events');
    await expect(runTool('collect_delivery_events',{},'remote')).rejects.toThrow('unavailable');
    await expect(runTool('scaffold_internal_tool',{},'remote')).rejects.toThrow('unavailable');
    await expect(runTool('score_delivery_health',{events:[]},'remote')).rejects.toThrow('aggregate');
  });
  it('serves all pure tools, resources and prompts over the real built stdio binary',async()=>{
    const call=await client();
    const list=await call('tools/list');expect(list.tools).toHaveLength(8);
    expect(list.tools.find((t:any)=>t.name==='collect_delivery_events').annotations).toMatchObject({readOnlyHint:false,openWorldHint:true});
    expect((await call('resources/list')).resources.some((r:any)=>r.uri==='tenhaw://framework/readiness/v1')).toBe(true);
    expect((await call('prompts/list')).prompts).toHaveLength(4);
    const roi=await vector('roi/01-base.json').catch(async()=>{const {readdir}=await import('node:fs/promises');return vector(`roi/${(await readdir('spec/vectors/roi'))[0]}`);});
    const report=computeMetrics([],{since:'2026-01-01T00:00:00Z',until:'2026-02-01T00:00:00Z'});
    for(const[name,input]of [
      ['assess_ai_readiness',{responses:{answers:[]}}],['assess_ai_readiness',{mode:'questionnaire'}],
      ['score_delivery_health',{metrics:report}],['estimate_ai_roi',roi.input],['estimate_ai_project_cost',{stage:'poc',people:1}],
      ['generate_usecase_register',{context:'Portfolio assessment'}],['generate_operating_model',{teams:[]}]
    ] as const){const output=await call('tools/call',{name,arguments:input});expect(output.isError,JSON.stringify(output)).not.toBe(true);expect(output.structuredContent).toHaveProperty('result');}
    const invalid=await call('tools/call',{name:'assess_ai_readiness',arguments:{responses:{answers:[{questionId:'strategy-1',score:99}]}}});
    expect(invalid.isError).toBe(true);
    const resources=await call('resources/read',{uri:'tenhaw://framework/readiness/v1'});expect(JSON.parse(resources.contents[0].text)).toHaveProperty('contentCredit');
  });
  it('checks the event output boundary before credential collection or cache writes',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'tenhaw-mcp-path-')),outside=await mkdtemp(join(tmpdir(),'tenhaw-mcp-outside-'));
    try{
      await symlink(outside,join(directory,'.tenhaw'));
      const call=await client(directory);
      const response=await call('tools/call',{name:'collect_delivery_events',arguments:{githubRepos:['example/repo'],since:'2026-01-01T00:00:00Z',until:'2026-02-01T00:00:00Z'}});
      expect(response.isError).toBe(true);expect(response.content[0].text).toContain('outside the workspace');
    }finally{await rm(directory,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
  });
});

describe('remote request boundary',()=>{
  const good=()=>new Request('http://localhost/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  it('rejects unexpected origins, non-JSON input and streamed oversized bodies',async()=>{
    const origin=new Request('http://localhost/mcp',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
    expect((await secureRequest(origin,async()=>Response.json({ok:true}))).status).toBe(403);
    expect((await secureRequest(new Request('http://localhost/mcp',{method:'POST',body:'{}'}),async()=>Response.json({}))).status).toBe(415);
    const large=new Request('http://localhost/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(BODY_LIMIT+1)});
    expect((await secureRequest(large,async()=>Response.json({}))).status).toBe(413);
  });
  it('uses no-store, rate-limits bursts and fails closed for unconfigured production',async()=>{
    const result=await secureRequest(good(),async()=>Response.json({ok:true}));expect(result.status).toBe(200);expect(result.headers.get('Cache-Control')).toBe('no-store');
    for(let n=0;n<30;n++)expect(localRateLimit('unit-test-bucket',1000)).toBe(true);expect(localRateLimit('unit-test-bucket',1000)).toBe(false);expect(localRateLimit('unit-test-bucket',62000)).toBe(true);
    const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
    try{expect((await secureRequest(good(),async()=>Response.json({}))).status).toBe(503);}finally{if(old)process.env.VERCEL_ENV=old;else delete process.env.VERCEL_ENV;}
  });
});
