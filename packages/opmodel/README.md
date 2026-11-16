# @tenhaw/opmodel

Validate teams, OKRs, roadmaps and interactions for internal operating-model tools.

## When to use

- Use this when building an outcome roadmap, OKR register or team topology map.
- Do not use this for automatically prescribing organisational design or claiming affiliation with Team Topologies.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact npm publication before installation.

```sh
npm install @tenhaw/opmodel@1.1.0
```

## Quick start

```ts
import { generateOperatingModel, renderMermaid } from '@tenhaw/opmodel';
const report = generateOperatingModel({ teams: [] });
console.log(renderMermaid(report)); // flowchart LR
```

## API

`generateOperatingModel({teams,okrs?,roadmap?,interactions?,products?})`, `renderMermaid(report)`. Team, OKR, roadmap and interaction schemas are bundled with `@tenhaw/core`. References to missing teams, objectives or platform dependencies fail validation.

## Methodology and sources

Key-result progress is `(current-baseline)/(target-baseline)`, supporting decreasing targets. Identical baseline and target are rejected. Progress is not clamped, so overachievement stays visible. Warnings identify teams over nine people, missing platform support declarations, unowned OKRs and missing roadmap outcomes/owners. These support a conversation and are not prescriptions. Team Topologies source: https://teamtopologies.com/key-concepts. Mermaid uses generated node IDs and escapes labels.

## Built by Tenhaw

Tenhaw is a founder-led UK AI consultancy and venture studio. For expert help applying this, [book an AI readiness audit](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=opmodel#book).
