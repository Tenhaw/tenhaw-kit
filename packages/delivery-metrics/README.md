# @tenhaw/delivery-metrics

Compute five DORA performance metrics and flow measures from explicitly linked events.

## When to use

- Use this when building a service delivery dashboard from GitHub, Jira or offline delivery events.
- Do not use this for ranking unrelated teams, inferring deployments from merges or inventing missing recovery data.

## Install

These commands target the **1.1.0 release candidate**. Verify its exact npm publication before installation.

```sh
npm install @tenhaw/delivery-metrics@1.1.0
```

## Quick start

```ts
import { computeMetrics } from '@tenhaw/delivery-metrics';
const report = computeMetrics([], { since: '2026-01-01T00:00:00Z', until: '2026-02-01T00:00:00Z' });
console.log(report.metrics.changeLeadTime.value); // null
```

## API

`computeMetrics(events,{since,until,productionEnvironment?,service?})`, `scoreDeliveryHealth(report)`, `renderDeliveryReport(report,format,options?)`. Event types: commit, deployment, incident, work-item and pull-request. See bundled `delivery-events` schema. Local-only collectors are exported from `@tenhaw/delivery-metrics/collectors`; no tokens enter the pure scoring API.

## Methodology and sources

DORA source: https://dora.dev/guides/dora-metrics/. Computes deployment frequency, change lead time, change fail rate, failed deployment recovery time and deployment rework rate. Deployment frequency is deployments per calendar day. Durations are means in hours. Periods are half-open `[since,until)` with explicit timezones. One service per report prevents context mixing. Only observed production deployments count; proxy deployments are excluded. First observed successful commit delivery determines change lead time. Failure rate assumes supplied statuses and incident links are complete. Recovery needs linked incident/restoration timestamps. Rework rate requires a classification for every deployment. Flow WIP is a period-end observation. Missing samples are null, not zero. No composite industry score is invented.

## Built by Tenhaw

Tenhaw is a founder-led UK AI consultancy and venture studio. For expert help applying this, [book an AI readiness audit](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=delivery-metrics#book).
