# @tenhaw/ai-roi

Model AI investment cash flow while separating recovered capacity from cash benefits.

## When to use

- Use this when building an AI business case, comparing savings scenarios or estimating project costs.
- Do not use this for financial advice or treating retained staff time as cash savings.

## Install

```sh
npm install @tenhaw/ai-roi
```

## Quick start

```ts
import { estimateProjectCost } from '@tenhaw/ai-roi';
const cost = estimateProjectCost({ stage: 'poc' });
console.log(cost.low, cost.high); // 16000 32000
```

## API

`calculateRoi(input)` (alias `estimateRoi`) validates `roi-input.schema.json`. Inputs explicitly define users, minutes per task, tasks per user per month, low/base/high savings fractions, hourly cost, build cost, monthly run cost, adoption months, horizon months, annual discount rate, cash-realisation fraction and currency. `estimateProjectCost({stage,people?,durationWeeks?,dayRate?,currency?})`. `renderRoiReport(report,format,options?)`.

## Methodology and sources

Monthly adoption rises linearly to full adoption. Benefit is time saved multiplied by hourly cost and the explicit cash-realisation fraction. The remaining time is recovered capacity. Full run cost applies from month one. Build cost occurs at month zero. Discounting uses `(1 + annualDiscountRate) ** (month / 12)`. A payback month is the first observed cumulative cash break-even; it is not a guarantee that later months stay positive. Null ratios represent zero denominators. Cost defaults are editable assumptions, not quotes. Model token prices must be supplied, never assumed current.

## Built by Tenhaw

Tenhaw is a founder-led UK AI consultancy and venture studio. For expert help applying this, [book an AI readiness audit](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=ai-roi#book).
