// shared/index.js — generic index page for all LudoEdu games
// Requires: game-config.js (GAME_CONFIG), firebase-core.js,
//           platform-methods.js, firebase-service.js (GAME_ID, gameService)

const VERSION = 'v1.0.0';
console.log(`%c${GAME_CONFIG.name} [index] ${VERSION}`, 'color:#6c5ce7;font-weight:bold;font-size:14px');

const _pfx  = GAME_CONFIG.game_id + '-';
const _ui   = GAME_CONFIG.ui;
const MODES = GAME_CONFIG.modes;

// ── SVG constants ─────────────────────────────────────────────────────────────

const _SVG_SCORE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
const _SVG_AUDIO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const _SVG_FS_EXP  = `<svg id="fs-expand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const _SVG_FS_COMP = `<svg id="fs-compress" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`;
const _SVG_GOOGLE  = `<svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2a10.34 10.34 0 00-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.94v2.34A9 9 0 009 18z" fill="#34A853"/><path d="M3.98 10.72A5.4 5.4 0 013.7 9a5.4 5.4 0 01.28-1.72V4.94H.94A9 9 0 000 9c0 1.45.35 2.82.94 4.06l3.04-2.34z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 00.94 4.94l3.04 2.34C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>`;

// ── Style injection ───────────────────────────────────────────────────────────

(function () {
  const s = document.createElement('style');
  s.textContent = `
.mode-label-single{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.18);border-radius:20px;color:#fff;font-size:13px;font-weight:700;padding:0 12px;height:32px}
.difficulty-bar{display:flex;align-items:center;gap:6px;padding:4px 14px 8px;overflow-x:auto;scrollbar-width:none}
.difficulty-bar::-webkit-scrollbar{display:none}
.diff-chip{padding:4px 12px;border-radius:20px;border:none;background:rgba(255,255,255,.2);color:rgba(255,255,255,.8);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.diff-chip:hover{background:rgba(255,255,255,.35);color:#fff}
.diff-chip.active{background:#fff;color:#333}
.level-grid.list-mode{grid-template-columns:1fr;gap:6px}
.level-list-item{background:rgba(255,255,255,.92);border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;position:relative;border:2px solid transparent;transition:all .15s;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.level-list-item:hover{transform:translateX(3px);box-shadow:0 4px 14px rgba(0,0,0,.18)}
.level-list-item.selected{border-color:#fff;background:#b8b7bc;box-shadow:0 4px 16px rgba(0,0,0,.25),0 0 0 3px rgba(255,255,255,.3)}
.level-list-item.level-locked{filter:grayscale(40%) brightness(.7);cursor:default}
.level-list-body{flex:1;min-width:0}
.level-list-name{font-size:14px;font-weight:700;color:#2d1b00;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.level-list-notes{font-size:12px;color:#636e72;margin-top:2px}
.level-list-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
.level-list-diff{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(108,92,231,.12);color:#6c5ce7}
.level-list-play{width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:14px;padding-left:2px;box-shadow:0 2px 8px rgba(108,92,231,.4);flex-shrink:0}
`;
  document.head.appendChild(s);
})();

// ── Build DOM ─────────────────────────────────────────────────────────────────

(function () {
  document.getElementById('app').innerHTML = _buildAppHTML();
})();

