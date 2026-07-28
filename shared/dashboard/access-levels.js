// shared/dashboard/access-levels.js — onglet "Accès aux niveaux" du tableau de bord
// Chargé dynamiquement par dashboard.js, uniquement si ?game= est présent.
// Adapté de cliconvocabulary/access.js : plus de page/auth propre, rendu dans le container fourni.

let _alFamilies      = [];
let _alLevels        = [];
let _alDifficulties  = [];
let _alPlayers       = [];
let _alSupervisorId  = null;
let _alShowLocked    = true;
let _alSelectedFamilyDocId = null;
let _alSelectedDiff  = null;
let _alDeniedMap     = {};
let _alGame          = null;

async function renderAccessLevels(container, ctx) {
  _alGame = ctx.game;
  container.innerHTML = '<p class="tab-placeholder">Chargement…</p>';
  try {
    await ensureEditorService(ctx.game);

    const [profilesRaw, fams, levels, diffs] = await Promise.all([
      _platformMethods.getProfiles(),
      _platformMethods.getFamilies(),
      _platformMethods.getAllLevels(),
      _platformMethods.getDifficulties().catch(e => { console.warn('[access-levels]', e); return []; }),
    ]);

    const supervisor = profilesRaw.find(p => p.is_supervisor);
    if (!supervisor) {
      container.innerHTML = '<p class="tab-placeholder">Profil superviseur introuvable.</p>';
      return;
    }

    _alFamilies     = fams;
    _alLevels       = levels;
    _alDifficulties = diffs;
    _alPlayers      = profilesRaw.filter(p => !p.is_supervisor);
    _alSupervisorId = supervisor.id;
    _alShowLocked   = supervisor.show_locked_levels ?? true;
    _alSelectedFamilyDocId = _alFamilies[0]?.docId || null;
    _alSelectedDiff = null;

    _alDeniedMap = {};
    _alPlayers.forEach(p => { _alDeniedMap[p.id] = new Set(p.denied_levels || []); });

    _alBuildLayout(container);
    _alRenderFamilyTabs(container);
    _alRenderControls(container);
    _alRenderMatrix(container);
    _alUpdateToggle(container);

    container.querySelector('#al-save-btn').addEventListener('click', () => _alSave(container));
    container.querySelector('#al-btn-locked').addEventListener('click', () => { _alShowLocked = true;  _alUpdateToggle(container); });
    container.querySelector('#al-btn-hidden').addEventListener('click', () => { _alShowLocked = false; _alUpdateToggle(container); });
  } catch (e) {
    console.error('[access-levels] init error', e);
    container.innerHTML = '<p class="tab-placeholder">Erreur de chargement.</p>';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _alEsc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _alAvatarPath(id) {
  return `../${_alGame}/assets/avatars/avatar${String(id || 1).padStart(2, '0')}.png`;
}

function _alFamLevels() {
  const fam = _alFamilies.find(f => f.docId === _alSelectedFamilyDocId);
  if (!fam) return [];
  return _alLevels.filter(l => Number(l.family_id) === Number(fam.id) && l.valid !== false);
}

function _alViewLevels() {
  const fl = _alFamLevels();
  return _alSelectedDiff !== null ? fl.filter(l => (l.difficulties || []).includes(_alSelectedDiff)) : fl;
}

function _alIsAllowed(profileId, levelDocId) {
  return !_alDeniedMap[profileId]?.has(levelDocId);
}

function _alSetAllowed(profileId, levelDocId, allow) {
  if (!_alDeniedMap[profileId]) _alDeniedMap[profileId] = new Set();
  if (allow) _alDeniedMap[profileId].delete(levelDocId);
  else       _alDeniedMap[profileId].add(levelDocId);
}

// ── Layout ───────────────────────────────────────────────────────────────────

function _alBuildLayout(container) {
  container.innerHTML = `
    <div class="al-wrap">
      <div class="al-toolbar">
        <h2>🔓 Accès aux niveaux</h2>
        <button id="al-save-btn" class="btn btn-primary">Enregistrer</button>
      </div>
      <div class="al-family-bar" id="al-family-bar"></div>
      <div class="al-controls" id="al-controls"></div>
      <div class="al-table-wrap">
        <table class="al-matrix" id="al-matrix"><tbody><tr><td class="al-loading-cell">Chargement…</td></tr></tbody></table>
      </div>
      <div class="al-footer">
        <span class="al-footer-label">Niveaux non autorisés :</span>
        <div class="al-toggle-btns">
          <button class="al-toggle-btn" id="al-btn-locked">🔒 Verrouillé</button>
          <button class="al-toggle-btn" id="al-btn-hidden">⊘ Masqué</button>
        </div>
        <div id="al-save-error" class="error-msg"></div>
        <div id="al-save-ok" class="al-ok hidden">✓ Enregistré</div>
      </div>
    </div>
  `;
}

// ── Family tabs ──────────────────────────────────────────────────────────────

function _alRenderFamilyTabs(container) {
  const bar = container.querySelector('#al-family-bar');
  bar.innerHTML = _alFamilies.map(f =>
    `<button class="al-family-tab${f.docId === _alSelectedFamilyDocId ? ' active' : ''}" data-fam="${_alEsc(f.docId)}">${_alEsc(f.name)}</button>`
  ).join('');
  bar.querySelectorAll('.al-family-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _alSelectedFamilyDocId = btn.dataset.fam;
      _alSelectedDiff = null;
      _alRenderFamilyTabs(container);
      _alRenderControls(container);
      _alRenderMatrix(container);
    });
  });
}

