// shared/firebase-core.js — Firebase init, auth, db, current user
// Loaded before any game or editor service file.

// Capturé en tout premier : document.currentScript ne reste valide que pendant
// l'exécution synchrone de ce script (redevient null après, y compris dans un .then()).
const _scriptSrc = document.currentScript ? document.currentScript.src : null;

const firebaseConfig = {
  apiKey:            'AIzaSyDz1xCHbgqWsmhp1H5bia8smICmjBbi3uc',
  authDomain:        'ludoedu-fea1d.firebaseapp.com',
  projectId:         'ludoedu-fea1d',
  storageBucket:     'ludoedu-fea1d.firebasestorage.app',
  messagingSenderId: '595877165459',
  appId:             '1:595877165459:web:8e0fbd53344e3d7f899066',
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// Persistence offline (cache IndexedDB) — best-effort : échoue si plusieurs onglets
// ouverts (failed-precondition) ou navigateur non supporté (unimplemented, ex:
// navigation privée Safari). Couvre levels/words/rules/families une fois lus au
// moins une fois ; ne couvre PAS les binaires Storage, voir sw.js.
// Log volontaire (pas de catch silencieux) tant que ce mécanisme est en cours de
// validation — permet de diagnostiquer un échec plutôt que de deviner.
db.enablePersistence()
  .then(() => console.log('%c[persistence] activée', 'color:#2ecc71'))
  .catch(err => console.warn('[persistence] échec :', err.code, err.message));

// Service Worker — cache les assets Firebase Storage (images/audio) pour le hors-ligne.
// sw.js vit à la racine du site (pas dans shared/) pour pouvoir contrôler toutes les
// pages (jeux inclus). Racine calculée depuis l'URL réelle de CE script pour rester
// correcte que le site soit servi à la racine ou sous un sous-chemin (GitHub Pages
// project page, ex: /ludoedu/) — ne jamais hardcoder '/sw.js'.
if ('serviceWorker' in navigator && _scriptSrc) {
  const _root = _scriptSrc.replace(/shared\/firebase-core\.js.*$/, '');
  navigator.serviceWorker.register(_root + 'sw.js', { scope: _root })
    .then(reg => console.log('%c[sw] enregistré, scope=' + reg.scope, 'color:#2ecc71'))
    .catch(err => console.warn('[sw] échec :', err));
}

let _currentUser  = null;
let _authResolved = false;

auth.onAuthStateChanged(user => {
  _currentUser  = user;
  _authResolved = true;
  if (typeof window.onAuthChanged === 'function') window.onAuthChanged(user);
});
