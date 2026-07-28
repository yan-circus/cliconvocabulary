// shared/dashboard/general-settings.js — onglet "Général" du tableau de bord
// Transversal : mêmes réglages quel que soit le point d'entrée (racine ou jeu),
// car stockés directement sur le profil superviseur (profiles/{id}), pas par jeu.
// Repris du modal "Réglages" de shared/index.js (settings-overlay).

let _gsSupervisor = null;

async function renderGeneralSettings(container, ctx) {
  container.innerHTML = '<p class="tab-placeholder">Chargement…</p>';
  try {
    const profiles = await _platformMethods.getProfiles();
    _gsSupervisor = profiles.find(p => p.is_supervisor) || null;

    if (!_gsSupervisor) {
      container.innerHTML = '<p class="tab-placeholder">Profil superviseur introuvable.</p>';
      return;
    }

    _gsBuildLayout(container);
    container.querySelector('#gs-show-ranking').checked = _gsSupervisor.show_ranking ?? true;
    container.querySelector('#gs-save-btn').addEventListener('click', () => _gsSave(container));
  } catch (e) {
    console.error('[general-settings] init error', e);
    container.innerHTML = '<p class="tab-placeholder">Erreur de chargement.</p>';
  }
}

function _gsBuildLayout(container) {
  container.innerHTML = `
    <div class="gs-wrap">
      <div class="gs-toolbar">
        <h2>⚙️ Général</h2>
      </div>
      <div class="gs-list">
        <div class="gs-row">
          <div class="gs-row-info">
            <div class="gs-row-label">Afficher le classement</div>
            <div class="gs-row-desc">Les joueurs peuvent voir les scores de tous les utilisateurs dans le panneau Scores.</div>
          </div>
          <label class="gs-toggle">
            <input type="checkbox" id="gs-show-ranking">
            <span class="gs-toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="gs-actions">
        <button id="gs-save-btn" class="btn btn-primary">Enregistrer</button>
        <div id="gs-save-error" class="error-msg"></div>
        <div id="gs-save-ok" class="gs-ok hidden">✓ Enregistré</div>
      </div>
    </div>
  `;
}

async function _gsSave(container) {
  const btn   = container.querySelector('#gs-save-btn');
  const errEl = container.querySelector('#gs-save-error');
  const okEl  = container.querySelector('#gs-save-ok');
  btn.disabled = true;
  errEl.textContent = '';
  okEl.classList.add('hidden');
  try {
    const showRanking = container.querySelector('#gs-show-ranking').checked;
    await _platformMethods.updateSupervisorSettings(_gsSupervisor.id, { show_ranking: showRanking });
    _gsSupervisor.show_ranking = showRanking;
    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 2500);
  } catch (e) {
    console.error('[general-settings] save error', e);
    errEl.textContent = 'Erreur lors de la sauvegarde.';
  } finally {
    btn.disabled = false;
  }
}
