// editor.js — CliConVocabulary Level Editor

// ── State ────────────────────────────────────────────────────────────────────

const undoStack = [];
const UNDO_MAX  = 20;

const drag = {
  active:      false,
  started:     false,
  type:        null,    // 'point' | 'arrow'
  wordIdx:     -1,
  arrowIdx:    -1,
  startX:      0,
  startY:      0,
  justDragged: false,   // true from drag-end until next mousedown, suppresses click handlers
};

const state = {
  screen:           'auth',
  gridEnabled:      false,
  gridStep:         2.5,
  selColorOverride: false,
  families:       [],
  selectedFamily: null,
  levels:         [],
  level:          null,
  words:          [],
  selectedWord:   -1,
  editMode:       null,   // 'point' | 'arrow' | null
  selectedArrow:  -1,     // index of selected arrow tip within selectedWord
  isDirty:        false,
};

// ── Screen management ────────────────────────────────────────────────────────

function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.screen').forEach(el =>
    el.classList.toggle('active', el.dataset.screen === name)
  );
}

function showModal(id)  { document.getElementById(id).style.display = 'flex'; }
function hideModal(id)  { document.getElementById(id).style.display = 'none'; }
function esc(str)       { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function showErr(id, m) { const el = document.getElementById(id); if (el) el.textContent = m; }

function setLoading(btn, on) {
  btn.disabled = on;
  if (on)  { btn.dataset.txt = btn.textContent; btn.textContent = '…'; }
  else     { btn.textContent = btn.dataset.txt || btn.textContent; }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

window.onEditorAuthChanged = (user) => {
  if (!user) { showScreen('auth'); return; }
  showReauthScreen();
};

function showReauthScreen() {
  const isGoogle = editorService.getProvider() === 'google.com';
  document.getElementById('reauth-pw-group').style.display    = isGoogle ? 'none'  : 'block';
  document.getElementById('reauth-submit-btn').style.display  = isGoogle ? 'none'  : 'block';
  document.getElementById('reauth-google-hint').style.display = isGoogle ? 'block' : 'none';
  showErr('reauth-error', '');
  showScreen('reauth');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  setLoading(btn, true);
  try {
    await editorService.signIn(
      document.getElementById('login-email').value.trim(),
      document.getElementById('login-pw').value
    );
  } catch (err) { showErr('auth-error', err.message); }
  finally       { setLoading(btn, false); }
}

async function handleGoogleLogin() {
  try   { await editorService.signInWithGoogle(); }
  catch (err) { showErr('auth-error', err.message); }
}

async function handleReauth(e) {
  e.preventDefault();
  const btn = document.getElementById('reauth-submit-btn');
  setLoading(btn, true);
  try {
    await editorService.reauthPassword(document.getElementById('reauth-pw').value);
    await loadBrowser();
  } catch (err) { showErr('reauth-error', err.message); }
  finally       { setLoading(btn, false); }
}

async function handleGoogleReauth() {
  try   { await editorService.reauthGoogle(); await loadBrowser(); }
  catch (err) { showErr('reauth-error', err.message); }
}

async function handleLogout() {
  if (state.isDirty && !confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  await editorService.signOut();
}

// ── Browser ───────────────────────────────────────────────────────────────────

async function loadBrowser() {
  showScreen('browser');
  await editorService.seedVocabularyGame();
  await refreshFamilies();
}

async function refreshFamilies() {
  state.families = await editorService.getFamilies();
  renderFamilyList();
  if (state.families.length === 0) {
    state.selectedFamily = null;
    document.getElementById('family-title').textContent = 'Aucune famille — créez-en une';
    state.levels = [];
    renderLevelGrid();
    return;
  }
  const current = state.selectedFamily
    ? (state.families.find(f => f.docId === state.selectedFamily.docId) || state.families[0])
    : state.families[0];
  await selectFamily(current);
}

function renderFamilyList() {
  const container = document.getElementById('family-list');
  container.innerHTML = '';
  state.families.forEach(fam => {
    const active = state.selectedFamily?.docId === fam.docId;
    const item   = document.createElement('div');
    item.className = `family-item${active ? ' active' : ''}`;
    item.innerHTML = `
      <span class="family-name">${esc(fam.name)}</span>
      <button class="icon-btn danger" title="Supprimer" data-fid="${fam.docId}">✕</button>
    `;
    item.addEventListener('click', e => { if (e.target.dataset.fid) return; selectFamily(fam); });
    item.querySelector('[data-fid]').addEventListener('click', () => confirmDeleteFamily(fam));
    container.appendChild(item);
  });
}

async function selectFamily(fam) {
  state.selectedFamily = fam;
  renderFamilyList();
  document.getElementById('family-title').textContent = fam.name;
  state.levels = await editorService.getLevels(fam.id);
  renderLevelGrid();
}

function renderLevelGrid() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  state.levels.forEach(lvl => {
    const diff = editorService.DIFFICULTIES.find(d => d.id === lvl.difficulty);
    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `
      <div class="level-card-title">${esc(lvl.title || lvl.name)}</div>
      <div class="level-card-diff">${diff ? diff.label : '—'}</div>
      <div class="level-card-actions">
        <button class="btn btn-sm btn-primary">Éditer</button>
        <button class="btn btn-sm btn-danger">✕</button>
      </div>
    `;
    card.querySelectorAll('.btn')[0].addEventListener('click', () => openEditor(lvl));
    card.querySelectorAll('.btn')[1].addEventListener('click', () => confirmDeleteLevel(lvl));
    grid.appendChild(card);
  });
  const newCard = document.createElement('div');
  newCard.className = 'level-card level-card-new';
  newCard.textContent = '+ Nouveau niveau';
  newCard.addEventListener('click', openNewLevelModal);
  grid.appendChild(newCard);
}

async function confirmDeleteFamily(fam) {
  if (!confirm(`Supprimer la famille "${fam.name}" et tous ses niveaux ?`)) return;
  if (state.selectedFamily?.docId === fam.docId) state.selectedFamily = null;
  await editorService.deleteFamily(fam.docId);
  await refreshFamilies();
}

async function confirmDeleteLevel(lvl) {
  if (!confirm(`Supprimer le niveau "${lvl.title || lvl.name}" ?`)) return;
  if (lvl.image_path) await editorService.deleteImage(lvl.docId, lvl.image_path);
  await editorService.deleteLevel(lvl.docId);
  state.levels = await editorService.getLevels(state.selectedFamily.id);
  renderLevelGrid();
}

// ── New level modal ───────────────────────────────────────────────────────────

function openNewLevelModal() {
  if (!state.selectedFamily) { alert('Sélectionnez d\'abord une famille.'); return; }
  document.getElementById('new-level-name').value  = '';
  document.getElementById('new-level-diff').value  = '1';
  document.getElementById('new-level-image').value = '';
  const preview = document.getElementById('new-level-preview');
  if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  preview.style.display = 'none';
  showErr('modal-error', '');
  showModal('new-level-modal');
  document.getElementById('new-level-name').focus();
}

function handleImagePreview(e) {
  const file    = e.target.files[0];
  if (!file) return;
  const preview = document.getElementById('new-level-preview');
  if (preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  preview.src   = URL.createObjectURL(file);
  preview.style.display = 'block';
}

async function handleCreateLevel(e) {
  e.preventDefault();
  const name = document.getElementById('new-level-name').value.trim();
  const diff = parseInt(document.getElementById('new-level-diff').value);
  const file = document.getElementById('new-level-image').files[0];
  if (!name) { showErr('modal-error', 'Le nom est obligatoire.'); return; }
  if (!file) { showErr('modal-error', 'L\'image est obligatoire.'); return; }
  const btn = document.getElementById('create-level-btn');
  setLoading(btn, true);
  try {
    const lvl = await editorService.createLevel(state.selectedFamily.id, state.selectedFamily.uuid, name, diff);
    await editorService.uploadImage(lvl.docId, file);
    hideModal('new-level-modal');
    state.levels = await editorService.getLevels(state.selectedFamily.id);
    const full = state.levels.find(l => l.docId === lvl.docId);
    if (full) openEditor(full); else renderLevelGrid();
  } catch (err) { showErr('modal-error', err.message); }
  finally       { setLoading(btn, false); }
}

// ── Editor ────────────────────────────────────────────────────────────────────

async function openEditor(lvl) {
  state.level         = lvl;
  state.words         = [];
  state.selectedWord  = -1;
  state.editMode      = null;
  state.selectedArrow = -1;
  state.isDirty       = false;
  document.getElementById('image-area').classList.remove('can-place-point', 'can-place-arrow');
  document.getElementById('style-select').value = '';

  document.getElementById('editor-title').textContent                     = `${state.selectedFamily?.name || ''} / ${lvl.title || lvl.name}`;
  document.getElementById('editor-marker-size').value                     = lvl.marker_size          || 16;
  document.getElementById('marker-size-value').textContent                = `${lvl.marker_size || 16} px`;
  document.getElementById('editor-arrow-size').value                      = lvl.arrow_size           || 10;
  document.getElementById('arrow-size-value').textContent                 = `${lvl.arrow_size || 10} px`;
  document.getElementById('editor-marker-opacity').value                  = lvl.marker_opacity       ?? 100;
  document.getElementById('marker-opacity-value').textContent             = `${lvl.marker_opacity ?? 100} %`;
  document.getElementById('editor-selected-fill').value                   = lvl.selected_fill        || '#ffffff';
  document.getElementById('editor-selected-stroke').value                 = lvl.selected_stroke      || '#6c5ce7';
  state.selColorOverride = !!lvl.sel_color_override;
  document.querySelector('.image-controls').classList.toggle('sel-color-active', state.selColorOverride);
  document.getElementById('sel-color-btn').classList.toggle('active', state.selColorOverride);
  document.getElementById('editor-marker-color').value                    = lvl.marker_color        || '#000000';
  document.getElementById('editor-marker-stroke-color').value             = lvl.marker_stroke_color || '#ffffff';
  document.getElementById('editor-marker-stroke-width').value             = lvl.marker_stroke_width || 2;
  document.getElementById('editor-stroke-width-value').textContent        = `${lvl.marker_stroke_width || 2} px`;
  document.getElementById('editor-line-style').value                      = lvl.line_style          || 'solid';
  document.getElementById('editor-arrow-head').value                      = lvl.arrow_head          || 'filled';

  showScreen('editor');
  loadEditorImage(lvl.image_path);
  state.words = await editorService.getWords(lvl.docId);
  renderWordList();
  renderMarkers();
}

function loadEditorImage(url) {
  const img         = document.getElementById('editor-image');
  const placeholder = document.getElementById('image-placeholder');
  if (url) {
    img.src = url;
    img.style.display = 'block';
    placeholder.classList.remove('visible');
  } else {
    img.style.display = 'none';
    placeholder.classList.add('visible');
  }
}

async function handleReplaceImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const btn = document.getElementById('replace-image-btn');
  setLoading(btn, true);
  try {
    const url = await editorService.uploadImage(state.level.docId, file);
    state.level.image_path = url;
    loadEditorImage(url);
  } catch (err) { alert('Erreur upload : ' + err.message); }
  finally       { setLoading(btn, false); }
}

// ── Word list ─────────────────────────────────────────────────────────────────

function renderWordList() {
  const list = document.getElementById('word-list');
  list.innerHTML = '';
  state.words.forEach((w, i) => list.appendChild(buildWordItem(w, i)));
  document.getElementById('word-count').textContent =
    `${state.words.length} mot${state.words.length !== 1 ? 's' : ''}`;
  if (state.selectedWord >= 0) {
    const el = list.querySelectorAll('.word-item')[state.selectedWord];
    el?.scrollIntoView({ block: 'nearest' });
  }
  updatePlacementHint();
}

function buildWordItem(w, i) {
  const isSelected  = i === state.selectedWord;
  const isPointMode = isSelected && state.editMode === 'point';
  const isArrowMode = isSelected && state.editMode === 'arrow';
  const hasPoint    = !!w.point;
  const arrowCount  = (w.arrows || []).length;
  const hasSelArrow = isSelected && state.selectedArrow >= 0;

  const item = document.createElement('div');
  item.className = `word-item${isSelected ? ' selected' : ''}`;

  item.innerHTML = `
    <div class="mode-btns">
      <button class="mode-btn${isPointMode ? ' active' : ''}${hasPoint ? ' has-value' : ''}"
              data-mode="point" title="Placer le point">●</button>
      <button class="mode-btn${isArrowMode ? ' active' : ''}${arrowCount > 0 ? ' has-value' : ''}"
              data-mode="arrow" title="Ajouter une flèche"${!hasPoint ? ' disabled' : ''}>${arrowCount > 0 ? '→+' : '→'}</button>
      ${hasSelArrow ? `<button class="del-arrow-btn icon-btn danger" title="Supprimer cette flèche (Suppr)">✕</button>` : ''}
    </div>
    <div class="word-inputs">
      <input class="wi-fr" type="text" placeholder="Français" value="${esc(w.fr || '')}">
      <input class="wi-en" type="text" placeholder="Anglais"  value="${esc(w.en || '')}">
    </div>
    <div class="word-actions">
      <button class="icon-btn" title="Monter">↑</button>
      <button class="icon-btn" title="Descendre">↓</button>
      <button class="icon-btn danger" title="Supprimer le mot">✕</button>
    </div>
  `;

  // Sélection du mot (clic sur l'item hors boutons)
  item.addEventListener('click', () => {
    state.selectedWord  = i;
    state.editMode      = null;
    state.selectedArrow = -1;
    document.getElementById('image-area').classList.remove('can-place-point', 'can-place-arrow');
    renderWordList(); renderMarkers(); updatePlacementHint();
  });

  // Mode buttons
  item.querySelector('[data-mode="point"]').addEventListener('click', e => {
    e.stopPropagation(); activateMode(i, 'point');
  });
  item.querySelector('[data-mode="arrow"]').addEventListener('click', e => {
    e.stopPropagation(); if (hasPoint) activateMode(i, 'arrow');
  });

  // Delete selected arrow
  item.querySelector('.del-arrow-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    snapshot();
    state.words[i].arrows.splice(state.selectedArrow, 1);
    state.selectedArrow = -1;
    markDirty(); renderWordList(); renderMarkers();
  });

  // Inputs
  item.querySelector('.wi-fr').addEventListener('input', e => { state.words[i].fr = e.target.value; markDirty(); });
  item.querySelector('.wi-en').addEventListener('input', e => { state.words[i].en = e.target.value; markDirty(); });

  // Move / delete
  const [upBtn, downBtn, delBtn] = item.querySelectorAll('.word-actions .icon-btn');
  upBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (i === 0) return;
    snapshot();
    [state.words[i], state.words[i-1]] = [state.words[i-1], state.words[i]];
    if (state.selectedWord === i) state.selectedWord = i - 1;
    else if (state.selectedWord === i-1) state.selectedWord = i;
    markDirty(); renderWordList(); renderMarkers();
  });
  downBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (i >= state.words.length - 1) return;
    snapshot();
    [state.words[i], state.words[i+1]] = [state.words[i+1], state.words[i]];
    if (state.selectedWord === i) state.selectedWord = i + 1;
    else if (state.selectedWord === i+1) state.selectedWord = i;
    markDirty(); renderWordList(); renderMarkers();
  });
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!confirm(`Supprimer "${state.words[i].fr || state.words[i].en || 'ce mot'}" ?`)) return;
    snapshot();
    state.words.splice(i, 1);
    if (state.selectedWord >= state.words.length) {
      state.selectedWord = -1; state.editMode = null; state.selectedArrow = -1;
      document.getElementById('image-area').classList.remove('can-place');
    }
    markDirty(); renderWordList(); renderMarkers();
  });

  return item;
}

