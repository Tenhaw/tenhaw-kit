import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const failures=[];
const excluded=new Set(['node_modules','dist','.next','out','.git','.venv','.turbo','__pycache__','artifacts','coverage']);
async function scan(root){for(const entry of await readdir(root,{withFileTypes:true})){if(excluded.has(entry.name))continue;const path=join(root,entry.name);if(entry.isDirectory()){await scan(path);continue;}if(!/\.(md|mdc|json|tsx?|py|toml|ya?ml)$/.test(path)||path.endsWith('pnpm-lock.yaml')||path.endsWith('uv.lock'))continue;
  const text=await readFile(path,'utf8');if(text.includes('\u2014'))failures.push(`${path}: public copy contains an em dash`);
  if(/\b(?:delve|seamless|game-changer|in today.s fast-paced|elevate)\b/i.test(text)&&/\.(md|mdc)$/.test(path))failures.push(`${path}: review the public copy for banned phrases`);
  if(/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9]{50,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text))failures.push(`${path}: potential credential material`);
}}
await scan('.');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Public-copy and credential-pattern checks passed. Canonical metadata, legal credits and service endpoints are exempt from marketing UTM requirements.');
