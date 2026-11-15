import { runTool } from '@tenhaw/mcp/tools';
import { secureRequest } from '../../../../src/security';
export const runtime='nodejs';
export const maxDuration=10;
const names:Record<string,string>={'readiness/score':'assess_ai_readiness','delivery/health':'score_delivery_health','roi/estimate':'estimate_ai_roi'};
export async function POST(request:Request,context:{params:Promise<{tool:string[]}>}){
  const {tool}=await context.params,name=names[tool.join('/')];if(!name)return Response.json({error:'Unknown endpoint.'},{status:404});
  return secureRequest(request,async input=>{
    const body=await input.json();
    return Response.json(await runTool(name,name==='assess_ai_readiness'?{responses:body}:name==='score_delivery_health'?{metrics:body}:body,'remote'));
  });
}
export async function OPTIONS(request:Request){return secureRequest(request,async()=>new Response(null,{status:204}));}
