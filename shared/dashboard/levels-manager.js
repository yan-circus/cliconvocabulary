// shared/dashboard/levels-manager.js — onglet "Gestionnaire de niveaux" du tableau de bord
// Chargé dynamiquement par dashboard.js, uniquement si ?game= est présent.
// Adapté de shared/editor_manager.js : plus de page/auth propre, rendu dans le container fourni.
// Utilise window.editorService (chargé par ensureEditorService, voir dashboard.js).

console.log('%c[levels-manager] chargé — standard/perso/tiers (2026-07-28)', 'color:#6c5ce7');

let _lmGame = null;
const _lmState = {
  families:        [],
  selectedFamily:  null,
  levels:          { standard: [], perso: [], tiers: [] },
  subscribedTiers: new Set(),
  tiersCatalog:    [],
  level:           null,
  difficulties:    [],
  newLevelSource:  'standard',
  isDev:           false,
};

async function renderLevelsManager(container, ctx) {
  _lmGame = ctx.game;
  container.innerHTML = '<p class="tab-placeholder">Chargement…</p>';
  try {
    await ensureEditorService(ctx.game);
    _lmBuildLayout(container);
    _lmWireEvents(container);

    _lmState.difficulties = await editorService.getDifficulties().catch(() => []);
    _lmState.isDev        = await editorService.isDevAccount().catch(() => false);
    _lmPopulateDiffSelect(container, 'lm-new-level-diff', []);

    await _lmRefreshFamilies(container);
  } catch (e) {
    console.error('[levels-manager] init error', e);
    container.innerHTML = '<p class="tab-placeholder">Erreur de chargement.</p>';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _lmEsc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _lmShowErr(container, id, m) { const el = container.querySelector('#' + id); if (el) el.textContent = m; }
function _lmSetLoading(btn, on) {
  btn.disabled = on;
  if (on)  { btn.dataset.txt = btn.textContent; btn.textContent = '…'; }
  else     { btn.textContent = btn.dataset.txt || btn.textContent; }
}
function _lmShowModal(container, id) { container.querySelector('#' + id).style.display = 'flex'; }
function _lmHideModal(container, id) { container.querySelector('#' + id).style.display = 'none'; }

function _lmPopulateDiffSelect(container, selectId, selectedUuids) {
  const sel = container.querySelector('#' + selectId);
  sel.innerHTML = '';
  _lmState.difficulties.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.docId;
    opt.textContent = d.name;
    opt.selected = selectedUuids.includes(d.docId);
    sel.appendChild(opt);
  });
}

function _lmReadDiffSelect(container, selectId) {
  return [...container.querySelector('#' + selectId).selectedOptions].map(o => o.value);
}

// ── Layout ───────────────────────────────────────────────────────────────────