function activateMode(wordIdx, mode) {
  const imageArea = document.getElementById('image-area');
  if (state.selectedWord === wordIdx && state.editMode === mode) {
    state.selectedWord = -1; state.editMode = null; state.selectedArrow = -1;
    imageArea.classList.remove('can-place-point', 'can-place-arrow');
  } else {
    state.selectedWord  = wordIdx;
    state.editMode      = mode;
    state.selectedArrow = -1;
    imageArea.classList.remove('can-place-point', 'can-place-arrow');
    imageArea.classList.add(mode === 'point' ? 'can-place-point' : 'can-place-arrow');
  }
  renderWordList(); renderMarkers(); updatePlacementHint();
}

function addWord() {
  snapshot();
  state.words.push({ fr: '', en: '', langs: {}, point: null, arrows: [] });
  markDirty();
  renderWordList();
  const list = document.getElementById('word-list');
  list.scrollTop = list.scrollHeight;
  list.querySelectorAll('.word-item')[state.words.length - 1]?.querySelector('.wi-fr')?.focus();
}

function updatePlacementHint() {
  const hint = document.querySelector('.placement-hint');
  if (state.selectedWord < 0 || !state.editMode) { hint.classList.remove('visible'); return; }
  const w = state.words[state.selectedWord];
  const label = w.en || w.fr || 'ce mot';
  hint.textContent = state.editMode === 'point'
    ? `Cliquez sur l'image pour placer le point de "${label}"`
    : `Cliquez sur l'image pour ajouter une flèche pour "${label}"`;
  hint.classList.add('visible');
}

