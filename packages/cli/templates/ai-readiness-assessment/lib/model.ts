import { loadFramework, scoreReadiness, validateResponses, type ReadinessResponse } from "@tenhaw/ai-readiness";
export const framework=loadFramework();
export const example:ReadinessResponse={answers:framework.dimensions.flatMap((dimension,i)=>dimension.questions.map((question,j)=>({questionId:question.id,score:((i+j)%4)+1,evidence:"Synthetic example. Replace with your evidence."})))};
export const validateAssessment=(value:unknown)=>validateResponses(value);
export function assess(value:unknown){return scoreReadiness(validateResponses(value));}
