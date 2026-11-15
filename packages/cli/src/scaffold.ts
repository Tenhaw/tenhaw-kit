import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const templates = ['ai-adoption-dashboard', 'delivery-metrics-dashboard', 'ai-usecase-register', 'product-operating-model', 'ai-readiness-assessment'] as const;
export type Template = typeof templates[number];

/** Copy only bundled source. Never download scripts, overwrite a project, or follow symlinks. */
export async function scaffold(template: string, directory: string, options: { templateRoot?: string } = {}) {
  if (!templates.includes(template as Template)) throw new Error(`Unknown template. Choose: ${templates.join(', ')}`);
  if (!directory.trim() || directory === '.' || directory === '..') throw new Error('Choose a new project directory.');
  const target = resolve(directory);
  try { await lstat(target); throw new Error('Target already exists. Choose a new directory; existing files are never overwritten.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const packaged = fileURLToPath(new URL('../templates/', import.meta.url));
  const root = options.templateRoot ?? packaged;
  const source = join(root, template);
  await assertSourceTree(source);
  await mkdir(dirname(target), { recursive: true });
  const staging = `${target}.tenhaw-${process.pid}-${Date.now()}`;
  try {
    await cp(source, staging, { recursive: true, errorOnExist: true, force: false,
      filter: (path) => !relative(source, path).split(sep).some(p => ['node_modules', '.next', 'out', '.vercel', '.git'].includes(p) || p.startsWith('.env') && p !== '.env.example') });
    const manifestPath = join(staging, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.name = target.split(sep).at(-1)?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'tenhaw-internal-tool';
    delete manifest.packageManager;
    for (const group of ['dependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(manifest[group] ?? {})) {
        if (String(version).startsWith('workspace:')) manifest[group][name] = '1.0.0';
      }
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    // rename must not replace an empty directory another process created since the check.
    await mkdir(target);
    for (const entry of await readdir(staging)) await rename(join(staging, entry), join(target, entry));
    await rm(staging, { recursive: true });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  const quotedTarget = `'${target.replaceAll("'", "'\"'\"'")}'`;
  return { template, directory: target, nextSteps: [`cd ${quotedTarget}`, 'pnpm install', 'pnpm dev'],
    dataMode: 'browser-local', authentication: 'Required before adding shared storage or server-side real-data routes.' };
}

async function assertSourceTree(root: string) {
  const base = await realpath(root);
  async function visit(path: string): Promise<void> {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Template source contains a symbolic link.');
    const rel = relative(base, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid template path.');
    if (stat.isDirectory()) for (const entry of await readdir(path)) {
      if (['node_modules', '.next', 'out', '.git', '.vercel'].includes(entry)) continue;
      await visit(join(path, entry));
    }
  }
  await visit(base);
}
