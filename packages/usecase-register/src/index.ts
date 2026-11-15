import { invariant, round, validateInput, escapeHtml } from '@tenhaw/core';
export type UseCase={id:string;title:string;problem:string;ownerRole:string;businessUnit:string;value:number;feasibility:number;riskTier:'prohibited'|'high'|'limited'|'minimal'|'unknown';status:'idea'|'assessed'|'approved'|'PoC'|'pilot'|'production'|'retired';dataRequired?:string[];dataSensitivity?:'public'|'internal'|'confidential'|'restricted';valueHypothesis?:string;valueEstimate?:Record<string,unknown>;dependencies?:string[];kpis?:string[];reviewDate?:string};
export function prioritiseUseCases(input:{useCases:UseCase[]}){
  const register=validateInput<{useCases:UseCase[]}>('usecase-register',input);
  const ids=new Set(register.useCases.map(u=>u.id));invariant(ids.size===register.useCases.length,'/useCases','IDs must be unique');
  for(const u of register.useCases)for(const dependency of u.dependencies??[])invariant(ids.has(dependency)&&dependency!==u.id,`/useCases/${u.id}/dependencies`,'Dependencies must reference another use case in this register');
  const useCases=register.useCases.map(u=>({...u,priority:round(u.value*u.feasibility),governanceGate:u.riskTier==='prohibited'?'blocked':u.riskTier==='high'||u.riskTier==='unknown'?'review-required':'standard-review'})).sort((a,b)=>{
    const order={'standard-review':0,'review-required':1,blocked:2};return order[a.governanceGate as keyof typeof order]-order[b.governanceGate as keyof typeof order]||b.priority-a.priority||a.id.localeCompare(b.id);
  });
  return {useCases,methodology:'Priority = value (0 to 5) multiplied by feasibility (0 to 5). Governance gates take precedence over score.',limitations:['Risk tiers are indicative, not legal advice.','Transparency obligations can apply alongside high-risk obligations.','Prohibited uses are blocked pending qualified legal review.']};
}
export const generateUsecaseRegister=prioritiseUseCases;
export type UsecaseRegister=ReturnType<typeof prioritiseUseCases>;
function safeCell(value:unknown){let text=typeof value==='object'?JSON.stringify(value):String(value??'');if(/^'|^\s*[=+\-@]|^[\t\r]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;}
const fields=['id','title','problem','ownerRole','businessUnit','value','feasibility','riskTier','status','dataRequired','dataSensitivity','valueHypothesis','valueEstimate','dependencies','kpis','reviewDate','priority','governanceGate'] as const;
export function exportRegister(report:UsecaseRegister,format:'json'|'csv'|'md'){
  if(format==='json')return JSON.stringify(report,null,2);
  if(format==='csv')return [fields.join(','),...report.useCases.map(u=>fields.map(k=>safeCell(u[k])).join(','))].join('\r\n')+'\r\n';
  const escape=(x:unknown)=>escapeHtml(String(x??'')).replaceAll('|','\\|').replaceAll('\n',' ');
  return ['| '+fields.join(' | ')+' |','| '+fields.map(()=>'---').join(' | ')+' |',...report.useCases.map(u=>'| '+fields.map(k=>escape(u[k])).join(' | ')+' |')].join('\n')+'\n';
}
export function parseRegisterCsv(csv:string):{useCases:UseCase[]}{
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<csv.length;i++){
    const c=csv[i]!;
    if(c==='"'){if(quoted&&csv[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&csv[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  invariant(!quoted,'/csv','Unclosed quoted CSV field');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const headers=rows.shift()??[];invariant(new Set(headers).size===headers.length,'/csv','Duplicate column names');
  const useCases=rows.map((values,index)=>{
    invariant(values.length===headers.length,`/csv/${index+2}`,'Column count differs from header');
    const item:Record<string,unknown>={};
    headers.forEach((key,i)=>{if(!fields.includes(key as typeof fields[number])||key==='priority'||key==='governanceGate')return;let value=values[i]!;if(value.startsWith("'")&&(/^'|^\s*[=+\-@]|^[\t\r]/.test(value.slice(1))))value=value.slice(1);if(value==='')return;
      if(key==='value'||key==='feasibility')item[key]=Number(value);
      else if(['dataRequired','valueEstimate','dependencies','kpis'].includes(key)){try{item[key]=JSON.parse(value);}catch{invariant(false,`/csv/${index+2}/${key}`,'Expected JSON in structured CSV cell');}}
      else item[key]=value;
    });return item as UseCase;
  });
  validateInput('usecase-register',{useCases});return {useCases};
}
export function exportCsv(input:{useCases:UseCase[]}|UsecaseRegister){return exportRegister(prioritiseUseCases(input),'csv');}
