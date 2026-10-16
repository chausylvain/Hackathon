# Tableau de bord stratégique ensIIE

Hackathon ensIIE 2026, projet 3. Un site web statique (HTML, CSS, JavaScript) qui lit les 8 CSV
du kit et affiche 20 indicateurs sur six axes : formation, vie étudiante, entreprises, international,
recherche et budget. Il comprend des alertes, des filtres par année et par filière, des graphiques,
le catalogue des indicateurs et un export CSV.

Aucune installation : il faut seulement Python 3 (pour le petit serveur local) et un navigateur.

## Lancer

**Linux, macOS, WSL**
```bash
cd dashboard-ensiie-web
chmod +x lancer.sh      # la première fois seulement
./lancer.sh
```
**Windows** : double-cliquer sur `lancer.bat`.

Ouvrir ensuite **http://localhost:8000** dans le navigateur.

Le script télécharge les CSV manquants et le logo depuis hackathon.ensiie.fr, puis démarre le serveur.
Si vous avez déjà les 8 CSV, copiez-les dans `data/` : le script ne les retéléchargera pas.

⚠️ Un double-clic sur `index.html` ne suffit pas : le navigateur bloque la lecture des CSV
en dehors d'un serveur. Passez toujours par le script (ou `python3 -m http.server`).

## Contenu

```
index.html            la page
css/style.css         la mise en forme
js/indicateurs.js     ★ le catalogue des indicateurs : seuils, formules (le fichier à modifier)
js/app.js             chargement des données, filtres, onglets, graphiques
data/                 les 8 CSV du kit
assets/logo-ensiie.svg  le logo (téléchargé par le script)
lancer.sh, lancer.bat scripts de lancement
```

## Utiliser le tableau de bord

- **Vue d'ensemble** : les alertes de l'année, la santé des six axes (cliquez sur un axe pour l'ouvrir)
  et les indicateurs clés. Cliquez sur un indicateur pour voir son évolution et son seuil.
- **Un onglet par axe** : tous les indicateurs de l'axe et des graphiques détaillés.
- **Données et méthode** : le tableau des indicateurs par année (export CSV), le catalogue
  (définition, formule, seuil) et les tables sources.
- **Filtres** en haut : l'année de référence et les filières (FISE, FISEA, Master).

Une alerte se déclenche quand un indicateur franchit son seuil (ex. taux de réussite sous 88 %).
La flèche verte ou rouge indique si l'évolution sur un an est favorable.

## Modifier

Tout se passe dans `js/indicateurs.js` :
- **changer un seuil** : modifier `seuil: ["min", 88]` ;
- **ajouter un indicateur** : copier un bloc `{ axe: ..., nom: ..., calcul: (d, an) => ... }`.
  Il apparaît automatiquement dans son onglet, les alertes et le catalogue.

## Mettre en ligne (GitHub Pages, gratuit)

1. Créer un dépôt GitHub **public** et y envoyer tout le dossier, y compris `data/` et `assets/`
   (« Add file » → « Upload files », ou `git push`).
2. Dans le dépôt : **Settings → Pages**, Source « Deploy from a branch », branche `main`, dossier `/ (root)`, « Save ».
3. Une à deux minutes plus tard, le site est en ligne à l'adresse `https://<compte>.github.io/<dépôt>/`.

Les données sont fictives : rien n'empêche de les publier.
