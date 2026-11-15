import { createHmac } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DeliveryEvent } from './index.js';

export class CollectorError extends Error {
  constructor(message: string, public readonly exitCode: 3 | 4 = 3) { super(message); this.name = 'CollectorError'; }
}
type ApiRecord = Record<string, any>;
type Context = { fetch?: typeof fetch; env?: NodeJS.ProcessEnv; sleep?: (ms:number)=>Promise<void>; cacheDir?: string };
type Options = { since:string; until?:string; noCache?:boolean };
const delay = (ms:number) => new Promise<void>(r => setTimeout(r, ms));
function required(env: NodeJS.ProcessEnv, name:string) {
  const value = env[name]; if (!value) throw new CollectorError(`Set ${name} for local collection.`, 4); return value;
}
function redact<T>(value:T,secrets:string[]):T {
  if (typeof value === 'string') return secrets.reduce((v,s)=>s?v.split(s).join('[redacted]'):v,value) as T;
  if (Array.isArray(value)) return value.map(v=>redact(v,secrets)) as T;
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v,secrets)])) as T;
  return value;
}
function date(value:string) { const n=Date.parse(value); if (!Number.isFinite(n)||!/(Z|[+-]\d\d:\d\d)$/.test(value)) throw new CollectorError('Collection dates need ISO timestamps with a timezone.'); return n; }

async function request(url:URL,headers:Record<string,string>,context:Context):Promise<any> {
  for (let attempt=0;attempt<5;attempt++) {
    let response:Response;
    try { response=await (context.fetch??fetch)(url,{headers,redirect:'error',signal:AbortSignal.timeout(20000)}); }
    catch { if(attempt===4)throw new CollectorError('Upstream request failed after retries.');await(context.sleep??delay)(Math.min(2**attempt,8)*1000);continue; }
    if(response.status===429 || response.status>=500 || response.status===403&&response.headers.get('x-ratelimit-remaining')==='0') {
      if(attempt===4)throw new CollectorError(`Upstream HTTP ${response.status} after retries.`);
      const raw=response.headers.get('retry-after');
      const seconds=raw?(Number.isFinite(Number(raw))?Number(raw):Math.max(0,(Date.parse(raw)-Date.now())/1000)):2**attempt;
      if(!Number.isFinite(seconds)||seconds>60)throw new CollectorError('Upstream rate limit requires a wait longer than 60 seconds.');
      await(context.sleep??delay)(Math.max(0,seconds)*1000);continue;
    }
    if(!response.ok)throw new CollectorError(`Upstream returned HTTP ${response.status}.`);
    try{return await response.json();}catch{throw new CollectorError('Upstream returned invalid JSON.');}
  }
  throw new CollectorError('Upstream retries exhausted.');
}

async function cached(identity:unknown,secrets:string[],options:Options,ctx:Context,load:()=>Promise<DeliveryEvent[]>) {
  // A credential keys an opaque partition tag; this is not a stored password verifier.
  const principalKey=secrets.reduce((tag,secret)=>createHmac('sha256',secret).update(tag).digest('hex'),'tenhaw-kit-cache-principal-v1');
  const key=createHmac('sha256',principalKey).update(JSON.stringify(identity)).digest('hex');
  const directory=ctx.cacheDir??'.tenhaw/cache', file=join(directory,`${key}.json`);
  if(!options.noCache)try{if(Date.now()-(await stat(file)).mtimeMs<300000){const value=JSON.parse(await readFile(file,'utf8'));if(Array.isArray(value))return redact(value,secrets) as DeliveryEvent[];}}catch{/* A cache miss never changes collection. */}
  const events=redact(await load(),secrets);
  if(!options.noCache){await mkdir(directory,{recursive:true,mode:0o700});const temporary=`${file}.${process.pid}.tmp`;await writeFile(temporary,JSON.stringify(events),{mode:0o600});await rename(temporary,file);}
  return events;
}

