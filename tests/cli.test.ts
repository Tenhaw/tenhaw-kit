import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeAgentInstructions, parseArgs } from '../packages/cli/src/index.js';
import { scaffold, templates } from '../packages/cli/src/scaffold.js';

const root=resolve('.'), temporary:string[]=[];
async function temp(){const path=await mkdtemp(join(tmpdir(),'tenhaw-cli-'));temporary.push(path);return path;}
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
const run=(args:string[],cwd=root,env:NodeJS.ProcessEnv={})=>spawnSync(process.execPath,[join(root,'packages/cli/dist/index.js'),...args],{cwd,env:{...process.env,CI:'true',...env},encoding:'utf8',timeout:15000});
async function input(directory:string,name:string,tool:string,vector:string){const source=JSON.parse(await readFile(join(root,'spec/vectors',tool,vector),'utf8'));const path=join(directory,name);await writeFile(path,JSON.stringify(source.input));return path;}

describe('built CLI agent contract',()=>{
  it('prints version and help without extra output',()=>{
    const version=run(['--version']);expect(version.status).toBe(0);expect(version.stdout).toBe('1.0.1\n');expect(version.stderr).toBe('');
    expect(run(['--help']).stdout).toContain('delivery-metrics');
    expect(()=>parseArgs(['--unknown'])).toThrow('Unknown option');
    expect(()=>parseArgs(['--input'])).toThrow('requires a value');
  });
  it('executes readiness, ROI and delivery commands as clean JSON',async()=>{
    const cwd=await temp();
    const readiness=await input(cwd,'answers.json','readiness','02-one-answer.json');
    const roi=await input(cwd,'roi.json','roi','02-full-cash.json');
    const delivery=await input(cwd,'events.json','delivery','03-linked-commit.json');
    for(const args of [
      ['readiness','--input',readiness],['roi','--input',roi],['roi','cost','--stage','poc'],
      ['delivery-metrics','--from-file',delivery,'--since','2026-01-01T00:00:00Z','--until','2026-02-01T00:00:00Z'],
      ['readiness','--questionnaire'],['doctor','--network'],['mcp'],
    ]){const result=run([...args,'--json','--no-attribution'],cwd);expect(result.status,result.stderr).toBe(0);expect(()=>JSON.parse(result.stdout)).not.toThrow();expect(JSON.parse(result.stdout)).not.toHaveProperty('generator');expect(result.stderr).toBe('');}
  });
  it('wraps diagram and CSV string results when --json is requested',async()=>{
    const cwd=await temp(),model=await input(cwd,'model.json','opmodel','02-one-team.json'),cases=await input(cwd,'cases.json','usecases','02-minimal.json');
    for(const args of [['opmodel','diagram','--input',model],['usecases','export','--format','csv','--input',cases]]){
      const result=run([...args,'--json','--no-attribution'],cwd);expect(result.status,result.stderr).toBe(0);expect(JSON.parse(result.stdout).result).toBeTypeOf('string');
    }
    expect(run(['opmodel','validate','--input',model,'--json'],cwd).status).toBe(0);
  });
  it('uses the documented usage, validation and missing-authentication exit codes',async()=>{
    const cwd=await temp(),invalid=join(cwd,'invalid.json');await writeFile(invalid,'{"answers":[{"questionId":"strategy-1","score":7}]}');
    const result=run(['readiness','--input',invalid,'--json'],cwd);expect(result.status).toBe(2);expect(result.stdout).toBe('');expect(JSON.parse(result.stderr).error).toContain('/answers/0/score');
    expect(run(['readiness','--yes'],cwd).status).toBe(1);expect(run(['no-such-command'],cwd).status).toBe(1);
    const missing=run(['delivery-metrics','--github','example/app','--no-cache'],cwd,{GITHUB_TOKEN:''});expect(missing.status).toBe(4);expect(missing.stdout).toBe('');
  });
  it('does not reveal token values and honours environment suppression',()=>{
    const result=run(['doctor','--json'],root,{GITHUB_TOKEN:'example-never-log-me',TENHAW_NO_ATTRIBUTION:'1'});
    expect(result.status).toBe(0);expect(result.stdout+result.stderr).not.toContain('example-never-log-me');expect(JSON.parse(result.stdout)).not.toHaveProperty('generator');
  });
  it('preserves existing output files',async()=>{
    const cwd=await temp(),path=join(cwd,'report.json');await writeFile(path,'preserve');
    expect(run(['doctor','--json','--out',path],cwd).status).toBe(2);expect(await readFile(path,'utf8')).toBe('preserve');
  });
  it('validates and persists use-case additions and rejects duplicate IDs',async()=>{
    const cwd=await temp(),cases=await input(cwd,'cases.json','usecases','02-minimal.json');
    expect(run(['usecases','new','--input',cases,'--json'],cwd).status).toBe(0);
    expect(JSON.parse(run(['usecases','list','--json'],cwd).stdout).useCases).toHaveLength(1);
    expect(run(['usecases','prioritise','--json'],cwd).status).toBe(0);
    expect(run(['usecases','new','--input',cases,'--json'],cwd).status).toBe(2);
    expect(JSON.parse(await readFile(join(cwd,'.tenhaw/usecases.json'),'utf8')).useCases).toHaveLength(1);
  });
});

