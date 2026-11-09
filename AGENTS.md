# AGENTS.md

Kilo CLI is an open source AI coding agent that generates code from natural language, automates tasks, and supports 500+ AI models.

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `main`.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.
- You may be running in a git worktree. All changes must be made in your current working directory — never modify files in the main repo checkout.

## Albert Code (this repository) — read first

This repository is **Albert Code**, a fork of Kilo Code `v7.8.18`. It is a VS Code extension whose only remote host at runtime is the Albert API (`albert.api.etalab.gouv.fr`, OpenAI-compatible, base URL `https://albert.api.etalab.gouv.fr/v1`). These rules take precedence over the Kilo instructions below when they conflict.

Reference documents: [README.md](README.md) (install, configuration, limits), [NETWORK.md](NETWORK.md) (outbound flow inventory and verification), [UPSTREAM.md](UPSTREAM.md) (base tag, update procedure, conflict points, upstream tests incompatible by construction), [RELEASE.md](RELEASE.md) (versions, GitHub Release, Marketplace).

### Hard rules

- **Publishing**: the DINUM authorized the name "Albert Code". Releases follow [RELEASE.md](RELEASE.md) and nothing else: a GitHub Release of the public `KevinHoarau/albert_code` repo, created by CI from a `vX.Y.Z` tag on `main`, then the VS Code Marketplace under the publisher `khoarau` (`khoarau.albert-code`), uploaded by the user through the Marketplace web page from that release asset (no CI job, no publishing token). No other channel (Open VSX, npm, other marketplaces) without the user's approval. Push to `origin`, create or push a tag, or publish only when the user asks; never force-push, never move or delete a pushed tag.
- **Versions and release notes**: Albert Code has its own semver series (`packages/kilo-vscode/package.json`, started at `1.0.0`), independent from Kilo's. It does not use changesets: user-facing changes go to `packages/kilo-vscode/CHANGELOG.md` under an exact `## X.Y.Z` heading (the release job reads it). The Changesets section below does not apply.
- **Branches**: work on `albert_code`. `main` is the stable branch: it only receives validated versions of `albert_code` by fast-forward (`git merge --ff-only albert_code`), done by or for the user once CI and the network E2E test pass; never commit on `main` directly, never base work on it. `upstream` contains only Kilo code (one commit per imported tag); never commit Albert changes there. History is not shared with Kilo: updates go through `upstream` then `git merge upstream` (see UPSTREAM.md). Never import Kilo `main` or another tag without the user's approval.
- **Network lock**: deny by default. The only allowlist is `packages/albert/src/policy.ts` (loopback + Albert over HTTPS:443). Never add a host, never weaken the guard or disable a test to get a green result. A new outbound flow must be cut at its entry point and documented in NETWORK.md. Build-time network (npm registry, GitHub Releases, ziglang.org) is fine; runtime network is not.
- **Thin fork**: prefer new code in Albert-owned locations (`packages/albert/`, `packages/opencode/src/albert/`, `packages/kilo-vscode/src/albert/`, `packages/kilo-vscode/script/albert-*`, `packages/opencode/test/albert/`). Mark every change to an inherited file with `albert_change` (line comment, or `albert_change start` / `albert_change end`; `{/* albert_change */}` in JSX). Keep existing `kilocode_change` markers.
- **Secrets**: the user's Albert key is in `~/.config/albert/api_key` (mode 600). Only ever read it as `ALBERT_API_KEY="$(cat ~/.config/albert/api_key)"` inside a command; never print, log, commit or copy it. Check with `git grep -cF` before pushing if in doubt.
- **No model id is hard-coded**: Albert models come from `GET /v1/models` (`packages/opencode/src/albert/models.ts`).
- Write user-facing replies in French (the user writes in French). Code, comments and commit messages stay in English.

### How Albert Code works

