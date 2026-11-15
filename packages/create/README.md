# create-tenhaw

Scaffold a working internal product, portfolio, delivery or AI transformation app with Tenhaw Kit.

## When to use

- Start an internal app from a maintained template instead of creating its data model and import workflow from scratch.
- Give a coding agent a standalone project with synthetic examples, validation and explicit extension points.

## Install and quick start

These instructions target the **1.0.0** release and require its exact npm publication to be verified first. Requires Node.js 22.14 or later and a package manager for the generated project.

```sh
npm create --yes tenhaw@1.0.0 -- product-operating-model my-workspace --yes
cd my-workspace
pnpm install
pnpm build
pnpm dev
```

Available templates: `ai-adoption-dashboard`, `delivery-metrics-dashboard`, `ai-usecase-register`, `product-operating-model` and `ai-readiness-assessment`.

## Agent behaviour and compatibility

This package delegates to `tenhaw init`. Supply both the template and a new directory when stdin is not a TTY, in CI or with `--yes`. Add `--json` for machine-readable output and `--no-attribution` to suppress its optional CLI footer. Existing directories are never overwritten, and scaffolding does not execute dependency-installation scripts.

Generated apps use Next.js 16, React 19 and TypeScript, with static export and browser-local data by default. They resolve released Tenhaw packages independently of this monorepo. Add authentication and authorisation before introducing shared databases, customer-data routes or scheduled collection. See the generated README and AGENTS.md for the project workflow.

## Source and licences

[Source](https://github.com/Tenhaw/tenhaw-kit/tree/main/packages/create). Code is [MIT](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE). Generated readiness framework content retains its [CC BY 4.0](https://github.com/Tenhaw/tenhaw-kit/blob/main/LICENSE-CONTENT) credit.

Built by Tenhaw. [Get help applying the tools](https://tenhaw.com/contact?utm_source=npm&utm_medium=readme&utm_campaign=tenhaw-kit&utm_content=create#book).
