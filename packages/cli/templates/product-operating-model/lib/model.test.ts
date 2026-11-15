import { it,expect } from "vitest";
import { generateOperatingModel } from "@tenhaw/opmodel";
import { example,validateModel,progress } from "./model";
it("detects missing outcomes and oversized-team review prompts",()=>{const report=generateOperatingModel(example);expect(report.checks.some(check=>check.code==="roadmap-outcome")).toBe(true);expect(report.checks.some(check=>check.code==="team-size")).toBe(true);});
it("supports decreasing key-result targets",()=>{expect(progress(24,12,18)).toBe(50);});
it("rejects links to unknown teams before replacing the workspace",()=>{expect(()=>validateModel({...example,interactions:[{from:"platform",to:"unknown",mode:"facilitating"}]})).toThrow();});
