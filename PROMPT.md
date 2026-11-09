```markdown
# Mission : créer Albert Code, un fork de l'extension VS Code Kilo Code

Crée, à partir du code présent dans le dépôt courant, un fork de Kilo Code (https://github.com/Kilo-Org/kilocode, licence MIT) dont l'extension, à l'exécution, ne contacte que l'hôte `albert.api.etalab.gouv.fr` (API compatible OpenAI, URL de base `https://albert.api.etalab.gouv.fr/v1`). Retire ou désactive toutes les fonctions qui dépendent d'un autre serveur.

Dépôt de travail : le dépôt courant (privé), déjà initialisé avec le code du tag Kilo à forker. Ne change pas de version de base et ne re-clone pas Kilo.

Le nom « Albert Code » a été autorisé par la DINUM. Ne publie que par les canaux décrits dans `RELEASE.md` (GitHub Release et VS Code Marketplace), et seulement à ma demande.

## Avant toute modification
1. Identifie le tag de base (historique Git, `package.json`, `CHANGELOG.md`) et note-le dans `UPSTREAM.md`. S'il reste incertain, demande-le-moi.
2. Vérifie que l'arbre de travail est propre et que le dépôt contient bien tout le monorepo (`packages/kilo-vscode`, `packages/opencode`, `packages/core`).
3. Vérifie si le dépôt partage son historique avec Kilo. Ne réécris pas l'historique existant et ne force aucun push.

## Principes
- Fork mince : limite le diff pour que les mises à jour depuis Kilo restent possibles. Marque les changements dans le code existant avec `albert_change`.
- Refus par défaut : toute connexion sortante non autorisée échoue et est journalisée.
- Vérifie par le code et par des tests. Ce prompt peut être dépassé, et les docs de Kilo ne suffisent pas : `PRIVACY.md` annonce que Kilo n'a pas accès aux prompts, alors que le code envoie les sessions à son service d'ingestion.
- Les contraintes réseau portent sur l'exécution. Les registres de paquets restent permis au build.

