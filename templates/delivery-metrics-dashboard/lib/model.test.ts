import { it,expect } from "vitest";
import { calculate,example,samplePeriod,validateEvents } from "./model";
it("reports five DORA observations from linked synthetic production events",()=>{const report=calculate(example,samplePeriod.since,samplePeriod.until);expect(report.metrics.changeFailRate.value).toBeCloseTo(33.333333);expect(report.metrics.failedDeploymentRecoveryTime.value).toBe(1);expect(report.metrics.deploymentReworkRate.value).toBeCloseTo(33.333333);});
it("does not convert absent data into healthy zero values",()=>{const report=calculate([],samplePeriod.since,samplePeriod.until);expect(report.metrics.changeFailRate.value).toBeNull();});
it("rejects credential-shaped or invalid event input",()=>{expect(()=>validateEvents([{token:"secret"}])).toThrow();expect(()=>calculate(example,samplePeriod.until,samplePeriod.since)).toThrow();});
