# Releasing Tenhaw Kit

The source of truth is `Tenhaw/tenhaw-kit`. Nine npm distributions, four Python projects, the MCP metadata and agent manifests use one reviewed release version. A source commit or tag alone does not publish anything. `.github/workflows/release.yml` defaults to non-publishing `prepare` mode. Explicit `python-bootstrap` and `release` runs publish the exact archives from one successful prepare run. Both publication jobs run directly in that workflow through the protected `release` environment. Satellite synchronisation uses the owner CLI for the initial launch or an explicitly selected GitHub App workflow after package verification.

## Required account configuration

1. Protect `main` with required pull requests and the CI and CodeQL checks. Create the `release` environment, restrict it to `main` and require James as reviewer. GitHub creates unconfigured environments automatically, so the YAML environment declaration does not prove protection is enabled.
2. Configure npm trusted publishers for `tenhaw`, `create-tenhaw`, `@tenhaw/core`, `@tenhaw/ai-readiness`, `@tenhaw/delivery-metrics`, `@tenhaw/ai-roi`, `@tenhaw/usecase-register`, `@tenhaw/opmodel` and `@tenhaw/mcp`. Use owner `Tenhaw`, repository `tenhaw-kit`, workflow `release.yml`, environment `release`. Explicitly permit **direct `npm publish`**. Current npm settings default new publishers to staged publication. Newly configured publishers expire if the first publication does not complete within two days.
3. If a new npm package cannot yet have a trusted publisher, publish the reviewed bootstrap version through the maintainer's authenticated npm session with 2FA, then configure OIDC. A bootstrap is an actual public package release and must contain the proper licence and name. Never use an empty package simply to imply readiness. No `NPM_TOKEN` or `NODE_AUTH_TOKEN` is required by this workflow.
4. Configure PyPI trusted publishers with owner `Tenhaw`, repository `tenhaw-kit`, workflow `release.yml` and environment `release`. Existing projects can share that publisher. PyPI permits only **one pending publisher at a time** for this same identity, so new projects must be registered and bootstrapped sequentially as described below. Pending publishers create projects on first use; they do not reserve names. The user has authorised all four projects: `tenhaw-ai-readiness`, `tenhaw-ai-roi`, `tenhaw-delivery-metrics` and `tenhaw`. A trusted-publisher mismatch must be diagnosed from the actual registry response.
5. Create six dedicated public satellite repositories: `Tenhaw/tenhaw-gemini` and `Tenhaw/template-<name>` for the five templates. The initial `owner-cli` mode uses the existing authenticated `Tenhaw` account as described below. Before selecting the recurring `github-app` mode, install a GitHub App on those six repositories with repository **Contents: write**, **Administration: write** and **Metadata: read**, and store `SATELLITES_APP_ID` and `SATELLITES_APP_PRIVATE_KEY` as repository Actions secrets. The App token is generated for a single run and revoked by the action's cleanup. The ordinary repository `GITHUB_TOKEN` cannot write to the satellites.
6. Keep the source repository public. npm provenance is not generated from a private source repository. Enable secret scanning, push protection and Dependabot alerts in repository settings; configuration files do not establish those account settings.

For the initial satellite launch, complete the staged package procedure below, selecting `satellite_sync: owner-cli` for the full release. After both package publication jobs and their registry verification succeed, use a clean checkout of that run's exact source commit and the existing authenticated `Tenhaw` account:

```sh
node scripts/sync-satellites.mjs --version 1.0.1 --local-bootstrap --apply
```

