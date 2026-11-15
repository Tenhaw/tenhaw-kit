import { it,expect } from "vitest";
import { assess,example,framework,validateAssessment } from "./model";
it("covers the complete questionnaire and reports the synthetic gaps",()=>{expect(framework.dimensions.flatMap(d=>d.questions)).toHaveLength(30);expect(assess(example).coverage).toBe(1);expect(assess(example).gaps.length).toBeGreaterThan(0);});
it("withholds bands for incomplete data",()=>{expect(assess({answers:[{questionId:"strategy-1",score:5}]}).band).toBeNull();expect(assess({answers:[]}).overall).toBeNull();});
it("rejects malformed imported responses",()=>{expect(()=>validateAssessment({answers:[{questionId:"bogus",score:3}]})).toThrow();});
