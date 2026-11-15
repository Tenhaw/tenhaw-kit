import { McpServer, fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { schemas, renderReport } from '@tenhaw/core';
import { loadFramework } from '@tenhaw/ai-readiness';
import { runTool, serverInfo, toolsFor, type Surface } from './tools.js';

export function registerRemoteTools(server:McpServer,surface:Surface='remote') {
  for(const definition of toolsFor(surface)){
    server.registerTool(definition.name,{
      description:definition.description,inputSchema:fromJsonSchema(definition.inputSchema as JsonSchemaType),outputSchema:fromJsonSchema(definition.outputSchema as JsonSchemaType),
      annotations:{readOnlyHint:!definition.mutates,destructiveHint:false,idempotentHint:!definition.mutates,openWorldHint:Boolean(definition.network)}
    },async(input)=>{
      try{
        const output=await runTool(definition.name,input,surface);
        const requested=(input as {format?:'md'|'html'|'json'})?.format??'json';
        return {structuredContent:output,content:[{type:'text',text:requested==='json'?JSON.stringify(output):renderReport(output.result,requested,{source:'mcp',medium:'report',content:definition.name})}]};
      }catch(error){return {isError:true,content:[{type:'text',text:error instanceof Error?error.message:'Tool validation failed.'}]};}
    });
  }
  const resource=(name:string,uri:string,value:unknown)=>server.registerResource(name,uri,{mimeType:'application/json'},async()=>({contents:[{uri,mimeType:'application/json',text:JSON.stringify(value)}]}));
  resource('readiness-framework','tenhaw://framework/readiness/v1',loadFramework());
  resource('about','tenhaw://about',{name:'Tenhaw Kit',purpose:'Building blocks for agents creating internal portfolio, product, delivery and AI transformation tools.',licence:'MIT code; CC BY 4.0 framework content.',privacy:'Local scoring is offline. Remote delivery accepts aggregate metrics, never events or credentials. No package or MCP telemetry.'});
  for(const[name,value]of Object.entries(schemas))resource(`schema-${name}`,`tenhaw://schemas/${name}`,value);
  for(const name of ['readiness','delivery','roi','operating-model']){
    const slug=({readiness:'ai-readiness',delivery:'delivery-metrics',roi:'ai-roi','operating-model':'opmodel'} as Record<string,string>)[name];
    resource(`methodology-${name}`,`tenhaw://methodology/${name}`,{tool:name,reference:`https://kit.tenhaw.com/methodology/${slug}`,rules:name==='readiness'?'Weighted six-dimension self-assessment; bands need 80% coverage. Separate from the advisory audit.':name==='delivery'?'Five DORA metrics with production deployment evidence, service context and observed recovery.':name==='roi'?'Only realised cash is a cash benefit; recovered capacity is reported separately.':'Ownership and interaction checks support a design conversation.'});
  }
  for(const[name,prompt]of Object.entries({
    'ai-readiness-review':'Fetch the readiness questionnaire, collect evidence and explicit responses, then assess readiness. Explain response coverage and gaps. Do not infer unanswered scores or claim certification.',
    'delivery-health-review':'Collect events locally only when requested. Assess each service separately from production evidence. Use aggregate reports for remote scoring and explain every unavailable metric.',
    'ai-business-case':'Collect baseline volume, cost, saving scenarios and an explicit cash-realisation assumption. Estimate ROI and report retained capacity separately from money removed from cost lines.',
    'operating-model-design':'Establish products, accountable teams, measurable OKRs and intended roadmap outcomes. Generate the operating model and resolve missing ownership with the user.'
  }))server.registerPrompt(name,{description:`A structured ${name.replaceAll('-',' ')} workflow.`},async()=>({messages:[{role:'user',content:{type:'text',text:prompt}}]}));
}