// ── Markers ───────────────────────────────────────────────────────────────────

function getImageDisplayRect() {
  const img       = document.getElementById('editor-image');
  const container = document.getElementById('image-area');
  if (!img.naturalWidth) return null;
  const cRect = container.getBoundingClientRect();
  const nR    = img.naturalWidth / img.naturalHeight;
  const cR    = cRect.width / cRect.height;
  let dW, dH, oX, oY;
  if (nR > cR) { dW = cRect.width;  dH = cRect.width / nR;   oX = 0;                         oY = (cRect.height - dH) / 2; }
  else         { dH = cRect.height; dW = cRect.height * nR;  oY = 0;                         oX = (cRect.width  - dW) / 2; }
  return { x: oX, y: oY, width: dW, height: dH };
}

function toSvgPos(pct, imgRect) {
  return {
    px: imgRect.x + (pct.x / 100) * imgRect.width,
    py: imgRect.y + (pct.y / 100) * imgRect.height,
  };
}

function renderMarkers() {
  const svg = document.getElementById('markers-svg');
  const img = document.getElementById('editor-image');
  svg.innerHTML = '';
  if (!img || img.style.display === 'none' || !img.naturalWidth) return;
  const imgRect = getImageDisplayRect();
  if (!imgRect) return;

  const W = svg.clientWidth  || svg.getBoundingClientRect().width;
  const H = svg.clientHeight || svg.getBoundingClientRect().height;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const opacity   = (parseInt(document.getElementById('editor-marker-opacity').value) || 100) / 100;
  const selFill   = document.getElementById('editor-selected-fill').value               || '#ffffff';
  const selStroke = document.getElementById('editor-selected-stroke').value             || '#6c5ce7';

  if (state.gridEnabled) {
    for (let p = 0; p <= 100; p += state.gridStep) {
      const gx = imgRect.x + (p / 100) * imgRect.width;
      const gy = imgRect.y + (p / 100) * imgRect.height;
      const vl = mkSvg('line');
      vl.setAttribute('x1', gx); vl.setAttribute('y1', imgRect.y);
      vl.setAttribute('x2', gx); vl.setAttribute('y2', imgRect.y + imgRect.height);
      vl.setAttribute('stroke', 'rgba(108,92,231,0.35)'); vl.setAttribute('stroke-width', '1');
      svg.appendChild(vl);
      const hl = mkSvg('line');
      hl.setAttribute('x1', imgRect.x); hl.setAttribute('y1', gy);
      hl.setAttribute('x2', imgRect.x + imgRect.width); hl.setAttribute('y2', gy);
      hl.setAttribute('stroke', 'rgba(108,92,231,0.35)'); hl.setAttribute('stroke-width', '1');
      svg.appendChild(hl);
    }
  }

  const size   = parseInt(document.getElementById('editor-marker-size').value) || 16;
  const aSize  = parseInt(document.getElementById('editor-arrow-size').value)  || 10;
  const color  = document.getElementById('editor-marker-color').value         || '#000000';
  const sColor  = document.getElementById('editor-marker-stroke-color').value          || '#ffffff';
  const sWidth  = parseInt(document.getElementById('editor-marker-stroke-width').value)|| 2;
  const lStyle  = document.getElementById('editor-line-style').value                   || 'solid';
  const aHead   = document.getElementById('editor-arrow-head').value                   || 'filled';

  state.words.forEach((w, i) => {
    if (!w.point) return;
    const isSel   = i === state.selectedWord;
    const pFill   = isSel ? (state.selColorOverride ? selFill   : lightenColor(color))  : color;
    const pStroke = isSel ? (state.selColorOverride ? selStroke : lightenColor(sColor)) : sColor;

    const wG = mkSvg('g');
    wG.setAttribute('opacity', isSel ? 1 : opacity);

    const { px, py } = toSvgPos(w.point, imgRect);

    // ── Arrows (behind point) ────────────────────────────────────────────────
    (w.arrows || []).forEach((a, ai) => {
      const { px: ax, py: ay } = toSvgPos(a, imgRect);
      const isSelArrow = isSel && ai === state.selectedArrow;
      const aFill   = isSelArrow ? selStroke : pFill;
      const aStroke = isSelArrow ? selFill   : pStroke;

      // Line
      const line = mkSvg('line');
      line.setAttribute('x1', px); line.setAttribute('y1', py);
      line.setAttribute('x2', ax); line.setAttribute('y2', ay);
      line.setAttribute('stroke', pFill);
      line.setAttribute('stroke-width', Math.max(1, sWidth - 1));
      if (lStyle === 'dashed') line.setAttribute('stroke-dasharray', '7,4');
      line.setAttribute('stroke-linecap', 'round');
      wG.appendChild(line);

      // Arrowhead (filled mode only)
      if (aHead === 'filled') {
        const angle = Math.atan2(ay - py, ax - px);
        const hLen  = aSize * 0.8;
        const hAng  = Math.PI / 6;
        const p1x = ax - hLen * Math.cos(angle - hAng);
        const p1y = ay - hLen * Math.sin(angle - hAng);
        const p2x = ax - hLen * Math.cos(angle + hAng);
        const p2y = ay - hLen * Math.sin(angle + hAng);
        const poly = mkSvg('polygon');
        poly.setAttribute('points', `${ax},${ay} ${p1x},${p1y} ${p2x},${p2y}`);
        poly.setAttribute('fill', aFill); poly.setAttribute('stroke', aStroke); poly.setAttribute('stroke-width', '1');
        wG.appendChild(poly);
      }

      // Arrow tip dot (point mode = always visible; filled mode = visible only when selected)
      const tipG = mkSvg('g'); tipG.style.cursor = 'pointer';
      const tipC = mkSvg('circle');
      tipC.setAttribute('cx', ax); tipC.setAttribute('cy', ay);
      if (aHead === 'point' || isSelArrow) {
        tipC.setAttribute('r', isSelArrow ? aSize * 0.45 : aSize * 0.35);
        tipC.setAttribute('fill', aFill); tipC.setAttribute('stroke', aStroke); tipC.setAttribute('stroke-width', sWidth);
      } else {
        tipC.setAttribute('r', aSize * 0.5);
        tipC.setAttribute('fill', 'transparent'); tipC.setAttribute('stroke', 'none');
      }
      tipG.appendChild(tipC);
      tipG.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        drag.active = true; drag.started = false;
        drag.type = 'arrow'; drag.wordIdx = i; drag.arrowIdx = ai;
        drag.startX = e.clientX; drag.startY = e.clientY;
        const toggleOff = state.selectedWord === i && state.selectedArrow === ai;
        state.selectedWord  = i;
        state.editMode      = null;
        state.selectedArrow = toggleOff ? -1 : ai;
        document.getElementById('image-area').classList.remove('can-place-point', 'can-place-arrow');
        renderWordList(); renderMarkers(); updatePlacementHint();
      });
      tipG.addEventListener('click', e => { e.stopPropagation(); });
      wG.appendChild(tipG);
    });

    // ── Point (on top) ───────────────────────────────────────────────────────
    const ptG = mkSvg('g'); ptG.style.cursor = 'pointer';
    const ptC = mkSvg('circle');
    ptC.setAttribute('cx', px); ptC.setAttribute('cy', py);
    ptC.setAttribute('r', size / 2);
    ptC.setAttribute('fill', pFill); ptC.setAttribute('stroke', pStroke); ptC.setAttribute('stroke-width', sWidth);
    ptG.appendChild(ptC);
    if (isSel) ptG.classList.add('marker-selected-pulse');
    ptG.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      drag.active = true; drag.started = false;
      drag.type = 'point'; drag.wordIdx = i; drag.arrowIdx = -1;
      drag.startX = e.clientX; drag.startY = e.clientY;
      state.selectedWord  = i;
      state.editMode      = null;
      state.selectedArrow = -1;
      document.getElementById('image-area').classList.remove('can-place-point', 'can-place-arrow');
      renderWordList(); renderMarkers(); updatePlacementHint();
    });
    ptG.addEventListener('click', e => { e.stopPropagation(); });
    wG.appendChild(ptG);
    svg.appendChild(wG);
  });
}

