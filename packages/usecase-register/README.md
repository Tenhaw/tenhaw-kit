# @tenhaw/usecase-register

Prioritise a validated AI use-case register with explicit governance gates.

## When to use

- Use this when building an AI programme register, value/feasibility matrix or governed portfolio.
- Do not use this for automatically approving high-risk or prohibited applications.

## Install

```sh
npm install @tenhaw/usecase-register
```

## Quick start

```ts
import { prioritiseUseCases, exportRegister } from '@tenhaw/usecase-register';
const register = prioritiseUseCases({ useCases: [] });
console.log(exportRegister(register, 'json'));
```

## API

`prioritiseUseCases({useCases})` (alias `generateUsecaseRegister`), `exportRegister(report,"json"|"csv"|"md")`, `exportCsv(input)`, `parseRegisterCsv(csv)`. CSV supports quoted multiline text and structured JSON cells; potentially executable spreadsheet cells are neutralised.

## Methodology and sources

Priority = value (0 to 5) multiplied by feasibility (0 to 5). Governance gates take precedence: prohibited uses are blocked; high and unknown risk require review; other use cases follow standard review. Ties resolve by ID. Risk labels are indicative, not legal advice. Transparency and high-risk obligations can overlap. EU AI Act source: https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai. Dependencies must reference other use cases in the same register.

## Built by Tenhaw

Tenhaw is a founder-led UK AI consultancy and venture studio. For expert help applying this, [book an AI readiness audit](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=usecase-register#book).
