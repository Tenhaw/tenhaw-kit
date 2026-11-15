import { invariant, round, validateInput } from '@tenhaw/core';
export type Team={id:string;name:string;type:'stream-aligned'|'platform'|'enabling'|'complicated-subsystem';size:number;cognitiveLoad?:'low'|'medium'|'high';platformDependencies?:string[]};
export type Okr={id:string;objective:string;teamId?:string;keyResults:{id:string;description:string;baseline:number;target:number;current:number;confidence:number}[]};
export type RoadmapItem={id:string;title:string;horizon:'now'|'next'|'later';outcome?:string;teamId?:string;okrId?:string};
export type OperatingModelInput={teams:Team[];okrs?:Okr[];roadmap?:RoadmapItem[];interactions?:{from:string;to:string;mode:'collaboration'|'X-as-a-Service'|'facilitating'}[];products?:{id:string;name:string}[]};
export function generateOperatingModel(input:OperatingModelInput){
  const valid=validateInput<OperatingModelInput>('opmodel',input);
  const teams=[...valid.teams].sort((a,b)=>a.id.localeCompare(b.id)),okrs=[...(valid.okrs??[])].sort((a,b)=>a.id.localeCompare(b.id)),roadmap=[...(valid.roadmap??[])].sort((a,b)=>a.id.localeCompare(b.id)),interactions=[...(valid.interactions??[])].sort((a,b)=>(a.from+a.to+a.mode).localeCompare(b.from+b.to+b.mode));
  const teamIds=new Set(teams.map(t=>t.id)),okrIds=new Set(okrs.map(o=>o.id));
  invariant(teamIds.size===teams.length,'/teams','Team IDs must be unique');invariant(okrIds.size===okrs.length,'/okrs','OKR IDs must be unique');invariant(new Set(roadmap.map(r=>r.id)).size===roadmap.length,'/roadmap','Roadmap IDs must be unique');
  const checks:{code:string;entityId:string;message:string}[]=[];
  for(const t of teams){if(t.size>9)checks.push({code:'team-size',entityId:t.id,message:'Review whether this team can maintain clear collaboration and ownership.'});if(t.type==='stream-aligned'&&!t.platformDependencies?.length)checks.push({code:'platform-dependency',entityId:t.id,message:'Confirm whether this stream-aligned team needs platform support.'});for(const id of t.platformDependencies??[])invariant(teamIds.has(id)&&teams.find(x=>x.id===id)?.type==='platform',`/teams/${t.id}/platformDependencies`,'Reference an existing platform team');}
  for(const o of okrs){if(!o.teamId)checks.push({code:'okr-owner',entityId:o.id,message:'Assign an accountable team to this objective.'});else invariant(teamIds.has(o.teamId),`/okrs/${o.id}/teamId`,'Unknown owning team');invariant(new Set(o.keyResults.map(k=>k.id)).size===o.keyResults.length,`/okrs/${o.id}/keyResults`,'Key result IDs must be unique');for(const k of o.keyResults)invariant(k.target!==k.baseline,`/okrs/${o.id}/keyResults/${k.id}/target`,'Target must differ from baseline');}
  for(const r of roadmap){if(!r.outcome?.trim())checks.push({code:'roadmap-outcome',entityId:r.id,message:'State the outcome this item should change.'});if(!r.teamId)checks.push({code:'roadmap-owner',entityId:r.id,message:'Assign an accountable team to this roadmap item.'});else invariant(teamIds.has(r.teamId),`/roadmap/${r.id}/teamId`,'Unknown owning team');if(r.okrId)invariant(okrIds.has(r.okrId),`/roadmap/${r.id}/okrId`,'Unknown linked OKR');}
  for(const i of interactions)invariant(teamIds.has(i.from)&&teamIds.has(i.to)&&i.from!==i.to,'/interactions','Interactions must link two distinct known teams');
  const model={teams,okrs:okrs.map(o=>({...o,keyResults:o.keyResults.map(k=>({...k,progress:round((k.current-k.baseline)/(k.target-k.baseline))}))})),roadmap,interactions,products:[...(valid.products??[])].sort((a,b)=>a.id.localeCompare(b.id))};
  return {model,checks,limitations:['Team Topologies is a cited public model; no affiliation is implied.','Checks support a design conversation and are not organisational prescriptions.'],sources:['https://teamtopologies.com/key-concepts']};
}
export type OperatingModel=ReturnType<typeof generateOperatingModel>;
export function renderMermaid(report:OperatingModel):string{
  const ids=new Map(report.model.teams.map((t,i)=>[t.id,`team${i}`]));
  const safe=(text:string)=>text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/[\r\n]/g,' ');
  return ['flowchart LR',...report.model.teams.map(t=>`  ${ids.get(t.id)}["${safe(t.name)}"]`),...report.model.interactions.map(i=>`  ${ids.get(i.from)} -->|"${safe(i.mode)}"| ${ids.get(i.to)}`)].join('\n')+'\n';
}
