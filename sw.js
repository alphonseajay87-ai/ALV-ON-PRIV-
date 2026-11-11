// ALVéON PRIVÉ — offline shell. Bump VERSION on every deploy.
const VERSION = 'alveon-v2';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'assets/logo.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/main.js', 'js/data.js', 'js/store.js', 'js/ui.js', 'js/ai.js', 'js/musclemap.js', 'js/session.js',
  'js/reminders.js', 'js/v-today.js', 'js/v-train.js', 'js/v-fuel.js', 'js/v-body.js', 'js/v-coach.js', 'js/v-settings.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname === 'generativelanguage.googleapis.com') return;
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  // stale-while-revalidate: instant load, quietly refresh in the background
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
