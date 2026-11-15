import {afterEach,describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';

const script=resolve('scripts/lint.mjs'),temporary:string[]=[],origin='https://tenhaw.com';
const campaign=(changes:Record<string,string>={})=>{const url=new URL('/contact#book',origin);for(const[key,value]of Object.entries({utm_source:'github',utm_medium:'readme',utm_campaign:'tenhaw-kit',utm_content:'kit',...changes}))url.searchParams.set(key,value);return url;};
async function lint(files:Record<string,string>){const directory=await mkdtemp(join(tmpdir(),'tenhaw-lint-fixture-'));temporary.push(directory);for(const[path,text]of Object.entries(files)){await mkdir(dirname(join(directory,path)),{recursive:true});await writeFile(join(directory,path),text);}const result=spawnSync(process.execPath,[script],{cwd:directory,encoding:'utf8',timeout:10000});return {status:result.status,error:result.stderr};}
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})));});

describe('public engagement attribution contract',()=>{
  it('requires attribution for engagement destinations and promotional homepage links',async()=>{
    for(const path of ['/contact#book','/services/ai-readiness-audit','/#book']){const result=await lint({'README.md':`Book a call: ${new URL(path,origin)}`});expect(result.status,path).toBe(1);expect(result.error).toContain('engagement attribution');}
    expect((await lint({'README.md':`## Built by Tenhaw\nFor expert help: ${origin}`})).status).toBe(1);
  });
  it('accepts documented source and medium values, HTML escaping and parameters before fragments',async()=>{
    const sources=['npm','pypi','github','cli','mcp','claude-plugin','openai-plugin','gemini-ext','cursor','template','docs','devto','hashnode','linkedin','x'];
    const media=['readme','report','footer','skill','docs','post'];
    const text=[...sources.map(utm_source=>String(campaign({utm_source}))),...media.map(utm_medium=>String(campaign({utm_medium})))].join('\n');
    const result=await lint({'README.md':text,'app.tsx':`<a href="${String(campaign()).replaceAll('&','&amp;')}">Book</a>`});expect(result.error).toBe('');expect(result.status).toBe(0);
  });
  it('rejects missing, empty, duplicate, misplaced and unsupported attribution values',async()=>{
    const invalid:URL[]=[];for(const name of ['utm_source','utm_medium','utm_campaign','utm_content']){const url=campaign();url.searchParams.delete(name);invalid.push(url);}
    invalid.push(campaign({utm_source:'unknown'}),campaign({utm_medium:'unknown'}),campaign({utm_campaign:'another-campaign'}),campaign({utm_content:' '}),campaign({utm_content:'not/a/tool'}));
    const duplicate=campaign();duplicate.searchParams.append('utm_source','cli');invalid.push(duplicate);
    const extra=campaign();extra.searchParams.set('utm_term','extra');invalid.push(extra);
    invalid.push(new URL('/contact#book?utm_source=github&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=kit',origin));
    for(const url of invalid){const result=await lint({'README.md':String(url)});expect(result.status,String(url)).toBe(1);expect(result.error).toContain('engagement attribution');}
  });
  it('excludes explicit metadata, content credits, technical citations and machine endpoints',async()=>{
    const contact=new URL('/contact',origin),prices=new URL('/services/agentic-proof-of-concept',origin);
    const result=await lint({
      'plugin.json':JSON.stringify({homepage:origin,extensions:{interface:{supportURL:contact,termsURL:new URL('/terms',origin)}}}),
      'assumptions.json':JSON.stringify({sources:[prices]}),
      'README.md':`## Methodology and sources\n[Published prices](${prices})\n\n## Licence\nFramework CC BY 4.0, ${origin}.\n`,
      'submissions.md':`| Support URL candidate | ${contact} |\n| Terms URL | ${new URL('/terms',origin)} |`,
      'app.tsx':`const metadata={supportURL: '${contact}', canonical: '${prices}'};`,
      'services.txt':[new URL('/.well-known/mcp-registry-auth',origin),new URL('/api/v1/readiness/score',origin),'https://mcp.tenhaw.com/mcp','https://kit.tenhaw.com/install'].join('\n')
    });expect(result.error).toBe('');expect(result.status).toBe(0);
    expect((await lint({'links.json':JSON.stringify({ctaUrl:contact})})).status).toBe(1);
  });
  it('keeps generated Next exceptions bounded and scans full files for credential patterns',async()=>{
    const block=(body:string)=>`<!-- BEGIN:nextjs-agent-rules -->\n${body}\n<!-- END:nextjs-agent-rules -->\n`;
    expect((await lint({'AGENTS.md':block('Generated \u2014 text.'),'CLAUDE.md':block('Generated \u2014 text.')})).status).toBe(0);
    expect((await lint({'README.md':block('Public \u2014 text.')})).status).toBe(1);
    expect((await lint({'AGENTS.md':block('Generated instructions.')+`For expert help: ${new URL('/contact',origin)}`})).status).toBe(1);
    const secret=await lint({'AGENTS.md':block('ghp_'+'A'.repeat(40))});expect(secret.status).toBe(1);expect(secret.error).toContain('potential credential material');expect(secret.error).not.toContain('A'.repeat(40));
  });
});