function mkSvg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

function snapToGrid(pct) {
  if (!state.gridEnabled) return pct;
  return Math.round(pct / state.gridStep) * state.gridStep;
}

function handleImageAreaClick(e) {
  if (drag.justDragged) return;
  const img = document.getElementById('editor-image');
  if (!img || img.style.display === 'none' || !img.naturalWidth) return;
  const imgRect = getImageDisplayRect();
  if (!imgRect) return;

  const cRect = document.getElementById('image-area').getBoundingClientRect();
  const cx    = e.clientX - cRect.left;
  const cy    = e.clientY - cRect.top;

  // Click outside image bounds → deselect
  if (cx < imgRect.x || cx > imgRect.x + imgRect.width ||
      cy < imgRect.y || cy > imgRect.y + imgRect.height) {
    if (state.selectedWord >= 0) deselect();
    return;
  }

  // No active placement tool → click on empty area deselects
  if (state.selectedWord < 0 || !state.editMode) { deselect(); return; }

  const pctX = snapToGrid(Math.round(((cx - imgRect.x) / imgRect.width)  * 1000) / 10);
  const pctY = snapToGrid(Math.round(((cy - imgRect.y) / imgRect.height) * 1000) / 10);
  const w    = state.words[state.selectedWord];

  snapshot();
  if (state.editMode === 'point') {
    w.point = { x: pctX, y: pctY };
  } else if (state.editMode === 'arrow') {
    if (!w.point) { deselect(); return; }
    w.arrows.push({ x: pctX, y: pctY });
  }
  markDirty();
  deselect(); // auto-deactivate tool; deselect handles rendering
}

