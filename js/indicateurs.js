// ============================================================================
// CATALOGUE DES INDICATEURS — c'est le fichier à modifier pour faire évoluer le tableau de bord.
//
// Chaque indicateur a :
//   axe          : l'onglet où il apparaît
//   nom, unite   : ce qui s'affiche
//   definition   : phrase affichée dans le catalogue
//   formule      : le calcul, en clair
//   seuil        : ["min", x] -> alerte si la valeur passe SOUS x
//                  ["max", x] -> alerte si la valeur passe AU-DESSUS de x
//   baisseFavorable : true si une baisse est une bonne nouvelle
//   filiere      : true si le filtre FISE / FISEA / Master s'applique
//   calcul(d, an): renvoie la valeur pour une année. d donne accès aux données :
//       d.eff(an), d.adm(an), d.stages(an)  -> lignes filtrées par filière
//       d.table("nom_du_csv", an)           -> lignes d'une table pour une année
//       d.effectifTotal(an)                 -> effectif de toute l'école
// ============================================================================

const AXES = ["Formation", "Vie étudiante", "Entreprises", "International", "Recherche", "Budget"];

// Petites fonctions de calcul
const somme = (lignes, col) => lignes.reduce((total, l) => total + (Number(l[col]) || 0), 0);
const pourcent = (a, b) => (b ? (100 * a) / b : NaN);
const POSTES_HORS_DEPENSES = ["Recette taxe d'apprentissage", "Surface utile m2"];
const depenses = (d, an) => d.table("developpement_budget", an).filter(l => !POSTES_HORS_DEPENSES.includes(l.poste));

