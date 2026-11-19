// ALVéON PRIVÉ — service worker. Bump VERSION on every deploy.
//
// Strategy (why it is robust):
//  · precache only a tiny CORE, best-effort (allSettled) — one missing file can never break installation;
//  · the page reports everything it actually loaded (CACHE_URLS), so the offline cache fills itself and cannot drift from the code;
//  · code (html/js/css/json) is network-first with a short timeout, then cache — you never run a mix of old and new files while online;
//  · images and fonts are cache-first;
//  · a new worker WAITS; the app shows "Update ready" and sends SKIP_WAITING when you tap it.
const VERSION = 'alveon-v14';
const CORE = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'js/main.js', 'icons/icon-192.png'];
const NET_TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(CORE.map(u => cache.add(u)));
    if (!self.registration.active) self.skipWaiting(); // first install: nothing to protect, activate now
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  else if (d.type === 'CACHE_URLS' && Array.isArray(d.urls)) {
    e.waitUntil((async () => {
      const cache = await caches.open(VERSION);
      await Promise.allSettled(d.urls.filter(u => { try { return new URL(u, location.href).origin === location.origin; } catch { return false; } }).map(async u => {
        if (await cache.match(u)) return;
        const res = await fetch(u); if (res.ok) await cache.put(u, res);
      }));
    })());
  } else if (d.type === 'VERSION') e.source?.postMessage({ type: 'VERSION', version: VERSION });
});

const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
const okish = r => r && (r.ok || r.type === 'opaque');

async function networkFirst(req, fallbackKey) {
  const cache = await caches.open(VERSION);
  try {
    const res = await timeout(fetch(req), NET_TIMEOUT);
    if (okish(res)) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (fallbackKey && (await cache.match(fallbackKey))) || Response.error();
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (okish(res)) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const same = url.origin === location.origin;
  const font = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return; // Gemini, ntfy and everything else go straight to the network
  if (font) return e.respondWith(cacheFirst(req));
  if (req.mode === 'navigate') return e.respondWith(networkFirst(req, 'index.html'));
  if (/\.(?:js|css|json|webmanifest|html)$/.test(url.pathname) || url.pathname.endsWith('/')) return e.respondWith(networkFirst(req));
  e.respondWith(cacheFirst(req));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