function _lmBuildLayout(container) {
  container.innerHTML = `
    <div class="lm-wrap">
      <div class="lm-toolbar">
        <h2>🗂️ Gestionnaire de niveaux</h2>
      </div>

      <div class="lm-browser-body">
        <aside class="family-sidebar">
          <div class="sidebar-header">
            <span>Familles</span>
            <button id="lm-add-family-btn" class="icon-btn" title="Nouvelle famille">＋</button>
          </div>
          <div id="lm-family-list" class="family-list"></div>
        </aside>

        <section class="level-area">
          <div class="level-area-header">
            <h2 id="lm-family-title">Sélectionnez une famille</h2>
          </div>
          <div id="lm-level-grid"></div>
        </section>
      </div>
    </div>

    <!-- ══ Level meta panel ══════════════════════════════════════════════════ -->
    <div id="lm-level-meta-panel" class="level-meta-overlay" style="display:none">
      <div class="level-meta-card">
        <div class="level-meta-card-header">
          <h2 id="lm-meta-title"></h2>
        </div>
        <div class="level-meta-card-body">
          <div class="form-group">
            <label>Nom du niveau</label>
            <input id="lm-meta-name" type="text" required>
          </div>
          <div class="form-group">
            <label>Famille</label>
            <select id="lm-meta-family"></select>
          </div>
          <div class="form-group">
            <label>Difficultés <small style="font-weight:normal;color:#888">(Ctrl+clic pour plusieurs)</small></label>
            <select id="lm-meta-diff" multiple size="5" style="height:auto"></select>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="lm-meta-notes" rows="4" placeholder="Description, contexte, remarques…"></textarea>
          </div>
          <div class="form-group" style="flex-direction:row;align-items:center;gap:10px">
            <input id="lm-meta-valid" type="checkbox" style="width:18px;height:18px;cursor:pointer">
            <label for="lm-meta-valid" style="margin:0;cursor:pointer">Niveau valide (visible dans index.html)</label>
          </div>
          <div id="lm-meta-private-group" class="form-group" style="flex-direction:row;align-items:center;gap:10px;display:none">
            <input id="lm-meta-private" type="checkbox" style="width:18px;height:18px;cursor:pointer">
            <label for="lm-meta-private" style="margin:0;cursor:pointer">Niveau privé (décoché = visible et rejoignable par les autres comptes, section "Niveaux tiers")</label>
          </div>
          <div id="lm-meta-error" class="error-msg"></div>
          <button id="lm-meta-edit-btn" class="btn btn-primary btn-full" style="margin-top:8px">
            🖊 Éditer le contenu →
          </button>
        </div>
        <div class="level-meta-card-footer">
          <button id="lm-meta-cancel-btn" class="btn btn-secondary">Annuler</button>
          <button id="lm-meta-save-btn" class="btn btn-success">Sauvegarder</button>
        </div>
      </div>
    </div>

    <!-- ══ New level modal ═══════════════════════════════════════════════════ -->
    <div id="lm-new-level-modal" class="modal-overlay" style="display:none">
      <div class="modal">
        <h2>Nouveau niveau</h2>
        <form id="lm-new-level-form">
          <div class="form-group">
            <label>Nom du niveau</label>
            <input id="lm-new-level-name" type="text" placeholder="ex : Addition jusqu'à 10" required>
          </div>
          <div class="form-group">
            <label>Difficultés <small style="font-weight:normal;color:#888">(Ctrl+clic pour plusieurs)</small></label>
            <select id="lm-new-level-diff" multiple size="5" style="height:auto"></select>
          </div>
          <div class="form-group">
            <label>Notes (optionnel)</label>
            <textarea id="lm-new-level-notes" rows="3" placeholder="Description, contexte…"></textarea>
          </div>
          <div id="lm-modal-error" class="error-msg"></div>
          <div class="modal-actions">
            <button id="lm-cancel-modal-btn" type="button" class="btn btn-secondary">Annuler</button>
            <button id="lm-create-level-btn" type="submit" class="btn btn-primary">Créer</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ══ Tiers catalog modal ═══════════════════════════════════════════════ -->
    <div id="lm-tiers-catalog-modal" class="modal-overlay" style="display:none">
      <div class="modal">
        <h2>Niveaux tiers disponibles</h2>
        <div id="lm-tiers-catalog-list" class="lm-section-cards" style="max-height:50vh;overflow-y:auto"></div>
        <div class="modal-actions">
          <button id="lm-tiers-catalog-close-btn" type="button" class="btn btn-secondary">Fermer</button>
        </div>
      </div>
    </div>
  `;
}

function _lmWireEvents(container) {
  container.querySelector('#lm-add-family-btn').addEventListener('click', async () => {
    const name = prompt('Nom de la nouvelle famille :');
    if (!name?.trim()) return;
    const fam = await editorService.createFamily(name.trim());
    _lmState.selectedFamily = fam;
    await _lmRefreshFamilies(container);
  });

  container.querySelector('#lm-new-level-form').addEventListener('submit', e => _lmHandleCreateLevel(container, e));
  container.querySelector('#lm-cancel-modal-btn').addEventListener('click', () => _lmHideModal(container, 'lm-new-level-modal'));

  container.querySelector('#lm-meta-cancel-btn').addEventListener('click', () => _lmCloseMetaPanel(container));
  container.querySelector('#lm-meta-save-btn').addEventListener('click', () => _lmHandleSaveMeta(container));
  container.querySelector('#lm-meta-edit-btn').addEventListener('click', () => _lmOpenEditor());

  container.querySelector('#lm-tiers-catalog-close-btn').addEventListener('click', () => _lmHideModal(container, 'lm-tiers-catalog-modal'));
}

