# Tenhaw Kit Developer Tools hybrid submission candidate

Source candidate 1.1.0. This package combines the existing remote calculation service with local coding workflows. Its initial MCP draft uses the new identifier `tenhaw-developer-tools`; the earlier blocked skills-only draft is separate history. No approval or public availability is claimed.

Build internal product tools with connected deterministic calculations and local coding workflows. Validate readiness, aggregate delivery evidence, AI business cases, use-case registers and operating models through one remote MCP connection; scaffold projects and integrate the results locally. Desktop execution is required for local work.

- Package: `plugins/openai/tenhaw`.
- Route: With MCP, with `requires_local_executor: true` retained for local coding.
- Remote endpoint: `https://mcp.tenhaw.com/mcp`.
- Expected remote tools: `assess_ai_readiness`, `score_delivery_health`, `estimate_ai_roi`, `estimate_ai_project_cost`, `generate_usecase_register`, `generate_operating_model`.
- No local MCP component or interactive UI resource is attached.
- Authentication: none for remote calculations. Optional collector credentials stay in the local environment.

## Reviewer material

[review-cases.json](review-cases.json) prepares five positive and three negative scenarios covering all six remote calculations and their integration into local project schemas, views and fixtures. The manifest imports the MCP review cases. Actual desktop conversations, tool selection, local file changes and build/test outcomes remain **not run** until observed. The real walkthrough recording is pending; no placeholder recording URL is bundled.

The remote connection is substantive: fetch the versioned questionnaire, validate aggregate delivery evidence, calculate ROI and project costs, prioritise a governed register and validate the operating model. Local scaffolding, collection and build commands remain local and require the declared executor. Never upload credentials or raw repository events.

## Eligibility and owner gates

A remote MCP connection plus skills is a supported package structure. It does not establish that a product with core local functionality is eligible for ordinary review. Keep the truthful desktop flag and resolve the actual portal findings; OpenAI partner review may still be needed. Do not use this package to conceal the earlier skills-only intake block.

- **initial-remote-draft (pending-portal-validation):** Create a new initial MCP draft named tenhaw-developer-tools with this remote connection. An existing skills-only draft cannot acquire an MCP connection through the current update flow; retain the blocked prior draft as separate history.
- **desktop-clean-install (not-run):** Test the remote calculations and local CLI integration in a clean desktop installation. Keep requires_local_executor true and do not attach a local MCP server.
- **hybrid-desktop-eligibility (pending-portal-and-policy-review):** Remote MCP plus skills is a supported package shape, but remote attachment does not guarantee eligibility for a product whose core value includes local execution. Retain the truthful desktop flag and resolve portal findings; OpenAI partner review may still be required.
- **remote-protocol-and-domain (pending-portal-readback):** Read back exactly six calculation tools at https://mcp.tenhaw.com/mcp, complete this draft's own portal domain challenge and keep delivery input aggregate-only. No credentials, raw repository events or UI resource are attached.
- **conversation-tests (not-run):** Run the five positive and three negative remote-plus-local scenarios in the intended desktop client, recording actual tool selection, calculation results, local project changes and executed build/test outcomes.
- **walkthrough-video (not-recorded):** Record the real remote calculation and local coding workflow and supply an accessible recording URL before MCP review. No placeholder recording is bundled.
- **service-terms (pending-owner-scope-approval):** Review the hosted calculation and local coding scope against the draft service terms and privacy notice before public launch.
- **owner-identity (pending-owner):** Confirm the owning OpenAI organisation/project, submission permission and verified developer identity in the portal.
- **policy-attestations (pending-owner):** Review the exact package, applicable policies and attestations before submitting.
- **public-listing (not-submitted):** Upload the reviewed ZIP, resolve portal findings and complete review. Publication follows approval and an explicit owner action.

## Primary sources

- [Remote MCP and skill packaging](https://developers.openai.com/plugins/build/plugins)
- [Initial connections, review and publication](https://developers.openai.com/plugins/deploy/submission)
- [Desktop execution and local MCP eligibility](https://developers.openai.com/plugins/deploy/desktop-only)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
