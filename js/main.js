// ALVéON PRIVÉ — app shell: routing with transitions, error boundary, offline indicator, update flow, first run.
import { load, get, takeRecovery, requestPersistence, clearPhotos } from './store.js';
import { $, $$, icon, toast, openSheet, errorState, esc } from './ui.js';
import { todayView } from './v-today.js';
import { trainView } from './v-train.js';
import { fuelView } from './v-fuel.js';
import { bodyView } from './v-body.js';
import { coachView } from './v-coach.js';
import { openSettings } from './v-settings.js';
import { openOnboarding } from './onboarding.js';
import { startReminders } from './reminders.js';
import { getSession } from './session.js';

load();

const TABS = [
  { id: 'today', label: 'Today', fn: todayView },
  { id: 'train', label: 'Train', fn: trainView },
  { id: 'fuel', label: 'Fuel', fn: fuelView },
  { id: 'body', label: 'Body', fn: bodyView },
  { id: 'coach', label: 'Coach', fn: coachView },
];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const app = $('#app');
app.innerHTML = `<main class="view" id="view" tabindex="-1"></main>
<nav class="tabs" aria-label="Primary">${TABS.map(t => `<a href="#${t.id}" data-t="${t.id}">${icon(t.id)}<span>${t.label}</span></a>`).join('')}</nav>`;

// ---------- routing: every view renders inside an error boundary, with a direction-aware transition
let current = null, routeToken = 0, firstRoute = true;

/** Run a view; if it throws, show a calm error state with a retry instead of a blank screen. */
function mountView(tab, el) {
  try { tab.fn(el); }
  catch (e) {
    console.error(`[${tab.id}]`, e);
    el.innerHTML = errorState('This screen could not load. Your data is safe.');
    $('[data-retry]', el)?.addEventListener('click', () => { el.innerHTML = ''; mountView(tab, el); });
  }
}

