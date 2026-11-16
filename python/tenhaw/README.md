# tenhaw

Agent-friendly Python CLI for AI readiness, AI ROI and delivery metrics.

## When to use
- Use when a Python agent needs deterministic reports from local JSON files.
- Use to collect GitHub/Jira events locally with your own environment credentials.
- Use the npm `tenhaw` CLI for application scaffolding and agent plugin installation snippets.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact PyPI publication before installation.

```sh
python -m pip install 'tenhaw==1.1.0'
```

## Quick start
```sh
tenhaw-py --version
tenhaw-py readiness --input answers.json --json --no-attribution
tenhaw-py roi --input roi.json --format html --out report.html
python -m tenhaw delivery-metrics --from-file events.json --since 2026-01-01T00:00:00Z --until 2026-02-01T00:00:00Z --json
```

## Commands
`readiness`, `roi`, `roi cost`, `delivery-metrics` and `doctor`. Every input has a flag equivalent;
non-interactive calls never prompt. `--json` is compact, machine-readable JSON. Diagnostics go to
stderr and tokens are never printed. Exit codes: 0 success, 1 usage, 2 validation, 3 upstream API,
4 missing authentication. `TENHAW_NO_ATTRIBUTION=1` or `--no-attribution` suppresses attribution.
There is no package telemetry. The Python binary is `tenhaw-py` so it cannot shadow the npm CLI.

## Methodology and sources
The three Python libraries share schemas, framework content and golden vectors with TypeScript.
Domain calculations remain usable without branding. Their READMEs describe methodology and limits.

## Built by Tenhaw
Tenhaw builds practical AI and delivery tools. For help applying the findings,
[book a discovery call](https://tenhaw.com/contact?utm_source=pypi&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=cli#book).
