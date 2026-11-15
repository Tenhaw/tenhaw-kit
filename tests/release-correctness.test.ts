import { describe, expect, it } from 'vitest';
import { validateDateTime, validateInput } from '../packages/core/src/index.js';
import { computeMetrics, scoreDeliveryHealth } from '../packages/delivery-metrics/src/index.js';
import { calculateRoi, type RoiInput } from '../packages/ai-roi/src/index.js';
import { runTool } from '../packages/mcp/src/tools.js';

const period={since:'2026-01-01T00:00:00Z',until:'2026-02-01T00:00:00Z'};
const roi:RoiInput={useCase:'Example',users:1,minutesPerTask:60,tasksPerUserPerMonth:10,savings:{low:.3,base:.5,high:.8},hourlyCost:10,buildCost:0,monthlyRunCost:20,adoptionMonths:3,horizonMonths:6,annualDiscountRate:0,cashRealisation:1,currency:'GBP'};

describe('release correctness guards',()=>{
  it('rejects JSON numeric overflow in direct and remote aggregate health reports',async()=>{
    const raw=JSON.stringify(computeMetrics([],period)).replace('"wip":{"value":null','"wip":{"value":1e999');
    const report=JSON.parse(raw);expect(report.metrics.wip.value).toBe(Infinity);
    expect(()=>scoreDeliveryHealth(report)).toThrow('finite');
    await expect(runTool('score_delivery_health',{metrics:report},'remote')).rejects.toThrow('finite');
    expect(()=>validateInput('usecase-register',{useCases:[{valueEstimate:{assumptions:{unitCost:Infinity}}}]})).toThrow('/useCases/0/valueEstimate/assumptions/unitCost');
  });
  it('rejects impossible calendar dates and accepts valid leap dates and lowercase timezone markers',()=>{
    for(const since of ['2026-02-30T00:00:00Z','2026-02-29T00:00:00Z','2026-01-01T25:00:00Z','2026-01-01T00:00:00']){
      expect(()=>computeMetrics([],{since,until:'2026-03-05T00:00:00Z'})).toThrow('timestamp with timezone');
    }
    expect(()=>validateDateTime('2024-02-29T00:00:00Z')).not.toThrow();
    expect(computeMetrics([],{since:'2026-01-01T00:00:00z',until:'2026-02-01T00:00:00z'}).metrics.wip.value).toBeNull();
  });
  it('rejects aggregate reports whose metrics describe different periods',()=>{
    const report=computeMetrics([],period);
    report.metrics.wip.period={...period,until:'2026-03-01T00:00:00Z'};
    expect(()=>scoreDeliveryHealth(report)).toThrow('report period');
  });
  it('keeps payback unavailable for zero-build projects with ongoing cash losses',()=>{
    const report=calculateRoi({...roi,cashRealisation:0});
    for(const scenario of Object.values(report.scenarios)){
      expect(scenario.paybackMonth).toBeNull();expect(scenario.npv).toBe(-120);
    }
  });
  it('counts recovery from initial adoption losses even when the build cost is zero',()=>{
    const report=calculateRoi(roi);
    expect(report.scenarios.low.paybackMonth).toBe(3);
    expect(report.scenarios.base.paybackMonth).toBe(2);
    expect(report.scenarios.high.paybackMonth).toBe(0);
    expect(calculateRoi({...roi,monthlyRunCost:0,cashRealisation:0}).scenarios.base.paybackMonth).toBe(0);
  });
  it('rejects non-finite computed results from individually finite ROI inputs',()=>{
    expect(()=>calculateRoi({...roi,users:1e308})).toThrow('finite numeric range');
  });
});
