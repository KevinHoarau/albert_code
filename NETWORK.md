# Inventaire réseau — Albert Code

Base : Kilo Code `v7.8.18` (voir [UPSTREAM.md](UPSTREAM.md)). Inventaire établi en lisant le code du dépôt (et non la documentation de Kilo), avant toute modification.

**Objectif à l'exécution :** le seul hôte distant joignable est `albert.api.etalab.gouv.fr` (HTTPS, URL de base `https://albert.api.etalab.gouv.fr/v1`). La boucle locale (`127.0.0.1`, `::1`, `localhost`) reste ouverte pour la liaison extension ↔ CLI (`kilo serve`) et pour les serveurs MCP locaux.

**Statut :** inventaire établi avant les correctifs ; les décisions sont toutes appliquées sur la branche `albert_code`. Les sections [Mise en œuvre](#mise-en-œuvre) et [Vérifications](#vérifications) disent où chaque coupure est faite et comment elle a été vérifiée.

## Légende des décisions

| Décision | Sens |
|---|---|
| AUTORISÉ | Flux conservé, passe par la liste d'autorisation |
| LOCAL | Boucle locale uniquement |
| SUPPRIMÉ | Code retiré (télémétrie, envoi des sessions) |
| COUPÉ | Point d'entrée désactivé et interface masquée ; le code reste pour limiter le diff |
| BUILD | Uniquement pendant le build (registres de paquets, GitHub Releases) ; doit être absent à l'exécution |
| VERROU | Aucun point d'entrée volontaire, mais le verrou réseau bloque et journalise si le chemin est atteint |

## 1. Hôte de l'extension VS Code (`packages/kilo-vscode/src`)

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| CLI locale `http://127.0.0.1:<port>` (HTTP + SSE + WS) | `services/cli-backend/server-manager.ts`, `connection-service.ts`, SDK | Activation | Tout le trafic applicatif (sessions, prompts) avec mot de passe Basic | LOCAL |
| `github.com/<owner>.png` | `agent-manager/project/avatar.ts:66` | Ouverture de l'Agent Manager sur un dépôt GitHub | Nom du propriétaire du dépôt (fuite de métadonnées) | COUPÉ |
| `npx @playwright/mcp@latest` → `registry.npmjs.org` + navigation web | `services/browser-automation/settings.ts:13`, `browser-broker.ts` | Activation de l'automatisation du navigateur | Téléchargement de paquet, URL visitées | COUPÉ |
| URL de base d'un fournisseur personnalisé `/models` | `shared/fetch-models.ts:41` | Ajout d'un fournisseur personnalisé dans les réglages | Clé API du fournisseur | COUPÉ (remplacé par la découverte Albert côté CLI) |
| Reconnaissance vocale (source personnalisée `/models`, `/audio/transcriptions`) + capture `ffmpeg` | `speech-to-text/catalog.ts`, `transcribe.ts`, `capture.ts` | Bouton micro | Audio, clé API | COUPÉ |
| Génération d'images (via CLI → OpenRouter / passerelle) | `image-generation/models.ts` | Outil / réglage | Prompt | COUPÉ |
| Autocomplétion (via CLI → passerelle FIM `api.kilo.ai`) ; lien `app.kilo.ai/credits` | `services/autocomplete/*` | Frappe dans l'éditeur | Contexte du fichier courant | COUPÉ |
| Marketplace (via CLI → `api.kilo.ai`) | `MarketplacePanelProvider.ts`, `services/marketplace/*` | Panneau Marketplace | Requêtes de catalogue | COUPÉ |
| Télémétrie (proxy vers la CLI `/telemetry/capture`) | `services/telemetry/telemetry-proxy.ts` (+ ~10 appelants) | Nombreux événements UI | Événements, identifiant machine | SUPPRIMÉ |
| Statut distant / contrôle à distance | `services/RemoteStatusService.ts` | Connexion au compte | État des sessions | COUPÉ |
| Authentification OAuth MCP (`openExternal`) | `services/mcp-auth/service.ts` | Serveur MCP distant | Navigateur de l'utilisateur | COUPÉ (MCP distant retiré) |
| PR GitHub (`gh` CLI, `git remote add https://github.com/...`) | `agent-manager/WorktreeManager.ts:1566-1583` | « Checkout PR » dans l'Agent Manager | Appels `gh` / `git fetch` | COUPÉ (sous-processus, voir Limites) |
| `vscode.env.openExternal` (liens kilo.ai, docs, PR) | `browser-links.ts`, `vscode-host.ts`, `DiffViewerProvider.ts`, `pr-status-bridge.ts` | Clic utilisateur | Ouvre le navigateur système (hors processus) | Liens Kilo retirés ; autres liens conservés seulement sur clic explicite |
| Migration Roo / Kilo legacy | `legacy-migration/`, `roo-import/` | Premier lancement | Lecture de fichiers locaux | LOCAL (aucun appel réseau dans le code) |

## 2. Webview (`packages/kilo-vscode/webview-ui`, `packages/kilo-ui`, `packages/ui`)

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| CSP `img-src … https:` | `src/webview-html-utils.ts:38` | Rendu Markdown d'une réponse du modèle | Une image Markdown `![](https://x/?q=…)` exfiltre des données vers n'importe quel hôte | CSP stricte : `img-src ${cspSource} data: blob:` |
| CSP `connect-src` vers tous les ports locaux si le port est inconnu | `src/webview-html-utils.ts:6-11` | Panneaux sans port | — | Restreindre au port de la CLI |
| `frame-src` paramétrable | `src/webview-html-utils.ts:40` | Onglet navigateur intégré | URL arbitraire | COUPÉ (pas de frame distante) |
| Liens `kilo.ai`, `app.kilo.ai`, `blog.kilo.ai`, `github.com/Kilo-Org` | `webview-ui/src/components/profile/ProfileView.tsx`, réglages, i18n | Clic | Navigateur système | Retirés / rebrandés |
| Catalogue de fournisseurs (`opencode.ai`, logos) | `webview-ui/src/components/settings/provider-catalog.ts` | Réglages fournisseurs | — | COUPÉ |
| Sandbox réglages (`api.github.com`) | `webview-ui/src/components/settings/SandboxingTab.tsx` | Exemple d'hôte autorisé affiché dans l'interface | — | Texte seulement, aucune requête |

## 3. CLI embarquée (`packages/opencode/src`, `packages/core/src`, paquets `kilo-*`)

Le build de `kilo serve` est un exécutable Bun. Clients HTTP observés : `globalThis.fetch` (Bun), `effect/unstable/http` `HttpClient` (au-dessus de `fetch`), SDK `ai` / `@ai-sdk/*` (`fetch`), SDK MCP (`fetch` + SSE), `WebSocket` global, `@npmcli/arborist` (`node:http(s)`), sous-processus (`git`, `gh`, `go`, `gem`, `dotnet`, `npx`).

### 3.1 Compte, passerelle, Kilo Cloud

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| `api.kilo.ai` (profil, crédits, modes d'organisation, notifications, Kilo Pass, modèles d'embedding, tRPC) | `kilo-gateway/src/api/*.ts`, `api/constants.ts`, `api/url.ts` | Démarrage, connexion, ouverture des réglages | Jeton Kilo, identifiants d'organisation | COUPÉ |
| `ai-gateway.kilo.ai` / `api.kilo.ai/api/openrouter` (fournisseur `kilo`, `kilo-auto`) | `kilo-gateway/src/types.ts`, `opencode/src/provider/*` | Toute requête LLM vers le fournisseur Kilo | Prompts complets, code, résultats d'outils | COUPÉ (fournisseur retiré) |
| `api.kilo.ai` FIM / édition (autocomplétion) | `kilo-gateway/src/server/fim.ts`, `edit.ts` | Autocomplétion | Préfixe/suffixe du fichier | COUPÉ |
| Authentification par appareil `app.kilo.ai` | `kilo-gateway/src/auth/device.ts` | « Se connecter » | Code appareil | COUPÉ |
| Event service (WebSocket) | `kilo-gateway/src/event-service/client.ts:183` | Compte connecté | Ticket, événements | COUPÉ |
| `ingest.kilosessions.ai` (sessions, messages, résultats d'outils, diffs, statut) | `opencode/src/kilo-sessions/kilo-sessions.ts:256`, `ingest-queue.ts`, `ingest-drain.ts`, `kilo-gateway/src/cloud-sessions.ts` | Chaque mise à jour de session dès qu'un jeton Kilo valide existe | Contenu intégral des sessions | SUPPRIMÉ |
| Contrôle à distance (WebSocket `/api/user/cli`) | `opencode/src/kilo-sessions/remote-ws.ts:445` | Compte connecté | Commandes, état des sessions | SUPPRIMÉ avec l'ingestion |
| `gh` (liens de PR) | `opencode/src/kilo-sessions/pr-link-poller.ts` | Sessions cloud | Appels GitHub via `gh` | SUPPRIMÉ avec l'ingestion |
| `cloud-agent-next.kilosessions.ai`, catalogue/tRPC/stream ticket (« Continue in Cloud ») | `opencode/src/kilocode/cloud/*.ts` | Bouton « Continue in Cloud » | Session, dépôt | COUPÉ |
| Hébergement de session Kilo Cloud | `opencode/src/kilocode/session-hosting/*` | Partage / cloud | Session | COUPÉ |
| Export de session `*.kiloapps.io` | `opencode/src/kilocode/session-export/worker/*` | Export | Session | COUPÉ |
| Routage automatique `auto-routing.kiloapps.io` | `kilo-gateway/src/api/constants.ts`, `opencode/src/kilocode/auto-routing/*` | Modèle `kilo-auto` | Prompt | COUPÉ |
| Usage fournisseur (`app.kilo.ai`, `chatgpt.com`) | `core/src/kilocode/provider-usage/*` | Affichage de l'usage | Jetons | COUPÉ |
| Marketplace / archives de skills (`api.kilo.ai`) | `opencode/src/kilocode/marketplace/*` | Panneau Marketplace | Requêtes | COUPÉ |
| Import `kilo import <url>` | `opencode/src/cli/cmd/import.ts` | Commande CLI | URL de partage | COUPÉ |
| `$schema: https://app.kilo.ai/config.json` | `opencode/src/config/config.ts:382-490` | Écriture de la config | Aucune requête (chaîne écrite dans le fichier) | Rebrandé ou retiré (pas de flux) |

### 3.2 Télémétrie et observabilité

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| `us.i.posthog.com` (PostHog) | `kilo-telemetry/src/client.ts` ; importé par ~17 fichiers (`session/llm.ts`, `provider/auth.ts`, `kilocode/bootstrap.ts`…) | Démarrage, chaque requête LLM, outils, erreurs | Identifiant machine, événements, modèle, usage | SUPPRIMÉ (paquet et dépendance `posthog-node`) |
| OTLP (`@opentelemetry/exporter-trace-otlp-http`) | `core/src/observability.ts`, `control-plane/workspace.ts:533` | Si `OTEL_EXPORTER_OTLP_ENDPOINT` est défini | Traces | COUPÉ (variables vidées au lancement) + VERROU |
| Route `/telemetry/*` du serveur | `opencode/src/kilocode/server/httpapi/handlers/telemetry.ts` | Proxy de l'extension | Événements | SUPPRIMÉ |

### 3.3 Partage

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| `opncd.ai` (ou `enterprise.url`) | `opencode/src/share/share-next.ts:225` | « Partager », `KILO_AUTO_SHARE` | Session complète | COUPÉ (`KILO_DISABLE_SHARE` forcé + point d'entrée retiré) |

### 3.4 Modèles et fournisseurs

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| **`albert.api.etalab.gouv.fr/v1`** `/chat/completions`, `/models`, (`/embeddings` si indexation) | fournisseur `@ai-sdk/openai-compatible` (`opencode/src/provider/provider.ts:145`) | Chat, titres, messages de commit, découverte des modèles | Prompts, code, résultats d'outils, clé API | **AUTORISÉ** (seul hôte distant) |
| `models.dev` (`KILO_MODELS_URL`) | `core/src/models-dev.ts:171` | Démarrage, rafraîchissement périodique | User-Agent | COUPÉ : catalogue local (`KILO_MODELS_PATH`) + `KILO_DISABLE_MODELS_FETCH` |
| Snapshot `models.dev` embarqué (`KILO_MODELS_DEV`) | build de la CLI | Build | — | BUILD → remplacé par un catalogue Albert sans modèle codé en dur |
| Installation dynamique de SDK fournisseur (`Npm.add(model.api.npm)`) | `opencode/src/provider/provider.ts:1969`, `core/src/plugin/provider/dynamic.ts`, `sap-ai-core.ts` | Fournisseur non embarqué | Requête npm | COUPÉ (seul `@ai-sdk/openai-compatible`, embarqué) |
| Fournisseurs tiers (OpenAI, Anthropic, Google, Azure, Bedrock, xAI, Groq, Mistral, DeepSeek, OpenRouter, Together, Fireworks, Cerebras, DeepInfra, Vercel, Cloudflare, DigitalOcean, Snowflake, Modal, GitLab, Poe, Venice, Baseten, NVIDIA, MiniMax…) | `core/src/plugin/provider/*`, `opencode/src/plugin/*.ts`, `provider/provider.ts` | Configuration d'un fournisseur | Prompts | COUPÉ (liste blanche de fournisseurs = `albert`) |
| GitHub Copilot (`api.githubcopilot.com`, `github.com` device flow) | `opencode/src/plugin/github-copilot/*` | Connexion Copilot | Jeton, prompts | COUPÉ |
| OpenAI Codex / ChatGPT (`auth.openai.com`, `chatgpt.com`, WebSocket) | `opencode/src/plugin/openai/codex.ts`, `ws.ts`, `ws-pool.ts` | Connexion ChatGPT | Jeton, prompts | COUPÉ |
| Atomic Chat (plugin par défaut, sonde `127.0.0.1`) | `plugin-atomic-chat/*`, `opencode/src/kilocode/atomic-chat-feature.ts` | Démarrage (plugin par défaut) | Sonde locale | COUPÉ (`KILO_DISABLE_DEFAULT_PLUGINS`) |
| Anaconda Desktop (découverte locale) | `opencode/src/kilocode/anaconda-desktop/*` | Démarrage | Sonde locale | COUPÉ |
| `kilo auth login <url>` (`.well-known/opencode`) | `opencode/src/cli/cmd/providers.ts` | Commande CLI | — | COUPÉ |

### 3.5 Outils de l'agent

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| `webfetch` (URL arbitraire) | `opencode/src/tool/webfetch.ts`, `core/src/tool/webfetch.ts` | Appel d'outil par le modèle | URL choisie par le modèle (exfiltration possible) | COUPÉ (outil non enregistré) |
| `websearch` : `mcp.exa.ai`, `search.parallel.ai`, Exa via passerelle Kilo | `opencode/src/tool/websearch.ts`, `mcp-websearch.ts`, `core/src/tool/websearch.ts`, `kilocode/tool/websearch-kilo-exa.ts` | Appel d'outil | Requête de recherche | COUPÉ |
| `repo_clone` (`git clone`) | `opencode/src/tool/repo_clone.ts` | Appel d'outil | URL du dépôt | COUPÉ |
| `generate_image` (`openrouter.ai`, passerelle) | `opencode/src/kilocode/tool/generate-image.ts:19` | Appel d'outil | Prompt | COUPÉ |
| `browser_open` (navigateur intégré, URL HTTPS publique) | `opencode/src/kilocode/tool/browser-open.ts` | Appel d'outil | URL | COUPÉ |
| Code mode — catalogues OpenAPI distants | `codemode/src/openapi/*`, `opencode/src/kilocode/tool/code-mode.ts` | Expérimental | Requêtes HTTP arbitraires | COUPÉ |
| Instructions distantes (`instructions: ["https://…"]`) | `opencode/src/session/instruction.ts:119` | Config utilisateur | — | COUPÉ (URL refusées) |
| Skills distants (URL de découverte) | `opencode/src/skill/discovery.ts`, `core/src/skill/discovery.ts` | Config utilisateur | — | COUPÉ |
| Pièces jointes distantes | `opencode/src/kilocode/remote-attachments.ts` | Message avec URL | URL | COUPÉ |
| `bash` / terminal | `opencode/src/tool/shell.ts` | Appel d'outil | Commande arbitraire | **Non contrôlé par le verrou** — voir Limites |

### 3.6 Configuration, plugins, MCP

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| Config distante `.well-known/opencode` (+ `remote_config`) | `opencode/src/config/config.ts:690-718` | Entrée d'auth de type `wellknown` | En-têtes configurés | COUPÉ |
| Plugins npm de la config (`Npm.add`) → `registry.npmjs.org` (ou registre `.npmrc`) | `opencode/src/plugin/shared.ts:222`, `core/src/config/plugin/external.ts:77`, `core/src/npm.ts`, `core/src/npm-config.ts:37` | Démarrage si `plugin: [...]` | Noms de paquets | COUPÉ (`Npm.add` refuse à l'exécution ; plugins locaux `file://` seulement) |
| MCP distant (`type: "remote"`, SSE/HTTP, OAuth) | `opencode/src/mcp/*`, `opencode/src/kilocode/mcp/refresh.ts`, `cli/cmd/mcp.ts` | Config MCP | Requêtes/outils MCP | COUPÉ (seul `type: "local"` accepté) |
| MCP local (`type: "local"`, stdio) | `opencode/src/mcp/*` | Config MCP | — | AUTORISÉ, **non contrôlé par le verrou** (sous-processus) |
| Workspaces distants / control plane (proxy HTTP) | `opencode/src/control-plane/workspace.ts`, `server/routes/instance/httpapi/middleware/proxy.ts`, `workspace-routing.ts` | `KILO_EXPERIMENTAL_WORKSPACES` | Requêtes proxifiées | COUPÉ + VERROU |
| UI web embarquée / console | `opencode/src/server/shared/ui.ts` | Navigation locale | — | LOCAL (pas de repli distant dans la base) |

### 3.7 Mises à jour, binaires, LSP, formateurs

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| Vérification de version `registry.npmjs.org`, script `raw.githubusercontent.com`, `formulae.brew.sh` | `opencode/src/kilocode/installation/latest.ts`, `installation/index.ts`, `opencode/src/installation/index.ts:160`, `cli/upgrade.ts` | Démarrage | User-Agent | COUPÉ (`KILO_DISABLE_AUTOUPDATE` + point d'entrée) |
| ripgrep `github.com/BurntSushi/ripgrep/releases` | `core/src/ripgrep/binary.ts:106` | Premier `grep`/`glob` si `rg` absent | — | BUILD : `rg` embarqué dans le VSIX ; téléchargement à l'exécution coupé |
| LSP : `github.com/*/releases`, `api.github.com`, `download-cdn.jetbrains.com`, `api.releases.hashicorp.com`, `go install`, `gem install`, `dotnet tool install`, `Npm.which` (installe si absent) | `opencode/src/lsp/server.ts` (17 `fetch`, 4 sous-processus, 9 `Npm.which`) | Ouverture d'un fichier du langage | — | COUPÉ (`KILO_DISABLE_LSP_DOWNLOAD` + `Npm.add` refusé) ; LSP déjà installés sur la machine utilisables |
| Formateurs `Npm.which("prettier" / "oxfmt" / "@biomejs/biome")` → installation npm | `opencode/src/format/formatter.ts:79-148` | Après chaque édition | Noms de paquets | COUPÉ (pas d'installation ; binaire local seulement) |
| LanceDB (`Npm.add("@lancedb/lancedb")`) | `opencode/src/kilocode/lancedb.ts:36` | Indexation | — | COUPÉ avec l'indexation |
| Parseurs tree-sitter distants | `packages/tui/src/parsers-config.ts` | TUI seulement (non utilisé par `kilo serve`) | — | VERROU |
| `bwrap`, `ffmpeg` | `packages/kilo-vscode/script/bwrap-helper.ts`, `ffmpeg-helper.ts` | Build du VSIX | — | BUILD (`ffmpeg` retiré avec la reconnaissance vocale) |

### 3.8 Indexation et mémoire

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| Embeddings Voyage (`api.voyageai.com`), Ollama, OpenAI-compatible, passerelle Kilo | `kilo-indexing/src/indexing/embedders/*`, `kilo-gateway/src/api/embedding-models.ts` | Indexation (plugin par défaut) | Code source découpé | COUPÉ (`KILO_DISABLE_CODEBASE_INDEXING`) — réactivable plus tard avec `/v1/embeddings` d'Albert si LanceDB est embarqué au build |
| `kilo-memory` | `packages/kilo-memory` | Mémoire de projet | — | LOCAL (aucun client réseau dans le paquet) |

### 3.9 Divers

| Flux / hôte | Fichier | Déclencheur | Données envoyées | Décision |
|---|---|---|---|---|
| `kilo github` (Octokit, `api.github.com`, `dev.kilo.ai`) | `opencode/src/cli/cmd/github.handler.ts` | Commande CLI (non exposée par l'extension) | Jeton GitHub | COUPÉ |
| Bonjour/mDNS (`bonjour-service`) | `opencode/src` (serveur) | `--mdns` | Annonce sur le réseau local | COUPÉ |
| Proxy système (`HTTP(S)_PROXY`) transmis à la CLI | `server-manager.ts:320-381` | Réglage `http.proxy` de VS Code | — | Conservé ; le verrou s'applique avant le proxy (l'hôte final est vérifié) |

## Mise en œuvre

| Mécanisme | Où | Couvre |
|---|---|---|
| Liste d'autorisation unique | `packages/albert/src/policy.ts` | Boucle locale ; `albert.api.etalab.gouv.fr` en HTTPS sur 443 uniquement. L'URL d'Albert (`ALBERT_BASE_URL`, réglage `albertCode.apiBaseUrl`) n'accepte que cet hôte ou la boucle locale |
| Verrou CLI (processus entier) | `packages/opencode/src/albert/boot.ts`, premier import de `src/index.ts` et des workers ; `packages/albert/src/install.ts` | `fetch` (avec suivi des redirections pas à pas), `WebSocket`, `EventSource`, `node:http`/`https`, `net` (`connect`, `Socket#connect`), `tls`, `dns` (`lookup` et `resolve*`), `dgram`, `Bun.connect`, `Bun.dns.lookup`. `Bun.fetch` n'est pas modifiable par le runtime : un test statique interdit son usage |
| Verrou hôte de l'extension (bundle seulement) | `packages/kilo-vscode/script/albert-esbuild.js`, `packages/albert/src/scoped/*` | Mêmes clients, substitués au build (l'hôte d'extensions est partagé avec les autres extensions) |
| Journalisation | `packages/albert/src/guard.ts` | Chaque refus : `[albert-guard] blocked <type> <cible>` sur la sortie d'erreur et, si `ALBERT_GUARD_LOG` est défini, une ligne JSON (origine et chemin, jamais la query string) |
| Environnement imposé | `packages/albert/src/env.ts` (appliqué par l'extension au lancement et par la CLI à elle-même) | `KILO_DISABLE_SESSION_INGEST`, `_SHARE`, `_MODELS_FETCH`, `_AUTOUPDATE`, `_LSP_DOWNLOAD`, `_DEFAULT_PLUGINS`, `_CODEBASE_INDEXING`, `KILO_TELEMETRY_LEVEL=off`… ; suppression de `KILO_API_KEY`, `KILO_SESSION_INGEST_URL`, `KILO_MODELS_URL`, `OTEL_EXPORTER_OTLP_*`, `KILO_MACHINE_ID`… |
| Configuration imposée | `packages/opencode/src/albert/config.ts` (appliquée après fusion de toutes les sources) | Albert seul fournisseur ; partage, mises à jour, contrôle à distance, recherche web désactivés ; MCP distants et instructions par URL retirés ; outils réseau retirés du registre ; `bash` demande confirmation par défaut |
| Catalogue local | `packages/opencode/src/albert/catalog.ts`, `models.ts`, `script/generate.ts` | Le catalogue embarqué ne déclare qu'Albert, sans modèle ; les modèles viennent de `GET /v1/models`, mis en cache dans `~/.cache/albert-code/models.json` |
| Aucune installation à l'exécution | `packages/core/src/npm.ts` | Plugins npm, SDK de fournisseurs, LSP, formateurs, LanceDB |
| ripgrep embarqué | `packages/core/src/ripgrep/binary.ts`, `script/albert-package.ts` | Plus de téléchargement depuis GitHub à l'exécution |
| Réglages verrouillés | `packages/kilo-vscode/src/albert/settings.ts` | Navigateur / Playwright, autocomplétion, bouton d'indexation |
| CSP webview | `packages/kilo-vscode/src/webview-html-utils.ts` | `img-src` limité aux ressources de l'extension, `data:` et `blob:` ; `frame-src` limité à la boucle locale ; `connect-src` limité à la CLI locale |

## Vérifications

| Vérification | Résultat |
|---|---|
| Test réseau E2E (`packages/albert/e2e/run.sh`), CLI réelle dans un espace réseau isolé, faux Albert | Démarrage, découverte des modèles, session, appel d'outil `write`, titre, message de commit et commit, redémarrage : **0 requête DNS, 0 paquet sortant, 0 refus du verrou** |
| Test négatif (`negative.sh`) | La fuite volontaire (`leak.example.org`) est détectée : 2 requêtes DNS, 11 paquets attribués à cet hôte |
| Test VS Code (`run.sh --vscode`), VSIX sur profil vierge dans l'espace isolé | Activation, lancement de la CLI, découverte des modèles, aucun refus du verrou. Seuls `redirector.gvt1.com` (mises à jour de composants Chromium) et `main.vscode-cdn.net` apparaissent ; un VS Code vierge sans l'extension les contacte aussi |
| Test E2E Windows (`packages/albert/e2e/windows.ps1`, CI sur `windows-2025`), CLI Windows du VSIX, faux Albert | Même scénario. Sans espace réseau isolé : les connexions ouvertes par `kilo.exe` et `rg.exe` sont relevées par l'audit du Windows Filtering Platform (événements 5156/5157) et doivent toutes viser la boucle locale ; aucun refus du verrou. Le test négatif (`-Leak`) vérifie qu'une connexion externe est bien relevée. **Moins strict que sous Linux** : les requêtes DNS passent par le service client DNS de Windows et ne peuvent pas être attribuées, et les sous-processus hors du dossier de l'extension (`git`) ne sont pas observés |
| Session réelle contre Albert, CLI tracée par `strace -e connect` | Fournisseur unique `albert`, 7 modèles de chat lus sur `/v1/models`, outils `write` et `bash` (confirmation demandée), titre et message de commit par Albert. Une seule connexion distante : `142.44.61.228:443` (`albert.api.etalab.gouv.fr`) ; le reste est le résolveur local (`127.0.0.53`, `nscd`) |

### Flux trouvés pendant les tests et corrigés

| Flux | Trouvé par | Correction |
|---|---|---|
| `ai-gateway.kilo.ai/api/v1/embedding-models` depuis l'hôte de l'extension | Test VS Code (refusé et journalisé par le verrou de l'extension) | Catalogue vide renvoyé sans requête |
| Échec d'activation de l'extension (objets de configuration figés de VS Code) | Test VS Code | Réglages verrouillés par dérivation au lieu d'un `Proxy` |

### Recherche des hôtes dans le VSIX (`script/albert-scan.ts`)

Une chaîne présente dans le bundle n'est pas un flux. La recherche sert à vérifier qu'aucun hôte retiré avec son code ne subsiste, et à justifier les autres :

| Hôte | Hôte ext. | Webview | CLI | Justification |
|---|---|---|---|---|
| `albert.api.etalab.gouv.fr` | 2 | 0 | 6 | Seul flux distant autorisé |
| `us.i.posthog.com`, `ingest.kilosessions.ai`, `supermassive-black-hole.kiloapps.io` | 0 | 0 | 0 | Code supprimé ; le scan échoue s'ils réapparaissent |
| `models.dev`, `opncd.ai`, `mcp.exa.ai`, `search.parallel.ai`, `api.githubcopilot.com`, `chatgpt.com`, `download-cdn.jetbrains.com`, `api.releases.hashicorp.com`, `formulae.brew.sh` | 0 | 0 | 0 | Absents du bundle |
| `api.kilo.ai`, `app.kilo.ai`, `ai-gateway.kilo.ai`, `kiloapps.io` | 1–2 | 0–4 | 0–2 | Constantes de `kilo-gateway` et liens (code inatteignable : passerelle, compte et marketplace coupés ; toute requête serait refusée par le verrou) |
| `registry.npmjs.org`, `raw.githubusercontent.com`, `api.github.com`, `openrouter.ai`, `api.openai.com`, `api.anthropic.com`, `api.voyageai.com` | 0 | 0–171 | 1–6 | CLI : défauts de clients retirés (npm, mises à jour, fournisseurs tiers, embeddings) dont les points d'entrée sont coupés. Webview : textes de documentation et grammaires de coloration, sans requête (CSP) |
| `opencode.ai`, `kilo.ai` (webview) | 0 | 29–312 | 0–5 | Liens de documentation et schémas JSON dans les textes, sans requête (CSP) |

## Limites

Le verrou ne contrôle **pas** :

- les commandes lancées par l'outil `bash` / le terminal ;
- les serveurs MCP locaux (sous-processus) ;
- `git` et `gh` lancés par l'utilisateur ou l'Agent Manager ;
- le navigateur système ouvert par un lien.

Une confirmation est exigée par défaut avant chaque commande `bash`. Pour un cloisonnement strict, utilisez un pare-feu système (procédure dans `README.md`). L'isolation n'est jamais totale.
