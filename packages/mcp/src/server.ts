import { McpServer, fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { serverInfo, type Surface } from './tools.js';
import { registerRemoteTools } from './remote.js';
import { localDefinitions, runLocalTool } from './local-tools.js';
export { registerRemoteTools } from './remote.js';
export function createServer(surface:Surface='local') {
  const server=new McpServer(serverInfo,{instructions:'Tenhaw Kit provides deterministic building blocks for internal product, portfolio, delivery and transformation tools. Explain missing evidence and keep credentials local.'});
  registerRemoteTools(server,surface);
  if(surface==='local')for(const definition of localDefinitions)server.registerTool(definition.name,{
    description:definition.description,inputSchema:fromJsonSchema(definition.inputSchema as JsonSchemaType),outputSchema:fromJsonSchema(definition.outputSchema as JsonSchemaType),
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:Boolean(definition.network)}
  },async input=>{try{const output=await runLocalTool(definition.name,input);return {structuredContent:output,content:[{type:'text',text:JSON.stringify(output)}]};}catch(error){return {isError:true,content:[{type:'text',text:error instanceof Error?error.message:'Local tool validation failed.'}]};}});
  return server;
}
