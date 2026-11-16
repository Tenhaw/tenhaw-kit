import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

type Package = { name: string; version: string; integrity: string };
type RemotePackage = { name: string; version: string; dist: { integrity: string; attestations?: { url?: unknown } } };
type Options = { getPackage: (name: string, version: string) => Promise<unknown>; timeoutMs?: number; intervalMs?: number; now?: () => number; pause?: (milliseconds: number) => Promise<void>; report?: (message: string) => void };
const commands = vi.hoisted(() => ({ execFileSync: vi.fn(), execSync: vi.fn(), execFile: vi.fn(), spawn: vi.fn() }));
vi.mock('node:child_process', () => commands);
const root = fileURLToPath(new URL('../', import.meta.url));
const moduleUrl = pathToFileURL(join(root, 'scripts/npm-visibility.mjs')).href;
const { waitForNpmVisibility } = await import(moduleUrl) as { waitForNpmVisibility(packages: Package[], options: Options): Promise<void> };
const packages: Package[] = ['tenhaw', 'create-tenhaw', '@tenhaw/core', '@tenhaw/ai-readiness', '@tenhaw/delivery-metrics', '@tenhaw/ai-roi', '@tenhaw/usecase-register', '@tenhaw/opmodel', '@tenhaw/mcp'].map(name => ({ name, version: '1.0.0', integrity: `sha512-${createHash('sha512').update(name).digest('base64')}` }));
function remote(pkg: Package): RemotePackage { return { name: pkg.name, version: pkg.version, dist: { integrity: pkg.integrity, attestations: { url: `https://registry.npmjs.org/-/npm/v1/attestations/${encodeURIComponent(pkg.name)}@${pkg.version}` } } }; }
function clock() {
  let current = 0;
  const pauses: number[] = [], reports: string[] = [];
  return { now: () => current, pause: async (milliseconds: number) => { pauses.push(milliseconds); current += milliseconds; }, report: (message: string) => { reports.push(message); }, pauses, reports };
}
beforeEach(() => {
  // Polling must use only the injected registry reader and must never upload or invoke npm.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network call in fixture-only polling test'); }));
  for (const command of Object.values(commands)) command.mockImplementation(() => { throw new Error('No publisher or child process is allowed in visibility polling'); });
});
afterEach(() => {
  for (const command of Object.values(commands)) expect(command).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  vi.clearAllMocks(); vi.unstubAllGlobals();
});

