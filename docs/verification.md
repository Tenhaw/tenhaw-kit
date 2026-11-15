# Verification evidence

15 November 2026. Build and test evidence is recorded separately from the observed live website and identity proof. Registry and directory publication require their own verification.

| Check | Observed result |
| --- | --- |
| TypeScript package build and declaration output | Six libraries, CLI, create command and local/remote MCP entries build |
| `pnpm check` | Passed: type checking, 66 tests, 19 schemas, 62 vectors, 42 TypeScript/Python canonical results, plugin checks and copy/credential lint |
| Python | 39 tests, Ruff and strict mypy pass; four sdists and self-contained wheels build and install outside the checkout |
| Packed npm installation | Nine tarballs install together in a clean directory; installed CLI version 1.0.0 and questionnaire load; installed MCP lists eight tools; scaffolded portfolio app builds |
| CLI size | 225,206 bytes unpacked in the clean-package check, below the 2 MB target |
| Templates | All five production builds/typechecks, 17 template unit checks and 10 actual browser journey checks pass; browser-local import/export examples included |
| Compact docs | Production static build passes; machine-readable schemas, llms files, examples and OpenAPI generated from shared data |
| Remote application | Production build passes; three route traces contain no local collector or scaffolder imports |
| MCP | Actual built stdio protocol lists tools/resources/prompts and calls all pure tools; malformed input, remote local-only tools, oversized requests and unconfigured production protection are rejected |
| Plugin CLIs | Claude 2.1.325 strict plugin and marketplace validation pass; Gemini 0.68.0 extension validation passes with isolated state |
| Portable plugin schemas | Official Agent Plugins 1.0.0 manifest/MCP schemas pass; generator stable and no inline credentials |
| Workflow definitions | Eight workflows pass Actionlint 1.7.12 and YAML parsing; pinned Action commits verified against GitHub |
| npm release dry run | Nine tarballs validate; no local dry run claims public publication |
| Dependency audit | Production npm dependency audit reports no known vulnerabilities |
| Website | 28 booking/attribution/discovery/readiness regression checks pass; webpack production build passes for 452 pages; content guard confirms no CSS/components/layout changes |
| Website production | PR12 merged; Vercel production deployment `dpl_BYhYBhgUUDhmrgLK4VqcjrVCsmBt` is READY at exact merge commit `1f47f9c30e90732b786d84574e0536c83c3c9e55` |
| MCP HTTP identity | `https://tenhaw.com/.well-known/mcp-registry-auth` returns direct HTTP200, no redirect, plain UTF-8 text and the exact expected 66-byte public proof; `MCP_HTTP_AUTH_CONFIGURED=true` is confirmed |

The final 66-test result includes the additional local-only cache/path hardening regression.

All 10 browser journey checks passed with the existing Chromium revision 1248. They cover data controls remaining disabled before hydration and local workspace restoration before export, for each of the five starters. CI must still confirm the same checks with its configured Playwright Chromium revision 1255. Desktop/mobile visual inspection remains unverified because the computer-use browser host was unavailable. Main website Turbopack could not open its local PostCSS worker port in this environment; the supported webpack build passed.

The private registry signing seed is held only in GitHub's protected release environment; its session temporary file has been removed. This key preparation and verified HTTP proof do not imply that a registry entry has been published.

Public npm/PyPI versions, exact provenance/attestations, custom domains, live rate limiting, satellite repositories and directory submissions require their own live verification. Consult RUNBOOK.md and RELEASING.md; code generation and local validation alone do not establish any of those states.