export async function collectGithub(options:Options&{repos:string[]},context:Context={}):Promise<DeliveryEvent[]> {
  const token=required(context.env??process.env,'GITHUB_TOKEN');
  const start=date(options.since),end=date(options.until??new Date().toISOString());
  if(end<=start||!options.repos.length||options.repos.some(r=>!/^[-\w.]+\/[-\w.]+$/.test(r)))throw new CollectorError('Use owner/repository names and an increasing date range.');
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const get=(path:string,params:Record<string,string>={})=>{const url=new URL(path,'https://api.github.com');for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);return request(url,headers,context);};
  const pages=async(path:string,params:Record<string,string>={})=>{const rows:ApiRecord[]=[];for(let page=1;page<=1000;page++){const data=await get(path,{...params,per_page:'100',page:String(page)});if(!Array.isArray(data))throw new CollectorError('Unexpected GitHub response shape.');rows.push(...data);if(data.length<100)return rows;}throw new CollectorError('GitHub pagination limit reached; narrow the collection.');};
  return cached(['github',options], [token], options, context,async()=>{
    const events:DeliveryEvent[]=[];
    for(const repo of options.repos){
      const base=`/repos/${repo}`,commits=new Map<string,DeliveryEvent>();
      const deployments=await pages(`${base}/deployments`);
      const defaultBranch=!deployments.length?(await get(base)).default_branch:undefined;
      for(const deployment of deployments){
        if(!deployment.created_at||date(deployment.created_at)>=end)continue;
        // Status time is the observed deployment outcome, not the request creation time.
        const statuses=await pages(`${base}/deployments/${deployment.id}/statuses`);
        const final=statuses.find(s=>['success','failure','error'].includes(s.state)&&s.created_at&&date(s.created_at)<end);
        if(!final?.created_at||date(final.created_at)<start||date(final.created_at)>=end)continue;
        const changeFailure=deployment.payload?.tenhaw?.changeFailure===true;
        // A failed deployment job does not prove a change reached production and caused a failure.
        if(final.state!=='success'&&!changeFailure)continue;
        const sha=String(deployment.sha??'');
        if(sha&&!commits.has(sha)){
          const commit=await get(`${base}/commits/${encodeURIComponent(sha)}`),timestamp=commit.commit?.committer?.date;
          if(timestamp)commits.set(sha,{id:`${repo}:commit:${sha}`,type:'commit',timestamp,service:repo});
        }
        events.push({id:`${repo}:deployment:${deployment.id}`,type:'deployment',timestamp:final.created_at,service:repo,environment:deployment.environment??'production',commitIds:commits.has(sha)?[`${repo}:commit:${sha}`]:[],status:changeFailure?'failed':'success',...(typeof deployment.payload?.tenhaw?.rework==='boolean'?{rework:deployment.payload.tenhaw.rework}:{})});
      }
      const pulls=await pages(`${base}/pulls`,{state:'closed',sort:'updated',direction:'desc'});
      for(const pull of pulls){
        if(!pull.merged_at||date(pull.merged_at)<start||date(pull.merged_at)>=end)continue;
        const detail=await get(`${base}/pulls/${pull.number}`),reviews=await pages(`${base}/pulls/${pull.number}/reviews`);
        const first=reviews.filter(r=>r.submitted_at&&date(r.submitted_at)<=date(pull.merged_at)).sort((a,b)=>date(a.submitted_at)-date(b.submitted_at))[0];
        events.push({id:`${repo}:pr:${pull.number}`,type:'pull-request',service:repo,createdAt:pull.created_at,mergedAt:pull.merged_at,...(first?{firstReviewAt:first.submitted_at}:{}),...(Number.isInteger(detail.additions)?{additions:detail.additions}:{}),...(Number.isInteger(detail.deletions)?{deletions:detail.deletions}:{})});
        if(!deployments.length&&pull.base?.ref===defaultBranch)events.push({id:`${repo}:merge-proxy:${pull.number}`,type:'deployment',timestamp:pull.merged_at,service:repo,environment:'production',commitIds:[],status:'success',proxy:true});
      }
      for(const issue of await pages(`${base}/issues`,{labels:'incident',state:'all',since:options.since})){
        if(issue.pull_request)continue;
        const body=String(issue.body??''),deploymentId=/tenhaw-deployment:\s*(\S+)/i.exec(body)?.[1],startedAt=/tenhaw-started:\s*(\S+)/i.exec(body)?.[1],restoredAt=/tenhaw-restored:\s*(\S+)/i.exec(body)?.[1];
        if(!deploymentId||!startedAt)continue;
        date(startedAt);if(restoredAt)date(restoredAt);
        events.push({id:`${repo}:incident:${issue.number}`,type:'incident',service:repo,deploymentId:`${repo}:deployment:${deploymentId}`,startedAt,...(restoredAt?{restoredAt}:{})});
      }
      events.push(...commits.values());
    }
    return events;
  });
}

