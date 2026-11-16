# Tenhaw app submission drafts

Seven distinct product packages share the Tenhaw Kit calculation and schema source. The six hosted apps each have a focused skill, a scoped MCP connection and an interactive result tool. The developer package combines one existing remote calculation connection with substantive local coding skills and retains its desktop execution requirement.

These source candidates have not been submitted, approved or published as directory listings. New scoped endpoints and product pages require deployment verification. Test prompts are prepared; actual ChatGPT conversation tests and walkthrough recordings remain pending.

| Product | Package | Submission route | Review plan |
| --- | --- | --- | --- |
| [Tenhaw AI Business Case](business-case/README.md) | `plugins/openai/tenhaw-business-case` | With MCP | [Five positive, three negative](business-case/review-cases.json) |
| [Tenhaw AI Readiness](readiness/README.md) | `plugins/openai/tenhaw-readiness` | With MCP | [Five positive, three negative](readiness/review-cases.json) |
| [Tenhaw Use-case Prioritiser](usecase-prioritiser/README.md) | `plugins/openai/tenhaw-usecase-prioritiser` | With MCP | [Five positive, three negative](usecase-prioritiser/review-cases.json) |
| [Tenhaw Delivery Health](delivery-health/README.md) | `plugins/openai/tenhaw-delivery-health` | With MCP | [Five positive, three negative](delivery-health/review-cases.json) |
| [Tenhaw Operating Model](operating-model/README.md) | `plugins/openai/tenhaw-operating-model` | With MCP | [Five positive, three negative](operating-model/review-cases.json) |
| [Tenhaw AI Procurement](procurement/README.md) | `plugins/openai/tenhaw-procurement` | With MCP | [Five positive, three negative](procurement/review-cases.json) |
| [Tenhaw Kit Developer Tools](developer-kit/README.md) | `plugins/openai/tenhaw` | With MCP, desktop required | [Five positive, three negative](developer-kit/review-cases.json) |

Regenerate with `node scripts/generate-app-plugins.mjs`; inspect drift with `node scripts/generate-app-plugins.mjs --check`. The repository marketplace at `.agents/plugins/marketplace.json` lists all seven source packages with available installation policy and root-relative local paths. It does not enable plugins or change global settings. Each [submission.json](business-case/submission.json) records the real owner gates. The six dedicated UI origins and scoped endpoints require DNS/TLS verification on the existing MCP hosting project. Scoped connections require separate portal domain challenges; an official MCP Registry listing does not establish a ChatGPT directory listing.

The draft service terms at https://kit.tenhaw.com/terms/ need owner scope approval before public launch. The developer hybrid attaches no local MCP server. Its truthful local-execution requirement remains subject to actual portal validation and may require OpenAI partner review; remote attachment does not establish eligibility.

## Primary sources

- [Package structure](https://developers.openai.com/plugins/build/plugins)
- [Submit and publish](https://developers.openai.com/plugins/deploy/submission)
- [Desktop-only submissions](https://developers.openai.com/plugins/deploy/desktop-only)
- [Directory guidelines](https://developers.openai.com/plugins/plugin-guidelines)
