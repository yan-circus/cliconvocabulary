// shared/editor_manager.js — browser commun pour les éditeurs de jeux LudoEdu
// Chargé dynamiquement après les scripts du jeu. Utilise window.editorService.

const _GAME = new URLSearchParams(location.search).get('game') || '';

const _state = {
  families:       [],
  selectedFamily: null,
  levels:         [],
  level:          null,
  difficulties:   [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showErr(id, m) { const el = document.getElementById(id); if (el) el.textContent = m; }
function setLoading(btn, on) {
  btn.disabled = on;
  if (on)  { btn.dataset.txt = btn.textContent; btn.textContent = '…'; }
  else     { btn.textContent = btn.dataset.txt || btn.textContent; }
}
function showModal(id)  { document.getElementById(id).style.display = 'flex'; }
function hideModal(id)  { document.getElementById(id).style.display = 'none'; }

// ── Auth ──────────────────────────────────────────────────────────────────────

window.onAuthChanged = user => {
  if (!user) {
    location.href = _GAME ? '../' + _GAME + '/index.html' : '../index.html';
    return;
  }
  _initManager();
};
// Si l'auth a déjà été résolue avant le chargement de ce script (chargement dynamique)
if (_authResolved) window.onAuthChanged(_currentUser);

// ── Init ──────────────────────────────────────────────────────────────────────

async function _initManager() {
  const gameName = editorService.GAME_NAME || _GAME;
  document.getElementById('page-title').textContent = gameName + ' — Éditeur';
  document.title = gameName + ' — Éditeur';
  document.getElementById('home-link').href = '../' + _GAME + '/index.html';

  _state.difficulties = await editorService.getDifficulties().catch(() => []);
  _populateDiffSelect('new-level-diff', []);

  _loadBrowser();
}

function _populateDiffSelect(selectId, selectedUuids) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = '';
  _state.difficulties.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.docId;
    opt.textContent = d.name;
    opt.selected = selectedUuids.includes(d.docId);
    sel.appendChild(opt);
  });
}

function _readDiffSelect(selectId) {
  return [...document.getElementById(selectId).selectedOptions].map(o => o.value);
}

// ── Browser ───────────────────────────────────────────────────────────────────

async function _loadBrowser() {
  await _refreshFamilies();
}

async function _refreshFamilies() {
  _state.families = await editorService.getFamilies();
  _renderFamilyList();
  if (_state.families.length === 0) {
    _state.selectedFamily = null;
    document.getElementById('family-title').textContent = 'Aucune famille — créez-en une';
    _state.levels = [];
    _renderLevelGrid();
    return;
  }
  const current = _state.selectedFamily
    ? (_state.families.find(f => f.docId === _state.selectedFamily.docId) || _state.families[0])
    : _state.families[0];
  await _selectFamily(current);
}

function _renderFamilyList() {
  const container = document.getElementById('family-list');
  container.innerHTML = '';
  _state.families.forEach(fam => {
    const active = _state.selectedFamily?.docId === fam.docId;
    const item   = document.createElement('div');
    item.className = 'family-item' + (active ? ' active' : '');
    item.innerHTML = `
      <span class="family-name">${esc(fam.name)}</span>
      <button class="icon-btn danger" title="Supprimer" data-fid="${fam.docId}">✕</button>
    `;
    item.addEventListener('click', e => { if (e.target.dataset.fid) return; _selectFamily(fam); });
    item.querySelector('[data-fid]').addEventListener('click', () => _confirmDeleteFamily(fam));
    container.appendChild(item);
  });
}

async function _selectFamily(fam) {
  _state.selectedFamily = fam;
  _renderFamilyList();
  document.getElementById('family-title').textContent = fam.name;
  _state.levels = await editorService.getLevels(fam.id);
  _renderLevelGrid();
}

