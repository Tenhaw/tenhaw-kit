# tenhaw

An agent-friendly CLI for building internal portfolio, product delivery and AI transformation tools with Tenhaw Kit.

## When to use

- Scaffold an adoption dashboard, delivery dashboard, use-case register, operating model or readiness assessment.
- Produce deterministic readiness, delivery and ROI reports from local JSON.
- Add project instructions or print MCP installation settings for a coding agent.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact npm publication before installation. Requires Node.js 22.14 or later. No Tenhaw API key is required.

The previously verified public release is [1.0.1 on npm](https://www.npmjs.com/package/tenhaw/v/1.0.1), checked on 16 November 2026.

```sh
npm install --global tenhaw@1.1.0
# Or run without a global installation:
npx -y tenhaw@1.1.0 --help
```

## Quick start

```sh
tenhaw readiness --questionnaire --json
tenhaw init product-operating-model my-workspace --yes --json
cd my-workspace
pnpm install
pnpm build
```

The starter includes synthetic examples and browser-local storage. Add authentication and authorisation before implementing shared persistence or hosted collectors.

## One-prompt agent setup

Ask your coding agent to identify its client, configure the pinned `npx -y @tenhaw/mcp@1.1.0` server in the project's documented MCP configuration, preserve existing servers, and verify the eight local tools with a synthetic readiness calculation. Ask for missing GitHub/Jira environment variables only when local collection is requested. The [complete install guide](https://github.com/Tenhaw/tenhaw-kit/blob/main/docs/AGENT_INSTALL.md) includes client paths and acceptance checks.

Version 1.1.0 adds the `setup` command. Once the exact package version has been published and installed, run:

```sh
tenhaw setup --agent codex --directory /path/to/project --json
tenhaw setup --agent codex --directory /path/to/project --yes --verify --json
tenhaw setup --agent codex --directory /path/to/project --check --json
```

Choose `codex`, `claude`, `cursor`, `vscode` or `gemini`. Setup plans by default. `--yes` writes project configuration, `--check` inspects it, and `--verify` smoke-tests the selected MCP server. Defaults are `--transport local --integration none`; use `--transport remote` for the six pure remote tools. Optional local collection uses `--integration github`, `jira` or `github,jira`. The JSON report identifies missing environment variable names and next actions. Existing conflicting definitions are preserved for review.

## Commands and agent behaviour

Use `readiness`, `delivery-metrics`, `roi`, `roi cost`, `usecases`, `opmodel`, `init`, `setup`, `mcp`, `agents` and `doctor`. Run `tenhaw --help` for flags and template names.

```sh
tenhaw readiness --input answers.json --json --no-attribution
tenhaw delivery-metrics --from-file events.json --since 2026-01-01T00:00:00Z --until 2026-02-01T00:00:00Z --json
tenhaw roi --input roi.json --format html --out new-report.html
```

CI, non-TTY input and `--yes` disable prompts, so supply required inputs explicitly. `--json` writes machine-readable output to stdout; diagnostics use stderr. Exit codes: `0` success, `1` usage, `2` validation, `3` upstream API, `4` missing authentication. Existing scaffold targets, output files and agent instruction files are preserved.

GitHub/Jira collection runs locally with environment credentials. GitHub requires `GITHUB_TOKEN`; Jira requires `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN`. Set them in the environment that launches your coding client. Secret values must stay out of chat, command arguments, configuration and logs. `doctor --network` lists permitted hosts without printing token values. There is no package telemetry. `--no-attribution` or `TENHAW_NO_ATTRIBUTION=1` suppresses the marketing footer; applicable framework credits remain.

## Source and licences

[Source](https://github.com/Tenhaw/tenhaw-kit/tree/main/packages/cli). Code is [MIT](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE); authored framework content is [CC BY 4.0](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE-CONTENT). Reports state methodology, coverage and limitations; readiness scoring is a self-assessment, not certification or legal advice.

Built by Tenhaw. [Get help applying the tools](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=cli#book).
