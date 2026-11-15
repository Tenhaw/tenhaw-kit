import { validateInput } from "@tenhaw/core";
import { computeMetrics, type DeliveryEvent } from "@tenhaw/delivery-metrics";
import { list } from "./io";
export const samplePeriod={since:"2026-10-01T00:00:00Z",until:"2026-11-01T00:00:00Z"};
export const example:DeliveryEvent[]=[
{id:"c1",type:"commit",service:"Example service",timestamp:"2026-10-05T08:00:00Z"},
{id:"c2",type:"commit",service:"Example service",timestamp:"2026-10-07T08:00:00Z"},
{id:"d1",type:"deployment",service:"Example service",timestamp:"2026-10-05T12:00:00Z",environment:"production",commitIds:["c1"],status:"success",rework:false},
{id:"d2",type:"deployment",service:"Example service",timestamp:"2026-10-07T12:00:00Z",environment:"production",commitIds:["c2"],status:"success",rework:false},
{id:"i1",type:"incident",service:"Example service",startedAt:"2026-10-07T12:10:00Z",restoredAt:"2026-10-07T13:10:00Z",deploymentId:"d2"},
{id:"d3",type:"deployment",service:"Example service",timestamp:"2026-10-07T13:10:00Z",environment:"production",commitIds:["c2"],status:"success",rework:true},
{id:"w1",type:"work-item",service:"Example service",startedAt:"2026-10-01T09:00:00Z",completedAt:"2026-10-04T09:00:00Z",activeMinutes:600},
{id:"w2",type:"work-item",service:"Example service",startedAt:"2026-10-05T09:00:00Z",completedAt:"2026-10-07T09:00:00Z",activeMinutes:480},
{id:"w3",type:"work-item",service:"Example service",startedAt:"2026-10-08T09:00:00Z",completedAt:"2026-10-13T09:00:00Z",activeMinutes:900},
{id:"w4",type:"work-item",service:"Example service",startedAt:"2026-10-25T09:00:00Z"},
{id:"pr1",type:"pull-request",service:"Example service",createdAt:"2026-10-04T09:00:00Z",firstReviewAt:"2026-10-04T11:00:00Z",mergedAt:"2026-10-05T08:00:00Z",additions:120,deletions:20}
];
export function validateEvents(value:unknown){list(value,"events");return validateInput<DeliveryEvent[]>("delivery-events",value);}
export function calculate(events:DeliveryEvent[],since:string,until:string,service?:string){return computeMetrics(events,{since,until,service});}