describe('non-overwriting project writes',()=>{
  it('preserves all existing agent files',async()=>{
    const cwd=await temp();await writeFile(join(cwd,'AGENTS.md'),'Existing instructions');
    const result=await writeAgentInstructions(cwd);expect(result.existing).toContain('AGENTS.md');expect(await readFile(join(cwd,'AGENTS.md'),'utf8')).toBe('Existing instructions');
    expect(result.written).toHaveLength(3);
  });
  it('rejects instruction-directory symlinks escaping the project',async()=>{
    const cwd=await temp(),outside=await temp();await mkdir(join(cwd,'.cursor'));await symlink(outside,join(cwd,'.cursor/rules'));
    await expect(writeAgentInstructions(cwd)).rejects.toThrow('outside');expect(await readdir(outside)).toEqual([]);
  });
  it('scaffolds every bundled starter, preserves existing targets and strips sensitive environment files',async()=>{
    const cwd=await temp(),fixtures=join(cwd,'fixtures');
    for(const name of templates){const directory=join(fixtures,name);await mkdir(directory,{recursive:true});await writeFile(join(directory,'package.json'),JSON.stringify({name,dependencies:{'@tenhaw/core':'workspace:*'}}));await writeFile(join(directory,'.env.production'),'example-not-a-real-secret');await writeFile(join(directory,'.env.example'),'EXAMPLE=');
      const target=join(cwd,name),report=await scaffold(name,target,{templateRoot:fixtures});expect(report.dataMode).toBe('browser-local');expect(JSON.parse(await readFile(join(target,'package.json'),'utf8')).dependencies['@tenhaw/core']).toBe('1.0.1');expect(await readdir(target)).not.toContain('.env.production');expect(await readdir(target)).toContain('.env.example');await expect(scaffold(name,target,{templateRoot:fixtures})).rejects.toThrow('exists');}
  });
  it('refuses source symlinks and shell-quotes suggested navigation commands',async()=>{
    const cwd=await temp(),fixtures=join(cwd,'fixtures'),source=join(fixtures,templates[0]);await mkdir(source,{recursive:true});await writeFile(join(source,'package.json'),'{}');
    const target=join(cwd,"new ' $(touch marker) app"),report=await scaffold(templates[0],target,{templateRoot:fixtures});
    const result=spawnSync('/bin/sh',['-c',`${report.nextSteps[0]}\npwd`],{cwd,encoding:'utf8'});expect(result.status).toBe(0);expect(result.stdout.trim()).toBe(target);expect(await readdir(cwd)).not.toContain('marker');
    await symlink(join(source,'package.json'),join(source,'linked.json'));await expect(scaffold(templates[0],join(cwd,'other'),{templateRoot:fixtures})).rejects.toThrow('symbolic');
  });
});