// ── Browser ───────────────────────────────────────────────────────────────────

async function _lmRefreshFamilies(container) {
  _lmState.families = await editorService.getFamilies();
  _lmRenderFamilyList(container);
  if (_lmState.families.length === 0) {
    _lmState.selectedFamily = null;
    container.querySelector('#lm-family-title').textContent = 'Aucune famille — créez-en une';
    _lmState.levels = { standard: [], perso: [], tiers: [] };
    _lmRenderLevelGrid(container);
    return;
  }
  const current = _lmState.selectedFamily
    ? (_lmState.families.find(f => f.docId === _lmState.selectedFamily.docId) || _lmState.families[0])
    : _lmState.families[0];
  await _lmSelectFamily(container, current);
}

function _lmRenderFamilyList(container) {
  const list = container.querySelector('#lm-family-list');
  list.innerHTML = '';
  _lmState.families.forEach(fam => {
    const active = _lmState.selectedFamily?.docId === fam.docId;
    const item   = document.createElement('div');
    item.className = 'family-item' + (active ? ' active' : '');
    item.innerHTML = `
      <span class="family-name">${_lmEsc(fam.name)}</span>
      <button class="icon-btn danger" title="Supprimer" data-fid="${fam.docId}">✕</button>
    `;
    item.addEventListener('click', e => { if (e.target.dataset.fid) return; _lmSelectFamily(container, fam); });
    item.querySelector('[data-fid]').addEventListener('click', () => _lmConfirmDeleteFamily(container, fam));
    list.appendChild(item);
  });
}

async function _lmSelectFamily(container, fam) {
  _lmState.selectedFamily = fam;
  _lmRenderFamilyList(container);
  container.querySelector('#lm-family-title').textContent = fam.name;
  await _lmLoadLevels(container);
}

// Recharge les 3 groupes et redessine. Point d'entrée unique après toute mutation
// (création/suppression/réordonnancement/abonnement) pour ne jamais désynchroniser
// les listes. 'tiers' = niveaux perso d'autres comptes marqués publics (private:false) —
// dérivé de la même collection que 'perso', pas une source stockée séparément.
async function _lmLoadLevels(container) {
  const fam = _lmState.selectedFamily;
  if (!fam) {
    _lmState.levels = { standard: [], perso: [], tiers: [] };
    _lmState.subscribedTiers = new Set();
    _lmState.tiersCatalog = [];
    _lmRenderLevelGrid(container);
    return;
  }
  const [standard, perso, allPerso, subscribedIds] = await Promise.all([
    editorService.getLevels(fam.id, { sources: ['standard'] }),
    editorService.getLevels(fam.id, { sources: ['perso'], ownerUid: _currentUser?.uid }),
    editorService.getPersoLevelsInFamily(fam.id),
    editorService.getSubscribedTiersIds(),
  ]);
  // private === false strictement (pas juste falsy) : un doc sans champ `private` (ancien
  // format) est traité comme privé par défaut plutôt que public — fail-closed.
  const subscribedSet = new Set(subscribedIds);
  const publicOthers  = allPerso.filter(l => l.owner_uid !== _currentUser?.uid && l.private === false);
  // Section "Niveaux tiers" = uniquement ce à quoi on est abonné (comme une étagère de
  // livres empruntés), pas tout le catalogue — sinon ça grossit sans limite dès que
  // d'autres comptes publient. Parcourir/rejoindre du nouveau contenu passe par la
  // modale catalogue (_lmOpenTiersCatalog), pas par cette liste.
  const tiers = publicOthers.filter(l => subscribedSet.has(l.docId));
  _lmState.levels = { standard, perso, tiers };
  _lmState.subscribedTiers = subscribedSet;
  _lmState.tiersCatalog = publicOthers;
  _lmRenderLevelGrid(container);
}