const INDICATEURS = [
  // ------------------------------------------------------------ Formation
  { axe: "Formation", nom: "Effectif total", unite: "élèves", filiere: true,
    definition: "Nombre d'élèves inscrits, toutes années d'étude.",
    formule: "somme des effectifs",
    calcul: (d, an) => somme(d.eff(an), "effectif") },
  { axe: "Formation", nom: "Taux d'admission", unite: "%", filiere: true, baisseFavorable: true,
    definition: "Part des candidats admis : plus il est bas, plus le recrutement est sélectif.",
    formule: "admis / candidatures × 100",
    calcul: (d, an) => pourcent(somme(d.adm(an), "admis"), somme(d.adm(an), "candidatures")) },
  { axe: "Formation", nom: "Taux de réussite", unite: "%", filiere: true, seuil: ["min", 88],
    definition: "Part des inscrits en dernière année qui obtiennent le diplôme.",
    formule: "diplômés / inscrits en dernière année × 100",
    calcul: (d, an) => pourcent(somme(d.adm(an), "diplomes"), somme(d.adm(an), "inscrits_derniere_annee")) },
  { axe: "Formation", nom: "Taux d'abandon", unite: "%", filiere: true, seuil: ["max", 2], baisseFavorable: true,
    definition: "Sorties sans diplôme rapportées à l'effectif.",
    formule: "abandons / effectif × 100",
    calcul: (d, an) => pourcent(somme(d.adm(an), "abandons"), somme(d.eff(an), "effectif")) },
  { axe: "Formation", nom: "Part de femmes", unite: "%", filiere: true, seuil: ["min", 25],
    definition: "Part des femmes parmi les inscrits.",
    formule: "femmes / effectif × 100",
    calcul: (d, an) => pourcent(somme(d.eff(an), "femmes"), somme(d.eff(an), "effectif")) },
  { axe: "Formation", nom: "Part de boursiers", unite: "%", filiere: true, seuil: ["min", 25],
    definition: "Part des boursiers parmi les inscrits (ouverture sociale).",
    formule: "boursiers / effectif × 100",
    calcul: (d, an) => pourcent(somme(d.eff(an), "boursiers"), somme(d.eff(an), "effectif")) },

  // ------------------------------------------------------------ Vie étudiante
  { axe: "Vie étudiante", nom: "Satisfaction des élèves", unite: "/5", seuil: ["min", 3.7],
    definition: "Note moyenne de l'enquête annuelle de satisfaction.",
    formule: "satisfaction_sur_5",
    calcul: (d, an) => somme(d.table("vie_etudiante", an), "satisfaction_sur_5") },
  { axe: "Vie étudiante", nom: "Engagement associatif", unite: "%", seuil: ["min", 55],
    definition: "Part des élèves membres d'au moins une association.",
    formule: "membres des associations / effectif × 100",
    calcul: (d, an) => { const v = d.table("vie_etudiante", an); return pourcent(somme(v, "membres_assos"), somme(v, "effectif_total")); } },
  { axe: "Vie étudiante", nom: "Logement en résidence", unite: "%", seuil: ["min", 30],
    definition: "Part des élèves logés en résidence.",
    formule: "logés en résidence / effectif × 100",
    calcul: (d, an) => { const v = d.table("vie_etudiante", an); return pourcent(somme(v, "loges_residence"), somme(v, "effectif_total")); } },

  // ------------------------------------------------------------ Entreprises
  { axe: "Entreprises", nom: "Taxe d'apprentissage", unite: "€",
    definition: "Montant total versé par les entreprises.",
    formule: "somme des montants versés",
    calcul: (d, an) => somme(d.table("entreprises_taxe_apprentissage", an), "montant_eur") },
  { axe: "Entreprises", nom: "Entreprises versantes", unite: "entreprises",
    definition: "Nombre d'entreprises différentes qui versent la taxe.",
    formule: "nombre d'entreprise_id distincts",
    calcul: (d, an) => new Set(d.table("entreprises_taxe_apprentissage", an).map(l => l.entreprise_id)).size },
  { axe: "Entreprises", nom: "Taux d'embauche après stage", unite: "%", filiere: true, seuil: ["min", 30],
    definition: "Part des stages et alternances suivis d'une embauche.",
    formule: "stages avec embauche / nombre de stages × 100",
    calcul: (d, an) => { const s = d.stages(an); return pourcent(s.filter(l => l.embauche).length, s.length); } },
  { axe: "Entreprises", nom: "Gratification moyenne de stage", unite: "€/mois", filiere: true,
    definition: "Gratification mensuelle moyenne des stages (hors alternance).",
    formule: "moyenne des gratifications, type = stage",
    calcul: (d, an) => { const s = d.stages(an).filter(l => l.type === "stage"); return s.length ? somme(s, "gratification_mensuelle_eur") / s.length : NaN; } },

  // ------------------------------------------------------------ International
  { axe: "International", nom: "Mobilités sortantes pour 100 élèves", unite: "", seuil: ["min", 10],
    definition: "Élèves partis à l'étranger rapportés à l'effectif de l'école.",
    formule: "sortants / effectif × 100",
    calcul: (d, an) => pourcent(somme(d.table("international_mobilites", an), "sortants"), d.effectifTotal(an)) },
  { axe: "International", nom: "Accueillis pour 100 envoyés", unite: "", seuil: ["min", 50],
    definition: "Équilibre des échanges : étudiants accueillis pour 100 élèves partis.",
    formule: "entrants / sortants × 100",
    calcul: (d, an) => { const m = d.table("international_mobilites", an); return pourcent(somme(m, "entrants"), somme(m, "sortants")); } },

  // ------------------------------------------------------------ Recherche
  { axe: "Recherche", nom: "Publications par enseignant-chercheur", unite: "", seuil: ["min", 2],
    definition: "Productivité scientifique (revues et conférences).",
    formule: "(publications revues + conférences) / enseignants-chercheurs",
    calcul: (d, an) => { const r = d.table("recherche", an); return (somme(r, "publications_revues") + somme(r, "publications_conferences")) / somme(r, "enseignants_chercheurs"); } },
  { axe: "Recherche", nom: "Contrats de recherche", unite: "€",
    definition: "Montant des contrats de recherche.",
    formule: "somme des contrats",
    calcul: (d, an) => somme(d.table("recherche", an), "contrats_eur") },
  { axe: "Recherche", nom: "Doctorants", unite: "doctorants",
    definition: "Nombre de doctorants dans les quatre équipes.",
    formule: "somme des doctorants",
    calcul: (d, an) => somme(d.table("recherche", an), "doctorants") },

  // ------------------------------------------------------------ Budget
  { axe: "Budget", nom: "Exécution budgétaire", unite: "%", seuil: ["min", 90],
    definition: "Dépenses réalisées rapportées au budget prévu.",
    formule: "réalisé / prévu × 100 (hors recette TA et surface)",
    calcul: (d, an) => { const b = depenses(d, an); return pourcent(somme(b, "realise_eur"), somme(b, "prevu_eur")); } },
  { axe: "Budget", nom: "Part de la masse salariale", unite: "%", seuil: ["max", 75], baisseFavorable: true,
    definition: "Poids des salaires dans les dépenses réalisées.",
    formule: "masse salariale réalisée / dépenses réalisées × 100",
    calcul: (d, an) => { const b = depenses(d, an); return pourcent(somme(b.filter(l => l.poste === "Masse salariale"), "realise_eur"), somme(b, "realise_eur")); } },
];

// Indicateurs mis en avant sur la vue d'ensemble
const INDICATEURS_CLES = ["Effectif total", "Taux de réussite", "Part de femmes", "Satisfaction des élèves",
  "Taxe d'apprentissage", "Taux d'embauche après stage", "Mobilités sortantes pour 100 élèves",
  "Publications par enseignant-chercheur", "Exécution budgétaire"];
