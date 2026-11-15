import { collectGithub, collectJira } from '@tenhaw/delivery-metrics/collectors';
import { scaffold } from 'tenhaw/scaffold';
import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, dirname } from 'node:path';
import { runDefinition, runTool, toolsFor, type ToolDefinition } from './tools.js';
const object=(properties:Record<string,unknown>,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
const resultSchema=(result:Record<string,unknown>)=>object({result,generator:object({generator:{const:'Tenhaw Kit'},version:{type:'string'},url:{type:'string',format:'uri'}},['generator','version','url'])},['result']);
export const localDefinitions:ToolDefinition[]=[
  {name:'collect_delivery_events',description:'Use when a user explicitly requests local collection from GitHub or Jira for an internal delivery tool. Uses environment credentials, writes normalised events to a local file and returns its path; no credentials are returned.',localOnly:true,mutates:true,network:true,
    inputSchema:object({githubRepos:{type:'array',items:{type:'string',pattern:'^[-\\w.]+/[-\\w.]+$'},maxItems:20},jiraJql:{type:'string',maxLength:5000},config:object({statusToStage:{type:'object',additionalProperties:{enum:['todo','active','waiting','done']}}}),since:{type:'string',format:'date-time'},until:{type:'string',format:'date-time'}},['since','until']),outputSchema:resultSchema({type:'object'}),execute:async(input)=>{
      if(!input.githubRepos?.length&&!input.jiraJql)throw new Error('Supply githubRepos or jiraJql for local collection.');
      const root=await realpath(process.cwd()),directory=resolve('.tenhaw/events');
      let parent=directory;while(true){try{const actual=await realpath(parent),rel=relative(root,actual);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Event output directory resolves outside the workspace.');break;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;parent=dirname(parent);}}
      // MCP has one checked output location; the optional CLI cache is never written here.
      const events=[...(input.githubRepos?.length?await collectGithub({repos:input.githubRepos,since:input.since,until:input.until,noCache:true}):[]),...(input.jiraJql?await collectJira({jql:input.jiraJql,since:input.since,until:input.until,config:input.config,noCache:true}):[])];
      await mkdir(directory,{recursive:true,mode:0o700});
      const file=resolve(directory,`events-${Date.now()}-${process.pid}.json`);await writeFile(file,JSON.stringify(events,null,2),{flag:'wx',mode:0o600});
      return {eventCount:events.length,file,services:[...new Set(events.map(e=>e.service))].sort(),nextStep:'Compute each service separately with tenhaw delivery-metrics --from-file.'};
    }},
  {name:'scaffold_internal_tool',description:'Use when a user asks to create an internal adoption, delivery, use-case, operating-model or readiness tool in a new project directory. Writes a standalone starter with synthetic examples and browser-local data.',localOnly:true,mutates:true,
    inputSchema:object({template:{enum:['ai-adoption-dashboard','delivery-metrics-dashboard','ai-usecase-register','product-operating-model','ai-readiness-assessment']},directory:{type:'string',minLength:1,maxLength:240}},['template','directory']),outputSchema:resultSchema({type:'object'}),execute:async(input)=>{
      const root=await realpath(process.cwd()),target=resolve(root,input.directory),rel=relative(root,target);
      if(isAbsolute(input.directory)||!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('Scaffold directory must be a new relative path inside the current workspace.');
      // The nearest existing parent must remain inside the workspace after resolving symlinks.
      let parent=dirname(target);while(true){try{const resolved=await realpath(parent);const r=relative(root,resolved);if(r.startsWith('..')||isAbsolute(r))throw new Error('Scaffold parent resolves outside the workspace.');break;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;parent=dirname(parent);}}
      return scaffold(input.template,target);
    }}
];
export const localToolsFor=()=>[...toolsFor('local'),...localDefinitions];
export async function runLocalTool(name:string,input:unknown){const tool=localDefinitions.find(t=>t.name===name);return tool?runDefinition(tool,input,'local'):runTool(name,input,'local');}
