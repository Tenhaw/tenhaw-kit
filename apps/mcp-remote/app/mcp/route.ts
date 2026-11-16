import { VERSION } from '@tenhaw/core';
import { createMcpHandler } from 'mcp-handler';
import { registerRemoteTools } from '@tenhaw/mcp/remote';
import { secureRequest } from '../../src/security';
export const runtime='nodejs';
export const maxDuration=10;
const handler=createMcpHandler(server=>registerRemoteTools(server,'remote',{attribution:false}),{serverInfo:{name:'Tenhaw Kit',version:VERSION},instructions:'Deterministic building blocks for internal delivery and transformation apps. Remote delivery accepts aggregate metrics only. Never send credentials or raw repository events.',verboseLogs:false});
const route=(request:Request)=>secureRequest(request,handler);
export {route as POST,route as GET,route as OPTIONS};
