import { it,expect } from "vitest";
import { prioritiseUseCases } from "@tenhaw/usecase-register";
import { calculateRoi } from "@tenhaw/ai-roi";
import { example,importRegister,roiExample,validateRegister } from "./model";
it("retains governance gates when prioritising high-scoring cases",()=>{const report=prioritiseUseCases({useCases:[{...example.useCases[0]!,riskTier:"prohibited",value:5,feasibility:5}]});expect(report.useCases[0]!.governanceGate).toBe("blocked");});
it("does not count saved staff capacity as cash by default",()=>{const report=calculateRoi(roiExample);expect(report.scenarios.base.totalCashBenefit).toBe(0);expect(report.scenarios.base.recoveredCapacityHours).toBeGreaterThan(0);});
it("validates imports and rejects duplicate identifiers",()=>{expect(importRegister(JSON.stringify(example),"json").useCases).toHaveLength(3);expect(()=>validateRegister({useCases:[example.useCases[0],example.useCases[0]]})).toThrow();});
