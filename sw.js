// sw.js — cache runtime pour le mode hors-ligne. Portée : racine du site (placé ici
// volontairement pour couvrir shared/ ET tous les dossiers de jeux — un SW ne peut
// pas contrôler des pages en dehors du dossier où il vit).
//
// Deux stratégies selon le type de ressource :
// - Storage Firebase (images/audio, firebasestorage.googleapis.com) : cache-first.
//   Contenu immuable une fois créé pour un niveau donné, pas de risque de staleness.
// - App shell (fichiers du site) + SDK Firebase (www.gstatic.com) : network-first,
//   secours sur le cache seulement si offline. Respecte le cache-busting par VERSION
//   déjà en place dans le projet (shared/index.js, game.js...) — en ligne, toujours
//   le code le plus frais ; hors-ligne, la dernière version connue.
//
// Le reste (Firestore, Auth API...) n'est jamais intercepté — la persistence
// Firestore (voir shared/firebase-core.js) gère son propre cache indépendamment.
// Seules les requêtes GET sont interceptées : Cache.put() lève une exception sur
// une requête non-GET, ce qui casserait les uploads (PUT/POST) vers Storage.

const RUNTIME_CACHE = 'ludoedu-runtime-v2';
const STORAGE_HOST  = 'firebasestorage.googleapis.com';
const CDN_HOST       = 'www.gstatic.com';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== RUNTIME_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cache  = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // response.ok est toujours false pour une réponse opaque (cross-origin no-cors,
  // cas de firebasestorage.googleapis.com) même en cas de succès réel.
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    // response.ok est toujours false pour une réponse opaque (cross-origin no-cors,
    // ex: gstatic.com/firebasestorage.googleapis.com) même en cas de succès réel.
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // ne jamais intercepter uploads/écritures

  const url         = new URL(event.request.url);
  const isStorage    = url.hostname === STORAGE_HOST;
  const isAppOrCdn    = url.origin === self.location.origin || url.hostname === CDN_HOST;

  if (isStorage)      event.respondWith(cacheFirst(event.request));
  else if (isAppOrCdn) event.respondWith(networkFirst(event.request));
  // tout le reste (Firestore, Auth...) : pas de respondWith, comportement réseau normal
});
