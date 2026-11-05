const SHELL = 'boosterz-shell-202611051557', RUNTIME = 'fichario-runtime-1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'views.js', 'desk.js', 'sync.js', 'social.js', 'help.js', 'access.js', 'photos.js', 'firebase-config.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/logo.webp', 'icons/logo-light.webp', 'icons/favicon-64.png', 'data/index.json', 'data/hashes.bin', 'data/set-logos.json', 'data/set-logos-pt.json', 'data/set-art.json', 'data/set-fan.json', 'data/species.json', 'data/catalog.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') (await caches.open(RUNTIME)).put(req, res.clone());
  return res;
}
// Arquivos do próprio app sempre conferem se há versão nova, em vez de confiar no cache do navegador.
const fresh = req => req.url.startsWith(self.location.origin)
  ? fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache', ...(req.mode === 'navigate' ? { credentials: 'same-origin' } : {}) })
  : fetch(req);
async function networkFirst(req) {
  try {
    const res = await fresh(req);
    if (res.ok) (await caches.open(req.url.startsWith(self.location.origin) ? SHELL : RUNTIME)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const { hostname } = new URL(e.request.url);
  // Login e Firestore usam conexões longas: passam direto, sem cache.
  if (/(^|\.)(googleapis\.com|firebaseapp\.com|google\.com)$/.test(hostname) && hostname !== 'fonts.googleapis.com') return;
  const stable = hostname === 'assets.tcgdex.net' || hostname === 'cdn.jsdelivr.net' || hostname === 'fonts.gstatic.com' || hostname === 'www.gstatic.com' || hostname === 'tessdata.projectnaptha.com';
  e.respondWith(stable ? cacheFirst(e.request) : networkFirst(e.request));
});