// ── Controls (diff chips + bulk-all) ──────────────────────────────────────────

function _alRenderControls(container) {
  const ctrl = container.querySelector('#al-controls');
  const fl   = _alFamLevels();
  const diffIds = [...new Set(fl.flatMap(l => l.difficulties || []))];
  const diffs   = _alDifficulties.filter(d => diffIds.includes(d.docId));

  let html = '';
  if (diffs.length) {
    html += `<span class="al-controls-label">Difficulté :</span>`;
    html += `<button class="al-diff-chip${_alSelectedDiff === null ? ' active' : ''}" data-diff="">Tout</button>`;
    diffs.forEach(d => {
      html += `<button class="al-diff-chip${_alSelectedDiff === d.docId ? ' active' : ''}" data-diff="${_alEsc(d.docId)}">${_alEsc(d.name)}</button>`;
    });
  }
  html += `<button class="al-bulk-all-btn al-bulk-right" id="al-bulk-all-check">✓ Tout autoriser</button>`;
  html += `<button class="al-bulk-all-btn" id="al-bulk-all-uncheck">✗ Tout bloquer</button>`;

  ctrl.innerHTML = html;

  ctrl.querySelectorAll('.al-diff-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _alSelectedDiff = btn.dataset.diff || null;
      _alRenderControls(container);
      _alRenderMatrix(container);
    });
  });

  ctrl.querySelector('#al-bulk-all-check')?.addEventListener('click', () => {
    const vl = _alViewLevels();
    _alPlayers.forEach(p => vl.forEach(l => _alSetAllowed(p.id, l.docId, true)));
    _alRenderMatrix(container);
  });

  ctrl.querySelector('#al-bulk-all-uncheck')?.addEventListener('click', () => {
    const vl = _alViewLevels();
    _alPlayers.forEach(p => vl.forEach(l => _alSetAllowed(p.id, l.docId, false)));
    _alRenderMatrix(container);
  });
}

// ── Matrix ───────────────────────────────────────────────────────────────────

