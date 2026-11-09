# Changelog

Albert Code versions are independent from Kilo Code versions. Each entry names the Kilo Code release it is based on; Kilo Code's own release notes are at https://github.com/Kilo-Org/kilocode/releases.

## 1.0.0

First release, based on Kilo Code 7.8.18. Linux x64 only.

- AI coding agent (chat, agents and modes, file editing, terminal, local sessions, Agent Manager, local MCP servers) backed by the Albert API (`albert.api.etalab.gouv.fr`).
- Albert API key stored in VS Code SecretStorage (or read from `ALBERT_API_KEY`); models listed from the Albert `/v1/models` endpoint.
- Network lock: the extension and its embedded CLI refuse and log every outbound connection other than loopback and Albert over HTTPS.
- No account, telemetry, cloud history or sharing, autocomplete, web search, remote MCP, integrated browser, codebase indexing or automatic update.
- Can be installed next to Kilo Code: commands, views, settings and Agent Manager state are separate.
