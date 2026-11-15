# Ai readiness assessment

A working internal tool starter from Tenhaw Kit. Synthetic examples are included. Your imports and edits stay in browser localStorage.

## When to use

Use this when building an internal ai readiness assessment. Start locally, inspect the sample model and replace it with your own imported data. Add authenticated shared persistence only when you need collaboration across users.

## Run

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm typecheck
```

Inside the Tenhaw Kit monorepo, first run the root library build. A scaffolded copy resolves released @tenhaw packages instead of workspace links. Publication must be verified separately; source builds do not prove registry availability.

## Data and calculations

JSON is `{ "answers": [{ "questionId": "strategy-1", "score": 3, "evidence": "optional" }] }`. Thirty questions across six dimensions. Missing questions are excluded and coverage is shown. Maturity bands require at least 80% coverage. HTML report export and Print / PDF are available.

See `lib/model.ts` for the example and import validation. Calculation rules live in the @tenhaw packages; shared JSON Schemas and golden vectors live in the Tenhaw Kit source repository.

Files up to 2 MB are accepted. CSV and delivery-event imports are capped at 10,000 rows; domain schema limits also apply. JSON export preserves the input model. CSV exports protect text cells against spreadsheet formula injection. Browser storage can be unavailable or full; keep an exported JSON backup before clearing storage, changing origin or changing devices.

## Deploy

The Next.js build uses static export (`out/`). There is no API endpoint or shared database receiving the imported data. Deploy static output anywhere, including Vercel. The starter contains no credential fields, token collection, scheduled collectors or telemetry.

[Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FTenhaw%2Ftemplate-ai-readiness-assessment&project-name=ai-readiness-assessment) requires the public satellite repository to have been published. A local build does not verify that external release.

## Extend with authentication and a database

Before adding server persistence, remove static export and implement authentication plus authorisation for every read, write, import and export route. Auth.js can supply the session, but checking a session alone does not define who may access each record. Protect production deployments as well as previews.

A database is deliberately not included in this browser-local baseline. For collaboration, add Drizzle with an explicit SQLite or PostgreSQL schema and dialect-specific migrations, then write a one-time import from the exported JSON. Setting DATABASE_URL alone does not switch database dialects. Keep credentials server-side and out of NEXT_PUBLIC variables.

Run GitHub/Jira collectors locally with your read-only environment tokens and import their output. Do not add hosted collection until access control and credential storage are implemented and tested.

## Check the browser workflow

```sh
pnpm exec playwright install chromium
pnpm e2e
```

The browser test opens the synthetic workspace and verifies JSON export. Unit tests cover meaningful import and calculation boundaries. No live source-system tokens are needed.

## Licence and attribution

Code: MIT. The bundled readiness framework content remains CC BY 4.0 where used. Set `NEXT_PUBLIC_TENHAW_ATTRIBUTION=false` before building to remove the optional marketing footer; applicable licence notices remain.

Built with Tenhaw Kit. [Get expert help applying this](https://tenhaw.com/contact?utm_source=template&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=ai-readiness-assessment#book).
