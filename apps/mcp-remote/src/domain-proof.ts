import catalog from '../../../spec/content/app-products.json';

/** Return only a portal-issued public proof for this exact product hostname. */
export function appDomainProof(request: Request, configured = process.env.TENHAW_APP_DOMAIN_CHALLENGES) {
  const host = new URL(request.url).hostname;
  const profile = catalog.products.find(item => typeof item.endpoint === 'string' && new URL(item.endpoint).hostname === host);
  if (!profile || !configured) return new Response('Not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  let proofs: unknown;
  try { proofs = JSON.parse(configured); } catch { return new Response('Not configured.', { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  const value = proofs && typeof proofs === 'object' && !Array.isArray(proofs) ? (proofs as Record<string, unknown>)[profile.id] : undefined;
  if (typeof value !== 'string' || value.length < 1 || value.length > 4096 || /[\u0000-\u0020\u007f]/.test(value)) return new Response('Not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(value, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
