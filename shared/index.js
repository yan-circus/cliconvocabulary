// shared/index.js — generic index page for all LudoEdu games
// Requires: game-config.js (GAME_CONFIG), firebase-core.js,
//           platform-methods.js, firebase-service.js (GAME_ID, gameService)

const VERSION = 'v1.4.4';
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
.speed-selector{display:flex;align-items:center}
.speed-chips{display:flex;gap:4px;align-items:center}
.speed-chip{min-width:26px;height:26px;padding:0 6px;border-radius:13px;border:none;background:rgba(255,255,255,.2);color:rgba(255,255,255,.75);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
.speed-chip:hover{background:rgba(255,255,255,.35);color:#fff}
.speed-chip.active{background:#fff;color:#333}
.speed-chip-off{opacity:.6}
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

  const audioHtml = _ui.audio ? `<button id="audio-toggle" class="chrono-header-btn" title="Audio">${_SVG_AUDIO}</button>` : '';

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
        <div id="speed-selector" class="speed-selector"></div>
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
  </header>
  <div id="family-tabs-scroll" class="family-tabs-scroll"></div>

  <div class="level-content">
    <div class="sub-level-content">
      <div id="level-grid" class="level-grid${_ui.level_display === 'list' ? ' list-mode' : ''}">
        <div class="loading-msg">Chargement…</div>
      </div>
    </div>
  </div>

  <footer class="index-footer">
    <p class="footer-empty" id="footer-empty">Sélectionnez un niveau pour commencer</p>
    <div class="footer-info hidden" id="footer-info">
      <div class="footer-lvl-name" id="footer-name"></div>
      <div class="footer-lvl-sub"  id="footer-sub"></div>
    </div>
    <div class="mode-dev hidden" id="mode-dev">mode dev : <span id="dev-info"></span></div>
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

let selectedSpeed = parseInt(localStorage.getItem(_pfx + 'speed') || '0');
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

  const dashRow = document.createElement('div');
  dashRow.className = 'profile-row profile-row-lock';
  dashRow.innerHTML = `<span class="dropdown-action-label">🛠 Tableau de bord</span>`;
  dashRow.addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.add('hidden');
    location.href = '../shared/dashboard.html?game=' + GAME_CONFIG.game_id;
  });
  dropdown.appendChild(dashRow);

  const logoutRow = document.createElement('div');
  logoutRow.className = 'profile-row profile-row-lock';
  logoutRow.innerHTML = `<span class="dropdown-action-label">⬅ Se déconnecter</span>`;
  logoutRow.addEventListener('click', () => {
    document.getElementById('user-dropdown').classList.add('hidden');
    gameService.signOut().catch(console.error);
  });
  dropdown.appendChild(logoutRow);
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

// ── Settings panel ────────────────────────────────────────────────────────────
// _supervisorProfile() reste utilisé pour lire show_ranking (panneau Scores) —
// l'édition de ce réglage se fait maintenant depuis le Tableau de bord (onglet Général).

function _supervisorProfile() {
  return (cachedProfiles || []).find(p => p.is_supervisor) || null;
}

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
  try {
    state.families = await gameService.getFamilies();

    renderFamilyTabs();
    if (state.families.length > 0) {
      const savedFamId = localStorage.getItem(_pfx + 'family-id');
      const fam = state.families.find(f => String(f.docId) === savedFamId) || state.families[0];
      await selectFamily(fam);
    } else {
      document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Aucune famille disponible.</div>';
    }
  } catch(e) {
    console.error('[init]', e);
    document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Erreur de chargement.</div>';
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


function renderLevelGrid() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  const showLocked = _showLockedLevels();
  const currentMode = MODES.find(m => m.slug === selectedMode);

  const visible = state.levels.filter(lvl => {
    if (lvl.valid === false) return false;
    if (_isDenied(lvl) && !showLocked) return false;
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
    <img class="level-card-img" src="${lvl.image_path ? esc(lvl.image_path) : '../shared/assets/vignette_defaut.png'}" alt="" loading="lazy">
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
  const diffBadge = '';
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
  renderSpeedSelector();
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

function renderSpeedSelector() {
  const container = document.getElementById('speed-selector');
  if (!container) return;
  const mode = MODES.find(m => m.slug === selectedMode) || MODES[0];
  const sl   = mode.speed_levels || [];

  // Clamp selectedSpeed si le mode courant a moins d'états
  const maxLevel = sl.length ? sl[sl.length - 1].level : 0;
  if (selectedSpeed > maxLevel) {
    selectedSpeed = 0;
    localStorage.setItem(_pfx + 'speed', '0');
  }

  if (sl.length <= 1) { container.innerHTML = ''; return; }

  if (sl.length === 2) {
    const on = selectedSpeed > 0;
    container.innerHTML = `<button id="speed-toggle" class="chrono-header-btn${on ? ' on' : ''}" title="${esc(on ? sl[1].label : sl[0].label)}">⏱</button>`;
    container.querySelector('#speed-toggle').addEventListener('click', () => {
      selectedSpeed = selectedSpeed > 0 ? 0 : 1;
      localStorage.setItem(_pfx + 'speed', String(selectedSpeed));
      renderSpeedSelector();
    });
  } else {
    container.innerHTML = `<div class="speed-chips">` +
      sl.map(s =>
        `<button class="speed-chip${s.level === 0 ? ' speed-chip-off' : ''}${s.level === selectedSpeed ? ' active' : ''}" data-level="${s.level}" title="${esc(s.label)}">${s.level}</button>`
      ).join('') +
      `</div>`;
    container.querySelectorAll('.speed-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSpeed = parseInt(btn.dataset.level);
        localStorage.setItem(_pfx + 'speed', String(selectedSpeed));
        renderSpeedSelector();
      });
    });
  }
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

updateModeBtn(); // appelle renderSpeedSelector()
if (_ui.audio) document.getElementById('audio-toggle').classList.toggle('on', audioEnabled);

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
function _updateDevInfo() {
  const w = window.innerWidth, h = window.innerHeight;
  const device = w <= 750 ? 'mobile' : w <= 900 ? 'tablette' : 'desktop';
  document.getElementById('dev-info').textContent = `${device} · ${w}×${h}`;
}
window.addEventListener('resize', () => {
  if (!document.getElementById('mode-dev').classList.contains('hidden')) _updateDevInfo();
});

let _devClicks = 0;
document.getElementById('help-version').addEventListener('click', () => {
  _devClicks++;
  if (_devClicks >= 3) {
    _devClicks = 0;
    const el = document.getElementById('mode-dev');
    const entering = el.classList.toggle('hidden');
    document.body.classList.toggle('dev-mode', !entering);
    showToast(entering ? 'Mode développeur désactivé' : 'Mode développeur activé');
    if (!entering) _updateDevInfo();
  }
});
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
  const modeObj  = MODES.find(m => m.slug === mode);
  const speedObj = (modeObj?.speed_levels || []).find(s => s.level === selectedSpeed) || { level: 0, seconds: 0 };
  const p = new URLSearchParams({
    level:   state.selectedLevel.docId,
    mode,
    speed:   selectedSpeed,
    seconds: speedObj.seconds,
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
