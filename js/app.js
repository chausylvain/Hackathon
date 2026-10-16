// ============================================================================
// TABLEAU DE BORD STRATÉGIQUE ensIIE — moteur de l'application
// Les indicateurs sont définis dans indicateurs.js ; ce fichier charge les CSV,
// gère les filtres et les onglets, et dessine cartes, alertes et graphiques.
// ============================================================================

const FICHIERS = ["formation_effectifs", "formation_admissions_diplomes", "vie_etudiante",
  "entreprises_taxe_apprentissage", "entreprises_stages", "international_mobilites",
  "recherche", "developpement_budget"];
const ONGLETS = ["Vue d'ensemble", ...AXES, "Données et méthode"];
const TOUTES_FILIERES = ["FISE", "FISEA", "Master"];

const DONNEES = {};
const etat = { annee: null, filieres: [...TOUTES_FILIERES], onglet: "Vue d'ensemble", choisi: null };
let ANNEES = [];
let graphiques = [];

// ============================================================================
// 1. DONNÉES
// ============================================================================
async function chargerCSV(nom) {
  const reponse = await fetch(`data/${nom}.csv`);
  if (!reponse.ok) throw new Error(nom);
  return Papa.parse(await reponse.text(), { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
}

// Accès aux données pour les formules (voir indicateurs.js)
const d = {
  table: (nom, an) => DONNEES[nom].filter(l => l.annee === an),
  eff: an => d.table("formation_effectifs", an).filter(l => etat.filieres.includes(l.filiere)),
  adm: an => d.table("formation_admissions_diplomes", an).filter(l => etat.filieres.includes(l.filiere)),
  stages: an => d.table("entreprises_stages", an).filter(l => etat.filieres.includes(l.filiere)),
  effectifTotal: an => somme(d.table("formation_effectifs", an), "effectif"),
};

const valeur = (ind, an) => {
  const v = ind.calcul(d, an);
  return Number.isFinite(v) ? v : NaN;
};

function enAlerte(ind, v) {
  if (!ind.seuil || !Number.isFinite(v)) return false;
  const [type, seuil] = ind.seuil;
  return type === "min" ? v < seuil : v > seuil;
}

// ============================================================================
// 2. MISE EN FORME
// ============================================================================
function formater(v, unite, signe = false) {
  if (!Number.isFinite(v)) return "–";
  const entier = ["élèves", "entreprises", "doctorants", "€", "€/mois"].includes(unite);
  const dec = entier ? 0 : (unite === "%" ? 1 : 2);
  let texte = v.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (signe && v > 0) texte = "+" + texte;
  if (unite === "%") return texte + (signe ? " pts" : " %");
  if (["€", "€/mois", "/5"].includes(unite)) return texte + " " + unite;
  return texte;
}

const echapper = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const texteSeuil = ind => ind.seuil ? `${ind.seuil[0] === "min" ? "au moins" : "au plus"} ${formater(ind.seuil[1], ind.unite)}` : "–";

function telecharger(nomFichier, lignes) {
  const csv = lignes.map(l => l.map(c => /[",;\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(",")).join("\n");
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  lien.download = nomFichier;
  lien.click();
}

// ============================================================================
// 3. BRIQUES D'AFFICHAGE
// ============================================================================
function carteKPI(ind, montrerAxe = false) {
  const an = etat.annee;
  const v = valeur(ind, an);
  let evolution = "pas d'année précédente";
  if (ANNEES.includes(an - 1)) {
    const avant = valeur(ind, an - 1);
    if (Number.isFinite(avant) && Number.isFinite(v)) {
      const ecart = v - avant;
      const bon = ind.baisseFavorable ? ecart < 0 : ecart > 0;
      const fleche = ecart > 0 ? "▲" : ecart < 0 ? "▼" : "=";
      evolution = `<span class="${ecart === 0 ? "" : bon ? "bon" : "mauvais"}">${fleche} ${formater(ecart, ind.unite, true)}</span> vs ${an - 1}`;
    }
  }
  const alerte = enAlerte(ind, v);
  return `<button class="kpi ${alerte ? "en-alerte" : ""} ${ind === etat.choisi ? "choisi" : ""}" data-kpi="${INDICATEURS.indexOf(ind)}">
    ${montrerAxe ? `<div class="axe">${ind.axe}</div>` : ""}
    <div class="nom">${ind.nom}</div>
    <div class="valeur">${formater(v, ind.unite)}</div>
    <div class="evolution">${evolution}</div>
    ${alerte ? `<div class="badge">⚠ Alerte : seuil ${texteSeuil(ind)}</div>` : ""}
  </button>`;
}

function blocAlertes() {
  const alertes = INDICATEURS.filter(ind => enAlerte(ind, valeur(ind, etat.annee)));
  if (!alertes.length) return `<div class="boite alertes"><p class="ok">✔ Aucun indicateur en alerte en ${etat.annee}.</p></div>`;
  return `<div class="boite alertes">
    <p><strong>⚠ ${alertes.length} indicateur(s) en alerte en ${etat.annee}</strong></p>
    ${alertes.map(ind => `<p><span class="alerte-nom">${ind.nom}</span> (${ind.axe}) :
      ${formater(valeur(ind, etat.annee), ind.unite)}, seuil ${texteSeuil(ind)}</p>`).join("")}
  </div>`;
}

const cadreGraphique = (id, titre, large = false) =>
  `<div class="graphique ${large ? "large" : ""}"><h3>${titre}</h3><div class="zone"><canvas id="${id}"></canvas></div></div>`;

// ---------------------------------------------------------------- Chart.js
const css = nom => getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
const PALETTE = () => [css("--c1"), css("--c2"), css("--c3"), css("--c4")];

function graphique(id, type, labels, jeux, { horizontal = false, empile = false, unite = "" } = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const axeValeurs = { grid: { color: css("--grille") }, stacked: empile, beginAtZero: type === "bar",
    ticks: { color: css("--texte-2"), callback: v => formater(v, unite) } };
  const axeLabels = { grid: { display: false }, stacked: empile, ticks: { color: css("--texte-2") } };
  graphiques.push(new Chart(canvas, {
    type,
    data: { labels, datasets: jeux.map(j => ({ borderWidth: type === "line" ? 2 : 0, borderRadius: 4, pointRadius: 4, ...j })) },
    options: {
      maintainAspectRatio: false, indexAxis: horizontal ? "y" : "x",
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: jeux.length > 1, labels: { color: css("--texte-2"), boxWidth: 12 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label} : ${formater(horizontal ? c.parsed.x : c.parsed.y, unite)}` } },
      },
      scales: horizontal ? { x: axeValeurs, y: axeLabels } : { x: axeLabels, y: axeValeurs },
    },
  }));
}

function courbeIndicateur(id, ind) {
  const jeux = [{ label: ind.nom, data: ANNEES.map(an => valeur(ind, an)), borderColor: css("--c1"),
    backgroundColor: css("--c1"), pointRadius: ANNEES.map(an => an === etat.annee ? 7 : 4) }];
  if (ind.seuil) jeux.push({ label: "Seuil d'alerte", data: ANNEES.map(() => ind.seuil[1]),
    borderColor: css("--alerte"), backgroundColor: css("--alerte"), borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 });
  graphique(id, "line", ANNEES, jeux, { unite: ind.unite });
}

// ============================================================================
// 4. PAGES
// ============================================================================
function pageVueEnsemble() {
  const axes = AXES.map(axe => {
    const inds = INDICATEURS.filter(i => i.axe === axe);
    const n = inds.filter(i => enAlerte(i, valeur(i, etat.annee))).length;
    return `<button class="axe-carte" data-onglet="${axe}"><strong>${axe}</strong>
      <span>${inds.length} indicateurs · ${n ? `<b class="mauvais">⚠ ${n} en alerte</b>` : `<b class="bon">✔ aucune alerte</b>`}</span></button>`;
  }).join("");
  const cles = INDICATEURS.filter(i => INDICATEURS_CLES.includes(i.nom));
  if (!cles.includes(etat.choisi)) etat.choisi = cles[1];
  return {
    html: `<h2>Points d'attention</h2>${blocAlertes()}
      <h2>Santé des six axes</h2><div class="grille">${axes}</div>
      <h2>Indicateurs clés ${etat.annee}</h2><p class="aide">Cliquez sur un indicateur pour afficher son évolution.</p>
      <div class="grille">${cles.map(i => carteKPI(i, true)).join("")}</div>
      <h2>Évolution</h2><div class="graphiques">${cadreGraphique("g-evolution", etat.choisi.nom, true)}</div>`,
    dessiner: () => courbeIndicateur("g-evolution", etat.choisi),
  };
}

function pageAxe(axe) {
  const inds = INDICATEURS.filter(i => i.axe === axe);
  if (!inds.includes(etat.choisi)) etat.choisi = inds.find(i => i.seuil) || inds[0];
  const an = etat.annee;
  const extra = GRAPHIQUES_AXE[axe](an);
  return {
    html: `<h2>${axe} · ${an}</h2><p class="aide">Cliquez sur un indicateur pour afficher son évolution.</p>
      <div class="grille">${inds.map(i => carteKPI(i)).join("")}</div>
      <h2>Analyse</h2><div class="graphiques">
        ${cadreGraphique("g-evolution", `Évolution : ${etat.choisi.nom}`)}
        ${extra.map(g => g.html ?? cadreGraphique(g.id, g.titre, g.large)).join("")}
      </div>`,
    dessiner: () => { courbeIndicateur("g-evolution", etat.choisi); extra.forEach(g => g.dessiner && g.dessiner()); },
  };
}

// Graphiques propres à chaque axe
const parSecteur = (lignes, col) => {
  const t = {};
  lignes.forEach(l => { t[l.secteur] = (t[l.secteur] || 0) + (col ? Number(l[col]) || 0 : 1); });
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
};

const GRAPHIQUES_AXE = {
  "Formation": an => [
    { id: "g-filieres", titre: "Effectifs par filière", dessiner: () => graphique("g-filieres", "bar", ANNEES,
        etat.filieres.map((f, i) => ({ label: f, backgroundColor: PALETTE()[TOUTES_FILIERES.indexOf(f)],
          data: ANNEES.map(a => somme(d.table("formation_effectifs", a).filter(l => l.filiere === f), "effectif")) })),
        { empile: true, unite: "élèves" }) },
    { id: "g-recrutement", titre: `Recrutement ${an} : de la candidature à l'inscription`, dessiner: () => graphique("g-recrutement", "bar",
        ["Candidatures", "Admis", "Inscrits en 1re année"],
        [{ label: "Élèves", backgroundColor: css("--c1"),
           data: ["candidatures", "admis", "inscrits_1a"].map(c => somme(d.adm(an), c)) }],
        { horizontal: true, unite: "élèves" }) },
  ],
  "Vie étudiante": an => [
    { id: "g-evenements", titre: "Événements organisés par an", dessiner: () => graphique("g-evenements", "bar", ANNEES,
        [{ label: "Événements", backgroundColor: css("--c1"), data: ANNEES.map(a => somme(d.table("vie_etudiante", a), "evenements")) }],
        { unite: "" }) },
    { id: "g-assos", titre: "Associations actives", dessiner: () => graphique("g-assos", "bar", ANNEES,
        [{ label: "Associations", backgroundColor: css("--c3"), data: ANNEES.map(a => somme(d.table("vie_etudiante", a), "associations_actives")) }],
        { unite: "" }) },
  ],
  "Entreprises": an => {
    const ta = d.table("entreprises_taxe_apprentissage", an);
    const top = [...ta].sort((a, b) => b.montant_eur - a.montant_eur).slice(0, 10);
    const st = d.stages(an);
    const secteurs = parSecteur(st).map(e => e[0]);
    return [
      { id: "g-ta-secteur", titre: `Taxe d'apprentissage par secteur, ${an}`, dessiner: () => {
          const s = parSecteur(ta, "montant_eur");
          graphique("g-ta-secteur", "bar", s.map(e => e[0]), [{ label: "Montant", backgroundColor: css("--c1"), data: s.map(e => e[1]) }],
            { horizontal: true, unite: "€" });
        } },
      { id: "g-stages-secteur", titre: `Stages et alternances par secteur, ${an}`, dessiner: () => graphique("g-stages-secteur", "bar", secteurs,
          ["stage", "alternance"].map((type, i) => ({ label: type === "stage" ? "Stages" : "Alternances", backgroundColor: PALETTE()[i],
            data: secteurs.map(s => st.filter(l => l.secteur === s && l.type === type).length) })),
          { horizontal: true, empile: true }) },
      { html: `<div class="graphique large"><h3>10 premières entreprises versantes, ${an}</h3><div class="tableau"><table>
          <tr><th>Entreprise</th><th>Secteur</th><th>Taille</th><th class="nombre">Montant</th></tr>
          ${top.map(l => `<tr><td>${echapper(l.entreprise)}</td><td>${echapper(l.secteur)}</td><td>${echapper(l.taille)}</td>
            <td class="nombre">${formater(l.montant_eur, "€")}</td></tr>`).join("")}
        </table></div></div>` },
    ];
  },
  "International": an => {
    const zones = [...new Set(DONNEES.international_mobilites.map(l => l.zone))];
    const pays = d.table("international_mobilites", an).sort((a, b) => b.sortants - a.sortants).slice(0, 10);
    return [
      { id: "g-zones", titre: "Élèves partis à l'étranger, par zone", dessiner: () => graphique("g-zones", "bar", ANNEES,
          zones.map((z, i) => ({ label: z, backgroundColor: PALETTE()[i],
            data: ANNEES.map(a => somme(d.table("international_mobilites", a).filter(l => l.zone === z), "sortants")) }))) },
      { id: "g-pays", titre: `Principaux pays, ${an}`, dessiner: () => graphique("g-pays", "bar", pays.map(l => l.pays),
          [{ label: "Partis", backgroundColor: css("--c1"), data: pays.map(l => l.sortants) },
           { label: "Accueillis", backgroundColor: css("--c2"), data: pays.map(l => l.entrants) }]) },
    ];
  },
  "Recherche": an => {
    const equipes = [...new Set(DONNEES.recherche.map(l => l.equipe))];
    const r = d.table("recherche", an);
    return [
      { id: "g-pub-equipe", titre: `Publications par équipe, ${an}`, dessiner: () => graphique("g-pub-equipe", "bar", r.map(l => l.equipe),
          [{ label: "Revues", backgroundColor: css("--c1"), data: r.map(l => l.publications_revues) },
           { label: "Conférences", backgroundColor: css("--c2"), data: r.map(l => l.publications_conferences) }],
          { horizontal: true, empile: true }) },
      { id: "g-contrats", titre: "Contrats de recherche par équipe", large: true, dessiner: () => graphique("g-contrats", "line", ANNEES,
          equipes.map((e, i) => ({ label: e, borderColor: PALETTE()[i], backgroundColor: PALETTE()[i],
            data: ANNEES.map(a => somme(d.table("recherche", a).filter(l => l.equipe === e), "contrats_eur")) })),
          { unite: "€" }) },
    ];
  },
  "Budget": an => {
    const b = depenses(d, an);
    return [
      { id: "g-budget", titre: `Budget prévu et réalisé par poste, ${an}`, dessiner: () => graphique("g-budget", "bar", b.map(l => l.poste),
          [{ label: "Prévu", backgroundColor: css("--c4"), data: b.map(l => l.prevu_eur) },
           { label: "Réalisé", backgroundColor: css("--c1"), data: b.map(l => l.realise_eur) }],
          { horizontal: true, unite: "€" }) },
    ];
  },
};

function pageDonnees() {
  const lignesKPI = INDICATEURS.map(ind => `<tr><td>${ind.nom}</td>${ANNEES.map(an => {
    const v = valeur(ind, an);
    return `<td class="nombre ${enAlerte(ind, v) ? "alerte-cellule" : ""}">${formater(v, ind.unite)}</td>`;
  }).join("")}</tr>`).join("");
  const catalogue = INDICATEURS.map(ind => `<tr><td>${ind.axe}</td><td>${ind.nom}</td><td class="texte">${ind.definition}</td>
    <td class="texte">${ind.formule}</td><td>${texteSeuil(ind)}</td><td>${ind.filiere ? "oui" : "non"}</td></tr>`).join("");
  const table = etat.tableSource || FICHIERS[0];
  const lignes = DONNEES[table];
  const colonnes = Object.keys(lignes[0] || {}).filter(c => c !== "embauche");
  return {
    html: `<h2>Indicateurs par année</h2>
      <p class="aide">En rouge : valeur en alerte. Le filtre filière s'applique.</p>
      <div class="ligne-outils"><button class="bouton" id="export-kpi">⬇ Télécharger en CSV</button></div>
      <div class="tableau"><table><tr><th>Indicateur</th>${ANNEES.map(an => `<th class="nombre">${an}</th>`).join("")}</tr>${lignesKPI}</table></div>
      <h2>Catalogue des indicateurs</h2>
      <div class="tableau"><table><tr><th>Axe</th><th>Indicateur</th><th>Définition</th><th>Formule</th><th>Seuil d'alerte</th><th>Par filière</th></tr>${catalogue}</table></div>
      <h2>Données sources</h2>
      <div class="ligne-outils"><select id="table-source">${FICHIERS.map(f => `<option ${f === table ? "selected" : ""}>${f}</option>`).join("")}</select>
        <span class="aide" style="margin:0">${lignes.length} lignes</span></div>
      <div class="tableau"><table><tr>${colonnes.map(c => `<th>${c}</th>`).join("")}</tr>
        ${lignes.slice(0, 300).map(l => `<tr>${colonnes.map(c => `<td>${echapper(l[c])}</td>`).join("")}</tr>`).join("")}</table></div>`,
    dessiner: () => {
      document.getElementById("export-kpi").onclick = () => telecharger(`indicateurs_ensiie.csv`,
        [["indicateur", "unite", ...ANNEES], ...INDICATEURS.map(ind => [ind.nom, ind.unite, ...ANNEES.map(an => {
          const v = valeur(ind, an); return Number.isFinite(v) ? Math.round(v * 100) / 100 : "";
        })])]);
      document.getElementById("table-source").onchange = e => { etat.tableSource = e.target.value; afficher(); };
    },
  };
}

// ============================================================================
// 5. AFFICHAGE GÉNÉRAL
// ============================================================================
function afficher() {
  graphiques.forEach(g => g.destroy());
  graphiques = [];
  document.querySelectorAll("#onglets button").forEach(b => b.setAttribute("aria-selected", b.dataset.onglet === etat.onglet));

  const page = etat.onglet === "Vue d'ensemble" ? pageVueEnsemble()
    : etat.onglet === "Données et méthode" ? pageDonnees()
    : pageAxe(etat.onglet);
  document.getElementById("contenu").innerHTML = page.html;

  document.querySelectorAll("[data-kpi]").forEach(b => b.onclick = () => { etat.choisi = INDICATEURS[b.dataset.kpi]; afficher(); });
  document.querySelectorAll(".axe-carte").forEach(b => b.onclick = () => { etat.onglet = b.dataset.onglet; afficher(); window.scrollTo(0, 0); });
  page.dessiner();
}

function demarrer() {
  ANNEES = [...new Set(DONNEES.formation_effectifs.map(l => l.annee))].sort((a, b) => a - b);
  etat.annee = ANNEES[ANNEES.length - 1];

  const menu = document.getElementById("annee");
  menu.innerHTML = [...ANNEES].reverse().map(an => `<option>${an}</option>`).join("");
  menu.onchange = () => { etat.annee = Number(menu.value); afficher(); };

  document.querySelectorAll(".filtres input[type=checkbox]").forEach(c => c.onchange = () => {
    const coches = [...document.querySelectorAll(".filtres input:checked")].map(x => x.value);
    etat.filieres = coches.length ? coches : [...TOUTES_FILIERES];
    afficher();
  });

  document.getElementById("onglets").innerHTML = ONGLETS.map(o =>
    `<button role="tab" data-onglet="${o}">${o}</button>`).join("");
  document.querySelectorAll("#onglets button").forEach(b => b.onclick = () => { etat.onglet = b.dataset.onglet; afficher(); });

  afficher();
}

Promise.allSettled(FICHIERS.map(async nom => { DONNEES[nom] = await chargerCSV(nom); }))
  .then(resultats => {
    const manquants = FICHIERS.filter((_, i) => resultats[i].status === "rejected");
    if (manquants.length) {
      document.getElementById("erreur-fichiers").textContent = manquants.map(f => f + ".csv").join(", ");
      document.getElementById("erreur").style.display = "block";
      return;
    }
    DONNEES.entreprises_stages.forEach(l => { l.embauche = String(l.embauche_suite).toLowerCase() === "true"; });
    demarrer();
  });