function _buildAppHTML() {
  const multiMode = MODES.length > 1;
  const first     = MODES[0];

  const modeMenuHtml = multiMode ? `
    <div id="mode-menu" class="mode-menu">
      <button id="mode-menu-btn" class="mode-menu-btn">
        <span id="mode-menu-icon">${first.icon}</span>
        <span id="mode-menu-label">${first.label}</span>
        <span class="mode-menu-arrow">▾</span>
      </button>
      <div id="mode-dropdown" class="mode-dropdown hidden">
        ${MODES.map(m => `<button class="mode-entry${m.audio_required ? ' mode-entry-audio' : ''}" data-mode="${m.slug}"><span>${m.icon}</span>${esc(m.label)}</button>`).join('')}
      </div>
    </div>` : `<div class="mode-label-single"><span>${first.icon}</span><span>${esc(first.label)}</span></div>`;

  const chronoHtml = _ui.chrono ? `<button id="chrono-toggle" class="chrono-header-btn" title="Chrono">⏱</button>` : '';
  const audioHtml  = _ui.audio  ? `<button id="audio-toggle"  class="chrono-header-btn" title="Audio">${_SVG_AUDIO}</button>` : '';

  const diffBarHtml = _ui.difficulty ? `
    <div id="difficulty-bar" class="difficulty-bar">
      <button class="diff-chip active" data-diff="0">Tous</button>
      ${GAME_CONFIG.difficulties.map(d => `<button class="diff-chip" data-diff="${d.id}">${esc(d.label)}</button>`).join('')}
    </div>` : '';

  const accessLink = _ui.access_control
    ? `<a id="access-btn" href="access.html" class="supervisor-option">🔓 Niveaux autorisés</a>` : '';

  const helpSectionsHtml = (GAME_CONFIG.help_sections || []).map(s => `
    <div class="help-section">
      <div class="help-mode-title">${esc(s.title)}</div>
      <p>${esc(s.text)}</p>
    </div>`).join('');

  return `
<div class="index-layout">
  <header class="index-header">
    <div class="header-row">
      <div class="header-left">
        ${modeMenuHtml}
        ${chronoHtml}
        ${audioHtml}
      </div>
      <div class="header-right">
        <button id="help-btn"  class="icon-btn" title="Aide">?</button>
        <button id="score-btn" class="icon-btn" title="Scores">${_SVG_SCORE}</button>
        <div id="user-area">
          <button id="auth-btn" title="Mon compte">
            <img id="auth-avatar" class="user-avatar hidden" src="" alt="Avatar">
            <span id="auth-icon">👤</span>
            <span id="user-display">Me connecter</span>
          </button>
          <div id="user-dropdown" class="hidden"></div>
        </div>
        <button id="close-btn" class="icon-btn" title="Fermer">✕</button>
      </div>
    </div>
    ${diffBarHtml}
    <div id="family-tabs-scroll" class="family-tabs-scroll"></div>
  </header>

  <div class="level-content">
    <div id="level-grid" class="level-grid${_ui.level_display === 'list' ? ' list-mode' : ''}">
      <div class="loading-msg">Chargement…</div>
    </div>
  </div>

  <footer class="index-footer">
    <p class="footer-empty" id="footer-empty">Sélectionnez un niveau pour commencer</p>
    <div class="footer-info hidden" id="footer-info">
      <div class="footer-lvl-name" id="footer-name"></div>
      <div class="footer-lvl-sub"  id="footer-sub"></div>
    </div>
  </footer>
</div>

<!-- Score panel -->
<div id="score-overlay" class="panel-overlay hidden">
  <div class="center-panel score-panel">
    <div class="center-panel-header">
      <h3>Scores</h3>
      <button id="score-close-btn" class="icon-btn">✕</button>
    </div>
    <div class="score-tabs">
      <button class="score-tab active" data-tab="mine">Mes scores</button>
      <button class="score-tab" data-tab="ranking">Classement</button>
    </div>
    <div id="score-content" class="score-content"><div class="loading-msg">Chargement…</div></div>
  </div>
</div>

<!-- Help panel -->
<div id="help-overlay" class="panel-overlay hidden">
  <div class="center-panel help-panel">
    <div class="center-panel-header">
      <h3>Aide — ${esc(GAME_CONFIG.name)}</h3>
      <button id="help-close-btn" class="icon-btn">✕</button>
    </div>
    <div class="help-body">${helpSectionsHtml}</div>
    <div class="help-version" id="help-version"></div>
  </div>
</div>

<!-- Auth modal -->
<div id="auth-overlay" class="panel-overlay hidden">
  <div class="center-panel center-panel-sm">
    <div class="modal-body">
      <div class="modal-header">
        <h3>Mon compte</h3>
        <button id="auth-close" class="icon-btn">✕</button>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Connexion</button>
        <button class="auth-tab" data-tab="register">Créer un compte</button>
      </div>
      <form id="auth-login" class="auth-form">
        <div class="form-group"><label>Email</label><input id="login-email" type="email" autocomplete="email" required></div>
        <div class="form-group"><label>Mot de passe</label><input id="login-password" type="password" autocomplete="current-password" required></div>
        <button id="forgot-btn" type="button" class="auth-forgot">Mot de passe oublié ?</button>
        <button id="login-btn" type="submit" class="btn btn-primary btn-full">Connexion</button>
        <div id="login-error" class="error-msg"></div>
      </form>
      <form id="auth-register" class="auth-form hidden">
        <div class="form-group"><label>Prénom</label><input id="reg-firstname" type="text" autocomplete="given-name" required></div>
        <div class="form-group"><label>Nom (optionnel)</label><input id="reg-lastname" type="text" autocomplete="family-name"></div>
        <div class="form-group"><label>Email</label><input id="reg-email" type="email" autocomplete="email" required></div>
        <div class="form-group"><label>Mot de passe</label><input id="reg-password" type="password" autocomplete="new-password" required minlength="6"></div>
        <p class="avatar-label">Avatar</p>
        <div id="reg-avatar-picker" class="avatar-picker"></div>
        <button id="register-btn" type="submit" class="btn btn-primary btn-full">Créer le compte</button>
        <div id="register-error" class="error-msg"></div>
      </form>
      <div class="divider">ou</div>
      <button id="google-btn" class="btn btn-google btn-full">${_SVG_GOOGLE} Continuer avec Google</button>
      <button id="play-anon" type="button" class="auth-anon btn-full">Jouer sans compte</button>
    </div>
  </div>
</div>

<!-- Supervisor modal -->
<div id="supervisor-overlay" class="panel-overlay hidden">
  <div class="center-panel center-panel-xs">
    <div class="modal-body">
      <div class="modal-header">
        <h3>Options superviseur</h3>
        <button id="supervisor-close" class="icon-btn">✕</button>
      </div>
      <div id="supervisor-auth">
        <p class="supervisor-hint">Entrez votre mot de passe pour confirmer votre identité.</p>
        <form id="supervisor-reauth-form" class="auth-form">
          <div class="form-group"><label>Mot de passe</label><input id="supervisor-password" type="password" autocomplete="current-password"></div>
          <button id="supervisor-reauth-btn" type="submit" class="btn btn-primary btn-full">Confirmer</button>
          <button id="supervisor-google-btn" type="button" class="btn btn-google btn-full" style="display:none">${_SVG_GOOGLE} Confirmer avec Google</button>
          <div id="supervisor-auth-error" class="error-msg"></div>
        </form>
      </div>
      <div id="supervisor-options" style="display:none;flex-direction:column;gap:8px;color:#c1c9cb">
        <button id="add-profile-btn" class="supervisor-option">➕ Ajouter un joueur</button>
        ${accessLink}
        <a href="../shared/editor_manager.html?game=${GAME_CONFIG.game_id}" class="supervisor-option">🖊 Éditeur de niveaux</a>
        <button id="settings-btn" class="supervisor-option">⚙️ Réglages</button>
        <button id="logout-btn" class="supervisor-option supervisor-option-danger">⬅ Se déconnecter</button>
      </div>
    </div>
  </div>
</div>

<!-- Settings panel -->
<div id="settings-overlay" class="panel-overlay hidden">
  <div class="center-panel center-panel-sm">
    <div class="modal-body">
      <div class="modal-header">
        <h3>⚙️ Réglages</h3>
        <button id="settings-close" class="icon-btn">✕</button>
      </div>
      <div class="settings-list">
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-label">Afficher le classement</div>
            <div class="settings-row-desc">Les joueurs peuvent voir les scores de tous les utilisateurs dans le panneau Scores.</div>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="setting-show-ranking">
            <span class="settings-toggle-slider"></span>
          </label>
        </div>
      </div>
      <button id="settings-save-btn" class="btn btn-primary btn-full">Enregistrer</button>
      <div id="settings-error" class="error-msg"></div>
    </div>
  </div>
</div>

<!-- Add profile modal -->
<div id="add-profile-overlay" class="panel-overlay hidden">
  <div class="center-panel center-panel-sm">
    <div class="modal-body">
      <div class="modal-header">
        <h3>Nouveau joueur</h3>
        <button id="add-profile-close" class="icon-btn">✕</button>
      </div>
      <form id="add-profile-form" class="auth-form">
        <div class="form-group"><label>Prénom</label><input id="add-profile-prenom" type="text" autocomplete="off" required></div>
        <div class="form-group"><label>Nom (optionnel)</label><input id="add-profile-nom" type="text" autocomplete="off"></div>
        <p class="avatar-label">Avatar</p>
        <div id="add-profile-avatar-picker" class="avatar-picker"></div>
        <button id="add-profile-submit" type="submit" class="btn btn-primary btn-full">Créer le joueur</button>
        <div id="add-profile-error" class="error-msg"></div>
      </form>
    </div>
  </div>
</div>

<!-- Profile settings modal -->
<div id="profile-overlay" class="panel-overlay hidden">
  <div class="center-panel center-panel-sm">
    <div class="modal-body">
      <div class="modal-header">
        <h3 id="profile-panel-title">Avatar</h3>
        <button id="profile-close" class="icon-btn">✕</button>
      </div>
      <div id="profile-avatar-picker" class="avatar-picker avatar-picker-4col"></div>
      <button id="profile-save" class="btn btn-primary btn-full" style="margin-top:8px">Enregistrer</button>
    </div>
  </div>
</div>

<button id="fullscreen-btn" class="fullscreen-btn" title="Plein écran">${_SVG_FS_EXP}${_SVG_FS_COMP}</button>
`;
}

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  families:               [],
  selectedFamily:         null,
  levels:                 [],
  selectedLevel:          null,
  selectedLevelItemCount: null,
  progress:               { best_scores: {} },
};

