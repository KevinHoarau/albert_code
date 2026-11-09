# Upstream — Albert Code

## Version de base

| Élément | Valeur |
|---|---|
| Projet amont | Kilo Code — https://github.com/Kilo-Org/kilocode (MIT) |
| Tag de base | `v7.8.18` |
| Commit amont du tag | `b81761530650f8ec7b071441f4f54d2514f1a244` (arbre `3db365894750ec12ef88ae01ba8dfb069452cc49`) |
| Import local | `b88ea19` + `7d5d032` « Original Kilo Code 7.8.18 » (import en deux commits) |
| Import complété | `38d6e35` sur la branche `upstream` : arbre identique à celui du tag |

L'identification repose sur quatre éléments :

- `packages/kilo-vscode`, `packages/opencode` et `packages/core` sont en `7.8.18` ;
- `packages/kilo-vscode/CHANGELOG.md` commence à `## 7.8.18` ;
- `git ls-remote --tags https://github.com/Kilo-Org/kilocode.git v7.8.18` renvoie le commit ci-dessus ;
- l'arbre de `38d6e35` a le même hash que l'arbre du tag.

### Écart corrigé à l'import

L'import initial omettait 205 fichiers du tag, sans aucun fichier modifié ni ajouté :

- tous les fichiers et dossiers racine commençant par un point (`.github/`, `.gitignore`, `.oxlintrc.json`, `.husky/`, `.changeset/`, `.kilo/`, `.opencode/`…) ;
- `packages/opencode/script/build-node.ts`.

Ils ont été restaurés à l'identique depuis le même tag, dans le commit `38d6e35` de la branche `upstream`.

## Branches

| Branche | Contenu |
|---|---|
| `upstream` | Uniquement le code de Kilo, un commit par version importée. Ne jamais y commiter de changement Albert. |
| `albert_code` | Branche de travail du fork. Reçoit `upstream` par `git merge`. |
| `main` | Branche stable : uniquement les versions validées d'`albert_code`, en avance rapide (`git merge --ff-only albert_code`). Aucun commit direct. |

Une version est validée quand la CI `albert` est verte sur `albert_code`, que le test réseau et son test négatif passent, et que le VSIX construit a été vérifié. On la publie alors sur `main` :

```bash
git switch main
git merge --ff-only albert_code
git push origin main
git switch albert_code
```

Le dépôt **ne partage pas** son historique avec Kilo (racine locale `b88ea19`). Un `git merge` direct d'un tag Kilo n'aurait donc aucun ancêtre commun. C'est la branche `upstream` qui sert d'ancêtre commun.

## Procédure de mise à jour vers un nouveau tag Kilo

N'importez jamais la branche `main` de Kilo ni un autre tag que celui choisi, et faites valider le choix du tag. La mise à jour se fait sur `albert_code` ; `main` ne la reçoit qu'une fois validée.

```bash
TAG=v7.9.0   # exemple
# 1. Récupérer le tag (seuls ses objets, sans historique)
git fetch --depth 1 https://github.com/Kilo-Org/kilocode.git "refs/tags/$TAG:refs/tags/kilo-$TAG"

# 2. Remplacer le contenu de upstream par celui du tag
git switch upstream
git rm -rq .
git checkout "kilo-$TAG" -- .
git commit -m "chore(upstream): Kilo Code $TAG"
test "$(git rev-parse HEAD^{tree})" = "$(git rev-parse "kilo-$TAG^{tree}")" && echo "arbre identique au tag"

# 3. Fusionner dans le fork
git switch albert_code
git merge upstream
```

Après résolution des conflits, et avant de commiter la fusion :

1. **Inventorier les nouveaux flux.** Cherchez dans l'amont tout nouvel appel réseau, puis mettez [NETWORK.md](NETWORK.md) à jour :

   ```bash
   git diff 38d6e35 upstream -- packages | grep -E '^\+.*(fetch\(|https?://|new WebSocket|http\.request|Npm\.add|spawn\()'
   ```