function _alRenderMatrix(container) {
  const vl  = _alViewLevels();
  const tbl = container.querySelector('#al-matrix');

  if (!_alPlayers.length) {
    tbl.innerHTML = '<tbody><tr><td class="al-no-player-msg">Aucun joueur à configurer. Ajoutez des joueurs depuis l\'écran d\'accueil.</td></tr></tbody>';
    return;
  }

  let thead = '<thead><tr>';
  thead += `<th class="al-corner-th">
    <div class="al-corner-bulk">
      <button class="al-bulk-btn" data-action="all-check">✓ tous</button>
      <button class="al-bulk-btn" data-action="all-uncheck">✗ tous</button>
    </div>
  </th>`;
  _alPlayers.forEach(p => {
    thead += `<th class="al-player-th">
      <img class="al-player-avatar" src="${_alAvatarPath(p.avatar_id)}" alt="${_alEsc(p.prenom)}">
      <div class="al-player-name">${_alEsc(p.prenom)}</div>
      <div class="al-col-bulk">
        <button class="al-bulk-btn" data-action="col-check" data-pid="${_alEsc(p.id)}">✓</button>
        <button class="al-bulk-btn" data-action="col-uncheck" data-pid="${_alEsc(p.id)}">✗</button>
      </div>
    </th>`;
  });
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  if (vl.length === 0) {
    tbody += `<tr><td class="al-no-player-msg" colspan="${_alPlayers.length + 1}">Aucun niveau dans cette famille.</td></tr>`;
  } else {
    vl.forEach(lvl => {
      tbody += '<tr>';
      tbody += `<td>
        <div class="al-level-cell">
          <span class="al-level-name">${_alEsc(lvl.title || lvl.name)}</span>
          <div class="al-row-bulk">
            <button class="al-bulk-btn" data-action="row-check" data-lid="${_alEsc(lvl.docId)}">✓</button>
            <button class="al-bulk-btn" data-action="row-uncheck" data-lid="${_alEsc(lvl.docId)}">✗</button>
          </div>
        </div>
      </td>`;
      _alPlayers.forEach(p => {
        const checked = _alIsAllowed(p.id, lvl.docId);
        tbody += `<td class="al-cb-cell">
          <input type="checkbox" class="al-cb"
            data-pid="${_alEsc(p.id)}" data-lid="${_alEsc(lvl.docId)}"
            ${checked ? 'checked' : ''}>
        </td>`;
      });
      tbody += '</tr>';
    });
  }
  tbody += '</tbody>';

  tbl.innerHTML = thead + tbody;

  tbl.addEventListener('change', e => {
    const cb = e.target.closest('.al-cb');
    if (!cb) return;
    _alSetAllowed(cb.dataset.pid, cb.dataset.lid, cb.checked);
  });

  tbl.addEventListener('click', e => {
    const btn = e.target.closest('.al-bulk-btn');
    if (!btn) return;
    const action = btn.dataset.action;
    const vids   = _alViewLevels().map(l => l.docId);

    if (action === 'col-check' || action === 'col-uncheck') {
      const pid = btn.dataset.pid;
      vids.forEach(lid => _alSetAllowed(pid, lid, action === 'col-check'));
    } else if (action === 'row-check' || action === 'row-uncheck') {
      const lid = btn.dataset.lid;
      _alPlayers.forEach(p => _alSetAllowed(p.id, lid, action === 'row-check'));
    } else if (action === 'all-check' || action === 'all-uncheck') {
      _alPlayers.forEach(p => vids.forEach(lid => _alSetAllowed(p.id, lid, action === 'all-check')));
    }
    _alRenderMatrix(container);
  });
}

// ── Toggle locked / hidden ─────────────────────────────────────────────────────

function _alUpdateToggle(container) {
  container.querySelector('#al-btn-locked').classList.toggle('active',  _alShowLocked);
  container.querySelector('#al-btn-hidden').classList.toggle('active', !_alShowLocked);
}

// ── Save ─────────────────────────────────────────────────────────────────────

async function _alSave(container) {
  const btn   = container.querySelector('#al-save-btn');
  const errEl = container.querySelector('#al-save-error');
  const okEl  = container.querySelector('#al-save-ok');
  btn.disabled = true;
  errEl.textContent = '';
  okEl.classList.add('hidden');
  try {
    await Promise.all(_alPlayers.map(p => {
      const denied = [...(_alDeniedMap[p.id] || new Set())];
      return _platformMethods.updateDeniedLevels(p.id, denied);
    }));
    if (_alSupervisorId) {
      await _platformMethods.updateShowLockedSetting(_alSupervisorId, _alShowLocked);
    }
    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 2500);
  } catch (e) {
    console.error('[access-levels] save error', e);
    errEl.textContent = 'Erreur lors de la sauvegarde.';
  } finally {
    btn.disabled = false;
  }
}