let chronoEnabled = localStorage.getItem(_pfx + 'chrono') === '1';
let audioEnabled  = !_ui.audio ? false : localStorage.getItem(_pfx + 'audio') !== '0';

// ── Score modes (derived from GAME_CONFIG) ────────────────────────────────────

const SCORE_MODES = MODES.filter(m => m.score_tracking)
  .map(m => ({ slug: m.slug, label: m.icon + ' ' + m.label, typeId: m.id }));

// ── Auth & Profiles ───────────────────────────────────────────────────────────

let currentProfileId   = localStorage.getItem(_pfx + 'profile-id') || null;
let currentProfileData = null;
let cachedProfiles     = null;
let profileAvatarId    = 1;

function avatarPath(id) {
  return `assets/avatars/avatar${String(id).padStart(2, '0')}.png`;
}

function buildAvatarGrid(container, selectedId, onSelect) {
  container.innerHTML = '';
  for (let i = 1; i <= 24; i++) {
    const div = document.createElement('div');
    div.className = 'avatar-option' + (i === selectedId ? ' selected' : '');
    const img = document.createElement('img');
    img.src = avatarPath(i);
    img.alt = `Avatar ${i}`;
    div.appendChild(img);
    div.addEventListener('click', () => {
      container.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      onSelect(i);
    });
    container.appendChild(div);
  }
}

function showUserAvatar(avatarId) {
  const avatarImg = document.getElementById('auth-avatar');
  const authIcon  = document.getElementById('auth-icon');
  if (avatarId) {
    avatarImg.src = avatarPath(avatarId);
    avatarImg.classList.remove('hidden');
    authIcon.classList.add('hidden');
  } else {
    avatarImg.classList.add('hidden');
    authIcon.classList.remove('hidden');
  }
}

function selectProfile(profileId, profileData) {
  currentProfileId   = profileId;
  currentProfileData = profileData;
  if (profileId) localStorage.setItem(_pfx + 'profile-id', profileId);
  else           localStorage.removeItem(_pfx + 'profile-id');
  const display = document.getElementById('user-display');
  if (display) display.textContent = profileData?.prenom || 'Joueur';
  showUserAvatar(profileData?.avatar_id || null);
  loadProgress();
}

async function loadProgress() {
  state.progress = await gameService.getProgress(currentProfileId);
  if (state.selectedFamily) renderLevelGrid();
}

async function refreshProfilesCache() {
  cachedProfiles = await gameService.getProfiles();
  return cachedProfiles;
}

async function renderProfilesDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  dropdown.innerHTML = '';
  const profiles = cachedProfiles ?? await refreshProfilesCache();
  const others   = [...profiles]
    .filter(p => p.id !== currentProfileId)
    .sort((a, b) => (b.is_supervisor ? 1 : 0) - (a.is_supervisor ? 1 : 0));

  others.forEach(profile => {
    const row = document.createElement('div');
    row.className = 'profile-row';
    row.innerHTML = `
      <div class="profile-avatar-wrap">
        <img src="${avatarPath(profile.avatar_id || 1)}" alt="${esc(profile.prenom)}">
        ${profile.is_supervisor ? '<span class="crown-badge">👑</span>' : ''}
      </div>
      <span class="profile-row-name">${esc(profile.prenom)}</span>`;
    row.addEventListener('click', () => {
      selectProfile(profile.id, profile);
      profileAvatarId = profile.avatar_id || 1;
      document.getElementById('user-dropdown').classList.add('hidden');
    });
    dropdown.appendChild(row);
  });

  if (others.length) {
    const sep = document.createElement('div');
    sep.className = 'dropdown-separator';
    dropdown.appendChild(sep);
  }

  const editRow = document.createElement('div');
  editRow.className = 'profile-row';
  editRow.innerHTML = `<span class="dropdown-action-label">✏ Modifier ${esc(currentProfileData?.prenom || 'le joueur')}</span>`;
  editRow.addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.add('hidden');
    openProfileSettings(currentProfileData || {});
  });
  dropdown.appendChild(editRow);

  const sep2 = document.createElement('div');
  sep2.className = 'dropdown-separator';
  dropdown.appendChild(sep2);

  const lockRow = document.createElement('div');
  lockRow.className = 'profile-row profile-row-lock';
  lockRow.innerHTML = `<span class="dropdown-action-label">🔒 Options superviseur</span>`;
  lockRow.addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.add('hidden');
    openSupervisorOptions();
  });
  dropdown.appendChild(lockRow);
}

// ── Auth button ───────────────────────────────────────────────────────────────

document.getElementById('auth-btn').addEventListener('click', async () => {
  if (gameService.getUser()) {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown.classList.contains('hidden')) {
      await renderProfilesDropdown();
      dropdown.classList.remove('hidden');
      refreshProfilesCache();
    } else {
      dropdown.classList.add('hidden');
    }
  } else {
    document.getElementById('auth-overlay').classList.remove('hidden');
  }
});

document.addEventListener('click', e => {
  if (!document.getElementById('user-area').contains(e.target))
    document.getElementById('user-dropdown').classList.add('hidden');
});

// ── Auth modal ────────────────────────────────────────────────────────────────

let regAvatarId = 1;
buildAvatarGrid(document.getElementById('reg-avatar-picker'), regAvatarId, id => { regAvatarId = id; });

document.getElementById('auth-close').addEventListener('click', () =>
  document.getElementById('auth-overlay').classList.add('hidden')
);
document.getElementById('auth-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('auth-overlay'))
    document.getElementById('auth-overlay').classList.add('hidden');
});
document.getElementById('play-anon').addEventListener('click', () =>
  document.getElementById('auth-overlay').classList.add('hidden')
);

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('auth-login').classList.toggle('hidden',    tab.dataset.tab !== 'login');
    document.getElementById('auth-register').classList.toggle('hidden', tab.dataset.tab !== 'register');
  });
});

document.getElementById('forgot-btn').addEventListener('click', async () => {
  const email   = document.getElementById('login-email').value.trim();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = ''; errorEl.style.color = '';
  if (!email) { errorEl.textContent = 'Entrez votre email d\'abord.'; return; }
  const btn = document.getElementById('forgot-btn');
  btn.disabled = true;
  try {
    await gameService.resetPassword(email);
    errorEl.style.color = 'var(--success)';
    errorEl.textContent = 'Email envoyé ! Vérifiez votre boîte mail.';
  } catch(err) {
    errorEl.style.color = '';
    errorEl.textContent = authErrorMsg(err);
  } finally { btn.disabled = false; }
});

