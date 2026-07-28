// shared/dashboard/users-manager.js — onglet "Gestion utilisateurs" du tableau de bord
// Transversal : les profils sont communs à tous les jeux (profiles/{id}), pas de dépendance
// à ?game= sauf pour l'affichage des avatars (dossier assets/avatars dupliqué par jeu mais
// avec les mêmes fichiers — on utilise le jeu courant si connu, sinon un jeu par défaut).
// Purement administratif : créer / supprimer / renommer. Le cosmétique (choix d'avatar) reste
// dans le menu joueur ("✏ Modifier [prénom]"), volontairement pas dupliqué ici.

let _umProfiles       = [];
let _umGame           = null;
let _umTargetProfile  = null; // profil en cours de renommage, null = création

async function renderUsersManager(container, ctx) {
  _umGame = ctx.game || 'cliconvocabulary';
  container.innerHTML = '<p class="tab-placeholder">Chargement…</p>';
  try {
    _umProfiles = await _platformMethods.getProfiles();
    _umBuildLayout(container);
    _umRenderList(container);
    _umWireEvents(container);
  } catch (e) {
    console.error('[users-manager] init error', e);
    container.innerHTML = '<p class="tab-placeholder">Erreur de chargement.</p>';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _umEsc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _umAvatarPath(id) {
  return `../${_umGame}/assets/avatars/avatar${String(id || 1).padStart(2, '0')}.png`;
}

// ── Layout ───────────────────────────────────────────────────────────────────

function _umBuildLayout(container) {
  container.innerHTML = `
    <div class="um-wrap">
      <div class="um-toolbar">
        <h2>👤 Gestion utilisateurs</h2>
        <button id="um-add-btn" class="btn btn-primary">➕ Nouveau profil</button>
      </div>
      <div id="um-list" class="um-list"></div>
      <div id="um-error" class="error-msg"></div>
    </div>

    <div id="um-form-modal" class="modal-overlay" style="display:none">
      <div class="modal">
        <h2 id="um-form-title">Nouveau profil</h2>
        <form id="um-form">
          <div class="form-group">
            <label>Prénom</label>
            <input id="um-form-prenom" type="text" required>
          </div>
          <div class="form-group">
            <label>Nom</label>
            <input id="um-form-nom" type="text">
          </div>
          <div id="um-form-error" class="error-msg"></div>
          <div class="modal-actions">
            <button id="um-form-cancel" type="button" class="btn btn-secondary">Annuler</button>
            <button id="um-form-submit" type="submit" class="btn btn-primary">Créer</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function _umRenderList(container) {
  const list = container.querySelector('#um-list');
  list.innerHTML = '';
  _umProfiles.forEach(p => {
    const row = document.createElement('div');
    row.className = 'um-row';
    row.innerHTML = `
      <img class="um-avatar" src="${_umAvatarPath(p.avatar_id)}" alt="${_umEsc(p.prenom)}">
      <div class="um-row-info">
        <div class="um-row-name">${_umEsc(p.prenom)} ${_umEsc(p.nom || '')}</div>
        ${p.is_supervisor ? '<span class="um-badge">👑 Superviseur</span>' : ''}
      </div>
      <div class="um-row-actions">
        <button class="btn btn-sm btn-secondary" data-action="rename">✏ Renommer</button>
        ${p.is_supervisor ? '' : '<button class="btn btn-sm btn-danger" data-action="delete">✕ Supprimer</button>'}
      </div>
    `;
    row.querySelector('[data-action="rename"]').addEventListener('click', () => _umOpenRename(container, p));
    row.querySelector('[data-action="delete"]')?.addEventListener('click', () => _umConfirmDelete(container, p));
    list.appendChild(row);
  });
}

// ── Create / rename form (modal partagé) ──────────────────────────────────────

function _umWireEvents(container) {
  container.querySelector('#um-add-btn').addEventListener('click', () => _umOpenCreate(container));
  container.querySelector('#um-form-cancel').addEventListener('click', () => _umCloseForm(container));
  container.querySelector('#um-form-modal').addEventListener('click', e => {
    if (e.target.id === 'um-form-modal') _umCloseForm(container);
  });
  container.querySelector('#um-form').addEventListener('submit', e => _umHandleSubmit(container, e));
}

function _umOpenCreate(container) {
  _umTargetProfile = null;
  container.querySelector('#um-form-title').textContent  = 'Nouveau profil';
  container.querySelector('#um-form-submit').textContent = 'Créer';
  container.querySelector('#um-form-prenom').value = '';
  container.querySelector('#um-form-nom').value    = '';
  container.querySelector('#um-form-error').textContent = '';
  container.querySelector('#um-form-modal').style.display = 'flex';
  container.querySelector('#um-form-prenom').focus();
}

function _umOpenRename(container, profile) {
  _umTargetProfile = profile;
  container.querySelector('#um-form-title').textContent  = 'Renommer le profil';
  container.querySelector('#um-form-submit').textContent = 'Enregistrer';
  container.querySelector('#um-form-prenom').value = profile.prenom || '';
  container.querySelector('#um-form-nom').value    = profile.nom || '';
  container.querySelector('#um-form-error').textContent = '';
  container.querySelector('#um-form-modal').style.display = 'flex';
  container.querySelector('#um-form-prenom').focus();
}

function _umCloseForm(container) {
  container.querySelector('#um-form-modal').style.display = 'none';
}

async function _umHandleSubmit(container, e) {
  e.preventDefault();
  const prenom = container.querySelector('#um-form-prenom').value.trim();
  const nom    = container.querySelector('#um-form-nom').value.trim();
  const errEl  = container.querySelector('#um-form-error');
  errEl.textContent = '';
  if (!prenom) { errEl.textContent = 'Le prénom est requis.'; return; }

  const btn = container.querySelector('#um-form-submit');
  btn.disabled = true;
  try {
    if (_umTargetProfile) {
      await _platformMethods.updateProfileFields(_umTargetProfile.id, { prenom, nom });
    } else {
      await _platformMethods.createChildProfile(prenom, nom, 1);
    }
    _umCloseForm(container);
    _umProfiles = await _platformMethods.getProfiles();
    _umRenderList(container);
  } catch (err) {
    errEl.textContent = err.message || 'Erreur lors de l\'enregistrement.';
  } finally {
    btn.disabled = false;
  }
}

// ── Delete ───────────────────────────────────────────────────────────────────

async function _umConfirmDelete(container, profile) {
  if (!confirm('Supprimer le profil "' + (profile.prenom || '') + '" ? Cette action est irréversible.')) return;
  const errEl = container.querySelector('#um-error');
  errEl.textContent = '';
  try {
    await _platformMethods.deleteChildProfile(profile.id);
    _umProfiles = await _platformMethods.getProfiles();
    _umRenderList(container);
  } catch (err) {
    errEl.textContent = err.message || 'Erreur lors de la suppression.';
  }
}