2. **Vérifier les marqueurs.** Le compte doit rester cohérent (127 dans `packages/` à la base 7.8.18) :

   ```bash
   git grep -c albert_change -- packages | awk -F: '{s+=$2} END {print s}'
   ```

3. **Lancer les vérifications.**
   - Types : `bun run typecheck` dans `albert`, `opencode`, `core`, `kilo-telemetry`, `kilo-gateway` et `kilo-vscode`.
   - Lint : `bun run lint` dans `kilo-vscode`.
   - Tests unitaires, comme dans `.github/workflows/albert.yml`.

4. **Passer le test réseau. C'est obligatoire.**

   ```bash
   (cd packages/opencode && bun run script/build.ts --single --skip-install)
   bash packages/albert/e2e/run.sh packages/opencode/dist/@kilocode/cli-linux-x64/bin/kilo
   bash packages/albert/e2e/negative.sh packages/opencode/dist/@kilocode/cli-linux-x64/bin/kilo
   bun --cwd packages/kilo-vscode script/albert-package.ts
   bash packages/albert/e2e/run.sh --vscode packages/kilo-vscode/out/albert-code-linux-x64.vsix
   ```

   Aucune fusion ne doit être poussée si `run.sh` ou `albert-scan.ts` échoue, ou si `negative.sh` ne détecte pas la fuite. Ne retirez jamais un hôte de la détection, et ne touchez pas au verrou pour obtenir un résultat vert. Si un nouvel hôte apparaît, coupez son point d'entrée ; s'il vient de VS Code lui-même, prouvez-le avec un VS Code sans l'extension avant de l'ajouter à `vscode-core-hosts.txt`.

5. **Contrôler les workflows.** Tout nouveau workflow amont fait échouer `script/check-workflows.ts`. Déplacez-le dans `.github/workflows/disabled/` (suffixe `.disabled`), sauf décision contraire.

## Organisation du fork

- Le code propre à Albert est dans des dossiers à part, sans marqueur :
  - `packages/albert/` : liste d'autorisation, verrou, environnement, tests E2E ;
  - `packages/opencode/src/albert/` ;
  - `packages/kilo-vscode/src/albert/` ;
  - `packages/kilo-vscode/script/albert-*`.
- Chaque modification d'un fichier existant porte `albert_change` (ligne, ou bloc `albert_change start` / `albert_change end`). Les marqueurs `kilocode_change` existants sont conservés.
- **Mode Albert.** La CLI le reconnaît à `ALBERT_CODE=1`, que `albert/boot.ts` pose avant tout autre module dans chaque point d'entrée livré (CLI et workers). Les comportements propres à Albert (fournisseur unique, configuration imposée, outils retirés, refus d'installation npm, pas de rafraîchissement de `models.dev`, pas de téléchargement de ripgrep) en dépendent. Les tests unitaires amont, qui importent les modules sans passer par un point d'entrée, testent donc toujours le comportement amont. Les tests `test/albert` testent le mode Albert, et le test E2E teste le binaire livré.

## Points de conflit attendus

