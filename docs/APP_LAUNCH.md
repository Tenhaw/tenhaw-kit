# Seven Tenhaw products

The seven product definitions live in `spec/content/app-products.json`. Six hosted apps use the existing calculation packages and one vendor-neutral procurement engine. The developer product combines the existing public remote calculation tools with local coding workflows and retains its desktop execution requirement.

## Implemented source

| Product | Hosted scope | Main capability |
| --- | --- | --- |
| AI Business Case | `/mcp/apps/business-case` | Low/base/high cash flow, capacity, NPV, payback and editable project costing |
| AI Readiness Assessment | `/mcp/apps/readiness` | Versioned questionnaire, explicit answers, evidence and coverage |
| AI Use-case Prioritiser | `/mcp/apps/usecase-prioritiser` | Accountable register, value/feasibility and governance gates |
| Delivery Health | `/mcp/apps/delivery-health` | Review one service's aggregate DORA and flow evidence |
| Product Operating Model | `/mcp/apps/operating-model` | Team, OKR and roadmap ownership checks and interactions |
| AI Procurement Pack | `/mcp/apps/procurement` | Buyer brief, supplier questions, must-haves, evidence rubric and editable Word export |
| Kit Developer Tools | `/mcp` and local desktop skills | Calculate and validate project inputs, scaffold and build internal tools, compose libraries and collect requested source events locally |

`packages/mcp/src/apps.ts` enforces each hosted tool allowlist. Each app has independently exposed data operations and one `show_*` operation. The show operation validates the same inputs and recalculates the authoritative result before attaching its versioned MCP Apps UI resource. The original `/mcp` six-tool remote interface and eight-tool local interface retain their existing inventories.

Each hosted product uses its own `https://<scope>.apps.tenhaw.com` origin for the UI and scoped MCP URL. The current OpenAI UI reference requires a unique dedicated origin per submitted plugin. These six domain aliases target the same existing MCP project. They also allow six independent portal ownership proofs without replacing another product's token. The canonical origins and URLs are recorded in the product catalogue.

The interfaces use the standard MCP Apps `ui/*` bridge. Inputs and exports stay within the connected task; no application workspace or usage telemetry is added. Procurement Word bytes are returned in tool-result `_meta`, outside model-visible structured output. Supplier scores start blank and remain unassessed until a reviewer supplies evidence. Hosted delivery never accepts raw repository events or customer credentials.

The developer plugin uses `requires_local_executor: true` and attaches the existing six-tool remote `/mcp` connection. Its skills use those calculations to prepare and validate inputs for local project integration. The hosted MCP transport omits promotional generator fields and report footers; applicable framework content credits remain. Scaffolding, builds and source-system collection still execute locally. The public package contains no stdio MCP server. Public local-MCP submissions have a separate partner eligibility requirement.

The portal currently blocks new skills-only submissions. Adding MCP to an existing skills-only draft is also unsupported, so the MCP-backed developer candidate uses a new `tenhaw-developer-tools` initial package. Its desktop requirement remains explicit. A successful upload is separate from eligibility and review; OpenAI may still require partner review for workflows whose core value requires local execution. Retain the original blocked draft as historical evidence until its owner decides whether to remove it.

## Reviewable packages

```sh
node scripts/generate-plugins.mjs
node scripts/generate-app-plugins.mjs --check
pnpm check
pnpm build:apps
node scripts/package-apps.mjs
```

The packager writes seven upload ZIPs, an archive inventory/hash manifest and one combined handover archive in `artifacts/`. Each upload ZIP starts at `plugin.json`, includes licences and icon assets, and contains only the product's declared skills and MCP configuration. Draft submission fields and five positive plus three negative reviewer cases per product are under `launch/apps/`.

Local protocol, calculation, UI and packaging checks are evidence of those checks. They do not establish a ChatGPT conversation review, a portal submission or a public listing. Record those outcomes separately against the exact source and archive hashes.

## Deployment and publishing sequence

1. Review the source branch, unified release version, seven packages, draft hosted-service terms and privacy scope through the repository's normal pull-request process.
2. Merge through the existing protected-main process. Prepare and publish exact npm/PyPI distributions using `RELEASING.md`. Keep public installation metadata on its last verified release until the new registry readbacks and public installs pass.
3. Use the existing `tenhaw-mcp` and `tenhaw-kit-docs` projects. Add and verify the six product hostname aliases from the catalogue on the existing MCP project, including DNS and TLS. All six profiles share that backend; no additional hosting project is needed by this design. Verify the Kit-only budget through the existing report before launch.
4. Expand and verify the native request-limit rule for `/mcp/apps/*` as well as the existing interfaces. Only after that readback, set `TENHAW_APPS_RATE_LIMIT_CONFIGURED=true`. Production app requests fail closed without this flag when native Vercel limiting is selected. Keep the 256 KB body cap and origin allowlist.
5. Check the exact deployed source/version, all six scoped inventories, each UI resource, a real calculation, Word export, invalid inputs, unknown products and request limiting. Check the seven product pages, privacy and owner-approved service terms. Preserve the legacy MCP inventory checks.
6. Confirm the owning OpenAI organisation/project and verified publisher identity. Upload the seven exact ZIPs as six focused MCP products and one developer product with a remote MCP connection and desktop skills. Review portal findings before completing the MCP connections. Do not convert the existing skills-only developer draft or remove its truthful local-executor flag.
7. Serve only the exact domain challenge issued by each portal connection. `TENHAW_APP_DOMAIN_CHALLENGES` maps product IDs to their portal-issued public tokens; the well-known route returns only the matching product's token on its exact hostname. The developer connection uses the existing `mcp.tenhaw.com` hostname and its own `developer-kit` token. Verify each permitted challenge origin in the actual portal. Never replace another product's proof. Resolve and record this before fixing the public endpoint URL, because the current portal update flow does not support changing an existing MCP URL.
8. Install the draft products in ChatGPT and run all five positive and three negative conversation cases for each product. Retain actual tool selection, output and fallback behaviour. Record real walkthroughs and supply accessible URLs. Browser tests with a mock host remain separately labelled UI tests.
9. Ask the owner to review policy attestations at submission time. Submit only the verified package and test materials. After OpenAI approval, publish and read back each exact public listing. Keep a per-product record; one approval does not establish the other six.

Do not create customer accounts, collect API keys, add commercial checkout or enable hosted collection as part of this release. Those capabilities have no implementation or data-access design in these products.

## Primary references

- [Plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [UI metadata and dedicated origins](https://developers.openai.com/plugins/reference)
- [Submission and review](https://developers.openai.com/plugins/deploy/submission)
- [Desktop-only distribution](https://developers.openai.com/plugins/deploy/desktop-only)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
