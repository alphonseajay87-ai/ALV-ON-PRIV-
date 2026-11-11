import { load, get } from './store.js';
import { $, $$, icon } from './ui.js';
import { todayView } from './v-today.js';
import { trainView } from './v-train.js';
import { fuelView } from './v-fuel.js';
import { bodyView } from './v-body.js';
import { coachView } from './v-coach.js';
import { openSettings } from './v-settings.js';
import { startReminders } from './reminders.js';

load();

const TABS = [
  { id: 'today', label: 'Today', fn: todayView },
  { id: 'train', label: 'Train', fn: trainView },
  { id: 'fuel', label: 'Fuel', fn: fuelView },
  { id: 'body', label: 'Body', fn: bodyView },
  { id: 'coach', label: 'Coach', fn: coachView },
];

const app = $('#app');
app.innerHTML = `<main class="view" id="view"></main>
<nav class="tabs" aria-label="Primary">${TABS.map(t => `<a href="#${t.id}" data-t="${t.id}">${icon(t.id)}<span>${t.label}</span></a>`).join('')}</nav>`;

function route() {
  const id = (location.hash.match(/#(\w+)/) || [])[1] || 'today';
  const tab = TABS.find(t => t.id === id) || TABS[0];
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === tab.id));
  const old = $('#view');
  const el = document.createElement('main');
  el.className = 'view'; el.id = 'view';
  old.replaceWith(el);
  window.scrollTo(0, 0);
  try { tab.fn(el); } catch (e) { console.error(e); el.innerHTML = `<p class="muted pad">Something went wrong loading this screen.</p>`; }
}
window.addEventListener('hashchange', route);
route();

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
  if (!get().onboarded) openSettings({ welcome: true });
}
if (skipSplash || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  splash?.remove(); afterSplash();
} else {
  splash.addEventListener('click', endSplash);
  setTimeout(endSplash, 3900);
}

startReminders();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