document.getElementById('auth-login').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  errorEl.textContent = ''; errorEl.style.color = '';
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  try {
    await gameService.signIn(email, password);
    document.getElementById('auth-overlay').classList.add('hidden');
  } catch(err) {
    errorEl.textContent = authErrorMsg(err);
  } finally { btn.disabled = false; }
});

document.getElementById('auth-register').addEventListener('submit', async e => {
  e.preventDefault();
  const prenom   = document.getElementById('reg-firstname').value.trim();
  const nom      = document.getElementById('reg-lastname').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errorEl  = document.getElementById('register-error');
  errorEl.textContent = '';
  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  try {
    await gameService.signUp(email, password, prenom, nom, regAvatarId);
    document.getElementById('auth-overlay').classList.add('hidden');
  } catch(err) {
    errorEl.textContent = authErrorMsg(err);
  } finally { btn.disabled = false; }
});

document.getElementById('google-btn').addEventListener('click', async () => {
  const btn = document.getElementById('google-btn');
  btn.disabled = true;
  try {
    await gameService.signInWithGoogle();
    document.getElementById('auth-overlay').classList.add('hidden');
  } catch(err) {
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request')
      console.error('Google sign-in error:', err);
  } finally { btn.disabled = false; }
});

// ── Supervisor modal ──────────────────────────────────────────────────────────

function openSupervisorOptions() {
  document.getElementById('supervisor-auth').style.display    = '';
  document.getElementById('supervisor-options').style.display = 'none';
  document.getElementById('supervisor-password').value        = '';
  document.getElementById('supervisor-auth-error').textContent = '';
  const provider = gameService.getSupervisorProvider();
  document.getElementById('supervisor-google-btn').style.display =
    provider === 'google.com' ? '' : 'none';
  document.getElementById('supervisor-overlay').classList.remove('hidden');
}

document.getElementById('supervisor-close').addEventListener('click', () =>
  document.getElementById('supervisor-overlay').classList.add('hidden')
);
document.getElementById('supervisor-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('supervisor-overlay'))
    document.getElementById('supervisor-overlay').classList.add('hidden');
});

document.getElementById('supervisor-reauth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('supervisor-password').value.trim();
  const errorEl  = document.getElementById('supervisor-auth-error');
  errorEl.textContent = '';
  if (!password) { errorEl.textContent = 'Entrez votre mot de passe.'; return; }
  const btn = document.getElementById('supervisor-reauth-btn');
  btn.disabled = true;
  try {
    await gameService.reauthWithPassword(password);
    sessionStorage.setItem('editor_reauth_ok', '1');
    document.getElementById('supervisor-auth').style.display    = 'none';
    document.getElementById('supervisor-options').style.display = 'flex';
  } catch(err) {
    errorEl.textContent =
      err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Mot de passe incorrect.' : 'Erreur d\'authentification.';
  } finally { btn.disabled = false; }
});

document.getElementById('supervisor-google-btn').addEventListener('click', async () => {
  const btn = document.getElementById('supervisor-google-btn');
  btn.disabled = true;
  try {
    await gameService.reauthWithGoogle();
    sessionStorage.setItem('editor_reauth_ok', '1');
    document.getElementById('supervisor-auth').style.display    = 'none';
    document.getElementById('supervisor-options').style.display = 'flex';
  } catch(err) {
    document.getElementById('supervisor-auth-error').textContent = 'Erreur Google.';
  } finally { btn.disabled = false; }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  document.getElementById('supervisor-overlay').classList.add('hidden');
  gameService.signOut().catch(console.error);
});

// ── Settings panel ────────────────────────────────────────────────────────────

function _supervisorProfile() {
  return (cachedProfiles || []).find(p => p.is_supervisor) || null;
}

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('supervisor-overlay').classList.add('hidden');
  const sup = _supervisorProfile();
  document.getElementById('setting-show-ranking').checked = sup?.show_ranking ?? true;
  document.getElementById('settings-error').textContent = '';
  document.getElementById('settings-overlay').classList.remove('hidden');
});
document.getElementById('settings-close').addEventListener('click', () =>
  document.getElementById('settings-overlay').classList.add('hidden')
);
document.getElementById('settings-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-overlay'))
    document.getElementById('settings-overlay').classList.add('hidden');
});
document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const btn   = document.getElementById('settings-save-btn');
  const errEl = document.getElementById('settings-error');
  btn.disabled = true; errEl.textContent = '';
  try {
    const sup = _supervisorProfile();
    if (!sup) throw new Error('no supervisor');
    await gameService.updateSupervisorSettings(sup.id, {
      show_ranking: document.getElementById('setting-show-ranking').checked,
    });
    cachedProfiles = null;
    await refreshProfilesCache();
    document.getElementById('settings-overlay').classList.add('hidden');
  } catch(e) {
    console.error('[settings]', e);
    errEl.textContent = 'Erreur lors de la sauvegarde.';
  } finally { btn.disabled = false; }
});

// ── Add profile modal ─────────────────────────────────────────────────────────

let addProfileAvatarId = 1;

document.getElementById('add-profile-btn').addEventListener('click', () => {
  document.getElementById('supervisor-overlay').classList.add('hidden');
  addProfileAvatarId = 1;
  document.getElementById('add-profile-prenom').value      = '';
  document.getElementById('add-profile-nom').value         = '';
  document.getElementById('add-profile-error').textContent = '';
  buildAvatarGrid(document.getElementById('add-profile-avatar-picker'), addProfileAvatarId, id => { addProfileAvatarId = id; });
  document.getElementById('add-profile-overlay').classList.remove('hidden');
});
document.getElementById('add-profile-close').addEventListener('click', () =>
  document.getElementById('add-profile-overlay').classList.add('hidden')
);
document.getElementById('add-profile-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('add-profile-overlay'))
    document.getElementById('add-profile-overlay').classList.add('hidden');
});
document.getElementById('add-profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const prenom  = document.getElementById('add-profile-prenom').value.trim();
  const nom     = document.getElementById('add-profile-nom').value.trim();
  const errorEl = document.getElementById('add-profile-error');
  errorEl.textContent = '';
  if (!prenom) { errorEl.textContent = 'Le prénom est requis.'; return; }
  const btn = document.getElementById('add-profile-submit');
  btn.disabled = true;
  try {
    await gameService.createChildProfile(prenom, nom, addProfileAvatarId);
    cachedProfiles = null;
    document.getElementById('add-profile-overlay').classList.add('hidden');
  } catch(err) {
    errorEl.textContent = 'Erreur lors de la création.'; console.error(err);
  } finally { btn.disabled = false; }
});

// ── Profile settings modal ────────────────────────────────────────────────────