// ── Global marker controls ────────────────────────────────────────────────────

function onSizeChange(e) {
  document.getElementById('marker-size-value').textContent = `${e.target.value} px`;
  state.level.marker_size = parseInt(e.target.value);
  markDirty(); renderMarkers();
}

function onArrowSizeChange(e) {
  document.getElementById('arrow-size-value').textContent = `${e.target.value} px`;
  state.level.arrow_size = parseInt(e.target.value);
  markDirty(); renderMarkers();
}

function onOpacityChange(e) {
  document.getElementById('marker-opacity-value').textContent = `${e.target.value} %`;
  state.level.marker_opacity = parseInt(e.target.value);
  markDirty(); renderMarkers();
}

function onStrokeWidthChange(e) {
  document.getElementById('editor-stroke-width-value').textContent = `${e.target.value} px`;
  state.level.marker_stroke_width = parseInt(e.target.value);
  markDirty(); renderMarkers();
}

function onAnyControlChange() { markDirty(); renderMarkers(); }

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveLevel() {
  const btn = document.getElementById('save-btn');
  setLoading(btn, true);
  try {
    await editorService.updateLevelMeta(state.level.docId, {
      marker_size:     parseInt(document.getElementById('editor-marker-size').value)       || 16,
      arrow_size:      parseInt(document.getElementById('editor-arrow-size').value)        || 10,
      marker_opacity:  parseInt(document.getElementById('editor-marker-opacity').value)    ?? 100,
      selected_fill:      document.getElementById('editor-selected-fill').value            || '#ffffff',
      selected_stroke:    document.getElementById('editor-selected-stroke').value          || '#6c5ce7',
      sel_color_override: state.selColorOverride,
      marker_color:        document.getElementById('editor-marker-color').value                 || '#000000',
      marker_stroke_color: document.getElementById('editor-marker-stroke-color').value          || '#ffffff',
      marker_stroke_width: parseInt(document.getElementById('editor-marker-stroke-width').value)|| 2,
      line_style:          document.getElementById('editor-line-style').value                   || 'solid',
      arrow_head:          document.getElementById('editor-arrow-head').value                   || 'filled',
    });
    await editorService.saveWords(state.level.docId, state.words);
    state.isDirty = false;
    btn.textContent = '✓ Sauvegardé';
    setTimeout(() => { btn.textContent = 'Sauvegarder'; }, 2000);
  } catch (err) { alert('Erreur lors de la sauvegarde : ' + err.message); }
  finally       { btn.disabled = false; }
}