function _renderLevelGrid() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  _state.levels.forEach((lvl, i) => {
    const diffLabels = (lvl.difficulties || [])
      .map(uid => _state.difficulties.find(d => d.docId === uid)?.name)
      .filter(Boolean).join(', ');
    const card = document.createElement('div');
    card.className = 'level-card';
    const isFirst = i === 0;
    const isLast  = i === _state.levels.length - 1;
    card.innerHTML = `
      <div class="level-card-title">${esc(lvl.title || lvl.name)}</div>
      <div class="level-card-diff">${diffLabels || '—'}</div>
      ${lvl.notes ? `<div class="level-card-notes">${esc(lvl.notes)}</div>` : ''}
      ${lvl.valid ? '<div class="level-card-valid">✓ Valide</div>' : ''}
      <div class="level-card-actions">
        <button class="btn btn-sm btn-secondary" title="Monter" ${isFirst ? 'disabled' : ''}>▲</button>
        <button class="btn btn-sm btn-secondary" title="Descendre" ${isLast ? 'disabled' : ''}>▼</button>
        <button class="btn btn-sm btn-primary">Éditer</button>
        <button class="btn btn-sm btn-secondary" title="Dupliquer">⧉</button>
        <button class="btn btn-sm btn-danger">✕</button>
      </div>
    `;
    card.querySelectorAll('.btn')[0].addEventListener('click', () => _moveLevel(lvl, 'up'));
    card.querySelectorAll('.btn')[1].addEventListener('click', () => _moveLevel(lvl, 'down'));
    card.querySelectorAll('.btn')[2].addEventListener('click', () => _openMeta(lvl));
    card.querySelectorAll('.btn')[3].addEventListener('click', () => _duplicateLevel(lvl));
    card.querySelectorAll('.btn')[4].addEventListener('click', () => _confirmDeleteLevel(lvl));
    grid.appendChild(card);
  });
  const newCard = document.createElement('div');
  newCard.className = 'level-card level-card-new';
  newCard.textContent = '+ Nouveau niveau';
  newCard.addEventListener('click', _openNewLevelModal);
  grid.appendChild(newCard);
}

async function _duplicateLevel(lvl) {
  const fam = _state.selectedFamily;
  if (!fam) return;
  const name = (lvl.title || lvl.name) + ' (copie)';
  try {
    const newLvl = await editorService.createLevel(fam.id, fam.uuid, name, lvl.difficulties || [], lvl.notes || '');
    // Copier les champs spécifiques au jeu si updateLevelMeta est disponible
    const extraFields = {};
    const skip = new Set(['docId','id','uuid','game_id','family_id','family_uuid','name','title','difficulties','notes','date','author']);
    Object.keys(lvl).forEach(k => { if (!skip.has(k)) extraFields[k] = lvl[k]; });
    if (Object.keys(extraFields).length) {
      await editorService.updateLevelMeta(newLvl.docId, extraFields);
    }
    _state.levels = await editorService.getLevels(fam.id);
    _renderLevelGrid();
  } catch(err) {
    alert('Erreur lors de la duplication : ' + err.message);
  }
}

async function _moveLevel(lvl, dir) {
  const levels = _state.levels;
  const idx     = levels.findIndex(l => l.docId === lvl.docId);
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= levels.length) return;

  // Si certains niveaux n'ont pas encore de order, initialiser tous les niveaux
  if (levels.some(l => l.order === undefined)) {
    await Promise.all(levels.map((l, i) => editorService.updateLevelMeta(l.docId, { order: i })));
    levels.forEach((l, i) => { l.order = i; });
  }

  const neighbor = levels[swapIdx];
  const tmp = lvl.order;
  await Promise.all([
    editorService.updateLevelMeta(lvl.docId,      { order: neighbor.order }),
    editorService.updateLevelMeta(neighbor.docId, { order: tmp }),
  ]);

  _state.levels = await editorService.getLevels(_state.selectedFamily.id);
  _renderLevelGrid();
}

async function _confirmDeleteFamily(fam) {
  if (!confirm('Supprimer la famille "' + fam.name + '" et tous ses niveaux ?')) return;
  if (_state.selectedFamily?.docId === fam.docId) _state.selectedFamily = null;
  await editorService.deleteFamily(fam.docId);
  await _refreshFamilies();
}

async function _confirmDeleteLevel(lvl) {
  if (!confirm('Supprimer le niveau "' + (lvl.title || lvl.name) + '" ?')) return;
  await editorService.deleteLevel(lvl.docId);
  _state.levels = await editorService.getLevels(_state.selectedFamily.id);
  _renderLevelGrid();
}

// ── New level modal ───────────────────────────────────────────────────────────

function _openNewLevelModal() {
  if (!_state.selectedFamily) { alert('Sélectionnez d\'abord une famille.'); return; }
  document.getElementById('new-level-name').value  = '';
  _populateDiffSelect('new-level-diff', []);
  document.getElementById('new-level-notes').value = '';
  showErr('modal-error', '');
  showModal('new-level-modal');
  document.getElementById('new-level-name').focus();
}

