import { invariant, round, validateInput, renderReport, escapeHtml, type AttributionOptions } from '@tenhaw/core';
import framework from './framework.json';
export type Framework = typeof framework;
export type ReadinessResponse = { answers: {questionId: string; score: number; evidence?: string}[] };
export type Weights = Record<string, number>;
export function loadFramework(version: 'v1' = 'v1'): Framework {
  invariant(version === 'v1', '/version', 'Only framework v1 is supported');
  return structuredClone(framework);
}
export function validateResponses(input: unknown): ReadinessResponse {
  const result = validateInput<ReadinessResponse>('readiness-response', input);
  const ids = result.answers.map(a=>a.questionId);
  invariant(new Set(ids).size === ids.length, '/answers', 'Each question can be answered only once');
  return result;
}
export function scoreReadiness(input: ReadinessResponse, options: {weights?: Partial<Weights>} = {}) {
  const responses = validateResponses(input);
  const known = new Set(framework.dimensions.map(d=>d.id));
  for (const [key,value] of Object.entries(options.weights ?? {})) invariant(known.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0, `/weights/${key}`, 'Use a known dimension and a finite nonnegative weight');
  const rawWeights = framework.dimensions.map(d=>options.weights?.[d.id] ?? d.weight);
  const totalWeight = rawWeights.reduce((a,b)=>a+b,0);
  invariant(Number.isFinite(totalWeight) && totalWeight > 0, '/weights', 'At least one dimension weight must be positive and the sum must be finite');
  const weights = rawWeights.map(w=>w/totalWeight);
  const dimensions = framework.dimensions.map((d,index)=>{
    const answers=responses.answers.filter(a=>a.questionId.startsWith(`${d.id}-`));
    return {id:d.id,label:d.label,weight:round(weights[index]!),score:answers.length ? round(answers.reduce((s,a)=>s+a.score,0)/answers.length) : null,answered:answers.length,total:d.questions.length,coverage:round(answers.length/d.questions.length)};
  });
  const presentWeight=dimensions.reduce((s,d,i)=>s+(d.score!==null?weights[i]!:0),0);
  const overall=presentWeight>0 ? round(dimensions.reduce((s,d,i)=>s+(d.score===null?0:d.score*weights[i]!),0)/presentWeight) : null;
  const coverage=round(responses.answers.length/30);
  const band=overall!==null && coverage>=framework.minimumBandCoverage ? framework.bands.find(b=>overall>=b.minimum && overall<b.maximumExclusive)?.name ?? null : null;
  const gaps=responses.answers.filter(a=>a.score<=2).map(a=>{
    const dimensionId=a.questionId.split('-')[0]!; const index=framework.dimensions.findIndex(d=>d.id===dimensionId);
    const question=framework.dimensions[index]!.questions.find(q=>q.id===a.questionId)!;
    return {questionId:a.questionId,dimensionId,score:a.score,priority:round(weights[index]!*(5-a.score)),recommendation:question.recommendations.low};
  }).sort((a,b)=>b.priority-a.priority || a.questionId.localeCompare(b.questionId));
  return {frameworkVersion:'v1',contentCredit:framework.contentCredit,overall,band,coverage,dimensions,gaps,recommendations:gaps.map(g=>({questionId:g.questionId,action:g.recommendation})),limitations:[...framework.limitations]};
}
export type ReadinessReport = ReturnType<typeof scoreReadiness>;
export function renderReadinessReport(report: ReadinessReport, format: 'md'|'html'|'json', options: AttributionOptions = {}): string {
  const method='Method: mean of answered questions per dimension; weighted mean renormalised over answered dimensions. Coverage is response coverage, not statistical confidence.';
  const body=renderReport(report,format,{content:'ai-readiness',...options});
  if(format==='html')return body.replace('</main>',`<p>${escapeHtml(report.contentCredit)} ${escapeHtml(method)}</p></main>`);
  return format==='md'?`${body}\n${method}\n`:body;
}
