# tenhaw

An agent-friendly CLI for building internal portfolio, product delivery and AI transformation tools with Tenhaw Kit.

## When to use

- Scaffold an adoption dashboard, delivery dashboard, use-case register, operating model or readiness assessment.
- Produce deterministic readiness, delivery and ROI reports from local JSON.
- Add project instructions or print MCP installation settings for a coding agent.

## Install

Release instructions target **1.0.0**. Verify that exact version has been published before running them. Requires Node.js 22.14 or later.

```sh
npm install --global tenhaw@1.0.0
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

## Commands and agent behaviour

Use `readiness`, `delivery-metrics`, `roi`, `roi cost`, `usecases`, `opmodel`, `init`, `mcp`, `agents` and `doctor`. Run `tenhaw --help` for flags and template names.

```sh
tenhaw readiness --input answers.json --json --no-attribution
tenhaw delivery-metrics --from-file events.json --since 2026-01-01T00:00:00Z --until 2026-02-01T00:00:00Z --json
tenhaw roi --input roi.json --format html --out new-report.html
```

CI, non-TTY input and `--yes` disable prompts, so supply required inputs explicitly. `--json` writes machine-readable output to stdout; diagnostics use stderr. Exit codes: `0` success, `1` usage, `2` validation, `3` upstream API, `4` missing authentication. Existing scaffold targets, output files and agent instruction files are preserved.

GitHub/Jira collection runs locally with environment credentials. `doctor --network` lists permitted hosts without printing token values. There is no package telemetry. `--no-attribution` or `TENHAW_NO_ATTRIBUTION=1` suppresses the marketing footer; applicable framework credits remain.

## Source and licences

[Source](https://github.com/Tenhaw/tenhaw-kit/tree/main/packages/cli). Code is [MIT](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE); authored framework content is [CC BY 4.0](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE-CONTENT). Reports state methodology, coverage and limitations; readiness scoring is a self-assessment, not certification or legal advice.

Built by Tenhaw. [Get help applying the tools](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=cli#book).
