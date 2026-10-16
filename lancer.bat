@echo off
REM Lance le tableau de bord sous Windows : double-cliquer sur lancer.bat
cd /d "%~dp0"
if not exist data mkdir data
if not exist assets mkdir assets

for %%f in (formation_effectifs formation_admissions_diplomes vie_etudiante entreprises_taxe_apprentissage entreprises_stages international_mobilites recherche developpement_budget) do (
  if not exist "data\%%f.csv" (
    echo Telechargement de %%f.csv...
    curl -fsSL "https://hackathon.ensiie.fr/projet3/%%f.csv" -o "data\%%f.csv" || del "data\%%f.csv" 2>nul
  )
)
if not exist "assets\logo-ensiie.svg" (
  curl -fsSL "https://hackathon.ensiie.fr/logo.svg" -o "assets\logo-ensiie.svg" || del "assets\logo-ensiie.svg" 2>nul
)

echo.
echo   Tableau de bord : http://localhost:8000   (fermer cette fenetre pour arreter)
echo.
start "" http://localhost:8000
python -m http.server 8000