- **Albert mode** (CLI): `packages/opencode/src/albert/boot.ts` is the first import of every CLI entry point and worker. It forces the environment (`packages/albert/src/env.ts`, sets `ALBERT_CODE=1`), installs the process-wide network guard (`packages/albert/src/install.ts`) and writes a local catalog that only declares Albert. Albert behaviour (single provider, enforced config in `src/albert/config.ts`, removed tools, no npm install, no models.dev refresh, bundled ripgrep) is gated on `ALBERT_CODE=1`, so upstream unit tests still test upstream behaviour; `test/albert` tests Albert mode. CLI data dirs are `~/.{local/share,cache,config}/albert-code`.
- **Extension host**: the guard is applied to the extension bundle only (the extension host is shared with other extensions) through `packages/kilo-vscode/script/albert-esbuild.js` (node net modules, fetch, WebSocket, a `vscode` wrapper that pins settings of removed features, a playwright stub). Webview CSP: no remote image or frame.
- **API key / URL**: SecretStorage (fallback `ALBERT_API_KEY`), setting `albertCode.apiBaseUrl`; UI in the first settings tab (`webview-ui/src/components/settings/AlbertTab.tsx`, host side `src/albert/panel.ts`, `src/albert/key.ts`). The key never goes back to the webview.
- **Removed features** (do not reintroduce): Kilo account/gateway/kilo-auto/BYOK and third-party providers, cloud history/share/remote control/session ingest/session export (code deleted), telemetry and PostHog (deleted), autocomplete, marketplace, web search, webfetch, repo_clone, image generation, integrated browser/Playwright, remote MCP, speech to text, auto-update, LSP/npm downloads, codebase indexing. The list of removed agent tools is `packages/albert/src/tools.ts`.
- **Branding**: never show "Kilo" in the UI. Translated strings are branded at resolution time by `brand()` (`packages/albert/src/brand.ts`) in the webview `resolveTemplate`, the host `t()` and the CLI system prompt (Albert plugin hook). Hard-coded strings must say "Albert Code". Keep factual origin mentions only (About tab, README, LICENSE).
- **Coexistence with Kilo Code**: sources keep Kilo's VS Code identifiers (`kilo-code.new.*`); packaging renames them to `albert-code.*` and the Agent Manager state file to `albert-agent-manager.json` (`script/albert-ids.ts`). Any new identifier namespace from upstream needs a rule there (`tests/unit/albert-ids.test.ts` and the VSIX scan fail otherwise). A dev build (`bun run extension`) keeps Kilo ids: do not run it next to Kilo Code.

### Environment and commands

- `bun` 1.4.4 is in `~/.bun/bin` (not on the default PATH): use `export PATH=$HOME/.bun/bin:$PATH`. Zig 0.14.0 is needed to build the CLI (`ZIG=/path/to/zig`; SHA-256 pinned in `.github/workflows/albert.yml`).
- **VSIX** (linux-x64 and win32-x64; no macOS yet): `bun script/albert-package.ts [--target=linux-x64|win32-x64] [--rebuild-cli]` from `packages/kilo-vscode` → `out/albert-code-<target>.vsix`. The Windows CLI is cross-built from Linux (`script/build.ts --target=win32-x64`, an `albert_change`) and needs `bun install --os='*' --cpu='*'` for the Windows native packages. It type-checks, lints, bundles, renames identifiers, adds checksum-pinned ripgrep, packages and runs `script/albert-scan.ts` (host scan + Kilo-identifier check). Rebuild the CLI (`--rebuild-cli`) whenever `packages/opencode` or `packages/core` changed, otherwise the VSIX ships the old CLI.
- **Checks to run before saying something is done** (see also `.github/workflows/albert.yml`):
  - typecheck: `bun run typecheck` in `packages/{albert,opencode,core,kilo-telemetry,kilo-gateway,kilo-vscode}`;
  - lint and knip: `bun run lint` and `bun run knip` in `packages/kilo-vscode`;
  - unit tests: `bun test` in `packages/albert`, `packages/core`, `packages/kilo-telemetry`; `bun test test/albert test/config test/tool/registry.test.ts test/plugin test/provider test/session` in `packages/opencode`; `bun test tests/unit/` in `packages/kilo-vscode`;
  - **network E2E (mandatory after any runtime change)**: `bash packages/albert/e2e/run.sh <kilo binary>` and `bash packages/albert/e2e/negative.sh <kilo binary>` (binary: `packages/opencode/dist/@kilocode/cli-linux-x64/bin/kilo`). Uses unprivileged user + network namespaces, nftables and tcpdump; set `TMPDIR` to a scratch directory;
  - Windows E2E (CI job `windows`, not runnable on Linux): `packages/albert/e2e/windows.ps1 -Bin <kilo.exe> [-Leak]` audits the connections of the extension's programs through the Windows Filtering Platform; weaker than the namespace test (DNS and child processes are not attributed);
  - VS Code smoke test: `bash packages/albert/e2e/run.sh --vscode <vsix>` (needs a display or `xvfb-run`; opens a VS Code window for ~1 min; keeps window captures as `$TMPDIR/albert-code-{vscode,settings}.xwd`). Coexistence: `E2E_ALSO=~/.vscode/extensions/kilocode.kilo-code-<version>-linux-x64 bash packages/albert/e2e/run.sh --vscode <vsix>`.