function _lmRenderLevelGrid(container) {
  const grid = container.querySelector('#lm-level-grid');
  grid.innerHTML = '';
  grid.appendChild(_lmBuildLevelSection(container, 'Niveaux standard', _lmState.levels.standard, 'standard'));
  grid.appendChild(_lmBuildLevelSection(container, 'Mes niveaux perso', _lmState.levels.perso, 'perso'));
  grid.appendChild(_lmBuildTiersSection(container, _lmState.levels.tiers));
}

function _lmBuildLevelSection(container, title, levels, source) {
  const section = document.createElement('div');
  section.className = 'lm-level-section';
  section.innerHTML = `<h3 class="lm-level-section-title">${_lmEsc(title)}</h3>`;

  // Niveaux standard = contenu natif du jeu, réservé au(x) compte(s) dev (users/{uid}.is_dev).
  // Un compte non-dev peut toujours les PARCOURIR (section visible) mais aucune action de
  // mutation n'est active — pas juste "Éditer" : dupliquer/supprimer/réordonner/créer
  // laisseraient sinon un contournement trivial de la restriction.
  const locked = source === 'standard' && !_lmState.isDev;

  const inner = document.createElement('div');
  inner.className = 'lm-section-cards';

  levels.forEach((lvl, i) => {
    const diffLabels = (lvl.difficulties || [])
      .map(uid => _lmState.difficulties.find(d => d.docId === uid)?.name)
      .filter(Boolean).join(', ');
    const card = document.createElement('div');
    card.className = 'level-card';
    const isFirst = i === 0;
    const isLast  = i === levels.length - 1;
    card.innerHTML = `
      <div class="level-card-title">${_lmEsc(lvl.title || lvl.name)}</div>
      <div class="level-card-diff">${diffLabels || '—'}</div>
      ${source === 'perso' ? `<div class="level-card-notes">${lvl.private === false ? '🌐 Public (visible par les autres comptes)' : '🔒 Privé'}</div>` : ''}
      ${lvl.notes ? `<div class="level-card-notes">${_lmEsc(lvl.notes)}</div>` : ''}
      ${lvl.valid ? '<div class="level-card-valid">✓ Valide</div>' : ''}
      <div class="level-card-actions">
        <button class="btn btn-sm btn-secondary" title="Monter" data-act="up" ${isFirst || locked ? 'disabled' : ''}>▲</button>
        <button class="btn btn-sm btn-secondary" title="Descendre" data-act="down" ${isLast || locked ? 'disabled' : ''}>▼</button>
        ${!locked ? '<button class="btn btn-sm btn-primary" data-act="edit">Éditer</button>' : ''}
        <button class="btn btn-sm btn-secondary" title="Dupliquer" data-act="dup" ${locked ? 'disabled' : ''}>⧉</button>
        <button class="btn btn-sm btn-danger" data-act="del" ${locked ? 'disabled' : ''}>✕</button>
      </div>
    `;
    card.querySelector('[data-act="up"]').addEventListener('click', () => _lmMoveLevel(container, lvl, 'up'));
    card.querySelector('[data-act="down"]').addEventListener('click', () => _lmMoveLevel(container, lvl, 'down'));
    card.querySelector('[data-act="edit"]')?.addEventListener('click', () => _lmOpenMeta(container, lvl));
    card.querySelector('[data-act="dup"]').addEventListener('click', () => _lmDuplicateLevel(container, lvl));
    card.querySelector('[data-act="del"]').addEventListener('click', () => _lmConfirmDeleteLevel(container, lvl));
    inner.appendChild(card);
  });

  if (!locked) {
    const newCard = document.createElement('div');
    newCard.className = 'level-card level-card-new';
    newCard.textContent = '+ Nouveau niveau';
    newCard.addEventListener('click', () => _lmOpenNewLevelModal(container, source));
    inner.appendChild(newCard);
  }

  section.appendChild(inner);
  return section;
}

