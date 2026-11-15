# Build and release runbook

## Current state

Implementation and local verification are in progress. No public package release, production domain, directory listing or measurement baseline is asserted by this file. Record successful command output and exact versions before marking a step complete.

## Corrected sequence

1. Verify GitHub identity and exact name responses. Set the repository owner to Tenhaw.
2. Bootstrap the source repository, then prepare all implementation in a pull request. Protect main and require CI.
3. Build all libraries, Python distributions, CLI/MCP and standalone templates. Validate schemas and golden vectors; compare canonical output across languages.
4. Pack the npm artefacts and install them together into a clean directory. Exercise the installed CLI and stdio MCP. Scaffold a template using local tarballs and build it before any public package is required.
5. Verify the compact docs and remote app builds and preview endpoints. Set the remote rate-limit configuration; production fails closed without it.
6. Configure the GitHub release environment, npm trusted publishers and four PyPI pending publishers. A pending publisher does not reserve a name. Bootstrap npm package ownership with a real one-time authenticated publish only if required; do not ship empty placeholder packages.
7. Merge the reviewed release candidate. Publish exact npm/PyPI versions using OIDC and provenance/attestations. Re-run public clean-install checks.
8. Use a narrowly scoped GitHub App for satellite sync. The explicit release workflow invokes sync jobs; it does not depend on a GITHUB_TOKEN-created tag triggering another workflow.
9. Configure Git-connected Vercel projects, domains, rate limits and the user-selected spend alert. Verify health/version/commit, remote tools, request limits and static reference endpoints.
10. Publish MCP metadata only after package and endpoint verification. Prepare other directory submissions and launch drafts; login, DNS and legal acceptance remain account-owner actions when required.
11. Open the content-only tenhaw.com PR with the existing template and booking attribution tests. Activate links once their targets are live. Preserve the existing Call Booked series.

## Account configuration needed

- GitHub: release environment reviewer, protected branch and security settings; a GitHub App with access only to the six satellite repositories for sync.
- npm: organisation access and trusted publishing per package, workflow release.yml, environment release. Node >=22.14 and npm >=11.5.1 in publishing jobs.
- PyPI: pending publishers for tenhaw, tenhaw-ai-readiness, tenhaw-delivery-metrics and tenhaw-ai-roi, same repository/workflow/environment.
- Vercel: projects tenhaw-kit-docs and tenhaw-mcp, Git roots apps/docs and apps/mcp-remote, region lhr1. Add kit.tenhaw.com and mcp.tenhaw.com using the exact DNS targets returned by Vercel.
- Remote rate limiter: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel only. Stores expiring hashed request counters, not customer payloads. No values in source or logs.
- Spend alerts: choose a budget before activating paid remote hosting/rate limiting. The code does not select a chargeable plan.
- MCP registry: verify com.tenhaw namespace via DNS, or explicitly choose the GitHub fallback and regenerate package/manifest identity together.

## Verification commands

Use pnpm check, uv run pytest, uv run ruff check, uv run mypy, uv run python scripts/sync-python-assets.py --check, pnpm build:apps, pnpm build:templates and pnpm pack:check. Save current verification evidence in docs/verification.md.

Production verification must compare the health commit to the deployed main commit, inspect exact remote tool names, reject local-only tools, reject raw delivery events and oversized bodies, and observe a 429 burst response. Confirm exact package versions and provenance, not merely registry search presence.
