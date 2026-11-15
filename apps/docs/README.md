# Tenhaw Kit reference

Compact install and API reference for agents and engineers. The machine-readable files carry the full schemas and readiness question bank; the HTML pages stay short.

```sh
pnpm --filter @tenhaw-app/docs dev
pnpm --filter @tenhaw-app/docs build
```

The build copies JSON Schemas from `spec/schemas`, then generates llms.txt, llms-full.txt, OpenAPI, examples, sitemap and robots.txt. HTML references use the same tool catalogue in `lib/reference.json`. No analytics, customer data collection or remote credentials ship in this app.

Deploy the `apps/docs` root as a Vercel project with Node.js 22.14+; the build exports static files to `out`. Deployment and registry release status must be verified separately before announcing install commands as available.

Next.js is used without Fumadocs to keep the agent-first reference small. Code blocks are plain selectable text. The main tenhaw.com website does not inherit these routes or styles.
