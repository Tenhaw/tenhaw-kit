import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const failures=[];
const excluded=new Set(['node_modules','dist','.next','out','.git','.venv','.turbo','__pycache__','artifacts','coverage']);
const sources=new Set(['npm','pypi','github','cli','mcp','claude-plugin','openai-plugin','gemini-ext','cursor','template','docs','devto','hashnode','linkedin','x']);
const media=new Set(['readme','report','footer','skill','docs','post']);
const metadataKeys=new Set(['author','homepage','websiteUrl','websiteURL','privacyPolicyURL','supportURL','termsURL','canonical','canonicalUrl','canonicalURL','$id','$schema']);
const citationKeys=new Set(['sources','references','technicalSources','sourceLinks']);
const parameterNames=['utm_source','utm_medium','utm_campaign','utm_content'];
const urlPattern=/https?:\/\/[^\s<>"'`\\\])]+/gi;
function checkUrls(value,path,context={}){
  for(const match of value.matchAll(urlPattern)){
    const raw=match[0].replace(/&(?:amp|#38|#x26);/gi,'&').replace(/[.,;:]+$/,'');
    let url;try{url=new URL(raw);}catch{continue;}
    const host=url.hostname.toLowerCase();
    if(host!=='tenhaw.com'&&host!=='www.tenhaw.com')continue;
    // Technical subdomains are not engagement destinations. On the main site,
    // machine endpoints, explicit citations and canonical manifest metadata are untagged.
    if(/^\/(?:\.well-known|api|schemas)(?:\/|$)/.test(url.pathname)||/^\/(?:health|mcp|llms(?:-full)?\.txt|openapi\.json|robots\.txt|sitemap\.xml|terms|privacy|legal|licences?|licenses?)\/?$/.test(url.pathname))continue;
    const prefix=value.slice(Math.max(0,match.index-100),match.index);
    const sourceMetadata=/\b(?:homepage|websiteUrl|websiteURL|privacyPolicyURL|supportURL|termsURL|canonical|canonicalUrl|canonicalURL)["']?\s*[:=]\s*["']?\s*$/.test(prefix);
    if(context.metadata||sourceMetadata)continue;
    const marketing=context.marketing||/\b(?:for expert help|for help|book (?:a|an|your)|get (?:expert )?help|contact us)\b/i.test(value);
    if(context.citation&&!marketing)continue;
    const legal=/\b(?:CC BY|CC-BY|Creative Commons)\b/i.test(value)||context.legal;
    if(url.pathname==='/'&&!url.search&&!url.hash&&(legal||!marketing))continue;
    // These three canonical builder inputs are not rendered links. Their outputs
    // are tested separately; generated Markdown/JSON still undergoes this check.
    if(path==='packages/core/src/index.ts'&&raw==='https://tenhaw.com/contact#book'&&/\bconst\s+AUDIT_URL\s*=/.test(prefix))continue;
    if(path==='scripts/generate-plugins.mjs'&&raw==='https://tenhaw.com/contact#book'&&/new URL\(\s*["']?$/.test(prefix)&&/utm_source:source,utm_medium:'skill',utm_campaign:'tenhaw-kit',utm_content:skill\.id/.test(value))continue;
    if(path==='python/tenhaw/src/tenhaw/cli.py'&&raw==='https://tenhaw.com/contact?{query}#book'&&/return\s*\{.*["']url["']\s*:\s*f["']?$/.test(prefix)&&context.pythonBuilder)continue;
    const issues=[];
    for(const name of parameterNames)if(url.searchParams.getAll(name).length!==1||!url.searchParams.get(name)?.trim())issues.push(`${name} must occur once and be non-empty`);
    if(url.protocol!=='https:')issues.push('engagement links must use HTTPS');
    if(url.searchParams.has('utm_source')&&!sources.has(url.searchParams.get('utm_source')))issues.push('utm_source must use an approved Kit source');
    if(url.searchParams.has('utm_medium')&&!media.has(url.searchParams.get('utm_medium')))issues.push('utm_medium must use an approved Kit medium');
    if(url.searchParams.has('utm_campaign')&&url.searchParams.get('utm_campaign')!=='tenhaw-kit')issues.push('utm_campaign must be tenhaw-kit');
    const content=url.searchParams.get('utm_content');
    const generatedContent=context.code&&/^\$\{[A-Za-z_$][\w.$]*\}$/.test(content??'');
    if(content&&!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(content)&&!generatedContent)issues.push('utm_content must be a bounded tool or artefact slug');
    if([...url.searchParams.keys()].some(key=>key.startsWith('utm_')&&!parameterNames.includes(key)))issues.push('only the four documented UTM parameters are allowed');
    if(issues.length)failures.push(`${path}:${context.line??1}: engagement attribution: ${[...new Set(issues)].join('; ')}`);
  }
}
function checkAttribution(text,path){
  // Policy declarations are technical definitions, not outbound engagement links.
  if(path==='scripts/lint.mjs')return;
  if(path.endsWith('.json')){
    let document;try{document=JSON.parse(text);}catch{document=undefined;}
    if(document!==undefined){
      const walk=(value,keys=[])=>{if(typeof value==='string')checkUrls(value,path,{metadata:metadataKeys.has(keys.at(-1)),citation:keys.some(key=>citationKeys.has(key)),legal:keys.includes('contentCredit')});else if(Array.isArray(value))value.forEach((entry,index)=>walk(entry,[...keys,String(index)]));else if(value&&typeof value==='object')Object.entries(value).forEach(([key,entry])=>walk(entry,[...keys,key]));};
      walk(document);return;
    }
  }
  const markdown=/\.(?:md|mdc|txt)$/.test(path),headings=[];
  const pythonBuilder=/def _attribution\(/.test(text)&&/query\s*=\s*urlencode\(/.test(text)&&/"utm_source":\s*"pypi"/.test(text)&&/"utm_medium":\s*"report"/.test(text)&&/"utm_campaign":\s*"tenhaw-kit"/.test(text)&&/"utm_content":\s*command/.test(text);
  for(const [index,line]of text.split(/\r?\n/).entries()){
    const heading=markdown?/^(#{1,6})\s+(.+?)\s*#*$/.exec(line):null;
    if(heading){while(headings.length&&headings.at(-1).level>=heading[1].length)headings.pop();headings.push({level:heading[1].length,citation:/^(?:methodology(?: and sources)?|sources?|references|technical references|official references)\b/i.test(heading[2]),marketing:/^(?:built (?:by|with)|expert help|contact|book|attribution)\b/i.test(heading[2])});}
    const metadata=markdown&&/^\s*(?:\|\s*)?(?:support URL(?: candidate)?|terms URL|privacy(?: URL)?|canonical URL|homepage)\s*(?::|\|)/i.test(line);
    checkUrls(line,path,{line:index+1,metadata,code:/\.(?:[cm]?js|tsx?|py)$/.test(path),pythonBuilder,citation:headings.some(h=>h.citation)||/^\s*(?:[-*]\s*)?(?:source|reference|technical citation|methodology source)\s*:/i.test(line),marketing:headings.some(h=>h.marketing),legal:/(?:^|\/)LICENSE(?:-CONTENT)?$/.test(path)});
  }
}
async function scan(root){for(const entry of await readdir(root,{withFileTypes:true})){if(excluded.has(entry.name))continue;const path=join(root,entry.name);if(entry.isDirectory()){await scan(path);continue;}if(!/\.(md|mdc|json|[cm]?js|tsx?|py|toml|ya?ml|txt)$/.test(path)&&!/^LICENSE(?:-CONTENT)?$/.test(entry.name)||path.endsWith('pnpm-lock.yaml')||path.endsWith('uv.lock'))continue;
  const text=await readFile(path,'utf8');
  // CLAUDE.md is also a generated copy when templates are packed. Credentials still scan the complete text.
  const agentFile=entry.name==='AGENTS.md'||entry.name==='CLAUDE.md';
  const publicCopy=agentFile?text.replace(/^<!-- BEGIN:nextjs-agent-rules -->\r?\n[\s\S]*?^<!-- END:nextjs-agent-rules -->[ \t]*$/gm,''):text;
  if(publicCopy.includes('\u2014'))failures.push(`${path}: public copy contains an em dash`);
  if(/\b(?:delve|seamless|game-changer|in today.s fast-paced|elevate)\b/i.test(publicCopy)&&/\.(md|mdc)$/.test(path))failures.push(`${path}: review the public copy for banned phrases`);
  checkAttribution(publicCopy,path);
  if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9]{50,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text))failures.push(`${path}: potential credential material`);
}}
await scan('.');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Public-copy, engagement UTM and credential-pattern checks passed. Canonical metadata, legal credits, technical citations and service endpoints are excluded from engagement attribution.');