function openProfileSettings(profile) {
  profileAvatarId = profile.avatar_id || 1;
  document.getElementById('profile-panel-title').textContent = `Avatar de ${profile.prenom || 'ce joueur'}`;
  buildAvatarGrid(document.getElementById('profile-avatar-picker'), profileAvatarId, id => { profileAvatarId = id; });
  document.getElementById('profile-overlay').classList.remove('hidden');
}
document.getElementById('profile-close').addEventListener('click', () =>
  document.getElementById('profile-overlay').classList.add('hidden')
);
document.getElementById('profile-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('profile-overlay'))
    document.getElementById('profile-overlay').classList.add('hidden');
});
document.getElementById('profile-save').addEventListener('click', async () => {
  const btn = document.getElementById('profile-save');
  btn.disabled = true;
  try {
    await gameService.updateProfileAvatar(currentProfileId, profileAvatarId);
    cachedProfiles = null;
    if (currentProfileData) currentProfileData.avatar_id = profileAvatarId;
    showUserAvatar(profileAvatarId);
    document.getElementById('profile-overlay').classList.add('hidden');
  } catch(err) {
    console.error('Avatar save error:', err);
  } finally { btn.disabled = false; }
});

// ── Firebase auth state ───────────────────────────────────────────────────────

window.onAuthChanged = user => {
  if (user) {
    refreshProfilesCache().then(profiles => {
      if (!profiles.length) return;
      const saved      = profiles.find(p => p.id === currentProfileId);
      const supervisor = profiles.find(p => p.is_supervisor);
      const profile    = saved || supervisor || profiles[0];
      selectProfile(profile.id, profile);
      profileAvatarId = profile.avatar_id || 1;
    }).catch(() => {});
  } else {
    cachedProfiles = null; currentProfileId = null; currentProfileData = null;
    localStorage.removeItem(_pfx + 'profile-id');
    showUserAvatar(null);
    const display = document.getElementById('user-display');
    if (display) display.textContent = 'Me connecter';
  }
};

function authErrorMsg(err) {
  switch (err.code) {
    case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.';
    case 'auth/invalid-email':        return 'Email invalide.';
    case 'auth/weak-password':        return 'Mot de passe trop court (min. 6 caractères).';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':   return 'Email ou mot de passe incorrect.';
    default:                          return err.message;
  }
}

// ── Families ──────────────────────────────────────────────────────────────────

async function init() {
  state.families = await gameService.getFamilies();
  renderFamilyTabs();
  if (state.families.length > 0) {
    const savedFamId = localStorage.getItem(_pfx + 'family-id');
    const fam = state.families.find(f => String(f.docId) === savedFamId) || state.families[0];
    await selectFamily(fam);
  } else {
    document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Aucune famille disponible.</div>';
  }
}

// ── Couleurs de famille ───────────────────────────────────────────────────────

const FAMILY_COLORS = [
  '#e74c3c', '#e67e22', '#f39c12', '#27ae60',
  '#1abc9c', '#2980b9', '#9b59b6', '#e91e63',
  '#00bcd4', '#ff5722', '#3f51b5', '#8bc34a',
];

function getFamilyColor(idx) { return FAMILY_COLORS[idx % FAMILY_COLORS.length]; }

function updateFamilyColor() {
  const idx = state.selectedFamily
    ? state.families.findIndex(f => f.docId === state.selectedFamily.docId) : -1;
  const el = document.querySelector('.level-content');
  if (el) el.style.background = idx >= 0 ? getFamilyColor(idx) : '';
}

// ── Carousel ──────────────────────────────────────────────────────────────────

const _SLOT_PARAMS = [
  { tx: -380, ty:  0, scale: 0.50, opacity: 0    },
  { tx: -246, ty:  0, scale: 0.70, opacity: 0.50 },
  { tx: -142, ty:  0, scale: 1.00, opacity: 0.80 },
  { tx:    0, ty: 13, scale: 1.50, opacity: 1.00 },
  { tx:  142, ty:  0, scale: 1.00, opacity: 0.80 },
  { tx:  246, ty:  0, scale: 0.70, opacity: 0.50 },
  { tx:  380, ty:  0, scale: 0.50, opacity: 0    },
];
function _slotP(offset) { return _SLOT_PARAMS[Math.max(0, Math.min(6, offset + 3))]; }
function _lerp(a, b, t) { return a + (b - a) * t; }

let _suppressCarouselClick = false;
let _carouselPending = null;
let _carouselRaf     = null;

function renderFamilyTabs() {
  const scroll = document.getElementById('family-tabs-scroll');
  scroll.innerHTML = '';
  const n = state.families.length;
  if (n === 0) return;
  const selIdx = state.families.findIndex(f => f.docId === state.selectedFamily?.docId);

  for (let offset = -3; offset <= 3; offset++) {
    const famIdx = selIdx + offset;
    if (famIdx < 0 || famIdx >= n) continue;
    const fam = state.families[famIdx];
    const p   = _slotP(offset);
    const tab = document.createElement('button');
    tab.className      = 'family-tab' + (offset === 0 ? ' active' : '');
    tab.textContent    = fam.name;
    tab.dataset.offset = offset;
    tab.style.background = getFamilyColor(famIdx);
    tab.style.opacity    = p.opacity;
    tab.style.transform  = `translateX(${p.tx}px) translateY(${p.ty}px) scale(${p.scale})`;
    tab.addEventListener('click', () => {
      if (_suppressCarouselClick || offset === 0) return;
      _carouselNavigate(Math.sign(offset), Math.abs(offset));
    });
    scroll.appendChild(tab);
  }
}

function _carouselSetProgress(p) {
  const scroll = document.getElementById('family-tabs-scroll');
  if (!scroll) return;
  const abs = Math.abs(p);
  const dir = p >= 0 ? 1 : -1;
  const n   = Math.floor(abs);
  const t   = abs - n;
  scroll.querySelectorAll('.family-tab').forEach(tab => {
    const k    = parseInt(tab.dataset.offset);
    const from = _slotP(k + n * dir);
    const to   = _slotP(k + (n + 1) * dir);
    tab.style.transform = `translateX(${_lerp(from.tx, to.tx, t)}px) translateY(${_lerp(from.ty, to.ty, t)}px) scale(${_lerp(from.scale, to.scale, t)})`;
    tab.style.opacity   = _lerp(from.opacity, to.opacity, t);
  });
}