// Section tiers : uniquement les niveaux perso d'autres comptes AUXQUELS ON EST ABONNÉ
// (comme une étagère de livres empruntés) — pas tout le catalogue public, qui se
// parcourt à la demande via la modale "+ Ajouter un niveau" (_lmOpenTiersCatalog).
// L'abonnement est un geste actif (on va chercher), pas une liste qui s'allonge toute
// seule à chaque niveau publié par quelqu'un d'autre.
function _lmBuildTiersSection(container, levels) {
  const section = document.createElement('div');
  section.className = 'lm-level-section';
  section.innerHTML = `<h3 class="lm-level-section-title">Niveaux tiers</h3>`;

  const inner = document.createElement('div');
  inner.className = 'lm-section-cards';

  if (!levels.length) {
    inner.innerHTML = '<p class="tab-placeholder" style="padding:8px 0">Aucun abonnement pour l\'instant.</p>';
  }

  levels.forEach(lvl => {
    const diffLabels = (lvl.difficulties || [])
      .map(uid => _lmState.difficulties.find(d => d.docId === uid)?.name)
      .filter(Boolean).join(', ');
    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `
      <div class="level-card-title">${_lmEsc(lvl.title || lvl.name)}</div>
      <div class="level-card-diff">${diffLabels || '—'}</div>
      <div class="level-card-notes">Par ${_lmEsc(lvl.author || '?')}</div>
      ${lvl.notes ? `<div class="level-card-notes">${_lmEsc(lvl.notes)}</div>` : ''}
      <div class="level-card-actions">
        <button class="btn btn-sm btn-secondary" data-act="unsub">Se désabonner</button>
      </div>
    `;
    card.querySelector('[data-act="unsub"]').addEventListener('click', () => _lmUnsubscribe(container, lvl));
    inner.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'level-card level-card-new';
  addCard.textContent = '+ Ajouter un niveau';
  addCard.addEventListener('click', () => _lmOpenTiersCatalog(container));
  inner.appendChild(addCard);

  section.appendChild(inner);
  return section;
}

async function _lmUnsubscribe(container, lvl) {
  try {
    await editorService.unsubscribeTiersLevel(lvl.docId);
    await _lmLoadLevels(container);
  } catch (err) {
    alert('Erreur : ' + err.message);
  }
}

// ── Catalogue tiers (modale "+ Ajouter un niveau") ─────────────────────────────

function _lmOpenTiersCatalog(container) {
  _lmRenderTiersCatalogList(container);
  _lmShowModal(container, 'lm-tiers-catalog-modal');
}

function _lmRenderTiersCatalogList(container) {
  const list = container.querySelector('#lm-tiers-catalog-list');
  const available = _lmState.tiersCatalog.filter(l => !_lmState.subscribedTiers.has(l.docId));
  list.innerHTML = '';
  if (!available.length) {
    list.innerHTML = '<p class="tab-placeholder">Aucun niveau disponible dans cette famille pour l\'instant.</p>';
    return;
  }
  available.forEach(lvl => {
    const diffLabels = (lvl.difficulties || [])
      .map(uid => _lmState.difficulties.find(d => d.docId === uid)?.name)
      .filter(Boolean).join(', ');
    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `
      <div class="level-card-title">${_lmEsc(lvl.title || lvl.name)}</div>
      <div class="level-card-diff">${diffLabels || '—'}</div>
      <div class="level-card-notes">Par ${_lmEsc(lvl.author || '?')}</div>
      ${lvl.notes ? `<div class="level-card-notes">${_lmEsc(lvl.notes)}</div>` : ''}
      <div class="level-card-actions">
        <button class="btn btn-sm btn-primary" data-act="sub">S'abonner</button>
      </div>
    `;
    card.querySelector('[data-act="sub"]').addEventListener('click', async () => {
      try {
        await editorService.subscribeTiersLevel(lvl.docId);
        await _lmLoadLevels(container);
        _lmRenderTiersCatalogList(container);
      } catch (err) {
        alert('Erreur : ' + err.message);
      }
    });
    list.appendChild(card);
  });
}

async function _lmDuplicateLevel(container, lvl) {
  const fam = _lmState.selectedFamily;
  if (!fam) return;
  const name = (lvl.title || lvl.name) + ' (copie)';
  try {
    // source/owner_uid ne sont pas dans `skip` : createLevel pose les défauts
    // ('standard'/null), puis updateLevelMeta les écrase avec ceux de `lvl` juste après
    // — la copie garde donc le même groupe (standard/perso) que l'original.
    const newLvl = await editorService.createLevel(fam.id, fam.uuid, name, lvl.difficulties || [], lvl.notes || '');
    const extraFields = {};
    const skip = new Set(['docId','id','uuid','game_id','family_id','family_uuid','name','title','difficulties','notes','date','author']);
    Object.keys(lvl).forEach(k => { if (!skip.has(k)) extraFields[k] = lvl[k]; });
    if (Object.keys(extraFields).length) {
      await editorService.updateLevelMeta(newLvl.docId, extraFields);
    }
    await _lmLoadLevels(container);
  } catch (err) {
    alert('Erreur lors de la duplication : ' + err.message);
  }
}

async function _lmMoveLevel(container, lvl, dir) {
  const levels  = lvl.source === 'perso' ? _lmState.levels.perso : _lmState.levels.standard;
  const idx     = levels.findIndex(l => l.docId === lvl.docId);
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= levels.length) return;

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

  await _lmLoadLevels(container);
}

async function _lmConfirmDeleteFamily(container, fam) {
  if (!confirm('Supprimer la famille "' + fam.name + '" et tous ses niveaux ?')) return;
  if (_lmState.selectedFamily?.docId === fam.docId) _lmState.selectedFamily = null;
  await editorService.deleteFamily(fam.docId);
  await _lmRefreshFamilies(container);
}

async function _lmConfirmDeleteLevel(container, lvl) {
  if (!confirm('Supprimer le niveau "' + (lvl.title || lvl.name) + '" ?')) return;
  await editorService.deleteLevel(lvl.docId);
  await _lmLoadLevels(container);
}

// ── New level modal ────────────────────────────────────────────────────────────

function _lmOpenNewLevelModal(container, source = 'standard') {
  if (!_lmState.selectedFamily) { alert('Sélectionnez d\'abord une famille.'); return; }
  _lmState.newLevelSource = source;
  container.querySelector('#lm-new-level-modal h2').textContent =
    source === 'perso' ? 'Nouveau niveau perso' : 'Nouveau niveau standard';
  container.querySelector('#lm-new-level-name').value  = '';
  _lmPopulateDiffSelect(container, 'lm-new-level-diff', []);
  container.querySelector('#lm-new-level-notes').value = '';
  _lmShowErr(container, 'lm-modal-error', '');
  _lmShowModal(container, 'lm-new-level-modal');
  container.querySelector('#lm-new-level-name').focus();
}

async function _lmHandleCreateLevel(container, e) {
  e.preventDefault();
  const name  = container.querySelector('#lm-new-level-name').value.trim();
  const diffs = _lmReadDiffSelect(container, 'lm-new-level-diff');
  const notes = container.querySelector('#lm-new-level-notes').value.trim();
  if (!name) { _lmShowErr(container, 'lm-modal-error', 'Le nom est obligatoire.'); return; }
  const source = _lmState.newLevelSource;
  if (source === 'perso' && !_currentUser?.uid) {
    _lmShowErr(container, 'lm-modal-error', 'Non connecté — impossible de créer un niveau perso.');
    return;
  }
  const btn = container.querySelector('#lm-create-level-btn');
  _lmSetLoading(btn, true);
  try {
    const fam = _lmState.selectedFamily;
    // Un niveau perso est privé par défaut à la création (isPrivate=true) — il faudra
    // décocher "Niveau privé" dans le panneau meta pour le partager (section tiers
    // des autres comptes).
    await editorService.createLevel(fam.id, fam.uuid, name, diffs, notes, source, source === 'perso' ? _currentUser.uid : null, true);
    _lmHideModal(container, 'lm-new-level-modal');
    await _lmLoadLevels(container);
  } catch (err) {
    _lmShowErr(container, 'lm-modal-error', err.message);
  } finally {
    _lmSetLoading(btn, false);
  }
}

// ── Level meta panel ───────────────────────────────────────────────────────────

function _lmOpenMeta(container, lvl) {
  _lmState.level = lvl;

  container.querySelector('#lm-meta-title').textContent =
    (_lmState.selectedFamily?.name || '') + ' / ' + (lvl.title || lvl.name);
  container.querySelector('#lm-meta-name').value  = lvl.title || lvl.name || '';
  container.querySelector('#lm-meta-notes').value = lvl.notes || '';
  _lmShowErr(container, 'lm-meta-error', '');

  const famSel = container.querySelector('#lm-meta-family');
  famSel.innerHTML = '';
  _lmState.families.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.docId; opt.textContent = f.name;
    if (f.docId === (_lmState.selectedFamily?.docId || '')) opt.selected = true;
    famSel.appendChild(opt);
  });

  _lmPopulateDiffSelect(container, 'lm-meta-diff', lvl.difficulties || []);
  container.querySelector('#lm-meta-valid').checked = !!lvl.valid;

  // Le toggle privé/public n'a de sens que pour un niveau perso qu'on possède —
  // jamais affiché pour standard, ni pour le niveau perso de quelqu'un d'autre
  // (on n'arrive de toute façon jamais ici pour un niveau tiers, voir _lmBuildTiersSection).
  const showPrivate = lvl.source === 'perso' && lvl.owner_uid === _currentUser?.uid;
  container.querySelector('#lm-meta-private-group').style.display = showPrivate ? 'flex' : 'none';
  container.querySelector('#lm-meta-private').checked = lvl.private !== false; // fail-closed par défaut

  _lmShowModal(container, 'lm-level-meta-panel');
}

