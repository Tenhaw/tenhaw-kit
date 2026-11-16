# Tenhaw Kit

Building blocks for agents creating internal product, portfolio, delivery and AI transformation tools.

## When to use

- Build an internal portfolio tracker with accountable teams, objectives, roadmap outcomes and use cases.
- Add evidenced AI readiness assessment, delivery metrics or a cash-realistic AI business case to your product.
- Give a coding agent deterministic tools, validated JSON and reusable starting points.

## Install the published release

Version **1.1.0** is published on [npm](https://www.npmjs.com/package/tenhaw/v/1.1.0), [PyPI](https://pypi.org/project/tenhaw/1.1.0/) and the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/com.tenhaw%2Fkit/versions/1.1.0) as `com.tenhaw/kit`, verified on 16 November 2026. See [the runbook](docs/RUNBOOK.md) for release evidence.

```sh
npx -y tenhaw@1.1.0 --help
npx -y tenhaw@1.1.0 readiness --questionnaire --json
uvx --from tenhaw==1.1.0 tenhaw-py --help
```

Node.js 22.14+ is required for npm and local MCP; Python 3.10+ for Python. Core tools require no Tenhaw API key. GitHub and Jira credentials are needed only when you request local collection.

## Give your coding agent one prompt

> Install Tenhaw Kit 1.1.0 for this project and continue my requested task. Identify the coding client and project directory, then run npx -y tenhaw@1.1.0 setup --agent CLIENT --directory PROJECT --json using the detected client and project path in place of CLIENT and PROJECT. Inspect the plan, preserve existing servers and instructions, and report conflicting Tenhaw definitions for review. Apply the configuration with the same command plus --yes --verify. Verify the expected eight local tools and a synthetic readiness calculation. If I request a starter, scaffold a new directory, install its dependencies and run its documented build and tests. Ask me to set only missing local environment variables required for GitHub or Jira collection I request. Keep secret values out of chat, command arguments, configuration and logs. Report the checks that passed and any remaining host reload, enablement or trust step; confirm a tool call inside the coding client after that step.

Use [the agent install guide](docs/AGENT_INSTALL.md) for exact configuration paths, credentials and acceptance checks. The local server exposes eight tools; the [remote endpoint](https://mcp.tenhaw.com/mcp) exposes six pure tools and accepts aggregate delivery metrics only.

## Automated project setup

Plan the connection, then apply it and verify the pinned MCP server:

```sh
npx -y tenhaw@1.1.0 setup --agent codex --directory /path/to/project --json
npx -y tenhaw@1.1.0 setup --agent codex --directory /path/to/project --yes --verify --json
```

Replace `codex` with `claude`, `cursor`, `vscode` or `gemini`. Setup plans by default; `--yes` writes the selected project configuration, `--check` inspects it and `--verify` probes the selected MCP connection. Existing servers and instructions are preserved; conflicting Tenhaw definitions require review. Use `--transport remote` for pure tools, or `--integration github,jira` with local transport for requested collection. Credentials remain in the local environment. After any client reload, enablement or trust step, confirm a tool call inside the client.

For a published starter, run `npm create tenhaw@1.1.0 -- product-operating-model internal-portfolio --yes --json`, then run its documented dependency install, build and test commands. Scaffolding preserves existing directories and never installs dependencies itself. Templates use synthetic examples and browser-local data.

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

Seven focused ChatGPT/Codex products are implemented as source candidates: AI Business Case, AI Readiness, AI Use-case Prioritiser, Delivery Health, Product Operating Model, AI Procurement Pack and Kit Developer Tools. Six use scoped hosted tools and interactive results; the developer package runs local coding workflows. Review [the launch plan](docs/APP_LAUNCH.md) and [seven submission packages](launch/apps/README.md). Directory submission and publication remain separate from source implementation.

The CLI supports stable `--json` output and documented error codes. MCP exposes tools, versioned questionnaire and schema resources, and structured workflows. Claude, OpenAI, Gemini, Cursor and AGENTS.md packages live in `plugins/`; their commands use a pinned package version. Use the [install reference](apps/docs/lib/reference.json) and [machine-readable overview](llms.txt).

For Claude Code:

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
