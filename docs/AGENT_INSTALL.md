# Install Tenhaw Kit with a coding agent

Use one prompt to connect the tools, verify them and continue the requested work. Tenhaw Kit's calculations need no API key. Credentials are needed only for optional local GitHub or Jira collection.

## Published release and source changes

Version **1.0.1** is published on [npm](https://www.npmjs.com/package/tenhaw/v/1.0.1), [PyPI](https://pypi.org/project/tenhaw/1.0.1/) and the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/com.tenhaw%2Fkit/versions/1.0.1) as `com.tenhaw/kit`, verified on 16 November 2026. Publication and production evidence live in [RUNBOOK.md](RUNBOOK.md).

The automated `setup` command described below is **unreleased source work**. It is not included in npm 1.0.1. Until a new version has been published and verified, use the built source command for setup. Public 1.0.1 supports the manual client configuration commands and MCP server shown here.

| Route | Command or endpoint | Requirement |
| --- | --- | --- |
| Public CLI | `npx -y tenhaw@1.0.1 --help` | Node.js 22.14+ and npm |
| Local MCP | `npx -y @tenhaw/mcp@1.0.1` | Node.js 22.14+ and npm; eight tools |
| Remote MCP | `https://mcp.tenhaw.com/mcp` | A client supporting Streamable HTTP; six pure tools |
| Python CLI | `uvx --from tenhaw==1.0.1 tenhaw-py --help` | Python 3.10+ and uv |
| Python library | `python -m pip install 'tenhaw==1.0.1'` | Python 3.10+ in a virtual environment |

The remote endpoint requires no local Node runtime when configured directly in a client. Running the setup CLI itself requires Node. Remote tools accept calculation inputs and aggregate delivery metrics; collection and scaffolding use local tools.

## One prompt for the published release

> Install Tenhaw Kit 1.0.1 in this project and continue my requested task. Identify the coding client and consult its current MCP configuration documentation. Use the local server `npx -y @tenhaw/mcp@1.0.1`, or the remote endpoint only if I request pure remote tools. Preserve all existing instructions, servers and settings, and show any conflicting Tenhaw definition for review. Verify MCP initialisation, the expected tool inventory and a synthetic readiness calculation. If I request a starter, choose the matching template, scaffold a new directory, install its dependencies and run its documented build and tests. Ask me to set only missing environment variables needed for GitHub or Jira collection I request, in the local environment that launches the client. Never ask me to paste a secret into chat or include secret values in commands, configuration, reports or logs. Report the checks that passed and any required host reload or trust approval.

The agent can retrieve the public install snippets with:

```sh
npx -y tenhaw@1.0.1 mcp --json --no-attribution
```

## Automated setup from this source

Build the checkout using its pinned package manager:

```sh
corepack pnpm install
corepack pnpm build
```

Plan a connection for an existing project:

```sh
node packages/cli/dist/index.js setup --agent codex --directory /path/to/project --json
```

Apply the configuration and verify the selected MCP server:

```sh
node packages/cli/dist/index.js setup --agent codex --directory /path/to/project --yes --verify --json
```

Inspect a connection without writing:

```sh
node packages/cli/dist/index.js setup --agent codex --directory /path/to/project --check --verify --json
```

Replace `codex` with `claude`, `cursor`, `vscode` or `gemini`. Select `--transport local` or `remote`; the default is local. Select `--integration none`, `github`, `jira` or `github,jira`; the default is none. Collection integrations require local transport.

Planning and `--check` preserve files. `--yes` applies the selected project configuration. A matching existing definition is reusable; a conflicting definition requires review. Setup leaves host instructions in place and returns JSON that the calling agent can inspect for configuration status, missing environment variable names and next actions. Verification may download the pinned MCP package with npm or contact the remote endpoint. A successful protocol probe still needs the host to load and enable the server.

For a source-based one-prompt workflow, replace the manual configuration step in the prompt above with: “Build this checkout; run `setup` for my client and project directory, inspect the JSON plan, then apply it with `--yes --verify --json`. Resolve its next actions and report any remaining blocker.”

## Client configuration locations

Setup targets the selected project's configuration. Host trust, enablement and organisation policy still govern whether a session can use tools.

| Client | Project configuration | Primary documentation |
| --- | --- | --- |
| Codex | `.codex/config.toml`, `[mcp_servers.tenhaw]` | [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) |
| Claude Code | `.mcp.json`, `mcpServers.tenhaw` | [Project scope](https://code.claude.com/docs/en/mcp#project-scope) |
| Cursor | `.cursor/mcp.json`, `mcpServers.tenhaw` | [Configuration locations](https://cursor.com/docs/mcp#configuration-locations) |
| VS Code / Copilot | `.mcp.json`, `mcpServers.tenhaw` | [Native Copilot configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) |
| Gemini CLI | `.gemini/settings.json`, `mcpServers.tenhaw` | [MCP configuration and scopes](https://geminicli.com/docs/tools/mcp-server/) |

Codex project configuration requires a trusted project. Claude Code may request approval for project MCP servers. Current VS Code guidance uses portable workspace-root `.mcp.json` for new Copilot integrations. `.vscode/mcp.json` and `code --add-mcp` target the deprecated editor-managed Local harness; use them only when maintaining that client path. See the linked host documentation for loading and trust behaviour.

Public 1.0.1 supports these explicit CLI registrations:

```sh
claude mcp add --scope project tenhaw -- npx -y @tenhaw/mcp@1.0.1
codex mcp add tenhaw -- npx -y @tenhaw/mcp@1.0.1
```

The Codex CLI registration uses the CLI's configured scope; use the project file above when project scope is required. A plugin can also supply the server. Check the host's existing inventory before adding another registration.

## Ask for credentials only when needed

| Selected integration | Required local environment variables |
| --- | --- |
| `none` | None |
| `github` | `GITHUB_TOKEN` |
| `jira` | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| `github,jira` | All four variables above |

Use credentials with read access only to the requested repositories or Jira data. Keep their values in the local environment or the host's supported secret store. The agent should ask the user to set missing names there and retry the check. It should never ask for their values in the conversation.

The client must pass those variables to its local MCP process. Setup can include environment-variable references or name-only pass-through settings, without copying values. [Codex documents `env_vars`](https://learn.chatgpt.com/docs/extend/mcp?surface=cli); [Gemini requires explicit environment overrides](https://geminicli.com/docs/tools/mcp-server/#explicit-overrides) for variables its redaction would otherwise remove. If a GUI client was already running, restart or reload it after changing its launch environment. A `.env` file is not automatically loaded by every client.

Missing credentials should block only the selected collector. The questionnaire, readiness scoring, ROI and other pure tools remain usable. Remote configuration must never contain GitHub/Jira credentials.

## Create and verify a starter

The scaffold command creates a new directory and returns its next steps. The calling agent performs installation and verification as separate actions:

```sh
npx -y tenhaw@1.0.1 init product-operating-model internal-portfolio --yes --json
cd internal-portfolio
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

Use the generated `packageManager` pin and build policy. Templates contain synthetic examples and browser-local data. Add authentication and authorisation before adding shared persistence or server-side real-data routes.

## Install acceptance checks

Treat installation as complete when these checks pass:

1. The selected runtime meets the package requirement, and all executable package references use the reviewed version.
2. Project configuration loads without altering existing instructions or unrelated servers. Running setup again preserves the same connection.
3. MCP initialises and lists the expected eight local tools or six remote tools. A synthetic readiness calculation succeeds.
4. The coding client can call a tool after any host reload, enablement or trust step. A configuration file or standalone probe alone does not establish this.
5. Core tools work without credentials. Requested local collectors report only missing variable names until those variables are available.
6. A requested starter installs, builds and passes its documented tests in its own directory.

Record the version, selected client and transport, checks performed and any remaining blocker. These checks define the install quality target; they do not establish a comparative “best in class” ranking.