// ── Back ──────────────────────────────────────────────────────────────────────

async function backToBrowser() {
  if (state.isDirty && !confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
  state.isDirty = false; state.selectedWord = -1; state.editMode = null; state.selectedArrow = -1;
  document.getElementById('image-area').classList.remove('can-place-point', 'can-place-arrow');
  showScreen('browser');
  if (state.selectedFamily) {
    state.levels = await editorService.getLevels(state.selectedFamily.id);
    renderLevelGrid();
  }
}

// ── Import CSV ────────────────────────────────────────────────────────────────

function toggleImportArea() {
  const area = document.getElementById('import-area');
  const opening = !area.classList.contains('visible');
  area.classList.toggle('visible', opening);
  document.getElementById('import-feedback').textContent = '';
  if (opening) { document.getElementById('import-textarea').value = ''; document.getElementById('import-textarea').focus(); }
}

function handleImport() {
  const raw = document.getElementById('import-textarea').value.trim();
  const fb  = document.getElementById('import-feedback');
  fb.className = 'import-feedback';
  if (!raw) { fb.textContent = 'Rien à importer.'; return; }

  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) { fb.textContent = 'Au moins 2 lignes requises (en-tête + données).'; return; }

  const header     = lines[0].split(';').map(h => h.trim().toLowerCase());
  const frHeaders  = ['français', 'french', 'fr', 'francais'];
  let enCol = 0, frCol = 1;
  if (frHeaders.some(h => header[0].startsWith(h))) { frCol = 0; enCol = 1; }

  snapshot();
  let added = 0;
  lines.slice(1).forEach(line => {
    const cols = line.split(';').map(c => c.trim());
    const en = cols[enCol] || ''; const fr = cols[frCol] || '';
    if (!en && !fr) return;
    state.words.push({ fr, en, langs: {}, point: null, arrows: [] });
    added++;
  });

  if (added === 0) { fb.classList.add('error'); fb.textContent = 'Aucun mot valide trouvé.'; return; }
  markDirty(); renderWordList(); renderMarkers();
  fb.textContent = `${added} mot${added > 1 ? 's' : ''} importé${added > 1 ? 's' : ''}.`;
  setTimeout(() => document.getElementById('import-area').classList.remove('visible'), 1200);
}

