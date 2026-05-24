// index.js — CliConVocabulary level browser

const VERSION     = 'v0.2.5';
const COMMIT_HASH = '8f360f5';
const COMMIT_DATE = '2026-05-24 08:01 +0200';
console.log('%cCliConVocabulary ' + VERSION, 'color:#6c5ce7;font-weight:bold;font-size:14px');

const state = {
  families:       [],
  selectedFamily: null,
  levels:         [],
  selectedLevel:  null,
};
let chronoEnabled = false;

// ── Auth ──────────────────────────────────────────────────────────────────────

window.onGameAuthChanged = async (user) => {
  const ddInfo      = document.getElementById('auth-dd-info');
  const ddSignin    = document.getElementById('auth-signin-section');
  const ddConnected = document.getElementById('auth-connected-section');
  const ddEditor    = document.getElementById('auth-editor-link');

  if (user) {
    ddInfo.textContent = user.email || user.displayName || 'Connecté';
    ddInfo.classList.remove('hidden');
    ddSignin.classList.add('hidden');
    ddConnected.classList.remove('hidden');
    ddEditor.classList.remove('hidden');
  } else {
    ddInfo.classList.add('hidden');
    ddSignin.classList.remove('hidden');
    ddConnected.classList.add('hidden');
    ddEditor.classList.add('hidden');
  }
};

// Auth dropdown toggle
document.getElementById('auth-menu-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('auth-dropdown').classList.toggle('hidden');
});
document.addEventListener('click', () => document.getElementById('auth-dropdown').classList.add('hidden'));
document.getElementById('auth-dropdown').addEventListener('click', e => e.stopPropagation());

document.getElementById('dd-login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('dd-login-btn');
  btn.disabled = true; btn.textContent = '…';
  document.getElementById('dd-error').textContent = '';
  try {
    await gameService.signIn(
      document.getElementById('dd-email').value.trim(),
      document.getElementById('dd-pw').value
    );
    document.getElementById('auth-dropdown').classList.add('hidden');
  } catch(err) {
    document.getElementById('dd-error').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Connexion';
  }
});

document.getElementById('dd-google-btn').addEventListener('click', async () => {
  document.getElementById('dd-error').textContent = '';
  try {
    await gameService.signInWithGoogle();
    document.getElementById('auth-dropdown').classList.add('hidden');
  } catch(err) {
    document.getElementById('dd-error').textContent = err.message;
  }
});

document.getElementById('dd-logout-btn').addEventListener('click', async () => {
  await gameService.signOut();
  document.getElementById('auth-dropdown').classList.add('hidden');
});

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