function _carouselNavigate(navDir, steps = 1) {
  const selIdx  = state.families.findIndex(f => f.docId === state.selectedFamily?.docId);
  const maxStep = navDir < 0 ? selIdx : state.families.length - 1 - selIdx;
  const actual  = Math.min(steps, maxStep);
  if (actual <= 0) return;

  const newFam  = state.families[selIdx + navDir * actual];
  const targetP = navDir < 0 ? actual : -actual;

  state.selectedFamily         = newFam;
  state.selectedLevel          = null;
  state.selectedLevelItemCount = null;
  updateFooter();
  updateFamilyColor();
  document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Chargement…</div>';
  gameService.getLevels(newFam.id).then(levels => { state.levels = levels; renderLevelGrid(); });

  const scroll = document.getElementById('family-tabs-scroll');
  scroll.querySelectorAll('.family-tab').forEach(t => { t.style.transition = 'none'; });
  _suppressCarouselClick = true;
  if (_carouselPending) { clearTimeout(_carouselPending); _carouselPending = null; }
  if (_carouselRaf)     { cancelAnimationFrame(_carouselRaf); _carouselRaf = null; }

  const duration  = actual * 300;
  const startTime = performance.now();

  function tick(now) {
    const raw   = Math.min(1, (now - startTime) / duration);
    const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
    _carouselSetProgress(targetP * eased);
    if (raw < 1) {
      _carouselRaf = requestAnimationFrame(tick);
    } else {
      _carouselRaf = null;
      _suppressCarouselClick = false;
      renderFamilyTabs();
    }
  }
  _carouselRaf = requestAnimationFrame(tick);
}

function initCarouselDrag() {
  const scroll = document.getElementById('family-tabs-scroll');
  const MAX_PX = 130;
  let startX   = null;

  const setTr = (on) =>
    scroll.querySelectorAll('.family-tab').forEach(t => { t.style.transition = on ? '' : 'none'; });

  const onStart = (clientX) => {
    const hadAnimation = _carouselPending || _carouselRaf;
    if (_carouselPending) { clearTimeout(_carouselPending); _carouselPending = null; }
    if (_carouselRaf)     { cancelAnimationFrame(_carouselRaf); _carouselRaf = null; }
    if (hadAnimation) renderFamilyTabs();
    startX = clientX;
    setTr(false);
  };
  const onMove = (clientX) => {
    if (startX === null) return;
    _carouselSetProgress(Math.max(-2, Math.min(2, (clientX - startX) / MAX_PX)));
  };
  const onEnd = (clientX) => {
    if (startX === null) return;
    const p   = Math.max(-2, Math.min(2, (clientX - startX) / MAX_PX));
    startX    = null;
    const dir = p > 0 ? -1 : 1;
    const steps = Math.abs(p) >= 0.25 ? Math.min(2, Math.round(Math.abs(p))) : 0;
    const selIdx = state.families.findIndex(f => f.docId === state.selectedFamily?.docId);
    const newIdx = selIdx + dir * steps;
    const canNav = steps > 0 && newIdx >= 0 && newIdx < state.families.length;

    setTr(true);
    if (canNav) {
      const targetP = dir < 0 ? steps : -steps;
      _carouselSetProgress(targetP);
      _suppressCarouselClick = true;
      const newFam = state.families[newIdx];
      state.selectedFamily = newFam; state.selectedLevel = null; state.selectedLevelItemCount = null;
      updateFooter(); updateFamilyColor();
      document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Chargement…</div>';
      gameService.getLevels(newFam.id).then(levels => { state.levels = levels; renderLevelGrid(); });
      if (_carouselPending) clearTimeout(_carouselPending);
      _carouselPending = setTimeout(() => {
        _suppressCarouselClick = false; _carouselPending = null; renderFamilyTabs();
      }, 390);
    } else {
      _carouselSetProgress(0);
    }
  };

  scroll.addEventListener('mousedown',   e => onStart(e.clientX));
  document.addEventListener('mousemove', e => { if (startX !== null) onMove(e.clientX); });
  document.addEventListener('mouseup',   e => { if (startX !== null) onEnd(e.clientX); });
  scroll.addEventListener('touchstart',  e => onStart(e.touches[0].clientX), { passive: true });
  scroll.addEventListener('touchmove',   e => { if (startX !== null) onMove(e.touches[0].clientX); }, { passive: true });
  scroll.addEventListener('touchend',    e => { if (startX !== null) onEnd(e.changedTouches[0].clientX); });
}

async function selectFamily(fam) {
  state.selectedFamily         = fam;
  state.selectedLevel          = null;
  state.selectedLevelItemCount = null;
  localStorage.setItem(_pfx + 'family-id', String(fam.docId));
  renderFamilyTabs();
  updateFooter();
  updateFamilyColor();
  document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Chargement…</div>';
  state.levels = await gameService.getLevels(fam.id);
  renderLevelGrid();
}

// ── Difficulty filter ─────────────────────────────────────────────────────────

let selectedDifficulty = 0;

if (_ui.difficulty) {
  document.getElementById('difficulty-bar').addEventListener('click', e => {
    const chip = e.target.closest('.diff-chip');
    if (!chip) return;
    selectedDifficulty = parseInt(chip.dataset.diff);
    document.querySelectorAll('.diff-chip').forEach(c =>
      c.classList.toggle('active', parseInt(c.dataset.diff) === selectedDifficulty)
    );
    renderLevelGrid();
  });
}

// ── Levels ────────────────────────────────────────────────────────────────────

function _levelStars(lvl) {
  if (!selectedMode || MODES.find(m => m.slug === selectedMode)?.score_tracking === false) return '☆☆☆';
  const gameTypeId = MODES.find(m => m.slug === selectedMode)?.id ?? 0;
  const key        = `${lvl.docId}_${gameTypeId}`;
  const stars      = state.progress?.best_scores?.[key] ?? 0;
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

function _isDenied(lvl) {
  if (currentProfileData?.is_supervisor) return false;
  return (currentProfileData?.denied_levels || []).includes(lvl.docId);
}

function _showLockedLevels() {
  const sup = (cachedProfiles || []).find(p => p.is_supervisor);
  return sup?.show_locked_levels ?? true;
}

function _diffLabel(id) {
  return GAME_CONFIG.difficulties.find(d => d.id === id)?.label || '';
}

function renderLevelGrid() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  const showLocked = _showLockedLevels();
  const currentMode = MODES.find(m => m.slug === selectedMode);

  const visible = state.levels.filter(lvl => {
    if (lvl.valid === false) return false;
    if (_isDenied(lvl) && !showLocked) return false;
    if (selectedDifficulty > 0 && lvl.difficulty !== selectedDifficulty) return false;
    return true;
  });

  if (visible.length === 0) {
    grid.innerHTML = '<div class="loading-msg">Aucun niveau accessible.</div>';
    return;
  }

  visible.forEach(lvl => {
    const denied   = _isDenied(lvl);
    const noAudio  = _ui.audio && currentMode?.audio_required && lvl.audio_status !== 'complete';
    const isSelected = !denied && !noAudio && state.selectedLevel?.docId === lvl.docId;

    if (_ui.level_display === 'list') {
      _renderLevelListItem(grid, lvl, denied, noAudio, isSelected);
    } else {
      _renderLevelCard(grid, lvl, denied, noAudio, isSelected);
    }
  });
}

