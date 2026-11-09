# Publier une version

Le nom « Albert Code » a été autorisé par la DINUM. Albert Code est publié par deux canaux seulement :

| Canal | Où | Qui publie |
|---|---|---|
| GitHub Release | dépôt public `KevinHoarau/albert_code`, onglet *Releases* | la CI, à partir d'un tag `vX.Y.Z` sur `main` |
| VS Code Marketplace | éditeur `khoarau`, extension `khoarau.albert-code` | la CI, avec le VSIX de la GitHub Release, après ton approbation |

Aucun autre canal (Open VSX, npm, autre place de marché) sans décision explicite. Seule la cible `linux-x64` est construite : le Marketplace ne propose donc l'extension qu'aux utilisateurs Linux x64.

## Numéros de version

- Série propre à Albert Code, en semver `MAJEUR.MINEUR.CORRECTIF` (`1.0.0`, `1.0.1`, `1.1.0`…), sans lien avec les versions de Kilo Code. Le Marketplace refuse les suffixes (`1.0.0-beta`) et un numéro déjà publié.
- Correctif : correction de bug sans changement visible. Mineur : nouvelle fonction, ou nouvelle base Kilo sans rupture. Majeur : rupture (réglage supprimé, comportement réseau changé).
- La version vit dans `packages/kilo-vscode/package.json`. Chaque entrée du [CHANGELOG](packages/kilo-vscode/CHANGELOG.md) indique la version de Kilo Code sur laquelle elle repose.
- Albert Code n'utilise pas les changesets de Kilo : les notes de version s'écrivent directement dans `packages/kilo-vscode/CHANGELOG.md`, sous un titre `## X.Y.Z` exact. La CI en tire le texte de la GitHub Release.

## Prérequis (une seule fois)

1. **Vérifier l'historique avant de rendre le dépôt public.** Le dépôt devient public avec tout son historique. Vérification faite le 2026-11-09 : la clé Albert n'apparaît dans aucun commit, aucun chemin personnel ni fichier local n'a été commité, et les seuls motifs de jetons sont des valeurs factices de tests Kilo. À refaire si des commits non poussés sont ajoutés entre-temps :
   ```bash
   git log -p --all | grep -cF "$(cat ~/.config/albert/api_key)"   # doit afficher 0
   ```
2. **Rendre le dépôt public** : GitHub → *Settings* → *General* → *Danger Zone* → *Change visibility*.
3. **Créer l'éditeur** `khoarau` sur https://marketplace.visualstudio.com/manage (compte Microsoft).
4. **Créer un jeton d'accès** Azure DevOps (https://dev.azure.com → *User settings* → *Personal access tokens*) : organisation *All accessible organizations*, portée *Marketplace* → *Manage*. Il expire (un an au plus) : noter la date pour le renouveler. Le garder dans un gestionnaire de mots de passe, jamais dans le dépôt.
5. **Créer l'environnement GitHub `marketplace`** : *Settings* → *Environments* → *New environment* → `marketplace`.
   - *Required reviewers* : toi. Chaque publication attend ton approbation.
   - *Deployment branches and tags* : *Selected branches and tags*, règle de tag `v*`.
   - *Environment secrets* : `VSCE_PAT` = le jeton de l'étape 4. Il n'est lisible que par le job `marketplace`, pas par les autres jobs ni par les PR.

## Procédure

1. **Préparer la version sur `albert_code`** : passer `version` à `X.Y.Z` dans `packages/kilo-vscode/package.json`, ajouter l'entrée `## X.Y.Z` en tête du CHANGELOG, puis commiter et pousser :
   ```bash
   git commit -am "chore(vscode): release X.Y.Z"
   git push origin albert_code
   ```
2. **Valider** : la CI `albert` doit être verte (jobs `checks` et `e2e`). Installer le VSIX de l'artefact `albert-code-linux-x64-vsix` et faire un essai réel avec Albert. Si l'amont a changé, lancer aussi le test de coexistence en local (`E2E_ALSO=…`, voir le README).
3. **Promouvoir sur `main`** (avance rapide uniquement, voir [UPSTREAM.md](UPSTREAM.md#branches)) :
   ```bash
   git switch main
   git merge --ff-only albert_code
   git push origin main
   git switch albert_code
   ```
4. **Taguer** le commit de `main` et pousser le tag :
   ```bash
   git tag -a vX.Y.Z main -m "Albert Code X.Y.Z"
   git push origin vX.Y.Z
   ```
   La CI relance `checks` et `e2e` sur le tag. Le job `release` vérifie ensuite que le tag correspond à la version du manifeste, qu'il est sur `main` et que le CHANGELOG a une entrée pour cette version. Il crée enfin la GitHub Release avec `albert-code-X.Y.Z-linux-x64.vsix` et son empreinte `.sha256`.
5. **Approuver la publication sur le Marketplace** : le job `marketplace` attend dans l'onglet *Actions* (*Review deployments* → *Approve and deploy*). Il télécharge le VSIX de la GitHub Release, vérifie son empreinte et le publie sans le reconstruire. Avant d'approuver, tu peux installer le VSIX de la release pour un dernier essai.

   Publication à la main (par exemple si la CI n'est pas disponible), avec le même fichier :
   ```bash
   gh release download vX.Y.Z -D /tmp/albert-X.Y.Z && (cd /tmp/albert-X.Y.Z && sha256sum -c ./*.sha256)
   read -rs VSCE_PAT && export VSCE_PAT
   packages/kilo-vscode/node_modules/.bin/vsce publish --skip-duplicate --packagePath /tmp/albert-X.Y.Z/albert-code-X.Y.Z-linux-x64.vsix
   unset VSCE_PAT
   ```
6. **Vérifier** la page https://marketplace.visualstudio.com/items?itemName=khoarau.albert-code : version, README, onglet *Changelog*. Puis installer l'extension depuis VS Code.

## En cas d'erreur

- Un tag poussé n'est jamais déplacé ni supprimé : on corrige sur `albert_code` et on publie `X.Y.Z+1`.
- Si le job `release` échoue avant de créer la release (tag différent de la version, entrée de CHANGELOG absente), corriger la cause et relancer le job depuis l'onglet *Actions*. Si la correction exige un nouveau commit, publier un nouveau numéro.
- Si le job `marketplace` échoue (jeton expiré ou absent), corriger le secret `VSCE_PAT` et relancer le job : il republie le même VSIX, et `--skip-duplicate` ignore une version déjà en ligne.
- Une version publiée sur le Marketplace ne peut pas être republiée. Retirer une version (*Unpublish*) cache toute l'extension : préférer un correctif.
