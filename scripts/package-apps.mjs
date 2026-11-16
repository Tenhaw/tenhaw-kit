import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { generateAppPlugins, loadAppProducts } from './generate-app-plugins.mjs';

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const status = 'source-candidate-unsubmitted';
const maximumFileBytes = 5 * 1024 * 1024, maximumArchiveBytes = 50 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
function ensure(condition, message) { if (!condition) throw new Error(message); }

async function contained(root, path) {
  const target = resolve(root, path), rel = relative(root, target);
  ensure(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'Bundle path escapes the checkout.');
  let current = root;
  for (const component of rel.split(sep)) {
    current = resolve(current, component);
    try {
      const info = await lstat(current);
      ensure(!info.isSymbolicLink(), 'Bundle source and output paths must not contain symbolic links.');
      ensure(current === target ? info.isFile() || info.isDirectory() : info.isDirectory(), 'Bundle path contains an unsupported file type.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

async function regularFile(root, path, maximumBytes = maximumFileBytes) {
  const target = await contained(root, path);
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    ensure(info.isFile() && info.size <= maximumBytes, 'Bundle file is not regular or exceeds its bounded size limit.');
    return await handle.readFile();
  } finally { await handle.close(); }
}

function scanSecrets(bytes) {
  const text = bytes.toString('utf8');
  ensure(!/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9]{50,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----)/.test(text), 'Potential credential material found; no archive was written.');
}

async function inventory(root, directory, allowed) {
  const expected = new Set(allowed), found = [];
  await contained(root, directory);
  async function visit(path, prefix = '') {
    const entries = await readdir(resolve(root, path), { withFileTypes: true });
    for (const entry of entries) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      ensure(!['.git', 'node_modules', '.aws', '.ssh', '__pycache__'].includes(entry.name) && !entry.name.startsWith('.env'), 'Private, generated or dependency files are forbidden in app bundles.');
      const target = `${directory}/${name}`;
      const info = await lstat(await contained(root, target));
      ensure(!info.isSymbolicLink(), 'Bundle sources must not be symbolic links.');
      if (info.isDirectory()) {
        ensure(allowed.some(item => item.startsWith(`${name}/`)), 'Unexpected directory in app bundle source.');
        await visit(target, name);
      } else {
        ensure(info.isFile() && expected.has(name), 'Unexpected file in app bundle source.');
        const bytes = await regularFile(root, target);
        scanSecrets(bytes);
        found.push({ path: name, bytes });
      }
    }
  }
  await visit(directory);
  ensure(found.length === expected.size && allowed.every(path => found.some(file => file.path === path)), 'App bundle source is incomplete.');
  return found.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ value >>> 8;
  return (value ^ 0xffffffff) >>> 0;
}

/** A dependency-free stored ZIP: fixed 1980 timestamp, UTF-8 names, stable order and modes. */
function zip(files) {
  ensure(files.length > 0 && files.length < 65536, 'Unsupported bundle file count.');
  const local = [], central = [];
  let offset = 0, total = 0;
  for (const file of [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) {
    ensure(typeof file.path === 'string' && !file.path.startsWith('/') && !file.path.includes('\\') && file.path.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe ZIP member path.');
    const name = Buffer.from(file.path), bytes = Buffer.from(file.bytes), crc = crc32(bytes);
    total += bytes.length; ensure(name.length < 65536 && total <= maximumArchiveBytes, 'App bundle exceeds its bounded archive limit.');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, bytes);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(0x314, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8);
    record.writeUInt16LE(33, 14); record.writeUInt32LE(crc, 16); record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE((0o100644 << 16) >>> 0, 38); record.writeUInt32LE(offset, 42); central.push(record, name);
    offset += header.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

async function validateSchema(root, name, value, ajv) {
  const schemas = JSON.parse((await regularFile(root, 'tools/plugin-schemas/sources.json')).toString());
  const source = schemas.schemas.find(item => item.file === name), bytes = await regularFile(root, `tools/plugin-schemas/${name}`);
  ensure(source && hash(bytes) === source.sha256, 'Cached official plugin schema does not match its recorded digest.');
  const validate = ajv.getSchema(JSON.parse(bytes).$id) ?? ajv.compile(JSON.parse(bytes));
  ensure(validate(value), `Invalid portable app package: ${ajv.errorsText(validate.errors)}.`);
}

async function validateProduct(root, product, files, version, ajv) {
  const read = name => JSON.parse(files.find(file => file.path === name).bytes.toString());
  const manifest = read('plugin.json');
  await validateSchema(root, 'agent-plugin.schema.json', manifest, ajv);
  ensure(manifest.name === product.pluginName && manifest.version === version, 'App package identity or release version drift.');
  const extension = manifest.extensions?.['com.openai'];
  ensure(extension?.interface?.logo === './assets/icon.png' && extension.interface.composerIcon === './assets/icon.png', 'Package icons must resolve to the included brand asset.');
  ensure(!extension.hooks && !extension.apps, 'Lifecycle hooks and app references are forbidden in public app ZIPs.');
  ensure(!extension.review?.test_credentials && !extension.review?.reviewer_instructions, 'Private reviewer details must remain outside public ZIPs.');
  if (product.endpoint) {
    const mcp = read('mcp.json'); await validateSchema(root, 'agent-mcp.schema.json', mcp, ajv);
    ensure(Object.keys(mcp.mcpServers).length === 1, 'MCP app packages need exactly one declared remote connection.');
    const server = mcp.mcpServers[product.pluginName];
    ensure(server?.type === 'streamable-http' && server.url === product.endpoint && !server.headers, 'MCP connection differs from its declared public profile.');
    ensure(extension.review?.test_cases?.positive?.length === 5 && extension.review?.test_cases?.negative?.length === 3, 'A single MCP connection requires five positive and three negative review cases.');
    const covered = new Set(extension.review.test_cases.positive.flatMap(test => String(test.tools_triggered ?? '').split(',').map(name => name.trim()).filter(Boolean)));
    ensure(covered.size === product.tools.length && product.tools.every(name => covered.has(name)), 'MCP review cases must cover the actual declared tool inventory.');
    if (product.kind === 'desktop') ensure(extension.requires_local_executor === true && server.url === 'https://mcp.tenhaw.com/mcp' && !product.uiDomain && !product.renderTool, 'Developer hybrid must retain desktop execution, its real remote server and no UI or local MCP attachment.');
    else ensure(!extension.requires_local_executor, 'Hosted calculation app must not require a local executor.');
  } else {
    ensure(!files.some(file => file.path === 'mcp.json'), 'A skills-only package must not contain an undeclared MCP connection.');
    ensure(!Object.hasOwn(extension, 'review'), 'Skills-only developer packages must omit MCP review metadata.');
  }
}

/** Validate and package seven local source candidates. No upload or publication occurs. */
export async function packageApps({ root = checkout, check = false } = {}) {
  root = await realpath(root);
  const generated = await generateAppPlugins({ root, check: true });
  ensure(generated.ok, 'Generated app packages or review plans have drifted. Regenerate and review them before packaging.');
  const catalog = await loadAppProducts(root), version = JSON.parse((await regularFile(root, 'packages/core/package.json')).toString()).version;
  ensure(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version), 'Use an exact source release version.');
  const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
  const products = [], outputs = new Map(), aggregateFiles = [];
  for (const product of catalog.products) {
    const skills = product.kind === 'hosted' ? [product.skillName] : product.skillNames;
    const allowed = ['plugin.json', 'LICENSE', 'LICENSE-CONTENT', 'assets/icon.png', ...skills.map(name => `skills/${name}/SKILL.md`), ...(product.endpoint ? ['mcp.json'] : [])];
    const files = await inventory(root, product.packagePath, allowed);
    await validateProduct(root, product, files, version, ajv);
    const filename = `${product.pluginName}-${version}.zip`, bytes = zip(files);
    products.push({ productId: product.id, pluginName: product.pluginName, version, status, endpoint: product.endpoint, uiDomain: product.uiDomain ?? null, tools: product.tools,
      requiresLocalExecutor: product.requiresLocalExecutor, archive: filename, sha256: hash(bytes), bytes: bytes.length,
      files: files.map(file => ({ path: file.path, bytes: file.bytes.length, sha256: hash(file.bytes) })),
    });
    outputs.set(`artifacts/apps/${filename}`, bytes); aggregateFiles.push({ path: filename, bytes });
  }
  const plans = await inventory(root, 'launch/apps', ['README.md', ...catalog.products.flatMap(product => ['README.md', 'submission.json', 'review-cases.json'].map(name => `${product.slug}/${name}`))]);
  for (const file of plans) aggregateFiles.push({ path: `submission-plans/${file.path}`, bytes: file.bytes });
  const manifest = { schemaVersion: '1.0', version, status, archiveFormat: 'zip-stored', timestamp: '1980-01-01T00:00:00', products,
    submissionPlans: plans.map(file => ({ path: `submission-plans/${file.path}`, bytes: file.bytes.length, sha256: hash(file.bytes) })),
    publication: 'Local source candidates only. Portal upload, conversation review, owner approvals and publication remain separate actions.',
  };
  const manifestBytes = json(manifest); outputs.set('artifacts/apps/manifest.json', manifestBytes); aggregateFiles.push({ path: 'manifest.json', bytes: manifestBytes });
  const aggregateName = `tenhaw-seven-apps-${version}.zip`, aggregate = zip(aggregateFiles), aggregateSha256 = hash(aggregate);
  outputs.set(`artifacts/${aggregateName}`, aggregate);
  outputs.set(`artifacts/${aggregateName}.sha256`, Buffer.from(`${aggregateSha256}  ${aggregateName}\n`));
  // Resolve every source and destination before writing any archive.
  const destinations = await Promise.all([...outputs].map(async ([path, bytes]) => {
    const target = await contained(root, path);
    try { ensure((await lstat(target)).isFile(), 'Archive output must be a regular file.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { path, target, bytes };
  }));
  const changed = [];
  for (const item of destinations) {
    let existing; try { existing = await regularFile(root, item.path, maximumArchiveBytes + 1024 * 1024); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!existing?.equals(item.bytes)) changed.push(item.path);
  }
  if (!check && changed.length) {
    await mkdir(resolve(root, 'artifacts/apps'), { recursive: true });
    const lock = resolve(root, 'artifacts/apps/.package-apps.lock');
    let handle; try { handle = await open(lock, 'wx', 0o600); } catch { throw new Error('Another app packaging write may be in progress; review its lock before retrying.'); }
    try {
      for (const item of destinations.filter(item => changed.includes(item.path))) {
        await contained(root, item.path);
        const staging = `${item.target}.tmp-${randomUUID()}`;
        let created = false;
        try {
          const output = await open(staging, 'wx', 0o644);
          created = true;
          try { await output.writeFile(item.bytes); await output.sync(); } finally { await output.close(); }
          await rename(staging, item.target);
        } finally { if (created) await rm(staging, { force: true }); }
      }
    } finally { await handle.close(); await rm(lock, { force: true }); }
  }
  return { ok: !check || changed.length === 0, version, status, products: products.length, manifest: 'artifacts/apps/manifest.json', aggregate: `artifacts/${aggregateName}`, aggregateSha256, aggregateBytes: aggregate.length, changed };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2), rootFlag = args.indexOf('--root');
  try {
    ensure(args.every((arg, index) => arg === '--check' || arg === '--json' || arg === '--root' || rootFlag >= 0 && index === rootFlag + 1), 'Use --check, --json and optional --root <checkout>.');
    ensure(rootFlag < 0 || args[rootFlag + 1] && !args[rootFlag + 1].startsWith('--'), '--root requires a checkout directory.');
    const result = await packageApps({ root: rootFlag >= 0 ? resolve(args[rootFlag + 1]) : checkout, check: args.includes('--check') });
    console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : `${result.ok ? 'Prepared' : 'Drift in'} ${result.products} ${result.status} ZIPs at version ${result.version}. Aggregate: ${result.aggregate}.`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(error instanceof Error ? error.message : 'App packaging failed.'); process.exitCode = 1; }
}
