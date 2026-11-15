# Releasing Tenhaw Kit

The source of truth is `Tenhaw/tenhaw-kit`. Nine npm distributions, four Python projects, the MCP metadata and agent manifests use one reviewed release version. A source commit or tag alone does not publish anything. Both publication jobs run directly in `.github/workflows/release.yml`; satellite synchronisation is an explicit reusable workflow call after package verification.

## Required account configuration

1. Protect `main` with required pull requests and the CI and CodeQL checks. Create the `release` environment, restrict it to `main` and require James as reviewer. GitHub creates unconfigured environments automatically, so the YAML environment declaration does not prove protection is enabled.
2. Configure npm trusted publishers for `tenhaw`, `create-tenhaw`, `@tenhaw/core`, `@tenhaw/ai-readiness`, `@tenhaw/delivery-metrics`, `@tenhaw/ai-roi`, `@tenhaw/usecase-register`, `@tenhaw/opmodel` and `@tenhaw/mcp`. Use owner `Tenhaw`, repository `tenhaw-kit`, workflow `release.yml`, environment `release`. Explicitly permit **direct `npm publish`**. Current npm settings default new publishers to staged publication. Newly configured publishers expire if the first publication does not complete within two days.
3. If a new npm package cannot yet have a trusted publisher, publish the reviewed bootstrap version through the maintainer's authenticated npm session with 2FA, then configure OIDC. A bootstrap is an actual public package release and must contain the proper licence and name. Never use an empty package simply to imply readiness. No `NPM_TOKEN` or `NODE_AUTH_TOKEN` is required by this workflow.
4. Configure PyPI pending or existing trusted publishers for `tenhaw`, `tenhaw-ai-readiness`, `tenhaw-delivery-metrics` and `tenhaw-ai-roi` with the same owner, repository, workflow and environment. Pending publishers create projects on first use; they do not reserve names. The user has authorised PyPI publication. A trusted-publisher mismatch must be diagnosed from the actual registry response.
5. Create six dedicated public satellite repositories: `Tenhaw/tenhaw-gemini` and `Tenhaw/template-<name>` for the five templates. Install a GitHub App on those six repositories with repository **Contents: write**, **Administration: write** and **Metadata: read**. Store `SATELLITES_APP_ID` and `SATELLITES_APP_PRIVATE_KEY` as Actions secrets. The App token is generated for a single run and revoked by the action's cleanup. The ordinary repository `GITHUB_TOKEN` cannot write to the satellites.
6. Keep the source repository public. npm provenance is not generated from a private source repository. Enable secret scanning, push protection and Dependabot alerts in repository settings; configuration files do not establish those account settings.

The release runner uses Node 22.23.1, verified npm 11.5.1 and uv 0.11.32. npm requires Node 22.14.0 or later and npm 11.5.1 or later for trusted publishing. Dependency installation caching is disabled in the release job. All third-party Actions are pinned to reviewed commit hashes.

## Prepare the reviewed version

1. Add a changeset for a behaviour, schema or framework change. The nine npm packages are a fixed release group. Run `pnpm version:packages` on a branch and review the resulting changes.
2. Set the four Python project versions and internal requirements, MCP `server.json` package/server versions, Claude/OpenAI/Gemini manifests and install examples to the same version. The publisher rejects drift before mutation. Do not move or replace an existing public package version or satellite tag.
3. Regenerate assets and agent instruction files. Run the required verification below, review public copy, and merge the version PR through the normal review process.

```sh
uv run python scripts/sync-python-assets.py
node scripts/generate-plugins.mjs
pnpm check
uv run pytest
uv run ruff check
uv run mypy
pnpm build:apps
pnpm build:templates
node scripts/pack-check.mjs
uv build --all-packages --out-dir artifacts/python
node scripts/publish.mjs --version 1.0.0 --dry-run
```

The shared CI composite additionally runs all five template unit and Playwright journeys, clean Python wheel imports, and production dependency audits. Packaging must leave the original publishable tarballs in `artifacts/*.tgz`; clean-install test rewrites belong in temporary copies. `pack-check.mjs` verifies real packed installations, an MCP protocol inventory, a scaffold build, licensed contents and the CLI size limit. Regeneration checks fail when tracked assets differ or new untracked plugin files appear.

## Publish and verify

Dispatch **Release** on `main`, supplying the exact reviewed version. A shared verification job repeats all required checks and builds immutable distributions, records the exact source commit and version, and uploads a verified distribution artifact. Independent npm and PyPI jobs each enter the protected `release` environment, download that same artifact and verify its source identity before publishing. An npm account or bootstrap failure therefore does not prevent an authorised PyPI release.