## Points de départ (à vérifier sur le code du dépôt)
- L'extension (`packages/kilo-vscode`) lance une CLI embarquée (`kilo serve`, voir `src/services/cli-backend/server-manager.ts`), issue de `packages/opencode` et `packages/core`. Forke donc les deux.
- Le code de base est celui du dépôt courant. Kilo prépare une v2 : n'importe aucun changement de `main` ni d'un autre tag sans mon accord.
- Flux connus :
  - `api.kilo.ai`, `app.kilo.ai`, `ai-gateway.kilo.ai`
  - `ingest.kilosessions.ai` (sessions, messages, résultats d'outils, diffs), `opncd.ai` (partage)
  - `us.i.posthog.com` (télémétrie), `models.dev`
  - `registry.npmjs.org`, `api.github.com` (mises à jour, téléchargements de LSP)
  - `mcp.exa.ai`, `search.parallel.ai`, et les fournisseurs tiers
- Variables existantes : `KILO_DISABLE_SESSION_INGEST`, `KILO_DISABLE_SHARE`, `KILO_DISABLE_MODELS_FETCH`, `KILO_DISABLE_AUTOUPDATE`, `KILO_DISABLE_LSP_DOWNLOAD`, `KILO_DISABLE_DEFAULT_PLUGINS`, `KILO_MODELS_PATH`. Elles ne garantissent rien à elles seules.
- Albert ne sert pas `/v1/completions`, `/v1/responses` ni `/v1/messages`. Les identifiants de modèles changent : lis-les via `/v1/models`, sans en coder aucun en dur.

## Travail à réaliser
1. **Inventaire.** Avant de modifier le code, liste tous les flux sortants : `fetch`, clients HTTP, WebSocket, sous-processus, téléchargements de binaires ou de runtimes (ffmpeg, Playwright, etc.), plugins, webview et ressources distantes. Consigne-les dans `NETWORK.md` (fichier, déclencheur, données envoyées, décision).
2. **Verrou réseau.** Ajoute une liste d'autorisation centrale, côté CLI et côté hôte de l'extension, et une CSP stricte pour la webview. Vérifie que chaque client HTTP y passe. L'URL d'Albert est modifiable uniquement par un réglage dédié, et son hôte doit rester dans la liste d'autorisation.
3. **Configuration imposée.** Force les variables au lancement de la CLI. Albert est le seul fournisseur, sans passerelle ni connexion à un compte. Stocke la clé dans le SecretStorage de VS Code ou lis-la depuis `ALBERT_API_KEY`, sans jamais la journaliser ni la committer. Utilise un catalogue de modèles local, complété par `/v1/models`.
4. **Fonctions à retirer :**
   - compte, passerelle, `kilo-auto`, BYOK ;
   - historique cloud, partage, contrôle à distance, « Continue in Cloud » ;
   - télémétrie, y compris la dépendance PostHog ;
   - autocomplétion, marketplace, recherche web, `webfetch`, MCP distant, reconnaissance vocale ;
   - mises à jour automatiques, téléchargement de LSP, fournisseurs tiers ;
   - indexation du code, sauf si elle fonctionne avec les embeddings d'Albert sans autre flux.

   Supprime le code de la télémétrie et de l'envoi des sessions. Pour le reste, coupe aux points d'entrée et masque l'interface, sans laisser de bouton mort.
5. **Fonctions à conserver.** Chat, agents et modes, édition de fichiers, terminal, sessions locales, titres et messages de commit via un modèle Albert, MCP local.
6. **Rebranding.** Change le nom, l'éditeur, l'identifiant de l'extension, les icônes, les textes et les liens. Retire les marques Kilo de l'interface, en gardant les mentions factuelles d'origine. Conserve `LICENSE` et les copyrights de Kilo Code et d'OpenCode. Évite tout logo ou formulation suggérant un produit officiel de l'État.
7. **Tests.** Crée un test E2E exécuté dans un espace réseau isolé, avec un serveur factice compatible OpenAI à la place d'Albert. Il parcourt démarrage, session, appel d'outil, commit, redémarrage et échoue à toute tentative de connexion externe, DNS compris. Ajoute un test négatif prouvant qu'une fuite volontaire est détectée. Intègre l'ensemble à la CI.
8. **Maintenance.** Rédige `UPSTREAM.md` : tag de base, procédure de mise à jour depuis Kilo, points de conflit attendus, passage obligatoire du test réseau.
   - Si le dépôt partage son historique avec Kilo, documente une mise à jour par `git merge` du nouveau tag.
   - Si c'est un import sans historique, `git merge` ne pourra pas s'appuyer sur un ancêtre commun. Crée une branche `upstream` à partir du commit initial, qui ne contient que le code de Kilo. Pour chaque nouvelle version, remplace son contenu par celui du nouveau tag, commite, puis fusionne `upstream` dans `albert/main`.

## Limite à documenter
Le verrou ne contrôle pas les commandes lancées par l'outil `bash` ni les serveurs MCP locaux. Exige une confirmation avant chaque commande par défaut et documente un pare-feu système pour un cloisonnement strict. N'affirme jamais que l'isolation est totale.

## Livrables
- Branche `albert_code` dans le dépôt courant, avec des commits atomiques partant de l'état initial, que tu ne réécris pas
- VSIX installable, construit avec la procédure documentée
- `NETWORK.md`, `UPSTREAM.md`, `README.md` (installation, configuration, limites)
- Rapport final : tag de base, fonctions retirées, résultats des tests, écarts et risques restants

## Critères d'acceptation
- [ ] Le test réseau passe et son test négatif détecte la fuite.
- [ ] Une recherche des hôtes de `NETWORK.md` dans le bundle final ne révèle aucun flux actif non justifié.
- [ ] Une session complète fonctionne contre le serveur factice et, si `ALBERT_API_KEY` est disponible, contre Albert.
- [ ] Le VSIX s'installe sur un profil VS Code vierge, sans demande de connexion à Kilo.
- [ ] Les vérifications de types, le lint et les tests unitaires des paquets modifiés passent.

## Quand t'arrêter et demander
- Le tag de base reste incertain, ou le dépôt est incomplet.
- Une fonction de la liste « à conserver » dépend d'un serveur tiers.
- Une action sortirait du dépôt courant, ou exigerait une publication, un compte ou un secret absent.
- Un test échoue pour une raison que tu ne peux pas corriger sans affaiblir le verrou.

Ne désactive jamais un test ou le verrou pour obtenir un résultat vert. Commence par les vérifications préalables et l'inventaire, puis présente-les avec ton plan avant de modifier le code.
```