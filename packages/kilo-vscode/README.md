# Albert Code

AI coding agent for VS Code that only talks to the [Albert API](https://albert.api.etalab.gouv.fr) (`albert.api.etalab.gouv.fr`, OpenAI-compatible): chat, agents and modes, file editing, terminal, local sessions, local MCP servers.

Unofficial fork of Kilo Code 7.8.18 (itself derived from OpenCode), MIT license. Not a product of the French administration.

## Getting started

1. Run **Albert Code: Set Albert API Key** from the Command Palette (the key is stored in VS Code SecretStorage; `ALBERT_API_KEY` from the environment also works).
2. Open the Albert Code view in the activity bar. Models are read from the Albert `/v1/models` endpoint.

The base URL can be changed with the `albertCode.apiBaseUrl` setting; only `https://albert.api.etalab.gouv.fr` (or a loopback address, for tests) is accepted.

## Network

The extension and its embedded CLI refuse and log every outbound connection other than loopback and Albert. There is no telemetry, no account, no cloud sync, no marketplace, no autocomplete, no web search and no automatic update.

Shell commands run by the agent and local MCP servers are **not** covered by this lock: every shell command asks for confirmation by default, and a system firewall is required for strict isolation (see the repository README).
