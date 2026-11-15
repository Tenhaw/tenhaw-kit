# Build and release runbook

## Current state

The source repository is public at `Tenhaw/tenhaw-kit`; [source PR #1](https://github.com/Tenhaw/tenhaw-kit/pull/1) is pending final CI and merge. [Website PR #12](https://github.com/Tenhaw/Tenhaw_Website/pull/12) is merged. Record subsequent verification against the exact reviewed source commit.

- No npm or PyPI 1.0.0 publication is yet verified. npm web authentication, initial package ownership and trusted-publisher configuration remain release gates. PyPI publication has an independent job and can complete while the npm gate is unresolved.
- The six dedicated public satellite repositories exist. The five starter repositories are flagged as templates, with the intended topics. Their current content is README bootstrap only; application source, version tags and releases await the reviewed main commit and published package versions.
- The Vercel projects are `tenhaw-kit-docs` and `tenhaw-mcp`, using `apps/docs` and `apps/mcp-remote`, region `lhr1` and the Standard build machine. Both service domains are attached and ownership-verified. Public DNS, TLS and the final source deployment still need verification before `kit.tenhaw.com` or `mcp.tenhaw.com` is called live.
- The MCP namespace uses the live HTTP identity proof at `https://tenhaw.com/.well-known/mcp-registry-auth`. The protected signing key and `MCP_HTTP_AUTH_CONFIGURED=true` are configured. See [REGISTRY_IDENTITY.md](REGISTRY_IDENTITY.md) for the verified public proof and exact service-domain CNAME targets. Registry publication remains pending.
- The approved Kit-only operating budget is **US$25 per month**, tracked separately from the existing **US$200 team-wide alert**, which remains unchanged. The ignored `artifacts/hosting-budget.json` report observed US$0 combined effective cost for the two Kit projects through 15 November 2026 at 20:21 UTC. Usage reporting can lag; this record is not a hard spending cap.

## Corrected sequence

1. Verify GitHub identity and exact name responses. Set the repository owner to Tenhaw.
2. Bootstrap the source repository, then prepare all implementation in a pull request. Protect main and require CI.
3. Build all libraries, Python distributions, CLI/MCP and standalone templates. Validate schemas and golden vectors; compare canonical output across languages.
4. Pack the npm artefacts and install them together into a clean directory. Exercise the installed CLI and stdio MCP. Scaffold a template using local tarballs and build it before any public package is required.
5. Verify the compact reference and remote app builds and preview endpoints. Use the configured native Vercel Firewall rule for `/mcp` and `/api/v1/*`: 30 requests per IP per 60 seconds, with a 429 response. The application uses `TENHAW_RATE_LIMIT_PROVIDER=vercel` only on Vercel. Prove the production rule with a burst test after deployment.
6. Configure the GitHub release environment, npm trusted publishers and four PyPI pending publishers. A pending publisher does not reserve a name. Bootstrap npm package ownership with a real one-time authenticated publish only if required; do not ship empty placeholder packages.
7. Merge the reviewed release candidate and dispatch Release on main. Publish exact npm/PyPI versions using the independent OIDC jobs, with provenance/attestations. Record their results separately and re-run public clean-install checks.
8. For the initial satellite launch, run `node scripts/sync-satellites.mjs --version 1.0.0 --local-bootstrap --apply` using the existing authenticated Tenhaw account. The script verifies merged main history and all nine public npm versions before writing source. A narrowly scoped GitHub App remains the recurring Actions path; configure it when needed. No new long-lived token or deploy key is required for the initial local sync.
9. Add only the two service CNAME records listed in REGISTRY_IDENTITY.md at the authoritative DNS provider. Verify DNS, TLS, health/version/commit, all six remote tools, body limits, rate limiting and the static reference endpoints. Re-run `node scripts/hosting-budget.mjs` to check only the two Kit projects against US$25; preserve the existing team alert.
10. Publish MCP metadata only after package and endpoint verification, using the configured HTTP identity. Prepare other directory submissions and launch drafts; perform any login or legal acceptance through the real account flow and record its result.
11. Verify the merged website changes and booking attribution tests. Activate distribution links when their targets are live. Preserve the existing Call Booked series.

## Account configuration needed

- GitHub: protected main, required CI and the release environment. Use existing Tenhaw `gh` authentication for the initial satellite sync; a future GitHub App needs access only to the six satellite repositories, with Contents: write, Administration: write and Metadata: read.
- npm: organisation access and trusted publishing per package, workflow release.yml, environment release. Node >=22.14 and npm >=11.5.1 in publishing jobs.
- PyPI: pending publishers for tenhaw, tenhaw-ai-readiness, tenhaw-delivery-metrics and tenhaw-ai-roi, same repository/workflow/environment.
- Vercel: retain the two existing Kit project configurations, Git roots, `lhr1` region and Standard machine. Apply the exact service-domain DNS targets returned by Vercel and recorded in REGISTRY_IDENTITY.md.
- Remote rate limiter: native Vercel Firewall is the selected provider. Keep its published rule and the production application setting in sync. Upstash is a documented alternative; it is not required for this deployment. Production must fail closed if the selected control is unavailable.
- Budget: retain the approved US$25 Kit-only monthly budget and separate US$200 team alert. Keep private usage evidence in ignored artifacts. Do not introduce an account-wide pause or change unrelated project budgets.
- MCP registry: use `com.tenhaw/kit` with the configured HTTP proof and protected `MCP_PRIVATE_KEY`. No apex DNS TXT record is required for this identity method. The registry workflow validates the live proof and exact package/deployment version before publishing.

## Verification commands

Use pnpm check, uv run pytest, uv run ruff check, uv run mypy, uv run python scripts/sync-python-assets.py --check, pnpm build:apps, pnpm build:templates and pnpm pack:check. Save current verification evidence in docs/verification.md.

Production verification must compare the health commit to the deployed main commit, inspect exact remote tool names, reject local-only tools, reject raw delivery events and oversized bodies, and observe a 429 burst response. Confirm exact package versions and provenance, not merely registry search presence.
