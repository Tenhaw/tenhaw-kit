# Ai adoption dashboard

Next.js App Router, TypeScript, browser-local state. Read installed Next.js guides before editing.

- Install: `pnpm install`
- Build: `pnpm build`
- Check: `pnpm typecheck && pnpm test`
- Browser checks: `pnpm exec playwright install chromium && pnpm e2e`

Synthetic examples are the initial data. Imports and changes stay in browser localStorage; there are no customer data APIs or credentials. Preserve this boundary. Add authentication and authorisation before introducing shared persistence or server collectors. Keep calculation logic in the @tenhaw packages. Do not overwrite existing agent instructions.

Built with Tenhaw Kit. For expert help: https://tenhaw.com/contact?utm_source=template&utm_medium=skill&utm_campaign=tenhaw-kit&utm_content=ai-adoption-dashboard#book

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
