# Hosting and operating budget

The compact reference and remote MCP are separate Git-connected Vercel projects. The existing tenhaw.com project is not reconfigured.

James selected a **US$25 monthly operating budget for Kit**, tracked separately. Vercel's existing **US$200 team-wide alert remains unchanged**, because it covers other applications too. A budget record is not a hard billing cap.

Use `node scripts/hosting-budget.mjs` to read the current billing period, retain only tenhaw-kit-docs and tenhaw-mcp, and compare their combined cost with US$25. It writes only the Kit report under ignored `artifacts/`. Do not commit private account usage reports to this public repository. The public weekly metrics workflow collects public distribution measurements only.

## Remote rate limiting

Preferred deployment: an active native Vercel Firewall rule covering `/mcp` and `/api/v1/*`, limiting each IP to 30 requests per 60 seconds with a 429 response. After publishing and verifying that rule, set `TENHAW_RATE_LIMIT_PROVIDER=vercel` in this project's production environment. The application accepts that setting only when running on Vercel.

Alternative: configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for expiring hashed request counters. No payloads are stored. No values belong in this repository.

Production requests fail closed until one of these controls is configured. Development uses an in-memory limiter. Verify the real production 429 response; do not infer protection from an environment variable alone.

No package, CLI or MCP telemetry is shipped. Hosting providers retain their own operational metadata. The reference site does not ship an analytics script.
