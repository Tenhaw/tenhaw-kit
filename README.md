# Tenhaw Kit

Building blocks for agents creating internal product, portfolio, delivery and AI transformation tools.

## When to use

- Build an internal portfolio tracker with accountable teams, objectives, roadmap outcomes and use cases.
- Add evidenced AI readiness assessment, delivery metrics or a cash-realistic AI business case to your product.
- Give a coding agent deterministic tools, validated JSON and reusable starting points.

## Start from source

This checkout is a release candidate. Public package and domain availability is verified separately in [the runbook](docs/RUNBOOK.md); source implementation does not imply publication.

```sh
corepack pnpm install
corepack pnpm build
node packages/cli/dist/index.js readiness --questionnaire --json
node packages/cli/dist/index.js init product-operating-model internal-portfolio --yes --json
```

Node 22.14+ is required. Scaffolding never installs dependencies or overwrites an existing directory. The templates use clearly synthetic examples and browser-local data.

After the verified public release, use `npx tenhaw@1.0.1 --help`, `npm create tenhaw@1.0.1 -- <template> <new-directory>`, or `npx @tenhaw/mcp@1.0.1` for local MCP. The local server exposes eight tools; the remote server exposes six pure tools and accepts aggregate delivery metrics only.

## Compose the packages

| Package | Add to your internal product |
| --- | --- |
| `@tenhaw/ai-readiness` | A 30-question self-assessment with explicit evidence, weights and response coverage |
| `@tenhaw/delivery-metrics` | Five DORA metrics and flow measures from linked production and work events |
| `@tenhaw/ai-roi` | Cash flow, NPV, payback, capacity and sensitivity cases |
| `@tenhaw/usecase-register` | Value and feasibility priorities with governance gates |
| `@tenhaw/opmodel` | OKRs, roadmaps, ownership checks and team interactions |
| `@tenhaw/core` | Shared schemas, report rendering and optional attribution |

The Python workspace provides readiness, delivery and ROI libraries plus `tenhaw-py`. Shared vectors compare canonical TypeScript and Python output byte for byte.

## Agent interfaces

The CLI supports stable `--json` output and documented error codes. MCP exposes tools, versioned questionnaire and schema resources, and structured workflows. Claude, OpenAI, Gemini, Cursor and AGENTS.md packages live in `plugins/`; their commands use a pinned package version. Use the [install reference](apps/docs/lib/reference.json) and [machine-readable overview](llms.txt).

For Claude Code, after the verified public release:

```sh
claude plugin marketplace add Tenhaw/tenhaw-kit
claude plugin install tenhaw@tenhaw-kit
```

Or run `/plugin install tenhaw --marketplace Tenhaw/tenhaw-kit` inside Claude Code.

## Methodology and data

Readiness scores are an internal self-assessment framework, separate from Tenhaw's workflow-based advisory audit. Bands require at least 80% response coverage. DORA values require production evidence; missing data remains unavailable. Saved effort is capacity until a cash-realisation assumption identifies actual cost removal. Governance labels are indicative, not legal advice or certification.

Pure package calculations are offline. GitHub and Jira collection happens locally with environment credentials. The remote service never accepts tokens or raw repository events. No package, CLI or MCP usage telemetry is included. Shared persistence and hosted collection are extension points that require an explicit access-control design.

## Verify

```sh
pnpm check
uv sync
uv run pytest
uv run ruff check
uv run mypy
pnpm build:apps
pnpm build:templates
pnpm pack:check
```

## Licence

Code is MIT. Authored framework content is CC BY 4.0. Marketing footers are suppressible with `--no-attribution` or `TENHAW_NO_ATTRIBUTION=1`; applicable framework-content credits remain. Numerical outputs and your evidence remain yours.

## Built by Tenhaw

Tenhaw is a UK AI consultancy and AI delivery partner. For expert help applying these tools, [book a conversation](https://tenhaw.com/contact?utm_source=github&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=kit#book).