// ── Clear all markers ─────────────────────────────────────────────────────────

function clearAllMarkers() {
  const count = state.words.filter(w => w.point).length;
  if (count === 0) return;
  if (!confirm(`Supprimer tous les marqueurs (${count} point${count > 1 ? 's' : ''}) ?`)) return;
  snapshot();
  state.words.forEach(w => { w.point = null; w.arrows = []; });
  state.selectedWord = -1; state.editMode = null; state.selectedArrow = -1;
  document.getElementById('image-area').classList.remove('can-place');
  markDirty(); renderWordList(); renderMarkers(); updatePlacementHint();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lightenColor(hex, factor = 0.55) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

function markDirty() { state.isDirty = true; }

function deselect() {
  state.selectedWord = -1; state.editMode = null; state.selectedArrow = -1;
  document.getElementById('image-area').classList.remove('can-place-point', 'can-place-arrow');
  renderWordList(); renderMarkers(); updatePlacementHint();
}

function snapshot() {
  undoStack.push(JSON.stringify(state.words));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
}

function undo() {
  if (undoStack.length === 0) return;
  state.words = JSON.parse(undoStack.pop());
  if (state.selectedWord >= state.words.length) {
    state.selectedWord = -1; state.editMode = null;
    document.getElementById('image-area').classList.remove('can-place');
  }
  state.selectedArrow = -1;
  markDirty(); renderWordList(); renderMarkers(); updatePlacementHint();
}

// ── Styles (localStorage presets) ────────────────────────────────────────────

const STYLES_KEY = 'cv-marker-styles';

function getStyles() {
  try { return JSON.parse(localStorage.getItem(STYLES_KEY)) || []; }
  catch { return []; }
}

function saveStylesLS(styles) {
  localStorage.setItem(STYLES_KEY, JSON.stringify(styles));
}

function currentStyleSettings() {
  return {
    marker_size:         parseInt(document.getElementById('editor-marker-size').value)         || 16,
    arrow_size:          parseInt(document.getElementById('editor-arrow-size').value)          || 10,
    marker_opacity:      parseInt(document.getElementById('editor-marker-opacity').value)      || 100,
    marker_color:        document.getElementById('editor-marker-color').value                  || '#000000',
    marker_stroke_color: document.getElementById('editor-marker-stroke-color').value           || '#ffffff',
    marker_stroke_width: parseInt(document.getElementById('editor-marker-stroke-width').value) || 2,
    line_style:          document.getElementById('editor-line-style').value                    || 'solid',
    arrow_head:          document.getElementById('editor-arrow-head').value                    || 'point',
  };
}

function renderStyleSelect() {
  const sel = document.getElementById('style-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— rappeler —</option>';
  getStyles().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name; opt.textContent = s.name;
    if (s.name === prev) opt.selected = true;
    sel.appendChild(opt);
  });
}

function applyStyle(style) {
  document.getElementById('editor-marker-size').value              = style.marker_size;
  document.getElementById('marker-size-value').textContent         = `${style.marker_size} px`;
  document.getElementById('editor-arrow-size').value               = style.arrow_size;
  document.getElementById('arrow-size-value').textContent          = `${style.arrow_size} px`;
  document.getElementById('editor-marker-opacity').value           = style.marker_opacity;
  document.getElementById('marker-opacity-value').textContent      = `${style.marker_opacity} %`;
  document.getElementById('editor-marker-color').value             = style.marker_color;
  document.getElementById('editor-marker-stroke-color').value      = style.marker_stroke_color;
  document.getElementById('editor-marker-stroke-width').value      = style.marker_stroke_width;
  document.getElementById('editor-stroke-width-value').textContent = `${style.marker_stroke_width} px`;
  document.getElementById('editor-line-style').value               = style.line_style;
  document.getElementById('editor-arrow-head').value               = style.arrow_head;
  Object.assign(state.level, style);
  markDirty(); renderMarkers();
}

function handleSaveStyle() {
  const name = prompt('Nom du style :');
  if (!name?.trim()) return;
  const styles = getStyles().filter(s => s.name !== name.trim());
  styles.push({ name: name.trim(), ...currentStyleSettings() });
  saveStylesLS(styles);
  renderStyleSelect();
  document.getElementById('style-select').value = name.trim();
}

function handleDeleteStyle() {
  const sel = document.getElementById('style-select');
  if (!sel.value) return;
  if (!confirm(`Supprimer le style "${sel.value}" ?`)) return;
  saveStylesLS(getStyles().filter(s => s.name !== sel.value));
  renderStyleSelect();
}

