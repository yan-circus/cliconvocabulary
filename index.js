// index.js — CliConVocabulary level browser

const VERSION     = 'v0.2.6';
const COMMIT_HASH = '8f293df';
const COMMIT_DATE = '2026-05-24 08:04 +0200';
console.log('%cCliConVocabulary ' + VERSION, 'color:#6c5ce7;font-weight:bold;font-size:14px');

const state = {
  families:       [],
  selectedFamily: null,
  levels:         [],
  selectedLevel:  null,
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

function renderFamilyTabs() {
  const scroll = document.getElementById('family-tabs-scroll');
  scroll.innerHTML = '';
  state.families.forEach(fam => {
    const tab = document.createElement('button');
    tab.className = `family-tab${fam.docId === state.selectedFamily?.docId ? ' active' : ''}`;
    tab.textContent = fam.name;
    tab.addEventListener('click', () => selectFamily(fam));
    scroll.appendChild(tab);
  });
}

async function selectFamily(fam) {
  state.selectedFamily = fam;
  state.selectedLevel  = null;
  renderFamilyTabs();
  updateFooter();
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
  state.levels.forEach((lvl, idx) => {
    const card = document.createElement('div');
    card.className = `level-card${state.selectedLevel?.docId === lvl.docId ? ' selected' : ''}`;
    card.innerHTML = `
      <div class="level-num">${idx + 1}</div>
      ${lvl.image_path
        ? `<img class="level-card-img" src="${esc(lvl.image_path)}" alt="" loading="lazy">`
        : `<div class="level-card-img-ph">🖼</div>`}
      <div class="level-card-name">${esc(lvl.title || lvl.name)}</div>
    `;
    card.addEventListener('click', () => onLevelClick(lvl));
    grid.appendChild(card);
  });
}

function onLevelClick(lvl) {
  if (state.selectedLevel?.docId === lvl.docId) {
    openLaunchPanel();
  } else {
    state.selectedLevel = lvl;
    renderLevelGrid();
    updateFooter();
  }
}

function updateFooter() {
  const empty   = document.getElementById('footer-empty');
  const info    = document.getElementById('footer-info');
  const playBtn = document.getElementById('footer-play-btn');

  if (!state.selectedLevel) {
    empty.classList.remove('hidden');
    info.classList.add('hidden');
    playBtn.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  info.classList.remove('hidden');
  playBtn.classList.remove('hidden');
  document.getElementById('footer-name').textContent = state.selectedLevel.title || state.selectedLevel.name;
  document.getElementById('footer-sub').textContent  = state.selectedFamily?.name || '';
}

// ── Launch panel ──────────────────────────────────────────────────────────────

function openLaunchPanel() {
  if (!state.selectedLevel) return;
  const lvl = state.selectedLevel;
  document.getElementById('launch-title').textContent = lvl.title || lvl.name;
  document.getElementById('launch-sub').textContent   = state.selectedFamily?.name || '';
  document.getElementById('launch-overlay').classList.remove('hidden');
}

function closeLaunchPanel() {
  document.getElementById('launch-overlay').classList.add('hidden');
}

document.getElementById('footer-play-btn').addEventListener('click', openLaunchPanel);
document.getElementById('launch-cancel-btn').addEventListener('click', closeLaunchPanel);
document.getElementById('launch-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('launch-overlay')) closeLaunchPanel();
});

document.getElementById('chrono-toggle').addEventListener('click', () => {
  chronoEnabled = !chronoEnabled;
  document.getElementById('chrono-toggle').classList.toggle('on', chronoEnabled);
  document.getElementById('chrono-label').textContent = chronoEnabled ? 'On' : 'Off';
});

document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => launchGame(btn.dataset.mode));
});

function launchGame(mode) {
  if (!state.selectedLevel) return;
  const p = new URLSearchParams({
    level:  state.selectedLevel.docId,
    mode,
    chrono: chronoEnabled ? '1' : '0',
  });
  window.location.href = `game.html?${p}`;
}

// ── Tab scroll arrows ─────────────────────────────────────────────────────────

document.getElementById('tabs-prev').addEventListener('click', () => {
  document.getElementById('family-tabs-scroll').scrollBy({ left: -160, behavior: 'smooth' });
});
document.getElementById('tabs-next').addEventListener('click', () => {
  document.getElementById('family-tabs-scroll').scrollBy({ left: 160, behavior: 'smooth' });
});

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