- Real Albert check (only when useful, never print the key): run the CLI with `ALBERT_API_KEY="$(cat ~/.config/albert/api_key)"` and drive it over HTTP like `packages/albert/e2e/scenario.ts`; bash permission prompts must be answered through `POST /permission/:id/reply`.

### Known limits and gotchas

- The guard does not cover commands run by the `bash` tool, local MCP servers, git/gh, or VS Code itself (it contacts `redirector.gvt1.com` and `main.vscode-cdn.net` even without the extension). Bash asks for confirmation by default; README documents a system firewall. Never claim isolation is total.
- 42 upstream CLI integration tests that spawn the real entry point with a `test` provider fail by construction in Albert mode (listed in UPSTREAM.md); the full `test/kilocode` and `packages/opencode` suites also have many environment-dependent failures upstream. Compare against the `upstream` branch before calling a failure a regression.
- `gh` is installed and authenticated (user's account): use it read-only to follow CI (`gh run list`, `gh run view <id> --log-failed`). Push only when the user asks.
- CI runner (Ubuntu 24.04) needs what a dev machine already has: `bubblewrap` plus `kernel.apparmor_restrict_unprivileged_userns=0` for the core sandbox tests, `rg` on PATH (core tests otherwise download it from GitHub releases, which can answer 504), `x11-utils`/`x11-apps` for the smoke test. Keep these steps in `.github/workflows/albert.yml`.
- Electron refuses to run as (namespace) root without `--no-sandbox`, and VS Code's IPC socket path must stay under 107 characters (the smoke test uses `/tmp/aud.*`).

## Build and Dev

- **Dev**: `bun run dev` (runs from root) or `bun run --cwd packages/opencode --conditions=browser src/index.ts`
- **Dev with params**: `bun dev -- help`
- **Extension**: `bun run extension` (build + launch VS Code with the extension in dev mode). Pass `--no-build` to skip the build. When asked to run an isolated VS Code/Kilo environment, use the CLI scripts instead of interactive launch configs: `bun run extension:isolated` reuses `.kilo-dev/`, and `bun run extension:isolated:clean` clears `.kilo-dev/` first. Pass an optional workspace path after `--`, for example `bun run extension:isolated -- ../sample-project`.
- **Typecheck**: `bun turbo typecheck` (uses `tsgo`, not `tsc`). Includes the JetBrains plugin and requires Java 21; do not run `java -version` as a routine preflight. Only check Java when a Gradle/Java command fails with a Java-version or missing-Java error. If missing, install via SDKMAN: `sdk install java 21-tem && sdk use java 21-tem`. If SDKMAN is not installed, see https://sdkman.io/install.
- **Test**: `bun test` from `packages/opencode/` (NOT from root -- root blocks tests)
- **Single test**: `bun test ./test/tool/tool-define.test.ts` from `packages/opencode/`
- **CLI build artifact size check**: after `bun run script/build.ts --single --skip-install` in `packages/opencode/`, use `du -h dist/*/*/bin/kilo` (scoped package output lives under `dist/@kilocode/`)
- **SDK regen**: After changing server endpoints in `packages/opencode/src/server/`, run `./script/generate.ts` from root to regenerate `packages/sdk/js/`
- **Knip** (unused exports): `bun run knip` from `packages/kilo-vscode/`. CI runs this — all exported types/functions must be imported somewhere. Remove or unexport unused exports before pushing.
- **Source links**: After adding or changing URLs in `packages/kilo-vscode/`, `packages/kilo-vscode/webview-ui/`, or `packages/opencode/src/`, run `bun run script/extract-source-links.ts` from the repo root and commit the updated `packages/kilo-docs/source-links.md`. CI runs this check — the build fails if the file is stale.
- **kilocode_change check**: `bun run check-kilocode-change` from `packages/kilo-vscode/`. CI runs this — `kilocode_change` is a marker for upstream merge conflicts and must not appear in `packages/kilo-vscode/` or `packages/kilo-ui/` (these are entirely Kilo Code additions). Remove the markers before pushing.
- **opencode annotation check**: `bun run script/check-opencode-annotations.ts --worktree` from repo root when verifying local agent changes. CI runs `bun run script/check-opencode-annotations.ts` on PRs touching `packages/opencode/` — every Kilo-specific change in shared opencode files must be annotated with `kilocode_change` markers. Exempt paths (no markers needed): `packages/opencode/src/kilocode/`, `packages/opencode/test/kilocode/`, and any path containing `kilocode` in the name.
- **Effect facade ratchet**: Do not add runtime-backed Promise facades to shared `packages/opencode/src` Effect services; use service dependencies, `AppRuntime`, or Kilo-owned boundaries. Run `bun run script/check-opencode-promise-facades.ts` when touching service adapters.
- **workflow allowlist**: `bun run script/check-workflows.ts` from repo root. CI runs this as part of the annotations workflow — any `.yml` / `.yaml` file added to or removed from `.github/workflows/` must be reflected in the hardcoded list in `script/check-workflows.ts`. Prevents upstream-merged workflows from silently starting to run in our CI.
- **Backend/SDK programmatic testing**: see [TESTING.md](./TESTING.md) for spawning the local main-branch backend (`bun dev serve`) and driving it via `curl` — use this instead of `kilo serve` (prod binary) when testing backend fixes.

## Quality Checks

Before saying an implementation is ready, run the smallest relevant checks that can catch lint, typecheck, and test failures for the touched package. Do not rely on manual extension launch to discover build problems. Fix failures you introduced before the final response, or state exactly which check is still failing or could not be run.

| Area | Checks |
|---|---|
| Root / cross-package | `bun run lint`, `bun run typecheck` |
| CLI | From `packages/opencode/`: `bun run typecheck`, `bun test` or targeted `bun test ./path/to/file.test.ts` |
| VS Code extension | From `packages/kilo-vscode/`: `bun run typecheck`, `bun run lint`, `bun run test:unit` or `bun run test` |
| Extension build/package | From `packages/kilo-vscode/`: `bun run compile` or `bun run package` when touching build, packaging, SDK, or webview integration paths |
| JetBrains plugin | From `packages/kilo-jetbrains/`: `./gradlew typecheck`, `./gradlew test`. Requires Java 21; do not run `java -version` as a routine preflight. Check Java only after a Java-version or missing-Java failure. |
| CI/local guards | Run affected guards documented above, such as `bun run knip`, `bun run check-kilocode-change`, `bun run script/check-opencode-annotations.ts --worktree`, or source link extraction |

Never run root `bun test`; the root script prints `do not run tests from root` and exits with code 1. Use package-level tests instead.

## Products

All products are clients of the **CLI** (`packages/opencode/`), which contains the AI agent runtime, HTTP server, and session management. Each client spawns or connects to a `kilo serve` process and communicates via HTTP + SSE using `@kilocode/sdk`.

| Product | Package | Description |
|---|---|---|
| Kilo CLI | `packages/opencode/` | Core engine. TUI, `kilo run`, `kilo serve`. Fork of upstream OpenCode. |
| Kilo VS Code Extension | `packages/kilo-vscode/` | VS Code extension. Bundles the CLI binary, spawns `kilo serve` as a child process. Includes the **Agent Manager** — a multi-session orchestration panel with git worktree isolation. |

**Agent Manager** refers to a feature inside `packages/kilo-vscode/` (extension code in `src/agent-manager/`, webview in `webview-ui/agent-manager/`). It is not a standalone product. See the extension's `AGENTS.md` for details.

In each VS Code extension host, one `KiloConnectionService` is created for the sidebar, every Kilo editor tab, and Agent Manager; it lazily starts and reuses one current `kilo serve` backend at a time. Agent Manager worktree sessions pass a directory context to this shared backend rather than starting one per worktree. State captured by the active service layer, such as Snapshot `trackState`, is shared across those requests; only directory-keyed `InstanceState` data is isolated.

Extension-specific settings should live in the Kilo extension settings, not default VS Code settings, unless they are intentionally VS Code-wide. Experimental flags should follow existing flag patterns, not VS Code settings; they usually belong in the Kilo Experimental settings section.

## Package Instructions

- When a task primarily touches `packages/kilo-jetbrains/`, read `packages/kilo-jetbrains/AGENTS.md` before planning or editing. It holds hard restrictions, a shared-code reuse index, and a skill/command index; load the matching `jetbrains-ui`, `jetbrains-session`, `jetbrains-arch`, or `jetbrains-dev` skill (or the `/release-jetbrains` command) for detailed guidance.

## Monorepo Structure

Turborepo + Bun workspaces. The packages you'll work with most:

| Package | Name | Purpose |
|---|---|---|
| `packages/opencode/` | `@kilocode/cli` | Core CLI -- agents, tools, sessions, server, TUI. This is where most work happens. |
| `packages/sdk/js/` | `@kilocode/sdk` | Auto-generated TypeScript SDK (client for the server API). Do not edit `src/gen/` by hand. |
| `packages/kilo-vscode/` | `kilo-code` | VS Code extension with sidebar chat + Agent Manager. See its own `AGENTS.md` for details. |
| `packages/kilo-gateway/` | `@kilocode/kilo-gateway` | Kilo auth, provider routing, API integration |
| `packages/kilo-telemetry/` | `@kilocode/kilo-telemetry` | PostHog analytics + OpenTelemetry |
| `packages/kilo-i18n/` | `@kilocode/kilo-i18n` | Internationalization / translations |
| `packages/kilo-ui/` | `@kilocode/kilo-ui` | SolidJS component library shared by the extension webview and docs screenshot stories |
| `packages/util/` | `@opencode-ai/util` | Shared utilities (error, path, retry, slug, etc.) |
| `packages/plugin/` | `@kilocode/plugin` | Plugin/tool interface definitions |

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## Style Guide

- Keep things in one function unless composable or reusable
- Avoid unnecessary destructuring. Instead of `const { a, b } = obj`, use `obj.a` and `obj.b` to preserve context
- Avoid possibly out-of-bounds array access. Instead of `array[index] ?? {}`, use `array.at(index) ?? {}`. Instead of `array[array.length - 1]`, use `array.at(-1)`
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Always use `Promise.withResolvers<T>()` to create deferred promises; all supported runtimes provide it. Never capture `resolve` and `reject` from a `new Promise` executor in external variables or object properties.
- Use `ref == null` to check for both `null` and `undefined` instead of `ref === undefined || ref === null`.

### Avoid let statements

Prefer `const`. Replace `let` + if/else assignment with a ternary or an IIFE. Reassignment is the only legitimate reason to reach for `let`.

### Naming Enforcement (Read This)

THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.
- Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.
- Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

### Avoid else statements

Prefer early returns (or an IIFE) over `else`. After an `if` that returns/throws, the `else` is redundant.

### No empty catch blocks

Never leave a `catch` block empty. An empty `catch` silently swallows errors and hides bugs. If you're tempted to write one, ask yourself:

1. Is the `try`/`catch` even needed? (prefer removing it)
2. Should the error be handled explicitly? (recover, retry, rethrow)
3. At minimum, log it via `log.error("...", { err })` so failures are visible — never `catch {}` or `catch (e) {}` with no body.

### Prefer single word naming

Default to a single-word name for variables, parameters, and helper functions. Reach for a multi-word name only when a single word would be genuinely ambiguous in context — not just because the longer name "reads nicer". The rule is about meaning, not character count: don't introduce camelCase compounds like `inputPID`, `existingClient`, `connectTimeout`, or `workerPath` when `pid`, `client`, `timeout`, or `path` is already clear from the surrounding code. See the "Naming Enforcement" section above for the preferred vocabulary.

## Testing

You MUST avoid using `mocks` as much as possible.
Tests MUST test actual implementation, do not duplicate logic into a test.

For VS Code UI changes, the optional shared self-test harness is at https://github.com/Kilo-Org/vscode-extension-self-test (the `vscode-self-test` skill). Offer it and let the user decide whether to install or use it.

## Markdown Tables

Do not pad markdown table cells for column alignment. Use the compact form with single-space-padded content cells and a minimal separator row:

```
| Command | What it runs |
|---|---|
| `kilo serve` | The prod CLI on `$PATH`. |
```

Do **not** right-pad cells to line up columns:

```
| Command                       | What it runs             |
| ----------------------------- | ------------------------ |
| `kilo serve`                  | The prod CLI on `$PATH`. |
```

Padding makes every content change rewrite the entire table, which blows up diffs on untouched rows. Markdown files are excluded from prettier (see `.prettierignore`) so running the formatter won't re-pad them, and `script/check-md-table-padding.ts` enforces the rule in CI. Run `bun run script/check-md-table-padding.ts --fix` to auto-rewrite padded tables.

## Commit Conventions

[Conventional Commits](https://www.conventionalcommits.org/) with scopes matching packages: `vscode`, `cli`, `agent-manager`, `sdk`, `ui`, `i18n`, `kilo-docs`, `gateway`, `telemetry`, `desktop`. Omit scope when spanning multiple packages.

## Changesets

User-facing changes (features, fixes, breaking changes) require a changeset file for release notes. Prefer one concise changeset per PR, grouping related changes when possible. Run `bunx changeset add` or manually create `.changeset/<slug>.md`. Use `patch` for bug fixes, `minor` for new features, `major` for breaking changes. See `.changeset/README.md` for details.

Changeset descriptions appear directly in release notes and are read by end users. Keep them concise and feature-oriented — describe **what changed from the user's perspective**, not implementation details. Write in imperative mood (e.g. "Support exporting conversations as markdown" not "Add a new export handler that serializes session messages to .md files").

## Pull Requests

PR descriptions should explain **what** changed, **why** the change is needed, and the intent or constraints a reviewer cannot infer from the diff alone. Keep simple PRs brief, but give non-trivial changes enough context to stand on their own. Skip file-by-file inventories, test result summaries, and anything obvious from the code itself.

## GitHub Issues

When creating or managing GitHub issues for the VS Code extension or JetBrains plugin via `gh`, load `.kilo/skills/gh-issues/SKILL.md`. It covers templates, project boards (`VS Code Extension`, `Jetbrains Plugin`), title conventions, and the `gh auth refresh -s project` recovery path.

## Fork Merge Process

Kilo CLI is a fork of [opencode](https://github.com/anomalyco/opencode).

**Very important**: when planning or coding, update shared files with OpenCode as last resort! Everything is shared code from OpenCode, except folders that contain `kilo` in the name or have a parent directory that contains `kilo` in the name. Example of kilo specific folders: `packages/opencode/src/kilocode/` and `packages/kilo-docs/`. Always look for ways to implement your feature or fix in a way that minimizes changes to shared code.

### Minimizing Merge Conflicts

We regularly merge upstream changes from opencode. To minimize merge conflicts and keep the sync process smooth:

1. **Prefer `kilocode` directories** - Place Kilo-specific code in dedicated directories whenever possible:
   - `packages/opencode/src/kilocode/` - Kilo-specific source code
   - `packages/opencode/test/kilocode/` - Kilo-specific tests
   - `packages/kilo-gateway/` - The Kilo Gateway package

2. **Minimize changes to shared files** - When you must modify files that exist in upstream opencode, keep changes as small and isolated as possible.

3. **Use `kilocode_change` markers** - When modifying shared code, mark your changes with `kilocode_change` comments so they can be easily identified during merges.
   Do not use these markers in files within directories with kilo in the name

4. **Avoid restructuring upstream code** - Don't refactor or reorganize code that comes from opencode unless absolutely necessary.

5. **Mirror new config keys to the cloud schema** - When adding a `kilocode_change` key to `Config.Info` in `packages/opencode/src/config/config.ts`, also add the matching JSON Schema entry in `apps/web/src/app/config.json/extras.ts` in the [cloud repo](https://github.com/Kilo-Org/cloud). See [CLI Config Schema](packages/kilo-docs/pages/contributing/architecture/config-schema.md) for the step-by-step.

The goal is to keep our diff from upstream as small as possible, making regular merges straightforward and reducing the risk of conflicts.

### Git conflict style

`bun install` sets `merge.conflictStyle=zdiff3` repo-locally via `script/setup-git.ts` (wired into `postinstall`). Conflicts include the common ancestor between `|||||||` and `=======`, which is what `script/upstream/` and `mergiraf` rely on for structural resolution and what makes manual resolution on shared opencode files tractable. If you've overridden it in your user config, the repo-local setting takes precedence — don't override it back.

### Kilocode Change Markers

When editing shared upstream files, mark Kilo-specific lines with `kilocode_change` comments so future merges can find them. The basic forms are:

- Single line: `const value = 42 // kilocode_change`
- Multi-line block: wrap with `// kilocode_change start` / `// kilocode_change end`
- New file in a shared path: `// kilocode_change - new file` at the top
- JSX/TSX: use `{/* kilocode_change */}` (and `{/* kilocode_change start */}` / `end`)

Markers are NOT needed in paths that contain `kilocode` in the name (e.g. `packages/opencode/src/kilocode/`, `packages/opencode/test/kilocode/`) — these are entirely Kilo Code additions and won't conflict with upstream.

For decision rules on when to keep changes inline vs. extract Kilo logic, marker placement guidance, and verification commands, load `.kilo/skills/kilocode-merge-minimizer/SKILL.md`.
