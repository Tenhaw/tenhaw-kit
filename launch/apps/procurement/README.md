# Tenhaw AI Procurement submission draft

Source candidate 1.1.0. This is prepared material, not an uploaded, approved or published directory listing.

Prepare a vendor-neutral AI procurement pack from a defined buying brief. Select evidence questions, must-have criteria and blank supplier response worksheets. Sector prompts support the buyer's own review. No supplier claims, prices, rankings, legal advice or procurement approval are invented.

- Package: `plugins/openai/tenhaw-procurement`.
- Audience: Procurement, technology and risk teams preparing a defined AI supplier evaluation.
- Route: With MCP, one scoped remote connection and one focused skill.
- Endpoint candidate: `https://procurement.apps.tenhaw.com/mcp/apps/procurement`. Its live deployment and this product's inventory still require verification.
- Dedicated UI origin: `https://procurement.apps.tenhaw.com`. DNS, TLS, hosting alias and exact host routing are pending deployment verification.
- Expected tools: `build_ai_procurement_pack`, `show_ai_procurement_pack`.
- Authentication: none. No user API key is required.

## Reviewer material

[review-cases.json](review-cases.json) contains five positive and three negative synthetic scenarios with explicit inputs and observable assertions. All conversation cases are **not run**. Deterministic tests or protocol checks recorded elsewhere do not establish these ChatGPT conversation results. The manifest imports the review prompts and expectations. The walkthrough recording is pending, and no placeholder recording URL is bundled.

Use only synthetic inputs during review. Check the data calculation, the matching interactive view, and graceful text output when the view is unavailable. Do not claim that creating a configuration or passing a protocol probe completes a ChatGPT installation.

## Owner gates

- **service-terms (pending-owner-scope-approval):** Approve the scope of the draft hosted-service terms at https://kit.tenhaw.com/terms/ before public launch.
- **dedicated-origin-dns-tls (pending-owner-deployment):** Configure https://procurement.apps.tenhaw.com as a dedicated hostname on the existing Tenhaw MCP hosting project, then verify DNS, TLS and exact host routing. Preserve a unique UI origin and portal challenge host for this plugin; no new hosting project is required.
- **endpoint-and-website (not-verified-live):** Deploy and read back this exact scoped endpoint and product page, including tool allowlist, UI resources, privacy and terms URLs.
- **conversation-tests (not-run):** Run all five positive and three negative cases in ChatGPT using synthetic inputs; retain actual tool selection, results and observations.
- **walkthrough-video (not-recorded):** Record the working app and review cases; supply an accessible real recording URL. No recording URL is fabricated in this package.
- **domain-challenge (pending-portal):** Serve the exact challenge issued by the portal. Each token is a single plain-text response; do not replace another app token at the same URL.
- **owner-identity (pending-owner):** Confirm the owning OpenAI organisation/project, submission permission and verified developer identity in the portal.
- **policy-attestations (pending-owner):** Review the exact package, applicable policies and attestations before submitting.
- **public-listing (not-submitted):** Upload the reviewed ZIP, resolve portal findings and complete review. Publication follows approval and an explicit owner action.

The public URLs and metadata are staged candidates until the deployed service and owner scope approval are verified. Do not copy an unrelated existing website's terms into the submission. Country targeting, translations, owner credentials and policy attestations require the owner's actual choices.

## Primary sources

- [Plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Review and publication](https://developers.openai.com/plugins/deploy/submission)
- [Desktop-only and local MCP eligibility](https://developers.openai.com/plugins/deploy/desktop-only)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
