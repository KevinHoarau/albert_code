# Albert Code

Albert Code est une extension VS Code d'agent de développement (chat, agents et modes, édition de fichiers, terminal, sessions locales, MCP local). À l'exécution, elle ne contacte que l'API Albert (`albert.api.etalab.gouv.fr`, compatible OpenAI).

C'est un fork non officiel de [Kilo Code](https://github.com/Kilo-Org/kilocode) v7.8.18, lui-même dérivé d'[OpenCode](https://github.com/anomalyco/opencode). Il est distribué sous licence MIT (voir [LICENSE](LICENSE)). Ce n'est pas un produit de l'administration ; l'usage du nom « Albert Code » a été autorisé par la DINUM.

Documents liés :

- [NETWORK.md](NETWORK.md) : inventaire des flux sortants et décisions ;
- [UPSTREAM.md](UPSTREAM.md) : version de base et procédure de mise à jour depuis Kilo ;
- [RELEASE.md](RELEASE.md) : numéros de version et publication.

## Installation

Depuis le VS Code Marketplace : cherchez **Albert Code** (éditeur `khoarau`) dans la vue Extensions, ou lancez `code --install-extension khoarau.albert-code`.

Ou depuis un fichier, téléchargé dans l'onglet *Releases* du dépôt GitHub (vérifiez-le avec le fichier `.sha256` publié à côté) :

```bash
code --install-extension albert-code-X.Y.Z-linux-x64.vsix   # ou albert-code-X.Y.Z-win32-x64.vsix
```

Ou bien : VS Code → Extensions → `…` → *Install from VSIX…*.

Deux cibles sont construites : `linux-x64` et `win32-x64` (Windows x64). macOS n'est pas encore disponible. Le VSIX embarque :

- la CLI (`bin/kilo`, `bin/kilo.exe` sous Windows) ;
- `ripgrep` (`bin/rg`, `bin/rg.exe`) ;
- sous Linux seulement, `bwrap` pour le bac à sable des commandes.

Sous Windows, les binaires ne sont pas signés : un antivirus d'établissement peut les bloquer ou ralentir leur premier lancement.

Il n'embarque ni ffmpeg ni Playwright.

## Configuration

Tout se règle dans le panneau **Albert Code → Paramètres**, onglet **Albert** (premier onglet) :

| Réglage | Effet |
|---|---|
| Clé API | Stockée dans le SecretStorage de VS Code, jamais réaffichée ni écrite dans un fichier. À défaut, la variable d'environnement `ALBERT_API_KEY` est utilisée. Aussi disponible par la commande **Albert Code: Set Albert API Key** |
| URL de l'API | Réglage `albertCode.apiBaseUrl`, `https://albert.api.etalab.gouv.fr/v1` par défaut. Seul l'hôte Albert (en HTTPS) ou une adresse de bouclage (tests) est accepté |
| Modèles disponibles | Liste en lecture seule des modèles renvoyés par `/v1/models` |

Le modèle par défaut, le petit modèle (titres, messages de commit), le modèle des sous-agents et celui de la compaction se choisissent dans l'onglet **Modèles**, parmi les modèles d'Albert.

Aucun identifiant de modèle n'est codé en dur. Au démarrage, la CLI lit `GET /v1/models`, garde les modèles de chat et met la réponse en cache pour les démarrages hors ligne. Les titres de session et les messages de commit utilisent un modèle Albert.

Après un changement de clé ou d'URL, l'extension redémarre son backend (la CLI lit la clé et l'URL au démarrage) : inutile de recharger la fenêtre. Une session en cours est interrompue par ce redémarrage.

### Coexistence avec Kilo Code

Albert Code peut être installé à côté de Kilo Code. Au packaging, tous les identifiants VS Code sont renommés : commandes, vues, panneaux, réglages, clés de contexte et types de tâches passent de `kilo-code.*` à `albert-code.*`. L'état de l'Agent Manager d'un projet est stocké dans `.kilo/albert-agent-manager.json` au lieu de `.kilo/agent-manager.json`. Les deux extensions ne partagent ni commande ni état ; elles partagent seulement les fichiers de configuration du projet (`.kilo/kilo.json`, règles, agents).

Une seule interaction connue subsiste : les deux Agent Managers interceptent les commandes de panneau de VS Code (`workbench.action.togglePanel`…). La seconde extension activée perd uniquement le suivi de visibilité de son terminal d'agent.

Les réglages VS Code d'Albert Code s'appellent donc `albert-code.*` (par exemple `albert-code.language`). Une version de développement lancée depuis les sources (`bun run extension`) garde les identifiants Kilo : ne la lancez pas à côté de Kilo Code.

Les données, le cache et la configuration de la CLI vivent dans des dossiers `albert-code` (`~/.local/share/albert-code`, `~/.cache/albert-code`, `~/.config/albert-code`). Ils ne sont jamais partagés avec une installation de Kilo.

## Ce qui a été retiré

- Compte Kilo, passerelle Kilo, `kilo-auto`, BYOK et tous les fournisseurs autres qu'Albert.
- Historique cloud, partage, contrôle à distance, « Continue in Cloud », envoi des sessions (code supprimé).
- Télémétrie, y compris la dépendance PostHog (code supprimé).
- Autocomplétion, marketplace, recherche web, `webfetch`, clonage de dépôt, génération d'images, navigateur intégré, MCP distant, reconnaissance vocale.
- Mises à jour automatiques, téléchargement de LSP, de formateurs ou de paquets npm à l'exécution.
- Indexation du code. Elle pourrait revenir avec les embeddings d'Albert, à condition d'embarquer LanceDB au build.

## Verrou réseau

- **CLI :** au démarrage, avant tout autre module, la CLI impose son environnement et enveloppe `fetch`, `WebSocket`, `http(s)`, `net`, `tls`, `dns`, `dgram` et `Bun.connect`. Seuls la boucle locale et `albert.api.etalab.gouv.fr:443` passent. Toute autre tentative échoue et est journalisée (sortie d'erreur et `ALBERT_GUARD_LOG`).
- **Hôte de l'extension :** le même contrôle s'applique au bundle de l'extension (l'hôte d'extensions est partagé avec les autres extensions, on ne modifie donc pas ses globaux).
- **Webview :** CSP stricte, sans image ni cadre distants.

Le détail des flux se trouve dans [NETWORK.md](NETWORK.md).

## Limites (à lire)

**L'isolation n'est pas totale.** Le verrou ne contrôle pas :

- les commandes lancées par l'agent avec l'outil `bash` / le terminal (`curl`, `git`, `npm`…) ;
- les serveurs MCP locaux, qui sont des sous-processus ;
- `git` et `gh` lancés par l'Agent Manager, et le navigateur ouvert par un lien ;
- VS Code lui-même. Le test VS Code observe par exemple `redirector.gvt1.com` (mises à jour de composants Chromium) et `main.vscode-cdn.net`, contactés par VS Code même sans l'extension.

Chaque commande `bash` exige une confirmation par défaut. Ne modifiez pas cette règle si vous dépendez de l'isolation.

Sous Windows, le verrou est le même code que sous Linux, mais sa vérification est moins stricte (voir [NETWORK.md](NETWORK.md#vérifications)), et ce README ne donne d'exemple de pare-feu que pour Linux.

### Cloisonnement strict par pare-feu système (Linux)

Pour un cloisonnement strict, exécutez VS Code sous un utilisateur dédié, puis n'autorisez que la boucle locale, le DNS et Albert. Exemple avec nftables :

```bash
# 1. Utilisateur dédié
sudo useradd -m albertcode
# 2. Règles : l'utilisateur albertcode ne sort que vers la boucle locale, le DNS et Albert
ALBERT_IPS=$(getent ahostsv4 albert.api.etalab.gouv.fr | awk '{print $1}' | sort -u | paste -sd, -)
sudo nft -f - <<EOF
table inet albertcode {
  chain out {
    type filter hook output priority 0; policy accept;
    meta skuid != "albertcode" accept
    oifname "lo" accept
    udp dport 53 accept
    tcp dport 53 accept
    ip daddr { $ALBERT_IPS } tcp dport 443 accept
    counter log prefix "albertcode-blocked " drop
  }
}
EOF
# 3. Lancer VS Code sous cet utilisateur
sudo -u albertcode -H code
```

Si les adresses d'Albert changent, il faut relancer l'étape 2. Avec un proxy d'entreprise, autorisez le proxy au lieu des adresses d'Albert, et filtrez l'hôte au niveau du proxy. Les tentatives bloquées apparaissent dans le journal du noyau (`journalctl -k | grep albertcode-blocked`).

## Construire

Prérequis : Linux, `bun@1.4.4` et Zig 0.14.0 (pour l'aide Bubblewrap ; empreinte SHA-256 dans `.github/workflows/albert.yml`). Les accès réseau (registre npm, GitHub Releases, ziglang.org) n'ont lieu qu'au build. La CLI Windows est compilée depuis Linux ; elle a besoin des paquets natifs de toutes les plateformes, d'où les options de `bun install`.

```bash
bun install --os='*' --cpu='*'
export ZIG=/chemin/vers/zig
bun --cwd packages/kilo-vscode script/albert-package.ts --rebuild-cli   # --target=linux-x64 ou --target=win32-x64 pour une seule cible
# -> packages/kilo-vscode/out/albert-code-{linux-x64,win32-x64}.vsix, puis inventaire des hôtes présents
```

## Tests

| Commande | Ce qu'elle vérifie |
|---|---|
| `bun test` dans `packages/albert` | Liste d'autorisation, enveloppes réseau, variables imposées |
| `bun test test/albert` dans `packages/opencode` | Configuration imposée, découverte des modèles, absence d'envoi des sessions |
| `bun run test:unit` dans `packages/kilo-vscode` | Tests de l'extension, CSP, réglages verrouillés, marque |
| `bash packages/albert/e2e/run.sh <bin/kilo>` | **Test réseau E2E** : CLI réelle dans un espace réseau isolé, faux serveur compatible OpenAI ; démarrage, session, appel d'outil, titre, commit, redémarrage ; échec à la moindre requête DNS, au moindre paquet sortant ou refus du verrou |
| `bash packages/albert/e2e/negative.sh <bin/kilo>` | **Test négatif** : une fuite volontaire doit être détectée |
| `bash packages/albert/e2e/run.sh --vscode <vsix>` | VS Code réel sur un profil vierge, dans l'espace isolé (nécessite un affichage ou `xvfb-run`) |
| `packages/albert/e2e/windows.ps1 -Bin <bin\kilo.exe> [-Leak]` (Windows, PowerShell administrateur ; lancé par la CI sur un runner Windows) | **Test E2E Windows** : même scénario, connexions de `kilo.exe` et `rg.exe` auditées par le Windows Filtering Platform ; échec à la moindre connexion hors boucle locale ou refus du verrou. `-Leak` : une fuite volontaire doit être détectée |
| `E2E_ALSO=<dossier de Kilo Code> bash packages/albert/e2e/run.sh --vscode <vsix>` | Coexistence : Kilo Code et Albert Code dans le même VS Code, sans doublon d'enregistrement ; seuls les refus du verrou d'Albert décident du verdict réseau |

Le test réseau doit passer avant toute fusion depuis Kilo (voir [UPSTREAM.md](UPSTREAM.md)).

## Licence et crédits

MIT. Copyright (c) Kilo Code et les contributeurs d'OpenCode. Voir [LICENSE](LICENSE).