describe('npm accepted-upload visibility wait', () => {
  it('checks all nine accepted versions under one joint window and stops querying completed packages', async () => {
    const time = clock(), calls: { name: string; at: number }[] = [];
    await waitForNpmVisibility(packages, { ...time, timeoutMs: 120_000, intervalMs: 30_000, getPackage: async (name, version) => {
      const index = packages.findIndex(pkg => pkg.name === name), pkg = packages[index]!;
      expect(version).toBe(pkg.version); calls.push({ name, at: time.now() });
      return time.now() >= index * 10_000 ? remote(pkg) : null;
    } });
    expect(time.now()).toBe(90_000);
    expect(time.pauses).toEqual([30_000, 30_000, 30_000]);
    expect(calls.filter(call => call.at === 0).map(call => call.name)).toEqual(packages.map(pkg => pkg.name));
    expect(calls.filter(call => call.name === packages[0]!.name)).toHaveLength(1);
    expect(calls.filter(call => call.name === packages[8]!.name).map(call => call.at)).toEqual([0, 30_000, 60_000, 90_000]);
    expect(time.reports.length).toBeGreaterThan(0);
  });

  it('returns immediately when exact hashes and provenance are visible, without a sleep or publication call', async () => {
    const time = clock(), reads = vi.fn(async (name: string) => remote(packages.find(pkg => pkg.name === name)!));
    await waitForNpmVisibility(packages, { ...time, getPackage: reads });
    expect(reads).toHaveBeenCalledTimes(9); expect(time.pauses).toEqual([]); expect(time.reports).toEqual([]);
  });

  it('bounds all missing versions by one deadline and shortens the final pause to the remaining time', async () => {
    const time = clock(), getPackage = vi.fn(async () => null);
    await expect(waitForNpmVisibility(packages, { ...time, timeoutMs: 65_000, intervalMs: 30_000, getPackage })).rejects.toThrow(/Timed out.*npm/i);
    expect(time.now()).toBe(65_000); expect(time.pauses).toEqual([30_000, 30_000, 5_000]);
    expect(getPackage).toHaveBeenCalledTimes(27);
  });

  it('uses one default 20-minute window for the whole set and names pending immutable versions at timeout', async () => {
    const time = clock();
    let error: unknown;
    try { await waitForNpmVisibility(packages, { ...time, getPackage: async () => null }); } catch (cause) { error = cause; }
    expect(time.now()).toBe(1_200_000);
    expect(time.pauses).toHaveLength(40);
    for (const pkg of packages) expect(String(error)).toContain(`${pkg.name}@${pkg.version}`);
    expect(String(error)).toMatch(/not repeated|do not.*republish/i);
  });

  it.each(['version', 'integrity', 'missing-integrity'] as const)('fails immediately on %s mismatch instead of waiting or retrying an immutable version', async fault => {
    const time = clock(), pkg = packages[0]!, value = remote(pkg);
    if (fault === 'version') value.version = '9.0.0';
    else value.dist.integrity = fault === 'integrity' ? 'sha512-different' : '';
    const getPackage = vi.fn(async () => value);
    await expect(waitForNpmVisibility([pkg], { ...time, getPackage })).rejects.toThrow(/version|integrity/i);
    expect(getPackage).toHaveBeenCalledTimes(1); expect(time.pauses).toEqual([]); expect(time.now()).toBe(0);
  });

  it('propagates an API/authentication/transport error without retrying it as a missing package', async () => {
    const time = clock(), unavailable = new Error('Registry HTTP 503');
    const getPackage = vi.fn(async () => { throw unavailable; });
    await expect(waitForNpmVisibility([packages[0]!], { ...time, getPackage })).rejects.toBe(unavailable);
    expect(getPackage).toHaveBeenCalledTimes(1); expect(time.pauses).toEqual([]);
  });

  it.each(['absent', 'null', 'empty'] as const)('waits for %s provenance after version and hash become visible', async state => {
    const time = clock(), pkg = packages[0]!, getPackage = vi.fn(async () => {
      const value = remote(pkg);
      if (time.now() === 0) {
        if (state === 'absent') delete value.dist.attestations;
        else value.dist.attestations = { url: state === 'null' ? null : '' };
      }
      return value;
    });
    await waitForNpmVisibility([pkg], { ...time, timeoutMs: 90_000, intervalMs: 30_000, getPackage });
    expect(time.pauses).toEqual([30_000]); expect(getPackage).toHaveBeenCalledTimes(2);
  });

  it.each([42, {}, 'http://registry.npmjs.org/attestation', 'https://', 'https://not a valid host/attestation'])('rejects malformed provenance URL %j without a retry', async url => {
    const time = clock(), value = remote(packages[0]!); value.dist.attestations = { url };
    const getPackage = vi.fn(async () => value);
    await expect(waitForNpmVisibility([packages[0]!], { ...time, getPackage })).rejects.toThrow(/provenance/i);
    expect(getPackage).toHaveBeenCalledTimes(1); expect(time.pauses).toEqual([]);
  });

  it.each([null, undefined, false, {}, { version: '1.0.0' }])('fails closed on a malformed package response %j (only null is pending)', async value => {
    const time = clock(), getPackage = vi.fn(async () => value);
    if (value === null) {
      await expect(waitForNpmVisibility([packages[0]!], { ...time, timeoutMs: 1, getPackage })).rejects.toThrow(/Timed out/);
      expect(time.now()).toBe(1);
    } else {
      await expect(waitForNpmVisibility([packages[0]!], { ...time, getPackage })).rejects.toThrow(/version|integrity/i);
      expect(time.pauses).toEqual([]);
    }
  });

  it.each([{ timeoutMs: 0 }, { timeoutMs: -1 }, { timeoutMs: Infinity }, { intervalMs: 0 }, { intervalMs: NaN }])('rejects invalid polling bounds %j before reading the registry', async bounds => {
    const time = clock(), getPackage = vi.fn(async () => null);
    await expect(waitForNpmVisibility(packages, { ...time, ...bounds, getPackage })).rejects.toThrow(/configuration/i);
    expect(getPackage).not.toHaveBeenCalled(); expect(time.pauses).toEqual([]);
  });

  it.each([{ values: [NaN] }, { values: [Infinity] }, { values: [0, NaN] }, { values: [0, 0, NaN] }])('rejects a nonfinite clock sequence $values', async ({ values }) => {
    let index = 0; const pause = vi.fn(async () => {});
    await expect(waitForNpmVisibility(packages, { now: () => values[Math.min(index++, values.length - 1)]!, pause, report: () => {}, getPackage: async () => null })).rejects.toThrow(/clock/i);
    expect(pause).not.toHaveBeenCalled();
  });

  it('rejects an overflowing deadline instead of creating an unbounded wait', async () => {
    const getPackage = vi.fn(async () => null);
    await expect(waitForNpmVisibility(packages, { timeoutMs: Number.MAX_VALUE, now: () => Number.MAX_VALUE, pause: async () => {}, report: () => {}, getPackage })).rejects.toThrow(/deadline|clock|configuration/i);
    expect(getPackage).not.toHaveBeenCalled();
  });

  it.each([{ values: [] }, { values: [packages[0]!, packages[0]!] }, { values: [{ ...packages[0]!, integrity: 'wrong' }] }])('rejects an empty, duplicate or invalid expected package list', async ({ values }) => {
    const time = clock(), getPackage = vi.fn(async () => null);
    await expect(waitForNpmVisibility(values, { ...time, getPackage })).rejects.toThrow(/package|configuration/i);
    expect(getPackage).not.toHaveBeenCalled();
  });
});