function _renderLevelCard(grid, lvl, denied, noAudio, isSelected) {
  const card = document.createElement('div');
  card.className = `level-card${isSelected ? ' selected' : ''}${denied || noAudio ? ' level-locked' : ''}`;
  const audioIcon = _ui.audio && ICONS.speaker && lvl.audio_status === 'complete'
    ? `<span class="level-audio-icon">${ICONS.speaker}</span>` : '';
  card.innerHTML = `
    ${lvl.image_path
      ? `<img class="level-card-img" src="${esc(lvl.image_path)}" alt="" loading="lazy">`
      : `<div class="level-card-img-ph">🖼</div>`}
    <div class="level-card-name">${esc(lvl.title || lvl.name)}${audioIcon}</div>
    <div class="level-stars">${_levelStars(lvl)}</div>
    ${denied || noAudio ? `<div class="level-lock-overlay">🔒</div>` : ''}
    ${isSelected ? `<button class="level-card-play" title="Jouer"><div class="level-card-play-icon">▶</div></button>` : ''}`;

  if (!denied && !noAudio) {
    card.addEventListener('click', () => onLevelClick(lvl));
    if (isSelected) {
      card.querySelector('.level-card-play').addEventListener('click', e => {
        e.stopPropagation(); launchGame(selectedMode);
      });
    }
  }
  grid.appendChild(card);
}

function _renderLevelListItem(grid, lvl, denied, noAudio, isSelected) {
  const item = document.createElement('div');
  item.className = `level-list-item${isSelected ? ' selected' : ''}${denied || noAudio ? ' level-locked' : ''}`;
  const diffBadge = lvl.difficulty && _ui.difficulty
    ? `<span class="level-list-diff">${esc(_diffLabel(lvl.difficulty))}</span>` : '';
  const notesHtml = lvl.notes ? `<div class="level-list-notes">${esc(lvl.notes)}</div>` : '';

  item.innerHTML = `
    <div class="level-list-body">
      <div class="level-list-name">${esc(lvl.title || lvl.name)}</div>
      ${notesHtml}
    </div>
    <div class="level-list-right">
      ${diffBadge}
      <div class="level-stars" style="font-size:11px;letter-spacing:1px">${_levelStars(lvl)}</div>
    </div>
    ${isSelected ? `<button class="level-list-play" title="Jouer">▶</button>` : ''}
    ${denied || noAudio ? `<div class="level-lock-overlay">🔒</div>` : ''}`;

  if (!denied && !noAudio) {
    item.addEventListener('click', () => onLevelClick(lvl));
    if (isSelected) {
      item.querySelector('.level-list-play').addEventListener('click', e => {
        e.stopPropagation(); launchGame(selectedMode);
      });
    }
  }
  grid.appendChild(item);
}

function onLevelClick(lvl) {
  if (state.selectedLevel?.docId === lvl.docId) {
    launchGame(selectedMode);
  } else {
    state.selectedLevel          = lvl;
    state.selectedLevelItemCount = null;
    renderLevelGrid();
    updateFooter();
    if (gameService.getItemCount) {
      gameService.getItemCount(lvl.docId).then(count => {
        if (state.selectedLevel?.docId === lvl.docId) {
          state.selectedLevelItemCount = count;
          updateFooter();
        }
      }).catch(() => {});
    }
  }
}

function updateFooter() {
  const empty = document.getElementById('footer-empty');
  const info  = document.getElementById('footer-info');
  if (!state.selectedLevel) {
    empty.classList.remove('hidden'); info.classList.add('hidden'); return;
  }
  empty.classList.add('hidden'); info.classList.remove('hidden');
  document.getElementById('footer-name').textContent = state.selectedLevel.title || state.selectedLevel.name;
  const parts = [];
  if (state.selectedLevel.notes) parts.push(state.selectedLevel.notes);
  if (state.selectedLevelItemCount !== null) {
    const lbl = _ui.item_label || 'item';
    parts.push(`${state.selectedLevelItemCount} ${lbl}${state.selectedLevelItemCount !== 1 ? 's' : ''}`);
  }
  document.getElementById('footer-sub').textContent = parts.join('  ·  ');
}

// ── Mode menu ─────────────────────────────────────────────────────────────────

let selectedMode = localStorage.getItem(_pfx + 'mode') || MODES[0].slug;
if (!MODES.find(m => m.slug === selectedMode)) selectedMode = MODES[0].slug;

function updateModeBtn() {
  const m = MODES.find(m => m.slug === selectedMode) || MODES[0];
  const icon  = document.getElementById('mode-menu-icon');
  const label = document.getElementById('mode-menu-label');
  if (icon)  icon.textContent  = m.icon;
  if (label) label.textContent = m.label;
  document.querySelectorAll('.mode-entry').forEach(el =>
    el.classList.toggle('active', el.dataset.mode === selectedMode)
  );
  if (_ui.audio) {
    document.querySelectorAll('.mode-entry-audio').forEach(el =>
      el.classList.toggle('hidden', !audioEnabled)
    );
  }
}

if (MODES.length > 1) {
  document.getElementById('mode-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('mode-dropdown').classList.toggle('hidden');
  });
  document.querySelectorAll('.mode-entry').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMode = btn.dataset.mode;
      localStorage.setItem(_pfx + 'mode', selectedMode);
      updateModeBtn();
      document.getElementById('mode-dropdown').classList.add('hidden');
      if (state.selectedFamily) renderLevelGrid();
    });
  });
  document.addEventListener('click', e => {
    const menu = document.getElementById('mode-menu');
    if (menu && !menu.contains(e.target))
      document.getElementById('mode-dropdown').classList.add('hidden');
  });
}

if (_ui.chrono) {
  document.getElementById('chrono-toggle').addEventListener('click', () => {
    chronoEnabled = !chronoEnabled;
    localStorage.setItem(_pfx + 'chrono', chronoEnabled ? '1' : '0');
    document.getElementById('chrono-toggle').classList.toggle('on', chronoEnabled);
  });
}

if (_ui.audio) {
  document.getElementById('audio-toggle').addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    localStorage.setItem(_pfx + 'audio', audioEnabled ? '1' : '0');
    document.getElementById('audio-toggle').classList.toggle('on', audioEnabled);
    updateModeBtn();
    if (state.selectedFamily) renderLevelGrid();
  });
}

updateModeBtn();
if (_ui.chrono) document.getElementById('chrono-toggle').classList.toggle('on', chronoEnabled);
if (_ui.audio)  document.getElementById('audio-toggle').classList.toggle('on', audioEnabled);

// ── Score panel ───────────────────────────────────────────────────────────────

let _scorePanelTab = 'mine';
let _allLevels     = null;

function _bestPoints(progress) { return progress.best_points || {}; }

function _cellHtml(stars, points) {
  if (stars === undefined || stars === null) return '<span class="score-none">—</span>';
  const p = points !== undefined ? `<span class="score-pts">${points} pts</span> ` : '';
  const s = '<span class="score-gold">' + '★'.repeat(stars) + '</span>'
          + '<span class="score-empty">☆</span>'.repeat(3 - stars);
  return p + s;
}

