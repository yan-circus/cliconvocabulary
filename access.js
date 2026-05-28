// access.js — Supervisor level access management

const DIFFICULTIES = GAME_CONFIG.difficulties;

let families          = [];
let allLevels         = [];
let players           = [];   // non-supervisor profiles
let supervisorId      = null;
let showLocked        = true;
let selectedFamilyDocId = null;
let selectedDiff      = null; // null = all, or difficulty id (integer)
let deniedMap         = {};   // profileId -> Set<levelDocId>

// ── Auth gate ─────────────────────────────────────────────────────────────────

window.onAuthChanged = async (user) => {
  if (!user) { location.href = 'index.html'; return; }
  try {
    await init();
  } catch (e) {
    console.error('[access] init error', e);
    document.querySelector('.access-table-wrap').innerHTML =
      '<p style="padding:40px;color:#e74c3c">Erreur de chargement.</p>';
  }
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const [profilesRaw, fams, levels] = await Promise.all([
    gameService.getProfiles(),
    gameService.getFamilies(),
    gameService.getAllLevels(),
  ]);

  const supervisor = profilesRaw.find(p => p.is_supervisor);
  if (!supervisor) { location.href = 'index.html'; return; }

  supervisorId = supervisor.id;
  showLocked   = supervisor.show_locked_levels ?? true;
  families     = fams;
  allLevels    = levels;
  players      = profilesRaw.filter(p => !p.is_supervisor);

  deniedMap = {};
  players.forEach(p => { deniedMap[p.id] = new Set(p.denied_levels || []); });

  selectedFamilyDocId = families[0]?.docId || null;
  selectedDiff = null;

  renderFamilyTabs();
  renderControls();
  renderMatrix();
  updateToggle();

  document.getElementById('save-btn').addEventListener('click', save);
  document.getElementById('btn-locked').addEventListener('click', () => {
    showLocked = true; updateToggle();
  });
  document.getElementById('btn-hidden').addEventListener('click', () => {
    showLocked = false; updateToggle();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function avatarPath(id) {
  return `assets/avatars/avatar${String(id || 1).padStart(2, '0')}.png`;
}

function famLevels() {
  const fam = families.find(f => f.docId === selectedFamilyDocId);
  if (!fam) return [];
  return allLevels.filter(l => Number(l.family_id) === Number(fam.id) && l.valid !== false);
}

function viewLevels() {
  const fl = famLevels();
  return selectedDiff !== null ? fl.filter(l => l.difficulty === selectedDiff) : fl;
}

function isAllowed(profileId, levelDocId) {
  return !deniedMap[profileId]?.has(levelDocId);
}

function setAllowed(profileId, levelDocId, allow) {
  if (!deniedMap[profileId]) deniedMap[profileId] = new Set();
  if (allow) deniedMap[profileId].delete(levelDocId);
  else       deniedMap[profileId].add(levelDocId);
}

// ── Render family tabs ────────────────────────────────────────────────────────

function renderFamilyTabs() {
  const bar = document.getElementById('family-bar');
  bar.innerHTML = families.map(f =>
    `<button class="access-family-tab${f.docId === selectedFamilyDocId ? ' active' : ''}" data-fam="${esc(f.docId)}">${esc(f.name)}</button>`
  ).join('');
  bar.querySelectorAll('.access-family-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFamilyDocId = btn.dataset.fam;
      selectedDiff = null;
      renderFamilyTabs();
      renderControls();
      renderMatrix();
    });
  });
}

// ── Render controls (diff chips + bulk-all) ───────────────────────────────────

function renderControls() {
  const ctrl = document.getElementById('controls');
  const fl   = famLevels();
  const diffs = [...new Set(fl.map(l => l.difficulty).filter(d => d != null))].sort((a, b) => a - b);

  let html = '';
  if (diffs.length) {
    html += `<span class="access-controls-label">Difficulté :</span>`;
    html += `<button class="access-diff-chip${selectedDiff === null ? ' active' : ''}" data-diff="">Tout</button>`;
    diffs.forEach(dId => {
      const d = DIFFICULTIES.find(x => x.id === dId);
      html += `<button class="access-diff-chip${selectedDiff === dId ? ' active' : ''}" data-diff="${dId}">${esc(d?.label || dId)}</button>`;
    });
  }
  html += `<button class="access-bulk-all-btn access-bulk-right" id="bulk-all-check">✓ Tout autoriser</button>`;
  html += `<button class="access-bulk-all-btn" id="bulk-all-uncheck">✗ Tout bloquer</button>`;

  ctrl.innerHTML = html;

  ctrl.querySelectorAll('.access-diff-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDiff = btn.dataset.diff ? Number(btn.dataset.diff) : null;
      renderControls();
      renderMatrix();
    });
  });

  document.getElementById('bulk-all-check')?.addEventListener('click', () => {
    const vl = viewLevels();
    players.forEach(p => vl.forEach(l => setAllowed(p.id, l.docId, true)));
    renderMatrix();
  });

  document.getElementById('bulk-all-uncheck')?.addEventListener('click', () => {
    const vl = viewLevels();
    players.forEach(p => vl.forEach(l => setAllowed(p.id, l.docId, false)));
    renderMatrix();
  });
}

