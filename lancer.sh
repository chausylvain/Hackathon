#!/usr/bin/env bash
# Lance le tableau de bord : ./lancer.sh   (puis ouvrir http://localhost:8000)
# - télécharge les CSV manquants et le logo depuis le site du hackathon
# - démarre un petit serveur web local
cd "$(dirname "$0")" || exit 1

SITE="https://hackathon.ensiie.fr"
FICHIERS="formation_effectifs formation_admissions_diplomes vie_etudiante entreprises_taxe_apprentissage
entreprises_stages international_mobilites recherche developpement_budget"

mkdir -p data assets
for f in $FICHIERS; do
  if [ ! -s "data/$f.csv" ]; then
    echo "Téléchargement de $f.csv…"
    curl -fsSL "$SITE/projet3/$f.csv" -o "data/$f.csv" \
      || { echo "  ✗ échec : copiez $f.csv à la main dans data/"; rm -f "data/$f.csv"; }
  fi
done

if [ ! -s assets/logo-ensiie.svg ]; then
  curl -fsSL "$SITE/logo.svg" -o assets/logo-ensiie.svg || rm -f assets/logo-ensiie.svg
fi

PORT="${1:-8000}"
echo ""
echo "  ✔ Tableau de bord : http://localhost:$PORT"
echo "    (Ctrl+C pour arrêter)"
echo ""
python3 -m http.server "$PORT"