async function _lmHandleSaveMeta(container) {
  const btn  = container.querySelector('#lm-meta-save-btn');
  const name = container.querySelector('#lm-meta-name').value.trim();
  if (!name) { _lmShowErr(container, 'lm-meta-error', 'Le nom est obligatoire.'); return; }
  const famDocId = container.querySelector('#lm-meta-family').value;
  const diffs    = _lmReadDiffSelect(container, 'lm-meta-diff');
  const notes    = container.querySelector('#lm-meta-notes').value;
  const newFam   = _lmState.families.find(f => f.docId === famDocId);

  btn.disabled = true;
  try {
    const valid   = container.querySelector('#lm-meta-valid').checked;
    const updates = { name, title: name, difficulties: diffs, notes, valid };
    if (_lmState.level.source === 'perso' && _lmState.level.owner_uid === _currentUser?.uid) {
      updates.private = container.querySelector('#lm-meta-private').checked;
    }
    if (newFam && Number(newFam.id) !== Number(_lmState.level.family_id)) {
      updates.family_id   = Number(newFam.id);
      updates.family_uuid = newFam.uuid;
    }
    await editorService.updateLevelMeta(_lmState.level.docId, updates);
    Object.assign(_lmState.level, updates);
    if (newFam) _lmState.selectedFamily = newFam;
    await _lmCloseMetaPanel(container);
    if (_lmState.selectedFamily) {
      _lmRenderFamilyList(container);
      container.querySelector('#lm-family-title').textContent = _lmState.selectedFamily.name;
      await _lmLoadLevels(container);
    }
  } catch (err) {
    _lmShowErr(container, 'lm-meta-error', err.message);
  } finally {
    btn.disabled = false;
  }
}

async function _lmCloseMetaPanel(container) {
  _lmHideModal(container, 'lm-level-meta-panel');
  if (_lmState.selectedFamily) await _lmLoadLevels(container);
}

function _lmOpenEditor() {
  if (!_lmState.level) return;
  location.href = '../' + _lmGame + '/editor.html?level=' + _lmState.level.docId;
}
