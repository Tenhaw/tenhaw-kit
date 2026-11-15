import { invariant, round, validateInput, validateDateTime, renderReport, type AttributionOptions } from '@tenhaw/core';
export type DeliveryEvent =
 | {id:string;type:'commit';timestamp:string;service:string}
 | {id:string;type:'deployment';timestamp:string;service:string;environment:string;commitIds:string[];status:'success'|'failed';rework?:boolean;proxy?:boolean}
 | {id:string;type:'incident';startedAt:string;restoredAt?:string;service:string;deploymentId:string}
 | {id:string;type:'work-item';startedAt:string;completedAt?:string;service:string;activeMinutes?:number}
 | {id:string;type:'pull-request';createdAt:string;firstReviewAt?:string;mergedAt?:string;service:string;additions?:number;deletions?:number};
export type MetricsConfig={since:string;until:string;productionEnvironment?:string;service?:string};
const HOUR=3600000,DAY=24*HOUR;
export function computeMetrics(input:DeliveryEvent[],cfg:MetricsConfig){
  validateInput<DeliveryEvent[]>('delivery-events',input);
  invariant(cfg,'/period','Explicit since and until timestamps are required');
  validateDateTime(cfg.since,'/period/since');validateDateTime(cfg.until,'/period/until');
  const start=Date.parse(cfg.since),end=Date.parse(cfg.until);
  invariant(end>start,'/period','until must be after since');
  const seen=new Map<string,DeliveryEvent>();
  for(const event of input){const old=seen.get(event.id);invariant(!old||JSON.stringify(old)===JSON.stringify(event),`/events/${event.id}`,'Conflicting duplicate event ID');seen.set(event.id,event);}
  const events=[...seen.values()].filter(e=>!cfg.service||e.service===cfg.service);
  invariant(new Set(events.map(e=>e.service)).size<=1,'/service','Compute each service separately; supply config.service when multiple services are present');
  for(const e of events){
    for(const [key,value] of Object.entries(e))if(['timestamp','startedAt','restoredAt','completedAt','createdAt','firstReviewAt','mergedAt'].includes(key))validateDateTime(value,`/events/${e.id}/${key}`);
    if(e.type==='incident'&&e.restoredAt)invariant(Date.parse(e.restoredAt)>=Date.parse(e.startedAt),`/events/${e.id}/restoredAt`,'Restoration cannot precede incident start');
    if(e.type==='work-item'&&e.completedAt)invariant(Date.parse(e.completedAt)>=Date.parse(e.startedAt),`/events/${e.id}/completedAt`,'Completion cannot precede start');
    if(e.type==='pull-request'){if(e.firstReviewAt)invariant(Date.parse(e.firstReviewAt)>=Date.parse(e.createdAt),`/events/${e.id}/firstReviewAt`,'Review cannot precede creation');if(e.mergedAt)invariant(Date.parse(e.mergedAt)>=Date.parse(e.createdAt),`/events/${e.id}/mergedAt`,'Merge cannot precede creation');}
  }
  const inside=(date:string)=>Date.parse(date)>=start&&Date.parse(date)<end;
  const period={since:cfg.since,until:cfg.until};
  const metric=(value:number|null,unit:string,sampleSize:number,caveats:string[]=[])=>({value:value===null?null:round(value),unit,sampleSize,period,dataSource:'supplied events',caveats});
  const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  const observedDeployments=events.filter((e):e is Extract<DeliveryEvent,{type:'deployment'}>=>e.type==='deployment'&&e.environment===(cfg.productionEnvironment??'production')&&!e.proxy);
  const deployments=observedDeployments.filter(e=>inside(e.timestamp));
  const commits=new Map(events.filter((e):e is Extract<DeliveryEvent,{type:'commit'}>=>e.type==='commit').map(e=>[e.id,e]));
  const incidents=events.filter((e):e is Extract<DeliveryEvent,{type:'incident'}>=>e.type==='incident'&&Date.parse(e.startedAt)<end&&deployments.some(d=>d.id===e.deploymentId&&Date.parse(e.startedAt)>=Date.parse(d.timestamp)));
  const firstDelivery=new Map<string,number>();
  const delivered=new Set<string>();
  for(const d of [...observedDeployments].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)))if(d.status==='success')for(const id of d.commitIds){const c=commits.get(id);if(c&&Date.parse(c.timestamp)<=Date.parse(d.timestamp)&&!delivered.has(id)){delivered.add(id);if(inside(d.timestamp))firstDelivery.set(id,(Date.parse(d.timestamp)-Date.parse(c.timestamp))/HOUR);}}
  const failed=new Set(deployments.filter(d=>d.status==='failed').map(d=>d.id));for(const i of incidents)failed.add(i.deploymentId);
  const recovery=incidents.filter(i=>i.restoredAt&&Date.parse(i.restoredAt)<=end).map(i=>(Date.parse(i.restoredAt!)-Date.parse(i.startedAt))/HOUR);
  const classified=deployments.filter(d=>typeof d.rework==='boolean');
  const work=events.filter((e):e is Extract<DeliveryEvent,{type:'work-item'}>=>e.type==='work-item'&&Date.parse(e.startedAt)<end);
  const completed=work.filter(e=>e.completedAt&&inside(e.completedAt));
  const cycle=completed.map(e=>(Date.parse(e.completedAt!)-Date.parse(e.startedAt))/HOUR);
  const efficiency=completed.filter(e=>e.activeMinutes!==undefined&&Date.parse(e.completedAt!)>Date.parse(e.startedAt)).map(e=>{
    const elapsed=(Date.parse(e.completedAt!)-Date.parse(e.startedAt))/60000;
    invariant(e.activeMinutes!<=elapsed,`/events/${e.id}/activeMinutes`,'Active time cannot exceed elapsed cycle time');return e.activeMinutes!/elapsed*100;
  });
  const prs=events.filter((e):e is Extract<DeliveryEvent,{type:'pull-request'}>=>e.type==='pull-request'&&!!e.mergedAt&&inside(e.mergedAt));
  const reviews=prs.filter(e=>e.firstReviewAt).map(e=>(Date.parse(e.firstReviewAt!)-Date.parse(e.createdAt))/HOUR);
  const sizes=prs.filter(e=>e.additions!==undefined&&e.deletions!==undefined).map(e=>e.additions!+e.deletions!);
  const noDeploy=['No observed production deployments in the requested period.'];
  const missing=(n:number,label:string)=>n?[]:[label];
  return {period,metrics:{
    deploymentFrequency:metric(deployments.length?deployments.length/((end-start)/DAY):null,'deployments/day',deployments.length,deployments.length?[]:noDeploy),
    changeLeadTime:metric(mean([...firstDelivery.values()]),'hours',firstDelivery.size,missing(firstDelivery.size,'No linked commit-to-production observations.')),
    changeFailRate:metric(deployments.length?failed.size/deployments.length*100:null,'percent',deployments.length,deployments.length?['Assumes supplied deployment statuses and incident links are complete.']:noDeploy),
    failedDeploymentRecoveryTime:metric(mean(recovery),'hours',recovery.length,missing(recovery.length,'No linked incidents with observed restoration.')),
    deploymentReworkRate:metric(deployments.length&&classified.length===deployments.length?classified.filter(d=>d.rework).length/deployments.length*100:null,'percent',classified.length,classified.length===deployments.length&&deployments.length?[]:['Every deployment needs explicit rework classification.']),
    cycleTime:metric(mean(cycle),'hours',cycle.length,missing(cycle.length,'No completed work items in the period.')),
    throughput:metric(work.length?completed.length/((end-start)/(7*DAY)):null,'items/week',completed.length,work.length?[]:['No work-item observations.']),
    wip:metric(work.length?work.filter(e=>!e.completedAt||Date.parse(e.completedAt)>=end).length:null,'items at period end',work.length,work.length?[]:['No work-item observations.']),
    flowEfficiency:metric(mean(efficiency),'percent',efficiency.length,missing(efficiency.length,'No completed work items with active time.')),
    prReviewTime:metric(mean(reviews),'hours',reviews.length,missing(reviews.length,'No merged pull requests with a first review timestamp.')),
    prSize:metric(mean(sizes),'changed lines',sizes.length,missing(sizes.length,'No merged pull requests with additions and deletions.'))
  },caveats:['Metrics describe one service and the supplied event window; missing links remain unavailable.',...(events.some(e=>e.type==='deployment'&&e.proxy)?['Proxy deployment events are excluded from DORA metrics.']:[])]};
}
export type DeliveryReport=ReturnType<typeof computeMetrics>;
export function scoreDeliveryHealth(report:DeliveryReport){
  validateInput('delivery-report',report);
  validateDateTime(report.period.since,'/period/since');validateDateTime(report.period.until,'/period/until');
  invariant(Number.isFinite(Date.parse(report.period.since))&&Number.isFinite(Date.parse(report.period.until))&&Date.parse(report.period.until)>Date.parse(report.period.since),'/period','Use an increasing observed period');
  for(const [name,metric] of Object.entries(report.metrics))invariant(metric.period.since===report.period.since&&metric.period.until===report.period.until,`/metrics/${name}/period`,'All metrics must use the report period');
  const actions:string[]=[];
  if(report.metrics.changeLeadTime.value===null)actions.push('Link commits to observed production deployments.');
  if(report.metrics.failedDeploymentRecoveryTime.value===null)actions.push('Record incident-to-deployment links and restoration timestamps.');
  if(report.metrics.deploymentReworkRate.value===null)actions.push('Classify planned and incident-driven deployments.');
  if(actions.length===0)actions.push('Review trends for this service with the team before choosing an improvement.');
  return {status:'informational',metrics:report.metrics,actions:actions.slice(0,3),limitations:['No composite score or cross-team ranking is inferred.','DORA defines five delivery performance metrics; context and data completeness matter.'],sources:['https://dora.dev/guides/dora-metrics/']};
}
export function renderDeliveryReport(report:DeliveryReport,format:'md'|'html'|'json',options:AttributionOptions={}){return renderReport(report,format,{content:'delivery-metrics',...options});}
