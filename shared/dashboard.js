// shared/dashboard.js — Tableau de bord superviseur : coquille (auth + navigation par onglets)
// Requires: firebase-core.js, platform-methods.js loaded before.
// Contenu de chaque onglet chargé dynamiquement depuis shared/dashboard/<module>.js

const VERSION = 'v0.6.11';
console.log('%cDashboard ' + VERSION, 'color:#6c5ce7;font-weight:bold;font-size:14px');

const _game = new URLSearchParams(location.search).get('game');

const TABS = [
  { key: 'general', icon: '⚙️', label: 'Général',                 scope: 'all',  src: 'dashboard/general-settings.js', render: 'renderGeneralSettings' },
  { key: 'users',    icon: '👤', label: 'Gestion utilisateurs',     scope: 'all',  src: 'dashboard/users-manager.js',    render: 'renderUsersManager' },
  { key: 'levels',   icon: '🗂️', label: 'Gestionnaire de niveaux', scope: 'game', src: 'dashboard/levels-manager.js',   render: 'renderLevelsManager' },
  { key: 'access',   icon: '🔓', label: 'Accès aux niveaux',        scope: 'game', src: 'dashboard/access-levels.js',    render: 'renderAccessLevels' },
  { key: 'stats',    icon: '📊', label: 'Statistiques',             scope: 'all',  src: 'dashboard/statistics.js',       render: 'renderStatistics' },
].filter(t => t.scope === 'all' || _game);

const _loadedModules = new Set();
let activeTab = TABS[0].key;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    // Cache-busting systématique : les modules d'onglet n'ont pas de VERSION propre
    // à vérifier en console (contrairement à shared/index.js/game.js), donc on force
    // un fetch réseau frais à chaque chargement plutôt que de risquer une copie servie
    // par le cache HTTP ou le Service Worker (voir sw.js).
    s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
    s.onload = res;
    s.onerror = () => rej(new Error('Impossible de charger : ' + src));
    document.head.appendChild(s);
  });
}

function _homeHref() {
  return _game ? '../' + _game + '/index.html' : '../index.html';
}

// Charge une fois editor-platform-methods.js + ../<game>/editor-firebase-service.js pour
// obtenir GAME_ID + editorService (déclare un `const GAME_ID` global — ne jamais charger
// aussi firebase-service.js sur la même page, la redéclaration ferait planter le script).
// Superset de ce que fournirait firebase-service.js : couvre à la fois "Accès aux niveaux"
// (getFamilies/getAllLevels/getDifficulties via _platformMethods) et "Gestionnaire de niveaux".
let _editorServicePromise = null;
function ensureEditorService(game) {
  if (!_editorServicePromise) {
    _editorServicePromise = loadScript('editor-platform-methods.js')
      .then(() => loadScript('../' + game + '/editor-firebase-service.js'));
  }
  return _editorServicePromise;
}

// ── Auth gate ──────────────────────────────────────────────────────────────
// La reauth n'est redemandée qu'une fois par session d'onglet (sessionStorage) : une fois
// confirmée, revenir sur dashboard.html (ex. depuis editor.html via "Retour") ne la redemande
// plus. Effacée à la déconnexion pour éviter qu'un autre profil en hérite dans le même onglet.

const _REAUTH_KEY = 'dashboard_reauth_ok';

window.onAuthChanged = function (user) {
  if (!user) {
    sessionStorage.removeItem(_REAUTH_KEY);
    location.href = _homeHref();
    return;
  }
  if (sessionStorage.getItem(_REAUTH_KEY) === user.uid) enterDashboard();
  else showReauthGate();
};

function showReauthGate() {
  document.getElementById('db-auth-screen').classList.remove('hidden');
  document.getElementById('db-app').classList.add('hidden');
  document.getElementById('reauth-password').value = '';
  document.getElementById('reauth-error').textContent = '';
  const provider = _platformMethods.getSupervisorProvider();
  document.getElementById('reauth-google-btn').classList.toggle('visible', provider === 'google.com');
}

document.getElementById('reauth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pw    = document.getElementById('reauth-password').value.trim();
  const errEl = document.getElementById('reauth-error');
  errEl.textContent = '';
  if (!pw) { errEl.textContent = 'Entrez votre mot de passe.'; return; }
  const btn = document.getElementById('reauth-btn');
  btn.disabled = true;
  try {
    await _platformMethods.reauthWithPassword(pw);
    sessionStorage.setItem(_REAUTH_KEY, _currentUser.uid);
    enterDashboard();
  } catch (err) {
    errEl.textContent =
      err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
        ? 'Mot de passe incorrect.' : 'Erreur d\'authentification.';
  } finally { btn.disabled = false; }
});

document.getElementById('reauth-google-btn').addEventListener('click', async () => {
  const btn = document.getElementById('reauth-google-btn');
  btn.disabled = true;
  try {
    await _platformMethods.reauthWithGoogle();
    sessionStorage.setItem(_REAUTH_KEY, _currentUser.uid);
    enterDashboard();
  } catch (err) {
    document.getElementById('reauth-error').textContent = 'Erreur Google.';
  } finally { btn.disabled = false; }
});

document.getElementById('reauth-cancel-btn').addEventListener('click', () => {
  location.href = _homeHref();
});

// ── Dashboard ──────────────────────────────────────────────────────────────

function enterDashboard() {
  document.getElementById('db-auth-screen').classList.add('hidden');
  document.getElementById('db-app').classList.remove('hidden');
  document.getElementById('db-home-link').href = _homeHref();
  document.getElementById('db-title').textContent = 'Tableau de bord ' + VERSION;
  renderSidebar();
  selectTab(activeTab);
}

function renderSidebar() {
  const sidebar = document.getElementById('db-sidebar');
  sidebar.innerHTML = TABS.map(t => `
    <button class="db-tab${t.key === activeTab ? ' active' : ''}" data-tab="${t.key}">
      <span class="db-tab-icon">${t.icon}</span><span>${t.label}</span>
    </button>
  `).join('');
  sidebar.querySelectorAll('.db-tab').forEach(btn =>
    btn.addEventListener('click', () => selectTab(btn.dataset.tab))
  );
}

async function selectTab(key) {
  activeTab = key;
  document.querySelectorAll('.db-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === key)
  );
  const container = document.getElementById('db-content');
  container.innerHTML = '<p class="tab-placeholder">Chargement…</p>';
  const tab = TABS.find(t => t.key === key);
  try {
    if (!_loadedModules.has(key)) {
      await loadScript(tab.src);
      _loadedModules.add(key);
    }
    window[tab.render](container, { game: _game });
  } catch (e) {
    console.error(e);
    container.innerHTML = '<p class="tab-placeholder">Erreur de chargement de la section.</p>';
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

if (_authResolved) window.onAuthChanged(_currentUser);
