# @tenhaw/mcp

MCP tools for coding agents building internal portfolio, product delivery and AI transformation apps.

## When to use

- Connect an agent to deterministic readiness, delivery, ROI, register and operating-model calculations.
- Collect GitHub/Jira events or scaffold an internal app locally when the user requests it.
- Use the remote surface for pure calculations over deliberately supplied inputs.

## Install and quick start

Release instructions target **1.0.1**; verify its exact npm publication before installation. Requires Node.js 22.14 or later. Hosted endpoint availability is verified separately.

```sh
# Codex CLI
codex mcp add tenhaw -- npx -y @tenhaw/mcp@1.0.1
# Claude Code
claude mcp add tenhaw -- npx -y @tenhaw/mcp@1.0.1
```

The local executable is `tenhaw-mcp`, or `npx -y @tenhaw/mcp@1.0.1`. It serves MCP over stdio with protocol messages on stdout. The configured remote address is `https://mcp.tenhaw.com/mcp`, using Streamable HTTP.

## Tools and data boundaries

| Tool | Local stdio | Remote HTTP |
| --- | --- | --- |
| `assess_ai_readiness` | Yes | Yes |
| `score_delivery_health` | Yes | Yes, aggregate report only |
| `estimate_ai_roi` | Yes | Yes |
| `estimate_ai_project_cost` | Yes | Yes |
| `generate_usecase_register` | Yes | Yes |
| `generate_operating_model` | Yes | Yes |
| `collect_delivery_events` | Yes | No |
| `scaffold_internal_tool` | Yes | No |

Local delivery scoring accepts events with an explicit period and a service selector when multiple services are present, or a computed report. Remote delivery scoring accepts a computed aggregate report under `metrics`; raw repository events and credential parameters are rejected. Collectors use local environment credentials and write normalised events inside the workspace. Scaffolding requires a new relative workspace directory. Neither collector nor scaffolder is registered remotely.

Inputs and structured outputs follow shared JSON Schemas. Readiness supports `{"mode":"questionnaire"}` to fetch its versioned questions. Resources expose the framework, schemas and methodology; prompts guide readiness reviews, delivery reviews, business cases and operating-model design. There is no package or MCP telemetry. Set `TENHAW_NO_ATTRIBUTION=1` to suppress optional promotional output; framework-content credits remain.

## Source and licences

[Source](https://github.com/Tenhaw/tenhaw-kit/tree/main/packages/mcp). Code is [MIT](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE); authored framework content is [CC BY 4.0](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE-CONTENT). Assessments support decisions and do not certify compliance or provide legal advice.

Built by Tenhaw. [Get help applying the tools](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=mcp#book).
