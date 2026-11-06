# Upstream — Albert Code

## Version de base

| Élément | Valeur |
|---|---|
| Projet amont | Kilo Code — https://github.com/Kilo-Org/kilocode (MIT) |
| Tag de base | `v7.8.18` |
| Commit amont du tag | `b81761530650f8ec7b071441f4f54d2514f1a244` (arbre `3db365894750ec12ef88ae01ba8dfb069452cc49`) |
| Import local | `b88ea19` + `7d5d032` « Original Kilo Code 7.8.18 » (import en deux commits, arbre `763a7df`) |

Sources de l'identification :

- `packages/kilo-vscode/package.json`, `packages/opencode/package.json` et `packages/core/package.json` sont en `7.8.18` ;
- `packages/kilo-vscode/CHANGELOG.md` commence à `## 7.8.18` ;
- `git ls-remote --tags https://github.com/Kilo-Org/kilocode.git v7.8.18` renvoie le commit ci-dessus ;
- les 10 822 fichiers importés sont identiques octet pour octet (même hash de blob) à ceux du tag.

## Historique

Le dépôt **ne partage pas** son historique avec Kilo : sa racine unique est `b88ea19`, de l'auteur local. Il faudra donc utiliser une branche `upstream` (et non un `git merge` direct du tag).

## Écart constaté entre l'import et le tag

205 fichiers du tag manquent dans l'import, sans aucun fichier modifié ni ajouté :

- tous les fichiers et dossiers racine commençant par un point : `.github/` (98), `.kilo/` (48), `.opencode/` (39), `.vscode/` (4), `.changeset/` (2), `.gitignore`, `.gitattributes`, `.oxlintrc.json`, `.prettierignore`, `.editorconfig`, `.envrc`, `.husky/`, `.opencode-version`, `.dockerignore`, `.gitleaksignore`, `.idea/`, `.kilocode/`, `.zed/` ;
- `packages/opencode/script/build-node.ts` (exclu par `packages/opencode/.gitignore`, mais suivi en amont).

La procédure de mise à jour sera complétée à la fin du chantier.
