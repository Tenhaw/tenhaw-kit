import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectGithub, collectJira } from '../packages/delivery-metrics/src/collectors.js';

const temporary:string[]=[];
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
const dates={since:'2026-01-01T00:00:00Z',until:'2026-02-01T00:00:00Z',noCache:true};
const reply=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
const fakeFetch=(handle:(url:URL,init:RequestInit)=>Response|Promise<Response>)=>(async(input:RequestInfo|URL,init:RequestInit={})=>handle(new URL(String(input)),init)) as typeof fetch;

describe('local collection privacy and source evidence',()=>{
  it('uses deployment outcome time, excludes unclassified job failures and namespaces event IDs',async()=>{
    const token='example-do-not-return-token';
    const fetch=fakeFetch((url,init)=>{
      expect(init.redirect).toBe('error');expect((init.headers as Record<string,string>).Authorization).toBe(`Bearer ${token}`);
      if(url.pathname.endsWith('/deployments'))return reply([
        {id:1,sha:'abc',created_at:'2025-12-31T23:50:00Z',environment:'production'},
        {id:2,sha:'jobfail',created_at:dates.since,environment:'production'},
        {id:3,sha:'classified',created_at:dates.since,environment:'production',payload:{tenhaw:{changeFailure:true,rework:true}}},
      ]);
      if(url.pathname.endsWith('/deployments/1/statuses'))return reply([{state:'success',created_at:'2026-01-02T00:00:00Z'}]);
      if(url.pathname.includes('/statuses'))return reply([{state:'failure',created_at:'2026-01-03T00:00:00Z'}]);
      if(url.pathname.includes('/commits/'))return reply({commit:{committer:{date:dates.since}}});
      if(url.pathname.endsWith('/pulls'))return reply([]);
      if(url.pathname.endsWith('/issues'))return reply([{number:4,closed_at:'2026-01-05T00:00:00Z',body:'tenhaw-deployment: 1\ntenhaw-started: 2026-01-04T00:00:00Z'}]);
      throw new Error('Unexpected fixture route');
    });
    const events=await collectGithub({...dates,repos:['example/app']},{env:{GITHUB_TOKEN:token},fetch});
    expect(events.filter(event=>event.type==='deployment')).toHaveLength(2);
    expect(events.find(event=>event.id==='example/app:deployment:2')).toBeUndefined();
    expect(events.find(event=>event.id==='example/app:deployment:3')).toMatchObject({status:'failed',rework:true});
    expect(events.find(event=>event.id==='example/app:incident:4')).not.toHaveProperty('restoredAt');
    expect(JSON.stringify(events)).not.toContain(token);
  });
  it('respects historical until when a newer outcome exists',async()=>{
    const fetch=fakeFetch(url=>{
      if(url.pathname.endsWith('/deployments'))return reply([{id:1,created_at:dates.since,environment:'production'}]);
      if(url.pathname.endsWith('/statuses'))return reply([{state:'success',created_at:'2026-03-01T00:00:00Z'},{state:'success',created_at:'2026-01-03T00:00:00Z'}]);
      return reply([]);
    });
    const events=await collectGithub({...dates,repos:['example/app']},{env:{GITHUB_TOKEN:'example-token'},fetch});
    expect(events[0]).toMatchObject({timestamp:'2026-01-03T00:00:00Z'});
  });
  it('paginates, proxies only default-branch merges and excludes reviews submitted after merge',async()=>{
    const pullPages:number[]=[];
    const fetch=fakeFetch(url=>{
      if(url.pathname.endsWith('/deployments')||url.pathname.endsWith('/issues'))return reply([]);
      if(url.pathname==='/repos/example/app')return reply({default_branch:'main'});
      if(url.pathname.endsWith('/pulls')){
        const page=Number(url.searchParams.get('page'));pullPages.push(page);
        if(page===1)return reply([{number:1,created_at:dates.since,merged_at:'2026-01-03T00:00:00Z',base:{ref:'main'}},{number:2,created_at:dates.since,merged_at:'2026-01-03T00:00:00Z',base:{ref:'release'}},...Array.from({length:98},()=>({merged_at:null}))]);
        return reply([]);
      }
      if(url.pathname.endsWith('/reviews'))return reply([{submitted_at:'2026-01-04T00:00:00Z'}]);
      if(/\/pulls\/\d+$/.test(url.pathname))return reply({additions:1,deletions:2});
      throw new Error('Unexpected fixture route');
    });
    const events=await collectGithub({...dates,repos:['example/app']},{env:{GITHUB_TOKEN:'example-token'},fetch});
    expect(pullPages).toEqual([1,2]);expect(events.filter(event=>event.type==='deployment')).toHaveLength(1);
    expect(events.find(event=>event.type==='pull-request')).not.toHaveProperty('firstReviewAt');
  });
  it('honours Retry-After and redacts tokens in normalised caches, scoped to the principal',async()=>{
    const cacheDir=await mkdtemp(join(tmpdir(),'tenhaw-collector-'));temporary.push(cacheDir);let count=0;const delays:number[]=[];
    const fetch=fakeFetch(url=>{
      if(url.pathname.endsWith('/deployments')){count++;if(count===1)return reply({},429,{'Retry-After':'1'});return reply([]);}
      if(url.pathname==='/repos/example/app')return reply({default_branch:'main'});return reply([]);
    });
    const context={env:{GITHUB_TOKEN:'example-principal-a'},fetch,cacheDir,sleep:async(ms:number)=>{delays.push(ms);}};
    const options={...dates,noCache:false,repos:['example/app']};
    await collectGithub(options,context);await collectGithub(options,context);expect(count).toBe(2);expect(delays).toEqual([1000]);
    await collectGithub(options,{...context,env:{GITHUB_TOKEN:'example-principal-b'}});expect(count).toBe(3);
    const files=await readdir(cacheDir);expect(files).toHaveLength(2);for(const file of files)expect(await readFile(join(cacheDir,file),'utf8')).not.toContain('example-principal');
  });
  it('paginates Jira search and changelogs, requires explicit mappings and stops at until',async()=>{
    let searches=0,changes=0;
    const env={JIRA_BASE_URL:'https://example.atlassian.net',JIRA_EMAIL:'example@example.test',JIRA_API_TOKEN:'example-token'};
    const fetch=fakeFetch(url=>{
      if(url.pathname.endsWith('/search/jql')){searches++;return reply(searches===1?{issues:[{id:'1',key:'APP-1',fields:{project:{key:'APP'}}}],nextPageToken:'next',isLast:false}:{issues:[],isLast:true});}
      changes++;return reply({values:[{created:changes===1?dates.since:'2026-02-02T00:00:00Z',items:[{field:'status',toString:changes===1?'Working':'Complete'}]}],total:2,isLast:changes===2});
    });
    await expect(collectJira({...dates,jql:'project = APP'},{env,fetch})).rejects.toThrow('statusToStage');
    const events=await collectJira({...dates,jql:'project = APP',config:{statusToStage:{Working:'active',Complete:'done'}}},{env,fetch});
    expect(searches).toBe(2);expect(changes).toBe(2);expect(events).toHaveLength(1);expect(events[0]).not.toHaveProperty('completedAt');
  });
  it('rejects missing credentials, unsafe Jira origins and excessively long server-directed waits',async()=>{
    await expect(collectGithub({...dates,repos:['example/app']},{env:{}})).rejects.toMatchObject({exitCode:4});
    await expect(collectJira({...dates,jql:'x'},{env:{JIRA_BASE_URL:'https://example.atlassian.net.attacker.test',JIRA_EMAIL:'e',JIRA_API_TOKEN:'t'}})).rejects.toThrow('origin');
    const fetch=fakeFetch(()=>reply({},429,{'Retry-After':'600'}));await expect(collectGithub({...dates,repos:['example/app']},{env:{GITHUB_TOKEN:'example-token'},fetch})).rejects.toThrow('longer than 60');
  });
});
