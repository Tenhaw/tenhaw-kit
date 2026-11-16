const defaultPause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function waitForNpmVisibility(packages, { getPackage, timeoutMs = 20 * 60 * 1000, intervalMs = 30 * 1000, now = Date.now, pause = defaultPause, report = console.log } = {}) {
  if (!Array.isArray(packages) || !packages.length || typeof getPackage !== 'function' || typeof now !== 'function' || typeof pause !== 'function' || typeof report !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('Invalid npm visibility poll configuration.');
  const identities = new Set();
  for (const pkg of packages) {
    if (!pkg || typeof pkg.name !== 'string' || !pkg.name || typeof pkg.version !== 'string' || !pkg.version || typeof pkg.integrity !== 'string' || !pkg.integrity.startsWith('sha512-') || identities.has(`${pkg.name}@${pkg.version}`)) throw new Error('Invalid or duplicated npm visibility package.');
    identities.add(`${pkg.name}@${pkg.version}`);
  }
  const started = now();
  if (!Number.isFinite(started)) throw new Error('Invalid npm visibility clock.');
  const deadline = started + timeoutMs;
  if (!Number.isFinite(deadline)) throw new Error('Invalid npm visibility deadline.');
  let pending = [...packages];
  const timeout = () => new Error(`Timed out waiting for npm processing/public visibility: ${pending.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')}. Accepted uploads were not repeated. Check registry scan or moderation status, then verify the same immutable bundle; do not rebuild or republish accepted versions.`);
  while (pending.length) {
    const before = now();
    if (!Number.isFinite(before)) throw new Error('Invalid npm visibility clock.');
    if (before >= deadline) throw timeout();
    const observations = await Promise.all(pending.map(async pkg => {
      // getPackage returns null only for HTTP 404. Authentication, transport and
      // other registry errors propagate immediately rather than being retried.
      const remote = await getPackage(pkg.name, pkg.version);
      if (remote === null) return pkg;
      if (!remote || remote.version !== pkg.version || remote.dist?.integrity !== pkg.integrity) throw new Error(`Immutable npm version or integrity mismatch for ${pkg.name}@${pkg.version}.`);
      const provenanceUrl = remote.dist?.attestations?.url;
      if (provenanceUrl === undefined || provenanceUrl === null || provenanceUrl === '') return pkg;
      try {
        const url = new URL(provenanceUrl);
        if (typeof provenanceUrl !== 'string' || url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Invalid provenance URL.');
      } catch {
        throw new Error(`Invalid npm provenance metadata for ${pkg.name}@${pkg.version}.`);
      }
      return null;
    }));
    pending = observations.filter(Boolean);
    if (!pending.length) return;
    const remaining = deadline - now();
    if (!Number.isFinite(remaining)) throw new Error('Invalid npm visibility clock.');
    if (remaining <= 0) throw timeout();
    report(`Waiting for npm scan/public visibility of ${pending.length} expected version(s); one shared ${timeoutMs / 60000}-minute deadline, no repeat uploads.`);
    await pause(Math.min(intervalMs, remaining));
  }
}