- npm publication uses OIDC and explicit provenance. Before the first upload, all nine tarballs are checked against their source manifests and any immutable existing versions. An existing version is reused only if its registry integrity exactly matches the local tarball. The script then verifies exact versions, tarball hashes, provenance metadata and a fresh `npm audit signatures` installation.
- The PyPI action publishes the built wheels and source distributions with OIDC attestations. The subsequent verifier checks all four exact project versions, matches each published distribution's SHA-256 against the local file, and requires its provenance endpoint to expose attestation bundles. Existing identical files support a safe rerun; a different immutable file fails verification.
- After both independent package jobs pass their registry verification, the release explicitly calls `sync-satellites.yml`. Each target receives a source snapshot, a standalone lockfile where applicable, public licences, source provenance metadata and an immutable version tag. Templates are flagged as templates. The Gemini manifest version and tag match exactly. Existing identical tagged source snapshots are verified without regenerating their lockfiles.
- The final job records a GitHub Release pointing to the verified source commit. It does not rely on tag-triggered workflows, because events created with `GITHUB_TOKEN` generally do not start another workflow run.

Evidence is uploaded as the verified-distributions artifact plus independent npm/PyPI evidence artifacts, including `npm-verification.json`, `pypi-verification.json`, packed distributions and clean-install evidence. A workflow file existing locally does not establish a successful publication. Report only the observed registry versions and successful run URLs.

If publication stops partway through, inspect which exact files are already public. Rerun the same reviewed source only when local artifacts match those immutable files. If the source needs a fix, use a new version. Never attempt to overwrite a published version or force-move a satellite release tag. A failure on either registry does not undo or block an independently completed publication to the other registry. Satellite failure does not undo completed package publication; the workflow remains failed until that required step succeeds.

## Publish the official MCP registry entry

`registry-publish.yml` is a separate manual workflow through the protected `release` environment. It requires the npm MCP package and the deployed remote endpoint to expose the exact requested version; `/health` must also identify the workflow source commit.

For `com.tenhaw/kit`, configure the official DNS authentication record at the **apex `tenhaw.com`**, then store the corresponding Ed25519 hex seed as the environment secret `MCP_PRIVATE_KEY` and set repository variable `MCP_DNS_AUTH_CONFIGURED=true`. Keep private keys out of chat, repository files and command output. The workflow does not print the DNS login process or its credential-bearing errors, and removes its ephemeral registry session on completion. The upstream publisher currently accepts in-process DNS signing through its private-key argument; use a dedicated ephemeral hosted runner and retain the protected environment restriction.

The publisher is pinned to official release `v1.8.9`. Its Linux archive is checked against the verified SHA-256 and its Sigstore bundle before extraction. Update the version, digest and signing identity together when upgrading. A failed or unconfigured DNS gate is a failed required operation, never a simulated registry submission. The workflow validates metadata, publishes, and checks the exact server name and version in the registry response. DNS authority and package publication are separate controls.

## Supply chain and measurement

CI includes CodeQL for JavaScript/TypeScript and Python, OpenSSF Scorecard output, dependency audits and pinned Action dependencies. The daily/manual MCP smoke workflow checks real stdio protocol responses and the exact live six-tool remote inventory with synthetic schema-validated calls; an unavailable or mismatched deployment fails the check. Scorecard results stay in the workflow artifact; no external score publication is implied. Dependabot opens update PRs. No automatic merge or direct write to `main` is configured.

`metrics-weekly.yml` records allowlisted public npm/PyPI downloads, repository stars/forks and official registry presence in a downloadable artifact. API failures are unavailable values. Template uses, deployments and unverified gallery counts remain null; forks, install clicks and downloads are not substituted for them. The script does not access analytics accounts, user inputs, repository contents or booking data. Copy a reviewed metrics artifact into `docs/metrics` through a PR when appropriate.

Launch posts and directory submissions remain drafts until explicitly approved. These workflows do not publish posts, contact third parties, submit directory forms or merge third-party pull requests.

## Official references

- [npm trusted publishing, runtime requirements, allowed publish actions and expiry](https://docs.npmjs.com/trusted-publishers/)
- [PyPI pending trusted publishers](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/)
- [GitHub workflow-to-workflow trigger restrictions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [MCP registry automation and publisher verification](https://modelcontextprotocol.io/registry/github-actions)
- [MCP DNS authentication and apex records](https://modelcontextprotocol.io/registry/authentication)