| Zone | Fichiers | Résolution |
|---|---|---|
| Points d'entrée CLI | `packages/opencode/src/index.ts`, `src/cli/tui/worker.ts`, `src/kilocode/session-export/worker.ts`, `src/kilocode/indexing-worker.ts` | `import "…/albert/boot"` doit rester la **première** ligne. Tout nouveau worker ou point d'entrée doit l'importer en premier |
| Plugins, config, outils | `src/plugin/index.ts`, `src/config/config.ts`, `src/tool/registry.ts` | Garder l'appel Albert ; vérifier que les nouveaux outils réseau sont ajoutés à `TOOLS` dans `src/albert/config.ts` |
| Core | `packages/core/src/npm.ts`, `models-dev.ts`, `ripgrep/binary.ts`, `global.ts` | Garder le refus d'installation, l'absence de rafraîchissement, le binaire embarqué, le dossier `albert-code` |
| Build CLI | `packages/opencode/script/generate.ts`, `script/build.ts` | Catalogue Albert seul ; test de fumée « aucun fournisseur tiers » |
| Envoi des sessions | `src/kilo-sessions/*`, `src/kilocode/session-export/worker/*`, `src/cli/cmd/import.ts`, `packages/kilo-gateway/src/cloud-sessions.ts` | Garder les versions inertes ; ne jamais réintroduire de client vers `ingest.kilosessions.ai` |
| Télémétrie | `packages/kilo-telemetry/*` | Garder les stubs ; si l'amont ajoute une fonction, l'ajouter vide. Ne jamais réintroduire `posthog-node` |
| Extension | `esbuild.js`, `package.json` (manifeste), `src/extension.ts`, `src/KiloProvider.ts`, `server-manager.ts`, `provider-actions.ts`, `features.ts`, `webview-html-utils.ts`, onglets de réglages, `model-selection.ts`, `language-utils.ts`, i18n `t()`, `constants.ts`, icônes | Le manifeste a été réécrit (identité, commandes et réglages retirés) : réappliquer les retraits sur les nouvelles entrées amont |
| Tests amont adaptés | Tests de `kilo-vscode` et `opencode` portant `albert_change` | Ajuster les attentes (libellés Albert Code, CSP, dossier `albert-code`) |
| Identifiants VS Code | `packages/kilo-vscode/script/albert-ids.ts` | Les sources gardent `kilo-code.new.*` ; le packaging renomme tout en `albert-code.*`. Si l'amont introduit un nouvel espace de noms (autre préfixe que `kilo-code.new`, `kilo-code.SidebarProvider`, `kilo-code-ActivityBar`, `kilo-code.agentTerminalFocus`, `kilo-code.nextEdit`, `kilo-worktree-*`, `agent-manager.json`), ajouter une règle : `tests/unit/albert-ids.test.ts` et `albert-scan.ts` échouent sinon |
| Workflows | `.github/workflows/*` | Les workflows Kilo vivent dans `disabled/` ; un workflow amont modifié y sera détecté comme renommé |

## Tests amont incompatibles par construction

Dans cet environnement, la suite complète `packages/opencode` (`bun test`) compte 1 888 échecs sur la branche `upstream` et 1 854 sur `albert_code`. Les échecs amont viennent de l'environnement (tests d'intégration lents ou dépendants de l'hôte) : ils ne sont pas dus au fork.

**42 tests échouent seulement sur `albert_code`.** Tous lancent le vrai point d'entrée de la CLI en sous-processus, donc en mode Albert :

| Fichiers | Cause |
|---|---|
| `test/cli/run/run-process.test.ts`, `run-stdin.process.test.ts`, `run-empty.process.test.ts`, `test/cli/acp/config-options.test.ts`, `lifecycle.test.ts`, `prompt-content.test.ts`, `test/cli/smokes/read-only.test.ts`, `test/kilocode/headless-session-drain.test.ts` | Ces tests configurent un fournisseur `test` (`test/test-model`, `test/parent`) : le point d'entrée n'accepte qu'Albert (« Model not found ») |
| `test/cli/mcp-add.test.ts` | Configuration attendue dans `~/.config/kilo/` (désormais `~/.config/albert-code/`) ; serveur MCP distant refusé |
| `test/cli/serve/serve-process.test.ts` (« kills the subprocess on scope close ») | Dépend de l'environnement : échoue aussi sur `upstream` lorsqu'il est lancé seul |

Ces tests n'ont été ni désactivés ni modifiés, et le verrou n'a pas été affaibli pour eux. Pour les rendre verts, il faudrait les réécrire avec le fournisseur `albert` pointant vers un serveur local (`ALBERT_BASE_URL=http://127.0.0.1:…`). Ce travail reste à faire.

Attention : sans `ALBERT_BASE_URL`, ces tests font contacter `albert.api.etalab.gouv.fr` par la CLI (hôte autorisé, réponse 401 sans clé). La CI d'Albert Code ne les lance donc pas.

Les tests ciblés de la CI (`test/albert`, `test/config`, `test/tool/registry.test.ts`, `test/plugin`, `test/provider`, `test/session`, et les suites de `core`, `albert`, `kilo-telemetry` et `kilo-vscode`) passent.