async function _handleCreateLevel(e) {
  e.preventDefault();
  const name   = document.getElementById('new-level-name').value.trim();
  const diffs  = _readDiffSelect('new-level-diff');
  const notes  = document.getElementById('new-level-notes').value.trim();
  if (!name) { showErr('modal-error', 'Le nom est obligatoire.'); return; }
  const btn = document.getElementById('create-level-btn');
  setLoading(btn, true);
  try {
    const fam = _state.selectedFamily;
    await editorService.createLevel(fam.id, fam.uuid, name, diffs, notes);
    hideModal('new-level-modal');
    _state.levels = await editorService.getLevels(fam.id);
    _renderLevelGrid();
  } catch (err) {
    showErr('modal-error', err.message);
  } finally {
    setLoading(btn, false);
  }
}

// ── Level meta panel ──────────────────────────────────────────────────────────

function _openMeta(lvl) {
  _state.level = lvl;

  document.getElementById('meta-title').textContent =
    (_state.selectedFamily?.name || '') + ' / ' + (lvl.title || lvl.name);
  document.getElementById('meta-name').value  = lvl.title || lvl.name || '';
  document.getElementById('meta-notes').value = lvl.notes || '';
  showErr('meta-error', '');

  const famSel = document.getElementById('meta-family');
  famSel.innerHTML = '';
  _state.families.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.docId; opt.textContent = f.name;
    if (f.docId === (_state.selectedFamily?.docId || '')) opt.selected = true;
    famSel.appendChild(opt);
  });

  _populateDiffSelect('meta-diff', lvl.difficulties || []);
  document.getElementById('meta-valid').checked = !!lvl.valid;

  document.getElementById('level-meta-panel').style.display = 'flex';
}

async function _handleSaveMeta() {
  const btn  = document.getElementById('meta-save-btn');
  const name = document.getElementById('meta-name').value.trim();
  if (!name) { showErr('meta-error', 'Le nom est obligatoire.'); return; }
  const famDocId = document.getElementById('meta-family').value;
  const diffs    = _readDiffSelect('meta-diff');
  const notes    = document.getElementById('meta-notes').value;
  const newFam   = _state.families.find(f => f.docId === famDocId);

  setLoading(btn, true);
  try {
    const valid   = document.getElementById('meta-valid').checked;
    const updates = { name, title: name, difficulties: diffs, notes, valid };
    if (newFam && Number(newFam.id) !== Number(_state.level.family_id)) {
      updates.family_id   = Number(newFam.id);
      updates.family_uuid = newFam.uuid;
    }
    await editorService.updateLevelMeta(_state.level.docId, updates);
    Object.assign(_state.level, updates);
    if (newFam) _state.selectedFamily = newFam;
    await _closeMetaPanel();
    if (_state.selectedFamily) {
      _state.levels = await editorService.getLevels(_state.selectedFamily.id);
      _renderFamilyList();
      document.getElementById('family-title').textContent = _state.selectedFamily.name;
      _renderLevelGrid();
    }
  } catch (err) {
    showErr('meta-error', err.message);
  } finally {
    btn.disabled = false;
  }
}

async function _closeMetaPanel() {
  document.getElementById('level-meta-panel').style.display = 'none';
  if (_state.selectedFamily) {
    _state.levels = await editorService.getLevels(_state.selectedFamily.id);
    _renderLevelGrid();
  }
}

function _openEditor() {
  if (!_state.level) return;
  location.href = '../' + _GAME + '/editor.html?level=' + _state.level.docId;
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('logout-btn').addEventListener('click', () =>
  editorService.signOut().catch(console.error)
);

document.getElementById('add-family-btn').addEventListener('click', async () => {
  const name = prompt('Nom de la nouvelle famille :');
  if (!name?.trim()) return;
  const fam = await editorService.createFamily(name.trim());
  _state.selectedFamily = fam;
  await _refreshFamilies();
});

document.getElementById('new-level-form').addEventListener('submit', _handleCreateLevel);
document.getElementById('cancel-modal-btn').addEventListener('click', () => hideModal('new-level-modal'));

document.getElementById('meta-cancel-btn').addEventListener('click', _closeMetaPanel);
document.getElementById('meta-save-btn').addEventListener('click', _handleSaveMeta);
document.getElementById('meta-edit-btn').addEventListener('click', _openEditor);
