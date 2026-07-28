// shared/dashboard/statistics.js — onglet "Statistiques" du tableau de bord
// Chargé dynamiquement par dashboard.js. Contenu à définir (futur).
// Depuis la racine : tous les jeux. Depuis un jeu (ctx.game) : jeu courant uniquement.

function renderStatistics(container, ctx) {
  container.innerHTML = `
    <h2>Statistiques</h2>
    <p class="tab-placeholder">${ctx.game ? 'Jeu : ' + ctx.game : 'Tous les jeux'} — à venir.</p>
  `;
}