// ── Render matrix ─────────────────────────────────────────────────────────────

function renderMatrix() {
  const vl  = viewLevels();
  const tbl = document.getElementById('matrix');

  if (!players.length) {
    tbl.innerHTML = '<tbody><tr><td class="no-player-msg">Aucun joueur à configurer. Ajoutez des joueurs depuis l\'écran d\'accueil.</td></tr></tbody>';
    return;
  }

  // ── thead ──
  let thead = '<thead><tr>';
  // corner
  thead += `<th class="matrix-corner-th">
    <div class="matrix-corner-bulk">
      <button class="matrix-bulk-btn" data-action="all-check">✓ tous</button>
      <button class="matrix-bulk-btn" data-action="all-uncheck">✗ tous</button>
    </div>
  </th>`;
  // player columns
  players.forEach(p => {
    thead += `<th class="matrix-player-th">
      <img class="matrix-player-avatar" src="${avatarPath(p.avatar_id)}" alt="${esc(p.prenom)}">
      <div class="matrix-player-name">${esc(p.prenom)}</div>
      <div class="matrix-col-bulk">
        <button class="matrix-bulk-btn" data-action="col-check" data-pid="${esc(p.id)}">✓</button>
        <button class="matrix-bulk-btn" data-action="col-uncheck" data-pid="${esc(p.id)}">✗</button>
      </div>
    </th>`;
  });
  thead += '</tr></thead>';

  // ── tbody ──
  let tbody = '<tbody>';
  if (vl.length === 0) {
    tbody += `<tr><td class="no-player-msg" colspan="${players.length + 1}">Aucun niveau dans cette famille.</td></tr>`;
  } else {
    vl.forEach(lvl => {
      tbody += '<tr>';
      // level name cell
      tbody += `<td>
        <div class="matrix-level-cell">
          <span class="matrix-level-name">${esc(lvl.title || lvl.name)}</span>
          <div class="matrix-row-bulk">
            <button class="matrix-bulk-btn" data-action="row-check" data-lid="${esc(lvl.docId)}">✓</button>
            <button class="matrix-bulk-btn" data-action="row-uncheck" data-lid="${esc(lvl.docId)}">✗</button>
          </div>
        </div>
      </td>`;
      // checkbox per player
      players.forEach(p => {
        const checked = isAllowed(p.id, lvl.docId);
        tbody += `<td class="matrix-cb-cell">
          <input type="checkbox" class="matrix-cb"
            data-pid="${esc(p.id)}" data-lid="${esc(lvl.docId)}"
            ${checked ? 'checked' : ''}>
        </td>`;
      });
      tbody += '</tr>';
    });
  }
  tbody += '</tbody>';

  tbl.innerHTML = thead + tbody;

  // ── Events (delegation) ──
  tbl.addEventListener('change', e => {
    const cb = e.target.closest('.matrix-cb');
    if (!cb) return;
    setAllowed(cb.dataset.pid, cb.dataset.lid, cb.checked);
  });

  tbl.addEventListener('click', e => {
    const btn = e.target.closest('.matrix-bulk-btn');
    if (!btn) return;
    const action = btn.dataset.action;
    const vids   = viewLevels().map(l => l.docId);

    if (action === 'col-check' || action === 'col-uncheck') {
      const pid = btn.dataset.pid;
      vids.forEach(lid => setAllowed(pid, lid, action === 'col-check'));
    } else if (action === 'row-check' || action === 'row-uncheck') {
      const lid = btn.dataset.lid;
      players.forEach(p => setAllowed(p.id, lid, action === 'row-check'));
    } else if (action === 'all-check' || action === 'all-uncheck') {
      players.forEach(p => vids.forEach(lid => setAllowed(p.id, lid, action === 'all-check')));
    }
    renderMatrix();
  });
}

// ── Toggle locked / hidden ────────────────────────────────────────────────────

function updateToggle() {
  document.getElementById('btn-locked').classList.toggle('active',  showLocked);
  document.getElementById('btn-hidden').classList.toggle('active', !showLocked);
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function save() {
  const btn   = document.getElementById('save-btn');
  const errEl = document.getElementById('save-error');
  const okEl  = document.getElementById('save-ok');
  btn.disabled = true;
  errEl.textContent = '';
  okEl.classList.add('hidden');
  try {
    await Promise.all(players.map(p => {
      const denied = [...(deniedMap[p.id] || new Set())];
      return gameService.updateDeniedLevels(p.id, denied);
    }));
    if (supervisorId) {
      await gameService.updateShowLockedSetting(supervisorId, showLocked);
    }
    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 2500);
  } catch (e) {
    console.error('[access] save error', e);
    errEl.textContent = 'Erreur lors de la sauvegarde.';
  } finally {
    btn.disabled = false;
  }
}
