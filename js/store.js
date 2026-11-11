// ALVéON PRIVÉ — local-first store (localStorage). Nothing leaves the device except Gemini calls.
import { DEFAULT_PLAN, computeXP, levelInfo, MUSCLES } from './data.js';

const KEY = 'alveon.prive.v1';

const defaults = () => ({
  v: 1,
  onboarded: false,
  profile: {
    name: 'Alph', weight: null, kcal: 2800, protein: 150, carbs: 340, fat: 80,
    water: 3000, restSec: 90,
    equipment: 'Home: dumbbells (adjustable handles + plates, about 22 kg total). Outdoors: pull-up bar and dips, bodyweight only.',
    days: 6,
  },
  settings: {
    apiKey: '',
    model: 'gemini-2.5-flash',
    remind: { enabled: false, meals: ['08:00', '12:30', '16:30', '20:00'], train: '17:30', fired: {}, push: { on: false, server: 'https://ntfy.sh', topic: '', sent: {}, last: 0 } },
  },
  plan: DEFAULT_PLAN,
  workouts: [],
  meals: [],
  water: {},
  weights: [],
  chat: [],
});

let state = defaults();
const subs = new Set();
let timer = null;

function merge(base, extra) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const k of Object.keys(extra || {})) {
    out[k] = k in base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], extra[k]) : extra[k];
  }
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? merge(defaults(), JSON.parse(raw)) : defaults();
  } catch { state = defaults(); }
  return state;
}
export const get = () => state;

export function update(fn) {
  fn(state);
  xpCache = null;
  persistSoon();
  subs.forEach(f => f(state));
}
export const subscribe = f => (subs.add(f), () => subs.delete(f));

function persistSoon() {
  clearTimeout(timer);
  timer = setTimeout(persist, 250);
}
export function persist() {
  const write = () => localStorage.setItem(KEY, JSON.stringify(state));
  try { write(); } catch {
    // quota: drop oldest meal thumbnails first
    const withThumb = state.meals.filter(m => m.thumb).sort((a, b) => a.ts - b.ts);
    for (const m of withThumb.slice(0, Math.max(5, withThumb.length >> 1))) delete m.thumb;
    try { write(); } catch { /* give up silently */ }
  }
}
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist());

// ---------- helpers
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const weekdayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // Mon=0

// ---------- selectors
export const mealsOn = key => state.meals.filter(m => dateKey(new Date(m.ts)) === key).sort((a, b) => a.ts - b.ts);
export function totalsOn(key) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const m of mealsOn(key)) { t.kcal += +m.kcal || 0; t.p += +m.p || 0; t.c += +m.c || 0; t.f += +m.f || 0; }
  return t;
}
export const waterOn = key => state.water[key] || 0;

let xpCache = null;
export function muscleStats() {
  if (!xpCache) {
    const raw = computeXP(state.workouts);
    xpCache = {};
    for (const m of Object.keys(MUSCLES)) xpCache[m] = { ...levelInfo(raw[m].xp), last: raw[m].last };
  }
  return xpCache;
}
export function physiqueIndex() {
  const s = muscleStats();
  const ms = Object.values(s);
  return Math.round((ms.reduce((a, m) => a + m.frac, 0) / ms.length / 5) * 100);
}
export function workoutDates() { return new Set(state.workouts.map(w => w.key)); }
export function streak() {
  const days = workoutDates();
  let n = 0; const d = new Date();
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  // rest days (plan) do not break the streak
  for (let i = 0; i < 400; i++) {
    const k = dateKey(d);
    const planned = state.plan.days[weekdayIdx(d)];
    if (days.has(k)) n++;
    else if (!(planned && planned.rest)) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export function lastPerf(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const e = state.workouts[i].exercises.find(x => x.id === exId);
    if (e && e.sets.length) {
      return e.sets.reduce((best, s) => ((+s.w || 0) * (+s.r || 0) >= (+best.w || 0) * (+best.r || 0) ? s : best), e.sets[0]);
    }
  }
  return null;
}
export function exportData() { return JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '' } }, null, 2); }
export function importData(json) {
  const incoming = JSON.parse(json);
  if (!incoming || typeof incoming !== 'object' || !('plan' in incoming)) throw new Error('Not an ALVéON backup');
  const key = state.settings.apiKey;
  state = merge(defaults(), incoming);
  state.settings.apiKey = key;
  xpCache = null; persist(); subs.forEach(f => f(state));
}
export function resetAll() {
  state = defaults(); xpCache = null; persist();
  localStorage.removeItem('alveon.session');
}