function route({ keepScroll = false } = {}) {
  const id = (location.hash.match(/#(\w+)/) || [])[1] || 'today';
  const tab = TABS.find(t => t.id === id) || TABS[0];
  const dir = current ? Math.sign(TABS.indexOf(tab) - TABS.indexOf(current)) : 0;
  const same = current === tab;
  current = tab;
  document.title = `${tab.label} · ALVéON PRIVÉ`;
  $$('.tabs a').forEach(a => { const on = a.dataset.t === tab.id; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  const token = ++routeToken, y = window.scrollY;
  const swap = () => {
    if (token !== routeToken) return; // a newer navigation superseded this one
    const el = document.createElement('main');
    el.className = 'view' + (!reduced() && !firstRoute && !same ? (dir < 0 ? ' enter-l' : ' enter-r') : '');
    el.id = 'view'; el.tabIndex = -1;
    $('#view').replaceWith(el);
    keepScroll ? window.scrollTo(0, y) : window.scrollTo(0, 0);
    mountView(tab, el);
    if (!firstRoute && !same && !keepScroll) { try { el.focus({ preventScroll: true }); } catch { /* ignore */ } }
    firstRoute = false;
  };
  const old = $('#view');
  if (!firstRoute && !same && !reduced() && old) { old.classList.add('leave'); setTimeout(swap, 130); } else swap();
}
window.addEventListener('hashchange', () => route());
window.addEventListener('alveon:rerender', () => route({ keepScroll: true }));
window.addEventListener('alveon:external', () => { if (!document.querySelector('.sheet-wrap') && !document.querySelector('.session')) route({ keepScroll: true }); });
route();

// ---------- global safety net: one bad handler must never leave the app unusable
let lastErr = 0;
const oops = e => {
  console.error(e.error || e.reason || e);
  const view = $('#view');
  if (view && !view.firstElementChild) { view.innerHTML = errorState('Something went wrong. Your data is safe.'); $('[data-retry]', view)?.addEventListener('click', () => route({ keepScroll: true })); }
  if (Date.now() - lastErr > 8000) { lastErr = Date.now(); toast('Something went wrong. Your data is safe.'); }
};
window.addEventListener('error', oops);
window.addEventListener('unhandledrejection', oops);

// ---------- connectivity
const net = document.createElement('div');
net.id = 'net'; net.className = 'net'; net.setAttribute('role', 'status'); net.hidden = true;
net.innerHTML = '<i></i><span>Offline · everything still works except the coach</span>';
document.body.appendChild(net);
const setNet = () => { const off = navigator.onLine === false; net.hidden = !off; document.body.classList.toggle('offline', off); };
window.addEventListener('online', () => { setNet(); toast('Back online'); });
window.addEventListener('offline', setNet);
setNet();

// ---------- storage health (full disk, trimmed data) surfaced in plain words
window.addEventListener('alveon:storage', e => {
  const d = e.detail || {};
  if (d.level === 'warn') toast('Storage is nearly full. Free space by removing saved photos.', 8000, { label: 'Free space', fn: () => toast(`Removed ${clearPhotos()} photos. Your data is untouched.`) });
  else if (d.level === 'trimmed') toast(`Storage was full, so I removed ${d.note}. Your workouts and meals are safe.`, 7000);
  else if (d.level === 'error') toast('Could not save: storage is full. Export a backup in Settings.', 12000, { label: 'Settings', fn: () => openSettings() });
});

// ---------- splash
const splash = $('#splash');
const skipSplash = new URLSearchParams(location.search).has('nosplash');
function endSplash() {
  if (!splash || splash.dataset.done) return;
  splash.dataset.done = '1';
  splash.classList.add('out');
  setTimeout(() => { splash.remove(); afterSplash(); }, 750);
}
function afterSplash() {
  const rec = takeRecovery();
  if (rec) return recoveryNotice(rec);
  if (!get().onboarded) openOnboarding();
  else if (getSession()) toast('You have a session in progress.', 5000, { label: 'Open Train', fn: () => { location.hash = '#train'; } });
}
function recoveryNotice(rec) {
  openSheet({
    title: rec.from === 'backup' ? 'We restored your data' : 'Saved data could not be read',
    body: `<p class="muted pad-b">${rec.from === 'backup'
      ? `Your saved data was damaged, so ALVéON restored the automatic backup from ${esc(new Date(rec.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}. Anything logged after that point may be missing, and your Gemini key needs to be entered again.`
      : 'Your saved data was damaged and no backup was available, so the app is starting fresh. A copy of the damaged data was kept on this device in case it can be recovered.'}</p><button class="btn primary block" id="ok">Continue</button>`,
    onMount: (el, sh) => { $('#ok', el).onclick = sh.close; },
    onClose: () => { if (!get().onboarded) openOnboarding(); },
  });
}
if (skipSplash || reduced()) { splash?.remove(); afterSplash(); }
else {
  splash.addEventListener('click', endSplash);
  const LINES = [
    ['What stands in the way becomes the way.', 'Marcus Aurelius'],
    ['Difficulties strengthen the mind, as labor does the body.', 'Seneca'],
    ['Fortune favors the bold.', 'Virgil'],
    ['Come and take them.', 'Leonidas of Sparta'],
    ['I came, I saw, I conquered.', 'Julius Caesar'],
  ];
  const [qt, qa] = LINES[Math.floor(Math.random() * LINES.length)];
  $('.sp-tag', splash).textContent = qt; $('.sp-by', splash).textContent = qa;
  const dust = $('.sp-dust', splash);
  if (dust) for (let i = 0; i < 18; i++) { const e = document.createElement('i'); e.style.cssText = `--x:${Math.random() * 100}%;--s:${(1 + Math.random() * 1.6).toFixed(1)}px;--d:${(6 + Math.random() * 5).toFixed(1)}s;--t:${(Math.random() * 3).toFixed(1)}s;--o:${(0.25 + Math.random() * 0.35).toFixed(2)}`; dust.appendChild(e); }
  setTimeout(endSplash, 7300);
}

startReminders();
requestPersistence();

// ---------- service worker: register, fill the offline cache from what the page really loaded, offer updates
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => toast('A new version of ALVéON is ready.', 12000, { label: 'Update', fn: () => w.postMessage({ type: 'SKIP_WAITING' }) });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    const check = () => { if (navigator.onLine !== false) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    setInterval(check, 60 * 60 * 1000);
    navigator.serviceWorker.ready.then(r => {
      const urls = performance.getEntriesByType('resource').map(x => x.name).filter(n => n.startsWith(location.origin));
      r.active?.postMessage({ type: 'CACHE_URLS', urls: [...new Set([...urls, location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html'])] });
    });
  }).catch(() => {});
}
