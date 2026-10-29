// Offline support: serve from cache, refresh in the background (stale-while-revalidate).
const CACHE = 'medici-v1';
const CORE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'vendor/three.module.min.js',
  'src/main.js', 'src/game.js', 'src/data.js', 'src/models.js', 'src/render.js', 'src/ui.js', 'src/audio.js', 'src/cloud.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