function handleStyleSelect(e) {
  const style = getStyles().find(s => s.name === e.target.value);
  if (style) applyStyle(style);
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Auth
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);

  // Reauth
  document.getElementById('reauth-form').addEventListener('submit', handleReauth);
  document.getElementById('google-reauth-btn').addEventListener('click', handleGoogleReauth);

  // Browser
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('add-family-btn').addEventListener('click', async () => {
    const name = prompt('Nom de la nouvelle famille :');
    if (!name?.trim()) return;
    const fam = await editorService.createFamily(name.trim());
    state.selectedFamily = fam;
    await refreshFamilies();
  });

  // New level modal
  document.getElementById('new-level-image').addEventListener('change', handleImagePreview);
  document.getElementById('new-level-form').addEventListener('submit', handleCreateLevel);
  document.getElementById('cancel-modal-btn').addEventListener('click', () => hideModal('new-level-modal'));
  const diffSel = document.getElementById('new-level-diff');
  editorService.DIFFICULTIES.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = d.label; diffSel.appendChild(opt);
  });

  // Editor
  document.getElementById('back-btn').addEventListener('click', backToBrowser);
  document.getElementById('save-btn').addEventListener('click', saveLevel);
  document.getElementById('add-word-btn').addEventListener('click', addWord);
  document.getElementById('import-btn').addEventListener('click', toggleImportArea);
  document.getElementById('clear-markers-btn').addEventListener('click', clearAllMarkers);
  document.getElementById('import-cancel-btn').addEventListener('click', toggleImportArea);
  document.getElementById('import-confirm-btn').addEventListener('click', handleImport);
  document.getElementById('replace-image-btn').addEventListener('click', () =>
    document.getElementById('replace-image-input').click()
  );
  document.getElementById('replace-image-input').addEventListener('change', handleReplaceImage);

  // Grid
  document.getElementById('grid-btn').addEventListener('click', () => {
    state.gridEnabled = !state.gridEnabled;
    document.getElementById('grid-btn').classList.toggle('active', state.gridEnabled);
    renderMarkers();
  });
  document.getElementById('grid-step-select').addEventListener('change', e => {
    state.gridStep = parseFloat(e.target.value);
    if (state.gridEnabled) renderMarkers();
  });

  // Styles
  renderStyleSelect();
  document.getElementById('style-select').addEventListener('change', handleStyleSelect);
  document.getElementById('save-style-btn').addEventListener('click', handleSaveStyle);
  document.getElementById('delete-style-btn').addEventListener('click', handleDeleteStyle);

  // Marker controls
  document.getElementById('editor-marker-size').addEventListener('input', onSizeChange);
  document.getElementById('editor-arrow-size').addEventListener('input', onArrowSizeChange);
  document.getElementById('editor-marker-opacity').addEventListener('input', onOpacityChange);
  document.getElementById('editor-marker-stroke-width').addEventListener('input', onStrokeWidthChange);

  document.getElementById('sel-color-btn').addEventListener('click', () => {
    state.selColorOverride = !state.selColorOverride;
    document.querySelector('.image-controls').classList.toggle('sel-color-active', state.selColorOverride);
    document.getElementById('sel-color-btn').classList.toggle('active', state.selColorOverride);
    markDirty(); renderMarkers();
  });
  ['editor-marker-color','editor-marker-stroke-color','editor-selected-fill','editor-selected-stroke','editor-line-style','editor-arrow-head']
    .forEach(id => document.getElementById(id).addEventListener('input', onAnyControlChange));

  // Image click
  document.getElementById('image-area').addEventListener('click', handleImageAreaClick);
  document.getElementById('editor-image').addEventListener('load', renderMarkers);
  window.addEventListener('resize', () => { if (state.screen === 'editor') renderMarkers(); });

  // Drag — reset justDragged at the start of every new interaction
  document.addEventListener('mousedown', () => { drag.justDragged = false; });

  // Drag — move marker
  document.addEventListener('mousemove', e => {
    if (!drag.active || state.screen !== 'editor') return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.started) {
      if (Math.hypot(dx, dy) < 4) return;
      snapshot();
      drag.started     = true;
      drag.justDragged = true;
      document.getElementById('markers-svg').style.cursor = 'grabbing';
    }
    const imgRect = getImageDisplayRect();
    if (!imgRect) return;
    const cRect = document.getElementById('image-area').getBoundingClientRect();
    const cx    = Math.max(imgRect.x, Math.min(imgRect.x + imgRect.width,  e.clientX - cRect.left));
    const cy    = Math.max(imgRect.y, Math.min(imgRect.y + imgRect.height, e.clientY - cRect.top));
    const pctX  = snapToGrid(Math.round(((cx - imgRect.x) / imgRect.width)  * 1000) / 10);
    const pctY  = snapToGrid(Math.round(((cy - imgRect.y) / imgRect.height) * 1000) / 10);
    const w     = state.words[drag.wordIdx];
    if (drag.type === 'point') {
      w.point = { x: pctX, y: pctY };
    } else {
      w.arrows[drag.arrowIdx] = { x: pctX, y: pctY };
    }
    renderMarkers();
  });

  // Drag — drop
  document.addEventListener('mouseup', () => {
    if (!drag.active || state.screen !== 'editor') return;
    drag.active = false;
    document.getElementById('markers-svg').style.cursor = '';
    if (drag.started) {
      drag.started = false;
      markDirty(); renderWordList(); renderMarkers(); updatePlacementHint();
    }
  });

  // Keyboard shortcuts (editor only)
  document.addEventListener('keydown', e => {
    if (state.screen !== 'editor') return;
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    // Suppr → supprimer la flèche sélectionnée
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedWord >= 0 && state.selectedArrow >= 0) {
        e.preventDefault();
        snapshot();
        state.words[state.selectedWord].arrows.splice(state.selectedArrow, 1);
        state.selectedArrow = -1;
        markDirty(); renderWordList(); renderMarkers(); updatePlacementHint();
      }
    }

    // Ctrl+Z → annuler
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  });
});
