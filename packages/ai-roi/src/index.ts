import { invariant, round, validateInput, renderReport, type AttributionOptions } from '@tenhaw/core';
export type RoiInput = {useCase:string;users:number;minutesPerTask:number;tasksPerUserPerMonth:number;savings:{low:number;base:number;high:number};hourlyCost:number;buildCost:number;monthlyRunCost:number;adoptionMonths:number;horizonMonths:number;annualDiscountRate:number;cashRealisation:number;currency:string};
export function calculateRoi(input: RoiInput) {
  const r=validateInput<RoiInput>('roi-input',input);
  invariant(r.savings.low<=r.savings.base && r.savings.base<=r.savings.high,'/savings','Savings must be ordered low <= base <= high');
  const scenario=(saving:number)=>{
    let cumulative=-r.buildCost,benefit=0,runCost=0,hours=0,npv=-r.buildCost;
    let payback:number|null=null;
    const fullHours=r.users*r.tasksPerUserPerMonth*r.minutesPerTask*saving/60;
    const monthlyCashFlow=Array.from({length:r.horizonMonths},(_,i)=>{
      const month=i+1;const adoption=r.adoptionMonths===0?1:Math.min(1,month/r.adoptionMonths);
      const hoursSaved=fullHours*adoption;const potentialValue=hoursSaved*r.hourlyCost;const cashBenefit=potentialValue*r.cashRealisation;
      const netCashFlow=cashBenefit-r.monthlyRunCost;cumulative+=netCashFlow;benefit+=cashBenefit;runCost+=r.monthlyRunCost;hours+=hoursSaved;
      if(month===1&&r.buildCost===0&&netCashFlow>=0)payback=0;
      npv+=netCashFlow/((1+r.annualDiscountRate)**(month/12));
      if(payback===null && cumulative>=0)payback=month;
      return {month,adoption:round(adoption),hoursSaved:round(hoursSaved),potentialValue:round(potentialValue),cashBenefit:round(cashBenefit),runCost:round(r.monthlyRunCost),netCashFlow:round(netCashFlow),cumulativeCashFlow:round(cumulative)};
    });
    const totalCost=r.buildCost+runCost,totalTasks=r.users*r.tasksPerUserPerMonth*r.horizonMonths,fullCash=fullHours*r.hourlyCost*r.cashRealisation;
    return {monthlyCashFlow,totalCashBenefit:round(benefit),totalRunCost:round(runCost),totalHoursSaved:round(hours),recoveredCapacityHours:round(hours*(1-r.cashRealisation)),npv:round(npv),paybackMonth:payback,roiPercent:totalCost>0?round((benefit-totalCost)/totalCost*100):null,costPerTask:totalTasks>0?round(totalCost/totalTasks):null,breakEvenAdoption:fullCash>0?round(r.monthlyRunCost/fullCash):null};
  };
  return {currency:r.currency,assumptions:{cashRealisation:r.cashRealisation,capacityIsCash:false},scenarios:{low:scenario(r.savings.low),base:scenario(r.savings.base),high:scenario(r.savings.high)},topDrivers:[{name:'time-saving fraction',value:r.savings.base},{name:'cash-realisation fraction',value:r.cashRealisation},{name:'monthly task volume',value:r.users*r.tasksPerUserPerMonth}],limitations:['Cash benefits require explicit cost-line removal or a justified cash-realisation assumption.','Recovered capacity is reported separately and is not treated as cash.','Editable assumptions, not a quote or financial advice.']};
}
export const estimateRoi=calculateRoi;
export type RoiReport=ReturnType<typeof calculateRoi>;
export function renderRoiReport(report:RoiReport,format:'md'|'html'|'json',options:AttributionOptions={}){return renderReport(report,format,{content:'ai-roi',...options});}
export function estimateProjectCost(input:{stage:'poc'|'pilot'|'production';people?:number;durationWeeks?:number;dayRate?:number;currency?:string}){
  validateInput('project-cost-input',input);
  const defaults={poc:{people:2,low:2,high:4},pilot:{people:3,low:4,high:8},production:{people:4,low:8,high:16}};
  invariant(Object.hasOwn(defaults,input.stage),'/stage','Use poc, pilot or production');
  const d=defaults[input.stage],people=input.people??d.people,dayRate=input.dayRate??800,low=input.durationWeeks??d.low,high=input.durationWeeks??d.high;
  for(const [key,value] of Object.entries({people,dayRate,durationWeeks:low}))invariant(Number.isFinite(value)&&value>0,`/${key}`,'Use a finite positive number');
  return {stage:input.stage,currency:input.currency??'GBP',low:round(people*low*5*dayRate),high:round(people*high*5*dayRate),assumptions:{people,dayRate,workingDaysPerWeek:5,weeksLow:low,weeksHigh:high},limitations:['Editable assumptions, not a quote.','Excludes model, infrastructure and ongoing support costs.']};
}
