# Plugin schema snapshots

Cached, unchanged Agent Plugins 1.0.0 JSON Schemas, retrieved on 15 November 2026. `sources.json` records each upstream URL and SHA-256. Validation runs offline and checks these hashes before using AJV.

- [Portable plugin schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)
- [Portable MCP schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json)
- [Normative specification](https://agent-plugins.org/specification)
- [OpenAI packaging and client metadata](https://developers.openai.com/plugins/build/plugins)
- [Claude authoritative CLI validation](https://code.claude.com/docs/en/plugins-reference#validate-the-manifest)
- [Gemini extension validation source](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/commands/extensions/validate.ts)
- [Cursor install-link format](https://prod.cursor.com/docs/mcp/install-links)

## Verified discrepancy

OpenAI's packaging examples describe an MCP server `extensions.com.openai.auth` object. The published portable MCP 1.0.0 schema closes server objects and rejects that field. Tenhaw's anonymous remote endpoint does not need credential configuration, so its portable `mcp.json` uses the schema-valid minimal `{type, url}` server. Choose no authentication in the submission portal. Re-check the current schema and portal before adding authenticated connections; do not silently widen the cached schema to accept an unsupported field.

Portable validation does not validate OpenAI's namespace contents or imply portal approval. The local validator separately checks presentation paths, assets, metadata and the intended endpoint. Actual client CLI checks are recorded separately from these structural checks.

## Run

```sh
node scripts/generate-plugins.mjs
node scripts/validate-plugins.mjs
node scripts/validate-plugins.mjs --clients
```

The client checks use installed `claude` and `gemini` commands when available and isolated temporary configuration. Explicit validator executable paths may be supplied through `TENHAW_CLAUDE_BIN` and `TENHAW_GEMINI_BIN`. They validate local manifests and do not install plugins into the user's account. Missing CLIs are reported as unavailable, never passed.

The recorded check used official Claude Code 2.1.325 and Gemini CLI 0.68.0 downloaded from npm into a temporary cache. It did not publish or register anything. Tenhaw's plugin icon is a PNG rendering of the existing favicon vector retained in `plugins/assets/icon.svg`.