This explicit local mode checks the account, canonical origin, merged main-branch PR history, clean source checkout and every published internal package before synchronising source. It delegates Git authentication to `gh auth git-credential`, without extracting a token or changing global Git configuration. Record the six resulting source snapshots, version tags and releases as separate satellite evidence. A successful package release in `owner-cli` mode does not establish satellite completion. The GitHub App workflow is available for recurring releases after its account configuration is complete.

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
node scripts/publish.mjs --version 1.0.1 --dry-run
```

The shared CI composite additionally runs all five template unit and Playwright journeys, clean Python wheel imports, and production dependency audits. Packaging must leave the original publishable tarballs in `artifacts/*.tgz`; clean-install test rewrites belong in temporary copies. `pack-check.mjs` verifies real packed installations, an MCP protocol inventory, a scaffold build, licensed contents and the CLI size limit. Regeneration checks fail when tracked assets differ or new untracked plugin files appear.

## Freeze the publication bundle

Dispatch **Release** on the reviewed `main` commit with `mode: prepare`, the exact version, `python_project: all` and no `source_run_id`:

```sh
gh workflow run release.yml --ref main -f mode=prepare -f version=1.0.1 -f python_project=all -f satellite_sync=owner-cli
```

Prepare runs the full shared verification and build, then freezes all nine npm tarballs and eight Python archives in one immutable artifact named `verified-distributions-<version>-<source-sha>`. Its `release-bundle.json` records SHA-256 and size for every archive, the repository, source SHA, version, producer run ID and producer mode. The artifact contains those 17 archives and the two identity manifests. Prepare has no publishing, satellite or GitHub Release job; it does not request publication approval from the `release` environment.

Wait for the entire prepare run to succeed and record its actual ID as `PREPARE_RUN_ID`. Every bootstrap run and the final release must supply that ID and run on the **same main commit**. Reuse verifies the producer's repository, `release.yml` path, dispatch event, main branch, exact SHA and successful conclusion through the GitHub API. It selects the unique unexpired artifact by immutable ID and requires its download digest to match, then validates the strict file inventory, every archive hash, version and prepare-producer identity. It reuploads those unchanged files for the current downstream jobs. Reuse never rebuilds distributions.

Freeze the source SHA and this one bundle before the first publication. Do not merge further source changes or regenerate archives between Python bootstrap runs and the full release: even a rebuild of the same source can produce different archive bytes. Retain the original bundle and observed run URL; hosted artifacts expire after 30 days. An expired or missing artifact fails reuse. Do not replace already published files with a rebuilt bundle.

## Bootstrap the four new Python projects

PyPI's pending identity excludes the project name, so four simultaneous pending registrations with `release` conflict. On first use, PyPI converts the pending publisher and removes its pending row. The next project can then use the same repository, workflow and protected environment. Existing normal publisher authorisations remain in place and are reused. Do not create unprotected environments or remove active project publishers to work around this restriction.

1. Keep one pending registration for `tenhaw-ai-readiness`. If an unused pending row for the metapackage `tenhaw` was entered first, replace that unused registration before publishing. Confirm the selected pending project's name and all four identity fields in PyPI before each scoped run.
2. Dispatch `mode: python-bootstrap`, `python_project: tenhaw-ai-readiness`, the exact version and `source_run_id: PREPARE_RUN_ID`. This runs one PyPA publishing action against only that project's verified wheel and sdist, then verifies the exact pair, hashes and publish attestations. npm, satellites and the final GitHub Release job are skipped.
3. After that run succeeds and the pending row has converted, register and bootstrap `tenhaw-ai-roi`, then `tenhaw-delivery-metrics`, using the same source run ID and source SHA. Verify each result before proceeding.
4. Register and bootstrap `tenhaw` last. Its three exact internal dependencies must already be public. Record all four scoped success URLs and verify the metapackage installs from the public registry before the full release.

For each selected project, set `PYTHON_PROJECT` to its exact allowlisted name and use the observed prepare run ID:

```sh
gh workflow run release.yml --ref main -f mode=python-bootstrap -f version=1.0.1 -f python_project="$PYTHON_PROJECT" -f source_run_id="$PREPARE_RUN_ID" -f satellite_sync=owner-cli
```

A bootstrap is an actual publication of that project's complete reviewed release. Its evidence states the selected project and leaves `allPythonProjectsVerified` false. A successful scoped run does not establish a full Python, npm or Kit launch. Each publishing job remains behind the existing protected `release` environment. A prepare success alone does not establish that a pending publisher or npm authentication is ready.

## Publish and verify

After the four Python bootstrap runs and npm account configuration are complete, dispatch **Release** on the same `main` SHA with explicit `mode: release`, the exact reviewed version, `python_project: all`, the original `source_run_id` and a satellite sync mode (`owner-cli` by default; `github-app` only after configuring its repository secrets):

```sh
gh workflow run release.yml --ref main -f mode=release -f version=1.0.1 -f python_project=all -f source_run_id="$PREPARE_RUN_ID" -f satellite_sync=owner-cli
```

The preflight rejects unsupported scopes, a missing or malformed producer ID, a single-project full release, a reused prepare request or `github-app` without both App secrets; only a boolean secret-presence result reaches its shell. The verification job validates and restages the original successful prepare bundle. Independent npm and PyPI jobs each enter the protected `release` environment, download that same immutable artifact and verify all 17 archive hashes and source/producer identity before publication. An npm account or bootstrap failure therefore does not prevent an authorised PyPI operation.

- npm publication uses OIDC and explicit provenance. Before the first upload, all nine tarballs are checked against their source manifests and any immutable existing versions. An existing version is reused only if its registry integrity exactly matches the local tarball. The script then verifies exact versions, tarball hashes, provenance metadata and a fresh `npm audit signatures` installation.
- npm scans accepted uploads before they become publicly installable. Its current guidance describes a typical delay of about five minutes, sometimes 15 minutes or more; a successful upload receipt is not proof of public availability. The publisher uploads all missing archives first, then polls all nine versions together every 30 seconds under one shared 20-minute deadline. Missing versions or pending provenance are retried; hash conflicts and non-404 registry errors fail immediately. Polling never repeats an upload. If the deadline expires, inspect scan/moderation status and use `node scripts/publish.mjs --version 1.0.1 --verify-only` with the original bundle to resume verification without publication. Do not rebuild or republish accepted versions to force visibility. The npm job has a 30-minute outer limit.
- Python preflight validates the exact wheel and sdist metadata for every selected project and rejects an unexpected remote file, hash conflict or yanked release before upload. The PyPI action uses the staged exact distributions with OIDC attestations. Its subsequent verifier requires the complete expected archive set, exact SHA-256 hashes, publish-attestation subjects and the approved repository/workflow/environment identity. Existing identical files support a safe rerun; a different immutable file fails verification. A full release verifies all four projects and records `allPythonProjectsVerified: true` only after they all pass.
- PyPI postverification retries release/attestation HTTP 404s and matching incomplete file lists every 15 seconds under one shared 10-minute deadline across selected projects. Conflicting files or publisher data fail immediately; verification never uploads files.
- In `owner-cli` mode, the App job is intentionally skipped. The workflow records only the verified package release and prints the separate owner CLI command with the exact source commit. Complete and verify the initial satellite sync using that command; it remains required launch work outside the package workflow.
- In `github-app` mode, after both independent package jobs pass their registry verification, the release explicitly calls `sync-satellites.yml`. Each target receives a source snapshot, a standalone lockfile where applicable, public licences, source provenance metadata and an immutable version tag. Templates are flagged as templates. The Gemini manifest version and tag match exactly. Existing identical tagged source snapshots are verified without regenerating their lockfiles. An App sync failure prevents the final GitHub Release job.
- The final job requires both package jobs to succeed and records a GitHub Release pointing to the verified source commit, with satellite status stated according to the selected mode. An intentionally skipped App job in `owner-cli` mode does not block that package release. It does not rely on tag-triggered workflows, because events created with `GITHUB_TOKEN` generally do not start another workflow run.

Evidence is uploaded as the verified-distributions artifact plus independent npm/PyPI evidence artifacts, including `release-bundle.json`, `npm-verification.json`, `pypi-verification.json` and the original packed distributions. The producer's Actions logs retain the full shared checks and clean-install results. A workflow file existing locally does not establish a successful publication. Report only the observed registry versions and successful run URLs.

If publication stops partway through, inspect which exact files are already public. Rerun the selected scope with the same prepare run ID, source SHA and version; the selected Python preflight permits a matching subset while rejecting conflicts, and postverification requires the complete pair. Do not run prepare again to recover a partially published version. If the source needs a fix, use a new reviewed version and new prepare run. Never attempt to overwrite a published version or force-move a satellite release tag. A failure on either registry does not undo or block an independently completed publication to the other registry. In `github-app` mode, satellite failure does not undo completed package publication and the workflow remains failed until that selected step succeeds. In `owner-cli` mode, a local sync failure leaves satellite launch work incomplete even when the package workflow is green; reconcile it with the same immutable source and version before reporting the full launch complete.

## Publish the official MCP registry entry

`registry-publish.yml` is a separate manual workflow through the protected `release` environment. It requires the npm MCP package and the deployed remote endpoint to expose the exact requested version; `/health` must also identify the workflow source commit.

For `com.tenhaw/kit`, serve the public Ed25519 proof at **`https://tenhaw.com/.well-known/mcp-registry-auth`** with a direct 200 response. Store the corresponding 64-character hex seed as protected environment secret `MCP_PRIVATE_KEY`. Set repository variable `MCP_HTTP_AUTH_CONFIGURED=true` only after the live proof is verified. See [the identity record](REGISTRY_IDENTITY.md) for the public body and DNS boundary. The workflow derives the expected public proof from its protected key, fetches the endpoint without following redirects and verifies the exact body before `mcp-publisher login http --domain tenhaw.com --private-key <seed>`. Keep private keys out of chat, repository files and command output. Login output and credential-bearing errors are suppressed; the private key is removed from the child environment, and the ephemeral registry session is removed on completion. The current official publisher requires its in-process signing key as an argument; use a dedicated ephemeral hosted runner and retain the protected environment restriction.

The publisher is pinned to official release `v1.8.9`. Its Linux archive is checked against the verified SHA-256 and its Sigstore bundle before extraction. Update the version, digest and signing identity together when upgrading. A failed or unconfigured HTTP proof gate is a failed required operation, never a simulated registry submission. The workflow validates metadata, publishes, and checks the exact server name and version in the registry response. Domain proof, service DNS and package publication are separate controls.

## Supply chain and measurement

CI includes CodeQL for JavaScript/TypeScript and Python, OpenSSF Scorecard output, dependency audits and pinned Action dependencies. The daily/manual MCP smoke workflow checks real stdio protocol responses and the exact live six-tool remote inventory with synthetic schema-validated calls; an unavailable or mismatched deployment fails the check. Scorecard results stay in the workflow artifact; no external score publication is implied. Dependabot opens update PRs. No automatic merge or direct write to `main` is configured.

`metrics-weekly.yml` records allowlisted public npm/PyPI downloads, repository stars/forks and official registry presence in a downloadable artifact. API failures are unavailable values. Template uses, deployments and unverified gallery counts remain null; forks, install clicks and downloads are not substituted for them. The script does not access analytics accounts, user inputs, repository contents or booking data. Copy a reviewed metrics artifact into `docs/metrics` through a PR when appropriate.

Launch posts and directory submissions remain drafts until explicitly approved. These workflows do not publish posts, contact third parties, submit directory forms or merge third-party pull requests.

## Official references

- [npm trusted publishing, runtime requirements, allowed publish actions and expiry](https://docs.npmjs.com/trusted-publishers/)
- [npm publish-time scanning and availability delays](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/)
- [PyPI pending trusted publishers](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/)
- [PyPI publishers shared across existing projects](https://docs.pypi.org/trusted-publishers/adding-a-publisher/)
- [PyPI pending-publisher identity and conversion](https://github.com/pypi/warehouse/blob/748d62889f7a3f77fc8282682ca77b8cbcf9abdb/warehouse/oidc/models/github.py#L379-L422)
- [GitHub workflow-to-workflow trigger restrictions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [MCP registry automation and publisher verification](https://modelcontextprotocol.io/registry/github-actions)
- [MCP DNS authentication and apex records](https://modelcontextprotocol.io/registry/authentication)
