// index.js — CliConVocabulary level browser

const VERSION     = 'v0.3.2';
const COMMIT_HASH = '6dc9bb3';
const COMMIT_DATE = '2026-05-25';
console.log('%cCliConVocabulary ' + VERSION, 'color:#6c5ce7;font-weight:bold;font-size:14px');

const state = {
  families:              [],
  selectedFamily:        null,
  levels:                [],
  selectedLevel:         null,
  selectedLevelWordCount: null,
};
let chronoEnabled = false;

// ── Auth & Profiles ───────────────────────────────────────────────────────────

let currentProfileId   = localStorage.getItem('cv-profile-id') || null;
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
  if (profileId) localStorage.setItem('cv-profile-id', profileId);
  else           localStorage.removeItem('cv-profile-id');
  const display = document.getElementById('user-display');
  if (display) display.textContent = profileData?.prenom || 'Joueur';
  showUserAvatar(profileData?.avatar_id || null);
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
      <span class="profile-row-name">${esc(profile.prenom)}</span>
    `;
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

// ── Auth button ──────────────────────────────────────────────────────────────

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
  } finally {
    btn.disabled = false;
  }
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
  } finally {
    btn.disabled = false;
  }
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
  } finally {
    btn.disabled = false;
  }
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
  } finally {
    btn.disabled = false;
  }
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
  } finally {
    btn.disabled = false;
  }
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
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  document.getElementById('supervisor-overlay').classList.add('hidden');
  gameService.signOut().catch(console.error);
});

// ── Add profile modal ─────────────────────────────────────────────────────────

let addProfileAvatarId = 1;

document.getElementById('add-profile-btn').addEventListener('click', () => {
  document.getElementById('supervisor-overlay').classList.add('hidden');
  addProfileAvatarId = 1;
  document.getElementById('add-profile-prenom').value      = '';
  document.getElementById('add-profile-nom').value         = '';
  document.getElementById('add-profile-error').textContent = '';
  buildAvatarGrid(
    document.getElementById('add-profile-avatar-picker'),
    addProfileAvatarId,
    id => { addProfileAvatarId = id; }
  );
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
    errorEl.textContent = 'Erreur lors de la création.';
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

// ── Profile settings modal ────────────────────────────────────────────────────

function openProfileSettings(profile) {
  profileAvatarId = profile.avatar_id || 1;
  document.getElementById('profile-panel-title').textContent =
    `Avatar de ${profile.prenom || 'ce joueur'}`;
  buildAvatarGrid(
    document.getElementById('profile-avatar-picker'),
    profileAvatarId,
    id => { profileAvatarId = id; }
  );
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
  } finally {
    btn.disabled = false;
  }
});

// ── Firebase auth state ───────────────────────────────────────────────────────

window.onGameAuthChanged = user => {
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
    cachedProfiles     = null;
    currentProfileId   = null;
    currentProfileData = null;
    localStorage.removeItem('cv-profile-id');
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
    await selectFamily(state.families[0]);
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

function getFamilyColor(familyIdx) {
  return FAMILY_COLORS[familyIdx % FAMILY_COLORS.length];
}

function _hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function updateFamilyColor() {
  const idx = state.selectedFamily
    ? state.families.findIndex(f => f.docId === state.selectedFamily.docId)
    : -1;
  const el = document.querySelector('.level-content');
  if (!el) return;
  el.style.background = idx >= 0 ? getFamilyColor(idx) : '';
}

// ── Carousel ──────────────────────────────────────────────────────────────────

// Slots -3..+3 : ±3 hors-écran pour les items qui entrent pendant le glissement
const _SLOT_PARAMS = [
  { tx: -380, ty:  0, scale: 0.50, opacity: 0    }, // -3
  { tx: -246, ty:  0, scale: 0.70, opacity: 0.50 }, // -2
  { tx: -142, ty:  0, scale: 1.00, opacity: 0.80 }, // -1
  { tx:    0, ty: 13, scale: 1.50, opacity: 1.00 }, //  0  (centre — descend pour toucher le content)
  { tx:  142, ty:  0, scale: 1.00, opacity: 0.80 }, // +1
  { tx:  246, ty:  0, scale: 0.70, opacity: 0.50 }, // +2
  { tx:  380, ty:  0, scale: 0.50, opacity: 0    }, // +3
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

// p quelconque : positif = glisse vers droite (famille précédente), négatif = vers gauche (suivante)
function _carouselSetProgress(p) {
  const scroll = document.getElementById('family-tabs-scroll');
  if (!scroll) return;
  const abs = Math.abs(p);
  const dir = p >= 0 ? 1 : -1;
  const n   = Math.floor(abs);       // slots déjà franchis
  const t   = abs - n;               // fraction vers le slot suivant
  scroll.querySelectorAll('.family-tab').forEach(tab => {
    const k    = parseInt(tab.dataset.offset);
    const from = _slotP(k + n * dir);
    const to   = _slotP(k + (n + 1) * dir);
    tab.style.transform = `translateX(${_lerp(from.tx, to.tx, t)}px) translateY(${_lerp(from.ty, to.ty, t)}px) scale(${_lerp(from.scale, to.scale, t)})`;
    tab.style.opacity   = _lerp(from.opacity, to.opacity, t);
  });
}

// Animation rAF pour les clics (part de p=0, arrive à p=targetP en douceur)
function _carouselNavigate(navDir, steps = 1) {
  const selIdx  = state.families.findIndex(f => f.docId === state.selectedFamily?.docId);
  const maxStep = navDir < 0 ? selIdx : state.families.length - 1 - selIdx;
  const actual  = Math.min(steps, maxStep);
  if (actual <= 0) return;

  const newFam  = state.families[selIdx + navDir * actual];
  const targetP = navDir < 0 ? actual : -actual;

  state.selectedFamily         = newFam;
  state.selectedLevel          = null;
  state.selectedLevelWordCount = null;
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
    const p    = Math.max(-2, Math.min(2, (clientX - startX) / MAX_PX));
    startX     = null;
    const absP = Math.abs(p);
    const dir  = p > 0 ? -1 : 1;
    const steps = absP >= 0.25 ? Math.min(2, Math.round(absP)) : 0;
    const selIdx = state.families.findIndex(f => f.docId === state.selectedFamily?.docId);
    const newIdx = selIdx + dir * steps;
    const canNav = steps > 0 && newIdx >= 0 && newIdx < state.families.length;

    setTr(true);

    if (canNav) {
      const targetP = dir < 0 ? steps : -steps;
      _carouselSetProgress(targetP); // CSS transition prend le relais depuis la position actuelle
      _suppressCarouselClick = true;
      const newFam = state.families[newIdx];
      state.selectedFamily         = newFam;
      state.selectedLevel          = null;
      state.selectedLevelWordCount = null;
      updateFooter();
      updateFamilyColor();
      document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Chargement…</div>';
      gameService.getLevels(newFam.id).then(levels => { state.levels = levels; renderLevelGrid(); });
      if (_carouselPending) clearTimeout(_carouselPending);
      _carouselPending = setTimeout(() => {
        _suppressCarouselClick = false;
        _carouselPending = null;
        renderFamilyTabs();
      }, 390);
    } else {
      _carouselSetProgress(0);
    }
  };

  scroll.addEventListener('mousedown',  e => onStart(e.clientX));
  document.addEventListener('mousemove', e => { if (startX !== null) onMove(e.clientX); });
  document.addEventListener('mouseup',   e => { if (startX !== null) onEnd(e.clientX); });
  scroll.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
  scroll.addEventListener('touchmove',  e => { if (startX !== null) onMove(e.touches[0].clientX); }, { passive: true });
  scroll.addEventListener('touchend',   e => { if (startX !== null) onEnd(e.changedTouches[0].clientX); });
}

async function selectFamily(fam) {
  state.selectedFamily          = fam;
  state.selectedLevel           = null;
  state.selectedLevelWordCount  = null;
  renderFamilyTabs();
  updateFooter();
  updateFamilyColor();
  document.getElementById('level-grid').innerHTML = '<div class="loading-msg">Chargement…</div>';
  state.levels = await gameService.getLevels(fam.id);
  renderLevelGrid();
}

// ── Levels ────────────────────────────────────────────────────────────────────

function renderLevelGrid() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  if (state.levels.length === 0) {
    grid.innerHTML = '<div class="loading-msg">Aucun niveau dans cette famille.</div>';
    return;
  }
  state.levels.filter(lvl => lvl.valid !== false).forEach(lvl => {
    const card = document.createElement('div');
    const isSelected = state.selectedLevel?.docId === lvl.docId;
    card.className = `level-card${isSelected ? ' selected' : ''}`;
    card.innerHTML = `
      ${lvl.image_path
        ? `<img class="level-card-img" src="${esc(lvl.image_path)}" alt="" loading="lazy">`
        : `<div class="level-card-img-ph">🖼</div>`}
      <div class="level-card-name">${esc(lvl.title || lvl.name)}</div>
      <div class="level-stars">★★★</div>
      ${isSelected ? `<button class="level-card-play" title="Jouer"><div class="level-card-play-icon">▶</div></button>` : ''}
    `;
    card.addEventListener('click', () => onLevelClick(lvl));
    if (isSelected) {
      card.querySelector('.level-card-play').addEventListener('click', e => {
        e.stopPropagation();
        launchGame(selectedMode);
      });
    }
    grid.appendChild(card);
  });
}

function onLevelClick(lvl) {
  if (state.selectedLevel?.docId === lvl.docId) {
    launchGame(selectedMode);
  } else {
    state.selectedLevel          = lvl;
    state.selectedLevelWordCount = null;
    renderLevelGrid();
    updateFooter();
    gameService.getWordCount(lvl.docId).then(count => {
      if (state.selectedLevel?.docId === lvl.docId) {
        state.selectedLevelWordCount = count;
        updateFooter();
      }
    }).catch(() => {});
  }
}

function updateFooter() {
  const empty = document.getElementById('footer-empty');
  const info  = document.getElementById('footer-info');

  if (!state.selectedLevel) {
    empty.classList.remove('hidden');
    info.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  info.classList.remove('hidden');
  document.getElementById('footer-name').textContent = state.selectedLevel.title || state.selectedLevel.name;

  const parts = [];
  if (state.selectedLevel.notes) parts.push(state.selectedLevel.notes);
  if (state.selectedLevelWordCount !== null)
    parts.push(`${state.selectedLevelWordCount} mot${state.selectedLevelWordCount !== 1 ? 's' : ''}`);
  document.getElementById('footer-sub').textContent = parts.join('  ·  ');
}

// ── Mode menu ─────────────────────────────────────────────────────────────────

const MODE_META = {
  learning: { icon: '📖', label: 'Apprentissage' },
  clicword: { icon: '👆', label: 'Find the word' },
  typeword: { icon: '⌨',  label: 'Type the word' },
  parmi3:   { icon: '🔤', label: 'Choose the word' },
};
let selectedMode = 'learning';

function updateModeBtn() {
  const m = MODE_META[selectedMode];
  document.getElementById('mode-menu-icon').textContent  = m.icon;
  document.getElementById('mode-menu-label').textContent = m.label;
  document.querySelectorAll('.mode-entry').forEach(el =>
    el.classList.toggle('active', el.dataset.mode === selectedMode)
  );
}

document.getElementById('mode-menu-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('mode-dropdown').classList.toggle('hidden');
});

document.querySelectorAll('.mode-entry').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedMode = btn.dataset.mode;
    updateModeBtn();
    document.getElementById('mode-dropdown').classList.add('hidden');
  });
});

document.addEventListener('click', e => {
  if (!document.getElementById('mode-menu').contains(e.target))
    document.getElementById('mode-dropdown').classList.add('hidden');
});

document.getElementById('chrono-toggle').addEventListener('click', () => {
  chronoEnabled = !chronoEnabled;
  document.getElementById('chrono-toggle').classList.toggle('on', chronoEnabled);
});

updateModeBtn();

// ── Launch ────────────────────────────────────────────────────────────────────

function launchGame(mode) {
  if (!state.selectedLevel) return;
  const p = new URLSearchParams({
    level:  state.selectedLevel.docId,
    mode,
    chrono: chronoEnabled ? '1' : '0',
    avatar: profileAvatarId,
    player: currentProfileData?.prenom || '',
  });
  window.location.href = `game.html?${p}`;
}

initCarouselDrag();

// ── Misc ──────────────────────────────────────────────────────────────────────

document.getElementById('close-btn').addEventListener('click', () => {
  if (window.history.length > 1) window.history.back(); else window.close();
});

// ── Help panel ────────────────────────────────────────────────────────────────

document.getElementById('help-version').textContent =
  `CliConVocabulary ${VERSION}` +
  (COMMIT_DATE !== '—' ? `  comit: ${COMMIT_DATE}` : '') +
  (COMMIT_HASH !== '—' ? `  num:${COMMIT_HASH}` : '');

document.getElementById('help-btn').addEventListener('click', () => {
  document.getElementById('help-overlay').classList.remove('hidden');
});
document.getElementById('help-close-btn').addEventListener('click', () => {
  document.getElementById('help-overlay').classList.add('hidden');
});
document.getElementById('help-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('help-overlay'))
    document.getElementById('help-overlay').classList.add('hidden');
});

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Start ─────────────────────────────────────────────────────────────────────

init();