export async function collectJira(options:Options&{jql:string;config?:{statusToStage?:Record<string,string>}},context:Context={}):Promise<DeliveryEvent[]> {
  const env=context.env??process.env,token=required(env,'JIRA_API_TOKEN'),email=required(env,'JIRA_EMAIL'),origin=required(env,'JIRA_BASE_URL');
  let base:URL;try{base=new URL(origin);}catch{throw new CollectorError('JIRA_BASE_URL must be a Jira Cloud HTTPS origin.');}
  if(base.protocol!=='https:'||!base.hostname.endsWith('.atlassian.net')||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new CollectorError('JIRA_BASE_URL must be a Jira Cloud HTTPS origin.');
  const start=date(options.since),end=date(options.until??new Date().toISOString());if(end<=start)throw new CollectorError('Use an increasing date range.');
  const mapping=Object.fromEntries(Object.entries(options.config?.statusToStage??{}).map(([k,v])=>[k.toLowerCase(),v]));
  if(!Object.keys(mapping).length)throw new CollectorError('Jira collection requires config.statusToStage mappings for active and done statuses.');
  if(Object.values(mapping).some(v=>!['todo','active','waiting','done'].includes(v)))throw new CollectorError('Status stages must be todo, active, waiting or done.');
  const headers={Authorization:`Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,Accept:'application/json'};
  const get=(path:string,params:Record<string,string>={})=>{const url=new URL(path,base);for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);return request(url,headers,context);};
  return cached(['jira',origin,options,mapping],[token,email],options,context,async()=>{
    const events:DeliveryEvent[]=[],tokens=new Set<string>();let nextPageToken:string|undefined;
    for(let page=0;page<1000;page++){
      const response=await get('/rest/api/3/search/jql',{jql:options.jql,maxResults:'100',fields:'created,status,project',...(nextPageToken?{nextPageToken}:{})});
      if(!Array.isArray(response.issues))throw new CollectorError('Unexpected Jira response shape.');
      for(const issue of response.issues){
        const transitions:{at:string;status:string}[]=[];let offset=0;
        for(let page=0;page<1000;page++){
          const data=await get(`/rest/api/3/issue/${encodeURIComponent(issue.id)}/changelog`,{startAt:String(offset),maxResults:'100'});
          if(!Array.isArray(data.values))throw new CollectorError('Unexpected Jira changelog shape.');
          for(const history of data.values)for(const item of history.items??[])if(item.field==='status')transitions.push({at:history.created,status:item.toString??''});
          offset+=data.values.length;if(data.isLast||offset>=data.total||!data.values.length)break;
          if(page===999)throw new CollectorError('Jira changelog limit reached.');
        }
        transitions.sort((a,b)=>date(a.at)-date(b.at));
        let startedAt:string|undefined,completedAt:string|undefined,previousAt:string|undefined,previousStage='todo',active=0;
        for(const transition of transitions){
          if(date(transition.at)>=end)break;
          const stage=mapping[transition.status.toLowerCase()];
          if(previousStage==='active'&&previousAt)active+=Math.max(0,date(transition.at)-date(previousAt))/60000;
          if(stage==='active'&&!startedAt)startedAt=transition.at;
          if(stage==='done')completedAt=transition.at;else if(stage)completedAt=undefined;
          previousAt=transition.at;previousStage=stage??'unknown';
        }
        if(startedAt&&(!completedAt||date(completedAt)>=start))events.push({id:`${base.hostname}:${issue.key}`,type:'work-item',service:issue.fields.project.key,startedAt,...(completedAt?{completedAt,activeMinutes:active}:{})});
      }
      nextPageToken=response.nextPageToken;
      if(response.isLast||!nextPageToken)return events;
      if(tokens.has(nextPageToken))throw new CollectorError('Jira repeated a pagination token.');tokens.add(nextPageToken);
    }
    throw new CollectorError('Jira pagination limit reached; narrow the query.');
  });
}
