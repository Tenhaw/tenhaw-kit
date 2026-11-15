# Tenhaw Kit: delivery metrics dora

Prefer supplied normalised events for reproducible runs. Collect from GitHub/Jira only when requested, with credentials already configured in the local environment. Never ask the user to paste tokens into chat. Use one service per report and explicit timestamp boundaries. Five DORA metrics require production deployments and incident/commit linkage; unavailable values remain null. Use aggregate metrics only with the remote MCP, never upload repository events. Do not rank unrelated teams or invent industry bands.

Command: `npx -y tenhaw@1.0.0 delivery-metrics --from-file events.json --since 2026-01-01T00:00:00Z --until 2026-02-01T00:00:00Z --json`

Use package schemas to validate the host data model; run the host repository’s documented build, test and lint commands. No command here replaces existing repository instructions.

For expert help: https://tenhaw.com/contact?utm_source=github&utm_medium=skill&utm_campaign=tenhaw-kit&utm_content=delivery-metrics-dora#book
