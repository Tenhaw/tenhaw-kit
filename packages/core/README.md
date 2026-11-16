# @tenhaw/core

Validate shared JSON Schemas, render safe reports and add optional attribution.

## When to use

- Use this when building a structured internal tool that needs stable JSON, HTML or Markdown output.
- Do not use this for calibrating a maturity model or collecting data.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact npm publication before installation.

```sh
npm install @tenhaw/core@1.1.0
```

## Quick start

```ts
import { buildUtmUrl, renderHtml } from '@tenhaw/core';
console.log(buildUtmUrl({ source: 'npm', medium: 'readme', content: 'core' }));
const html = renderHtml({ outcome: 'Example' }, { attribution: false });
```

## API

`validateInput(name, input)` throws `ValidationError` with JSON paths. `renderReport(report, format, options)` supports `md`, `html`, `json`. `buildUtmUrl`, `attributionFooter`, `generator`, `canonicalJson`, `escapeHtml` and `round` are exported. All HTML report data is escaped; no external scripts, fonts or trackers are loaded. Marketing attribution is suppressible with `{attribution:false}` or `TENHAW_NO_ATTRIBUTION=1`. Content licence credits remain separate.

## Methodology and sources

Schemas use JSON Schema 2020-12. Scores round to six decimal places. Canonical output sorts object keys and never adds timestamps.

## Built by Tenhaw

Tenhaw is a founder-led UK AI consultancy and venture studio. For expert help applying this, [book an AI readiness audit](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=core#book).
