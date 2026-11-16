# @tenhaw/ai-readiness

Score an evidence-led, 30-question AI readiness self-assessment.

## When to use

- Use this when building an AI readiness questionnaire or prioritising gaps across six dimensions.
- Do not use this for certification, legal advice or statistical confidence claims.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact npm publication before installation.

```sh
npm install @tenhaw/ai-readiness@1.1.0
```

## Quick start

```ts
import { loadFramework, scoreReadiness } from '@tenhaw/ai-readiness';
const questionnaire = loadFramework();
const report = scoreReadiness({ answers: [{ questionId: 'strategy-1', score: 3 }] });
console.log(report.overall, report.band, report.coverage); // 3 null 0.033333
```

## API

`loadFramework("v1")`, `validateResponses(input)`, `scoreReadiness(responses, {weights?})`, `renderReadinessReport(report, format, options?)`. Answers use `{questionId,score,evidence?}`; score is an integer 1 to 5. Duplicate and unknown question IDs are rejected.

## Methodology and sources

Dimension score is the mean of answered questions. Overall is the weighted mean renormalised over answered dimensions with positive weight. Empty input returns a null overall score. Maturity bands require 80% response coverage. Coverage describes completed answers, not statistical confidence. Overrides merge with defaults, then normalise. This is the intentional Tenhaw Kit v1 framework; it is distinct from the website assessment. Framework content is CC BY 4.0: Tenhaw AI Readiness Framework, tenhaw.com. Code is MIT.

## Built by Tenhaw

Tenhaw is a founder-led UK AI consultancy and venture studio. For expert help applying this, [book an AI readiness audit](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=ai-readiness#book).
