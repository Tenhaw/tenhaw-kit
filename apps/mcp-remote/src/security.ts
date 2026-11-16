import { createHash } from 'node:crypto';
const buckets=new Map<string,{count:number;expires:number}>();
export const BODY_LIMIT=256*1024;
export function localRateLimit(key:string,now=Date.now(),limit=30){
  for(const[id,bucket]of buckets)if(bucket.expires<=now)buckets.delete(id);
  let bucket=buckets.get(key);if(!bucket){bucket={count:0,expires:now+60000};buckets.set(key,bucket);}
  if(buckets.size>10000)return false;
  return ++bucket.count<=limit;
}
async function permitted(request:Request){
  // Set only after the project's active native WAF rule has been verified.
  if(process.env.TENHAW_RATE_LIMIT_PROVIDER==='vercel'&&process.env.VERCEL==='1'){
    // New app paths need the expanded native rule verified before public traffic.
    if(new URL(request.url).pathname.startsWith('/mcp/apps/')&&process.env.TENHAW_APPS_RATE_LIMIT_CONFIGURED!=='true'&&process.env.VERCEL_ENV==='production')return 'unconfigured';
    return 'yes';
  }
  const address=request.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown';
  const identity=createHash('sha256').update(`${Math.floor(Date.now()/60000)}:${address}`).digest('hex');
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token){if(process.env.VERCEL_ENV==='production')return 'unconfigured';return localRateLimit(identity)?'yes':'limited';}
  try{
    const endpoint=new URL('/pipeline',url);
    if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.upstash.io'))return 'unconfigured';
    const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify([['INCR',`tenhaw:${identity}`],['EXPIRE',`tenhaw:${identity}`,120]]),signal:AbortSignal.timeout(1500)});
    if(!response.ok)return 'unconfigured';
    const result=await response.json() as {result?:number;error?:string}[];
    if(typeof result[0]?.result!=='number'||result.some(r=>r.error))return 'unconfigured';
    return result[0].result<=30?'yes':'limited';
  }catch{return 'unconfigured';}
}
export function cors(request:Request){
  const origin=request.headers.get('origin');
  const allowed=new Set((process.env.TENHAW_ALLOWED_ORIGINS??'https://chatgpt.com,https://claude.ai').split(',').map(v=>v.trim()));
  if(origin&&!allowed.has(origin))return null;
  return {'Vary':'Origin','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, MCP-Session-Id','Access-Control-Expose-Headers':'MCP-Protocol-Version, MCP-Session-Id'};
}
export async function secureRequest(request:Request,handler:(request:Request)=>Promise<Response>){
  const headers=cors(request);if(!headers)return Response.json({error:'Origin not permitted.'},{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const rate=await permitted(request);
  if(rate!=='yes')return Response.json({error:rate==='limited'?'Request limit reached. Retry after 60 seconds.':'Production rate limiting needs configuration.'},{status:rate==='limited'?429:503,headers:{...headers,'Retry-After':'60'}});
  let prepared=request;
  if(request.method==='POST'){
    if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return Response.json({error:'Use application/json.'},{status:415,headers});
    if(Number(request.headers.get('content-length')??0)>BODY_LIMIT)return Response.json({error:'Request exceeds 256 KB.'},{status:413,headers});
    const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
    if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>BODY_LIMIT){await reader.cancel();return Response.json({error:'Request exceeds 256 KB.'},{status:413,headers});}chunks.push(value);}
    const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
    prepared=new Request(request,{body:body.buffer});
  }
  try{
    const response=await handler(prepared);
    for(const[key,value]of Object.entries(headers))response.headers.set(key,value);
    return response;
  }catch{return Response.json({error:'Request could not be processed. Check the documented input schema.'},{status:400,headers});}
}
