# Verification evidence

15 November 2026. The merged source snapshot below is `560a8701fd8802907d64d76d7d2e8f85ff656a0b`. Build and runtime evidence is recorded separately from registry and directory publication.

| Check | Observed result |
| --- | --- |
| TypeScript package build and declaration output | Six libraries, CLI, create command and local/remote MCP entries build |
| `pnpm check` | Passed: type checking, 66 tests, 19 schemas, 62 vectors, 42 TypeScript/Python canonical results, plugin checks and copy/credential lint |
| Python | 39 tests, Ruff and strict mypy pass; four sdists and self-contained wheels build and install outside the checkout |
| Packed npm installation | Nine tarballs install together in a clean directory; installed CLI version 1.0.0 and questionnaire load; installed MCP lists eight tools; scaffolded portfolio app builds |
| CLI size | 234,767 bytes unpacked in the merged main CI check, below the 2 MB target |
| Templates | All five production builds/typechecks, 17 template unit checks and 10 actual browser journey checks pass; browser-local import/export examples included |
| Compact docs | Production static build passes; machine-readable schemas, llms files, examples and OpenAPI generated from shared data |
| Remote application | Production build passes; three route traces contain no local collector or scaffolder imports |
| MCP | Actual built stdio protocol lists tools/resources/prompts and calls all pure tools; malformed input, remote local-only tools, oversized requests and unconfigured production protection are rejected |
| Plugin CLIs | Claude 2.1.325 strict plugin and marketplace validation pass; Gemini 0.68.0 extension validation passes with isolated state |
| Claude GitHub installation | Official Claude 2.1.325 added `Tenhaw/tenhaw-kit` and installed enabled `tenhaw@tenhaw-kit` 1.0.0 from the exact merged commit; all seven skills are present. Isolated temporary configuration; no AI request or MCP startup |
| Portable plugin schemas | Official Agent Plugins 1.0.0 manifest/MCP schemas pass; generator stable and no inline credentials |
| Workflow definitions | Eight workflows pass Actionlint 1.7.12 and YAML parsing; pinned Action commits verified against GitHub |
| npm release dry run | Nine tarballs validate; no local dry run claims public publication |
| Dependency audit | Production npm dependency audit reports no known vulnerabilities |
| Website | 28 booking/attribution/discovery/readiness regression checks pass; webpack production build passes for 452 pages; content guard confirms no CSS/components/layout changes |
| Website production | PR12 merged; Vercel production deployment `dpl_BYhYBhgUUDhmrgLK4VqcjrVCsmBt` is READY at exact merge commit `1f47f9c30e90732b786d84574e0536c83c3c9e55` |
| MCP HTTP identity | `https://tenhaw.com/.well-known/mcp-registry-auth` returns direct HTTP200, no redirect, plain UTF-8 text and the exact expected 66-byte public proof; `MCP_HTTP_AUTH_CONFIGURED=true` is confirmed |
| Kit production | [Reference](https://tenhaw-kit-docs.vercel.app/) and [MCP health](https://tenhaw-mcp.vercel.app/health) are READY at the exact merged commit; 28 unauthenticated production checks pass |
| Remote protocol and abuse controls | Six tools, 25 resources, four prompts and seven synthetic schema-validated calls pass; local tools and raw events are rejected, oversized requests return 413 and the final burst produces real 429 responses |

The final 66-test result includes the additional local-only cache/path hardening regression.

All 10 browser journey checks passed locally with Chromium revision 1248 and in [merged main CI](https://github.com/Tenhaw/tenhaw-kit/actions/runs/43759200763) with its official revision 1255. They cover data controls remaining disabled before hydration and local workspace restoration before export for every starter. CodeQL, Scorecard and Python 3.10/3.14 checks also pass on this commit. No separate desktop/mobile visual pass is claimed. Main website Turbopack could not open its local PostCSS worker port in this environment; the supported webpack build passed.

The local npm/Python distributions were refreshed from verified main CI artifact `14179262919`; their manifests and final numeric/hydration guards were checked. Ignored production and Claude-install evidence remains under `artifacts/`. Release workflows build their own immutable distributions from the reviewed commit; a local archive is not publication evidence.

The private registry signing seed is held only in GitHub's protected release environment; its session temporary file has been removed. This key preparation and verified HTTP proof do not imply that a registry entry has been published.

Public npm/PyPI versions and provenance/attestations, custom domains, satellite source/tags and directory submissions remain pending. Consult RUNBOOK.md, RELEASING.md and the prepared directory pack; production on the Vercel addresses does not establish those separate release states.