async function openScorePanel() {
  const showRanking = _supervisorProfile()?.show_ranking ?? true;
  const rankingTab  = document.querySelector('.score-tab[data-tab="ranking"]');
  if (rankingTab) rankingTab.style.display = showRanking ? '' : 'none';
  if (!showRanking && _scorePanelTab === 'ranking') _scorePanelTab = 'mine';
  document.getElementById('score-overlay').classList.remove('hidden');
  document.getElementById('score-content').innerHTML = '<div class="loading-msg">Chargement…</div>';
  if (!_allLevels) _allLevels = await gameService.getAllLevels();
  await renderScoreTab(_scorePanelTab);
}

async function renderScoreTab(tab) {
  _scorePanelTab = tab;
  document.querySelectorAll('.score-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  const content = document.getElementById('score-content');
  content.innerHTML = '<div class="loading-msg">Chargement…</div>';
  try {
    if (tab === 'mine') await _renderMyScores(content);
    else                await _renderRanking(content);
  } catch(e) {
    console.error('[scores]', e);
    content.innerHTML = '<div class="loading-msg">Erreur de chargement.</div>';
  }
}

async function _renderMyScores(container) {
  if (!currentProfileId) {
    container.innerHTML = '<div class="loading-msg">Connectez-vous pour voir vos scores.</div>';
    return;
  }
  const progress = await gameService.getProgress(currentProfileId);
  const bs = progress.best_scores || {};
  const levelIds = new Set(Object.keys(bs).map(k => k.substring(0, k.lastIndexOf('_'))));
  if (!levelIds.size) { container.innerHTML = '<div class="loading-msg">Aucun score enregistré.</div>'; return; }
  const levels = _allLevels.filter(l => levelIds.has(l.docId));
  const bp = _bestPoints(progress);
  let html = `<table class="score-table"><thead><tr><th>Niveau</th>${SCORE_MODES.map(m => `<th>${esc(m.label)}</th>`).join('')}</tr></thead><tbody>`;
  levels.forEach(lvl => {
    html += `<tr><td class="score-level-name">${esc(lvl.title || lvl.name)}</td>`;
    SCORE_MODES.forEach(m => {
      const key = `${lvl.docId}_${m.typeId}`;
      html += `<td class="score-stars">${_cellHtml(bs[key], bp[key])}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function _renderRanking(container) {
  const profiles = cachedProfiles ?? await refreshProfilesCache();
  if (!profiles.length) { container.innerHTML = '<div class="loading-msg">Aucun profil.</div>'; return; }
  const progressMap = await gameService.getProgressForProfiles(profiles.map(p => p.id));
  const levelIds = new Set();
  Object.values(progressMap).forEach(prog =>
    Object.keys(prog.best_scores || {}).forEach(k => levelIds.add(k.substring(0, k.lastIndexOf('_'))))
  );
  if (!levelIds.size) { container.innerHTML = '<div class="loading-msg">Aucun score enregistré.</div>'; return; }
  const levels = _allLevels.filter(l => levelIds.has(l.docId));
  const bpMap = {};
  profiles.forEach(p => { bpMap[p.id] = _bestPoints(progressMap[p.id] || {}); });
  let html = `<table class="score-table"><thead><tr><th>Joueur</th><th>Niveau</th>${SCORE_MODES.map(m => `<th>${esc(m.label)}</th>`).join('')}</tr></thead><tbody>`;
  for (const profile of profiles) {
    const bs = progressMap[profile.id]?.best_scores || {};
    const bp = bpMap[profile.id] || {};
    const played = levels.filter(lvl => SCORE_MODES.some(m => bs[`${lvl.docId}_${m.typeId}`] !== undefined));
    if (!played.length) continue;
    played.forEach((lvl, i) => {
      html += '<tr>';
      if (i === 0) html += `<td class="score-player-name" rowspan="${played.length}">${esc(profile.prenom)}</td>`;
      html += `<td class="score-level-name">${esc(lvl.title || lvl.name)}</td>`;
      SCORE_MODES.forEach(m => {
        const key = `${lvl.docId}_${m.typeId}`;
        html += `<td class="score-stars">${_cellHtml(bs[key], bp[key])}</td>`;
      });
      html += '</tr>';
    });
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

document.getElementById('score-btn').addEventListener('click', openScorePanel);
document.getElementById('score-close-btn').addEventListener('click', () =>
  document.getElementById('score-overlay').classList.add('hidden')
);
document.querySelectorAll('.score-tab').forEach(btn =>
  btn.addEventListener('click', () => renderScoreTab(btn.dataset.tab))
);
document.getElementById('score-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('score-overlay'))
    document.getElementById('score-overlay').classList.add('hidden');
});

// ── Help panel ────────────────────────────────────────────────────────────────

document.getElementById('help-version').textContent = `${GAME_CONFIG.name} ${VERSION}`;
document.getElementById('help-btn').addEventListener('click', () =>
  document.getElementById('help-overlay').classList.remove('hidden')
);
document.getElementById('help-close-btn').addEventListener('click', () =>
  document.getElementById('help-overlay').classList.add('hidden')
);
document.getElementById('help-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('help-overlay'))
    document.getElementById('help-overlay').classList.add('hidden');
});

// ── Launch ────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const existing = document.getElementById('_toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = '_toast'; t.className = 'cv-toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('cv-toast-show'));
  setTimeout(() => { t.classList.remove('cv-toast-show'); setTimeout(() => t.remove(), 300); }, 3500);
}

function launchGame(mode) {
  if (!state.selectedLevel) return;
  const currentMode = MODES.find(m => m.slug === mode);
  if (_ui.audio && currentMode?.audio_required && !audioEnabled) {
    showToast('🔊 Active le son pour jouer en mode ' + (currentMode?.label || mode));
    return;
  }
  const p = new URLSearchParams({
    level:   state.selectedLevel.docId,
    mode,
    chrono:  chronoEnabled ? '1' : '0',
    avatar:  profileAvatarId,
    player:  currentProfileData?.prenom || '',
    profile: currentProfileId || '',
  });
  if (_ui.audio) p.set('audio', audioEnabled ? '1' : '0');
  window.location.href = `game.html?${p}`;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

document.getElementById('close-btn').addEventListener('click', () => {
  if (window.history.length > 1) window.history.back(); else window.close();
});

// ── Fullscreen ────────────────────────────────────────────────────────────────

(function () {
  const btn      = document.getElementById('fullscreen-btn');
  const expand   = document.getElementById('fs-expand');
  const compress = document.getElementById('fs-compress');
  function update() {
    const fs = !!document.fullscreenElement;
    expand.style.display   = fs ? 'none' : '';
    compress.style.display = fs ? '' : 'none';
  }
  btn.addEventListener('click', () => {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', update);
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Start ─────────────────────────────────────────────────────────────────────

initCarouselDrag();

if (_authResolved) window.onAuthChanged(_currentUser);

init();
