import { schemas, generator, VERSION } from '@tenhaw/core';
import { fromJsonSchema, type JsonSchemaType, type StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import { loadFramework, scoreReadiness, type ReadinessResponse } from '@tenhaw/ai-readiness';
import { calculateRoi, estimateProjectCost, type RoiInput } from '@tenhaw/ai-roi';
import { computeMetrics, scoreDeliveryHealth, type DeliveryReport, type DeliveryEvent, type MetricsConfig } from '@tenhaw/delivery-metrics';
import { prioritiseUseCases, type UseCase } from '@tenhaw/usecase-register';
import { generateOperatingModel, type OperatingModelInput } from '@tenhaw/opmodel';

export type Surface = 'local' | 'remote';
export type ToolDefinition = { name:string; description:string; inputSchema:Record<string,unknown>; outputSchema:Record<string,unknown>; localOnly?:boolean; mutates?:boolean; network?:boolean; execute:(input:any,surface:Surface)=>Promise<unknown> };
const object = (properties:Record<string,unknown>,required:string[]=[]) => ({type:'object',properties,required,additionalProperties:false});
const embed = (value:unknown):Record<string,unknown> => {const copy=JSON.parse(JSON.stringify(value));delete copy.$id;delete copy.$schema;return copy;};
const schema = (name:keyof typeof schemas)=>embed(schemas[name]);
const deliveryTransportSchema=()=>{
  const report=schema('delivery-report');
  return {...report,properties:{...(report.properties as Record<string,unknown>),generator:object({generator:{const:'Tenhaw Kit'},version:{type:'string'},url:{type:'string',format:'uri'}},['generator','version','url'])}};
};
const format={type:'string',enum:['md','html','json']};
const resultSchema=(result:Record<string,unknown>)=>object({result,generator:object({generator:{const:'Tenhaw Kit'},version:{type:'string'},url:{type:'string',format:'uri'}},['generator','version','url'])},['result']);

export const definitions:ToolDefinition[]=[
  {name:'assess_ai_readiness',description:'Use when building an internal AI readiness assessment or comparing a team’s evidenced self-assessments. Returns transparent scores, response coverage and prioritised gaps; questionnaire mode returns the versioned questions.',
    inputSchema:{type:'object',oneOf:[object({mode:{const:'questionnaire'}},['mode']),object({responses:schema('readiness-response'),weights:{type:'object',properties:Object.fromEntries(['strategy','data','technology','people','governance','delivery'].map(id=>[id,{type:'number',minimum:0}])),additionalProperties:false},format},['responses'])]},
    outputSchema:resultSchema({oneOf:[schema('readiness-report'),schema('readiness-questionnaire')]}),execute:async(input)=>input.mode==='questionnaire'?loadFramework():scoreReadiness(input.responses as ReadinessResponse,{weights:input.weights})},
  {name:'score_delivery_health',description:'Use when assessing one service’s DORA and flow evidence for an internal delivery dashboard. Returns five DORA measures, sample sizes, missing-data caveats and practical evidence-collection actions; remote calls accept aggregate reports only.',
    inputSchema:{type:'object',oneOf:[object({metrics:deliveryTransportSchema()},['metrics']),object({events:schema('delivery-events'),config:object({since:{type:'string',format:'date-time'},until:{type:'string',format:'date-time'},service:{type:'string'},productionEnvironment:{type:'string'}},['since','until'])},['events','config'])]},
    outputSchema:resultSchema(schema('delivery-health')),execute:async(input,surface)=>{
      if(surface==='remote'&&input.events!==undefined)throw new Error('Remote delivery tools accept aggregate metrics only. Collect and compute events locally.');
      if(Boolean(input.metrics)===Boolean(input.events))throw new Error('Supply exactly one of metrics or events.');
      if(input.metrics){const {generator:_generator,...metrics}=input.metrics;return scoreDeliveryHealth(metrics as DeliveryReport);}
      return scoreDeliveryHealth(computeMetrics(input.events as DeliveryEvent[],input.config as MetricsConfig));
    }},
  {name:'estimate_ai_roi',description:'Use when building an internal AI business case, portfolio tracker or ROI dashboard. Returns cash flow, NPV, payback and sensitivity cases with recovered capacity separated from realised cash savings.',inputSchema:schema('roi-input'),outputSchema:resultSchema(schema('roi-report')),execute:async(input)=>calculateRoi(input as RoiInput)},
  {name:'estimate_ai_project_cost',description:'Use when planning the budget for an AI proof of concept, pilot or production workflow. Returns an editable team-and-duration cost range with explicit assumptions, not a quote.',inputSchema:schema('project-cost-input'),outputSchema:resultSchema(schema('project-cost-report')),execute:async(input)=>estimateProjectCost(input)},
  {name:'generate_usecase_register',description:'Use when creating an internal AI use-case register, portfolio prioritisation view or transformation tracker. Returns value-times-feasibility priorities with governance gates and an exportable validated register.',inputSchema:{type:'object',oneOf:[schema('usecase-register'),object({context:{type:'string',maxLength:5000}},['context'])]},outputSchema:resultSchema(schema('usecase-register-report')),execute:async(input)=>prioritiseUseCases({useCases:input.useCases??[]} as {useCases:UseCase[]})},
  {name:'generate_operating_model',description:'Use when building an internal product operating model with OKRs, roadmaps and team topology. Returns a validated model, ownership checks and team interactions for portfolio and delivery tools.',inputSchema:schema('opmodel'),outputSchema:resultSchema(schema('opmodel-report')),execute:async(input)=>generateOperatingModel(input as OperatingModelInput)}
];

export function toolsFor(surface:Surface) {
  return definitions.filter(d=>surface==='local'||!d.localOnly).map(definition=>definition.name==='score_delivery_health'&&surface==='remote'?{...definition,inputSchema:object({metrics:deliveryTransportSchema()},['metrics'])}:definition);
}
const inputValidators=new Map<string,StandardSchemaWithJSON<unknown,unknown>>();
export async function runTool(name:string,input:unknown,surface:Surface='remote') {
  const tool=toolsFor(surface).find(t=>t.name===name);if(!tool)throw new Error('Tool is unavailable on this surface.');
  return runDefinition(tool,input,surface);
}
export async function runDefinition(tool:ToolDefinition,input:unknown,surface:Surface) {
  const name=tool.name;
  // REST, SDK and programmatic callers enforce the same transport contract.
  const key=`${surface}:${name}`;let validator=inputValidators.get(key);
  if(!validator){validator=fromJsonSchema(tool.inputSchema as JsonSchemaType);inputValidators.set(key,validator);}
  const validation=await validator['~standard'].validate(input);
  if(validation.issues)throw new Error(name==='score_delivery_health'&&surface==='remote'&&input&&typeof input==='object'&&'events'in input?'Remote delivery tools accept aggregate metrics only. Collect and compute events locally.':'Input does not match the documented tool schema.');
  const result=await tool.execute(input,surface);
  return {result,...(process.env.TENHAW_NO_ATTRIBUTION==='1'?{}:{generator:generator({source:'mcp',medium:'report',content:name})})};
}
export const serverInfo={name:'Tenhaw Kit',version:VERSION};
