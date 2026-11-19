// ALVéON PRIVÉ — local-first store (localStorage). Nothing leaves the device except Gemini calls.
//
// Guarantees:
//  · every load is migrated to the current SCHEMA and sanitised, so views can trust the shape of the data;
//  · unreadable data is never silently replaced: it is copied aside and the last good backup is restored;
//  · a full disk degrades gracefully (thumbnails → old chat → …) and the user is told;
//  · imports are validated and can merge instead of replace.
import { DEFAULT_PLAN, computeXP, levelInfo, MUSCLES, EX } from './data.js';
import { dateKey, keyToDate, weekdayIdx, isKey } from './dates.js';
export { dateKey, keyToDate, weekdayIdx };

export const SCHEMA = 2;
const KEY = 'alveon.prive.v1'; // key name kept from v1 so existing data carries over
const BAK = KEY + '.bak';      // rolling daily snapshot (no photos, short chat)
const BAD = KEY + '.corrupt';  // raw copy of anything we could not parse
export const SESSION_KEY = 'alveon.session';

// ---------- small validators
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0, lo = -Infinity, hi = Infinity) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = v => v === true;
const clone = o => JSON.parse(JSON.stringify(o));
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const THUMB = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const safeId = v => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : uid());
const safeThumb = v => (typeof v === 'string' && v.length < 90000 && THUMB.test(v) ? v : undefined);
const isoOrNull = v => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const muscleKeys = a => (Array.isArray(a) ? a.filter(k => k in MUSCLES) : []);

// ---------- shape
const defaults = () => ({
  v: SCHEMA,
  onboarded: false,
  profile: {
    name: 'Alph', weight: null, kcal: 2800, protein: 150, carbs: 340, fat: 80,
    water: 3000, restSec: 90,
    goal: '',
    equipment: 'Home: dumbbells (adjustable handles + plates, about 22 kg total). Outdoors: pull-up bar and dips, bodyweight only.',
    days: 6,
  },
  settings: {
    apiKey: '',
    model: 'gemini-2.5-flash',
    remind: { enabled: false, meals: ['08:00', '12:30', '16:30', '20:00'], train: '17:30', fired: {}, push: { on: false, server: 'https://ntfy.sh', topic: '', sent: {}, last: 0 } },
  },
  plan: clone(DEFAULT_PLAN),
  prevPlan: null, // { plan, at } — lets the user revert the last plan change
  workouts: [],
  meals: [],
  water: {},
  weights: [],
  scans: [],
  chat: [],
  meta: { created: Date.now(), lastBackup: '' },
});

/** Only plain keys are merged; prototype-polluting keys are ignored. Type mismatches fall back to the base. */
function merge(base, extra) {
  if (base === null) return extra === undefined ? base : extra; // nullable field (e.g. weight, prevPlan)
  if (!isObj(base)) return extra === undefined || typeof extra !== typeof base || Array.isArray(extra) !== Array.isArray(base) ? base : extra;
  if (!isObj(extra)) return base;
  const out = { ...base };
  for (const k of Object.keys(extra)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = k in base ? merge(base[k], extra[k]) : extra[k];
  }
  return out;
}

export function validatePlan(p) {
  if (!isObj(p) || !Array.isArray(p.days) || p.days.length !== 7) return null;
  const days = p.days.map(d => {
    d = isObj(d) ? d : {};
    const ex = (Array.isArray(d.ex) ? d.ex : []).filter(e => isObj(e) && EX[e.id]).slice(0, 14)
      .map(e => ({ id: e.id, sets: Math.round(num(e.sets, 3, 1, 8)), reps: str(String(e.reps ?? '10'), 12) || '10' }));
    const rest = bool(d.rest) || !ex.length;
    return { title: rest ? 'Rest' : str(d.title, 40) || 'Session', focus: rest ? 'Recovery' : str(d.focus, 70), rest, ex: rest ? [] : ex };
  });
  return { name: str(p.name, 60) || 'Training plan', rationale: str(p.rationale, 600), days };
}

function sanitizeSet(s) { return { w: num(s?.w, 0, 0, 1000), r: num(s?.r, 0, 0, 10000) }; }

/** Normalise a merged state object so nothing downstream can crash on a bad shape. */
function sanitize(s) {
  const d = defaults();
  const p = isObj(s.profile) ? s.profile : {};
  const rm = isObj(s.settings?.remind) ? s.settings.remind : {};
  const push = isObj(rm.push) ? rm.push : {};
  const meals = (Array.isArray(rm.meals) ? rm.meals : []).filter(t => HHMM.test(t)).map(t => t.padStart(5, '0')).slice(0, 8);
  const seen = new Set();
  const uniq = rec => { while (seen.has(rec.id)) rec.id = uid(); seen.add(rec.id); return rec; };

  const out = {
    v: SCHEMA,
    onboarded: bool(s.onboarded),
    meta: { created: num(s.meta?.created, d.meta.created), lastBackup: str(s.meta?.lastBackup, 12) },
    profile: {
      name: str(p.name, 40).trim() || d.profile.name,
      weight: p.weight == null || p.weight === '' ? null : num(p.weight, null, 20, 400),
      kcal: num(p.kcal, d.profile.kcal, 800, 8000), protein: num(p.protein, d.profile.protein, 10, 500),
      carbs: num(p.carbs, d.profile.carbs, 0, 1000), fat: num(p.fat, d.profile.fat, 0, 400),
      water: num(p.water, d.profile.water, 500, 10000), restSec: Math.round(num(p.restSec, d.profile.restSec, 10, 600)),
      goal: str(p.goal, 60), equipment: str(p.equipment, 600), days: Math.round(num(p.days, d.profile.days, 1, 7)),
    },
    settings: {
      apiKey: str(s.settings?.apiKey, 200).trim(),
      model: str(s.settings?.model, 60).trim() || d.settings.model,
      remind: {
        enabled: bool(rm.enabled), meals: meals.length ? meals : d.settings.remind.meals,
        train: HHMM.test(rm.train) ? rm.train.padStart(5, '0') : d.settings.remind.train,
        fired: isObj(rm.fired) ? rm.fired : {},
        push: {
          on: bool(push.on), server: /^https:\/\//.test(push.server || '') ? str(push.server, 200) : d.settings.remind.push.server,
          topic: str(push.topic, 80), sent: isObj(push.sent) ? push.sent : {}, last: num(push.last, 0),
        },
      },
    },
    plan: validatePlan(s.plan) || d.plan,
    prevPlan: isObj(s.prevPlan) && validatePlan(s.prevPlan.plan) ? { plan: validatePlan(s.prevPlan.plan), at: num(s.prevPlan.at, 0) } : null,
    workouts: [], meals: [], water: {}, weights: [], scans: [], chat: [],
  };

  for (const w of Array.isArray(s.workouts) ? s.workouts : []) {
    if (!isObj(w)) continue;
    const date = isoOrNull(w.date); if (!date) continue;
    const exercises = (Array.isArray(w.exercises) ? w.exercises : []).filter(e => isObj(e) && EX[e.id])
      .map(e => ({ id: e.id, sets: (Array.isArray(e.sets) ? e.sets : []).map(sanitizeSet).filter(x => x.r > 0).slice(0, 40) })).filter(e => e.sets.length);
    if (!exercises.length) continue;
    out.workouts.push(uniq({
      id: safeId(w.id), date, key: isKey(w.key) ? w.key : dateKey(new Date(date)), name: str(w.name, 40) || 'Session',
      dayIdx: Number.isInteger(w.dayIdx) && w.dayIdx >= 0 && w.dayIdx < 7 ? w.dayIdx : null, dur: Math.round(num(w.dur, 0, 0, 1000)), ...(w.logged ? { logged: true } : {}), exercises,
    }));
  }
  out.workouts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const m of Array.isArray(s.meals) ? s.meals : []) {
    if (!isObj(m)) continue;
    const ts = num(m.ts, 0); if (!ts) continue;
    out.meals.push(uniq({
      id: safeId(m.id), ts, name: str(m.name, 80) || 'Meal', kcal: num(m.kcal, 0, 0, 10000), p: num(m.p, 0, 0, 1000), c: num(m.c, 0, 0, 1500), f: num(m.f, 0, 0, 800),
      thumb: safeThumb(m.thumb), src: m.src === 'ai' ? 'ai' : 'manual',
      items: Array.isArray(m.items) ? m.items.slice(0, 12).filter(isObj).map(i => ({ name: str(i.name, 60), grams: num(i.grams, 0, 0, 5000), kcal: num(i.kcal, 0, 0, 5000) })) : undefined,
    }));
  }
  if (isObj(s.water)) for (const k of Object.keys(s.water)) if (isKey(k)) out.water[k] = num(s.water[k], 0, 0, 20000);
  const wseen = new Set();
  for (const w of Array.isArray(s.weights) ? s.weights : []) {
    if (!isObj(w) || !isKey(w.date) || wseen.has(w.date)) continue;
    const kg = num(w.kg, 0); if (kg < 20 || kg > 400) continue;
    wseen.add(w.date); out.weights.push({ date: w.date, kg: Math.round(kg * 10) / 10 });
  }
  out.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const sc of Array.isArray(s.scans) ? s.scans : []) {
    if (!isObj(sc)) continue;
    const ratings = {}; if (isObj(sc.ratings)) for (const k of Object.keys(MUSCLES)) if (sc.ratings[k] != null) ratings[k] = Math.round(num(sc.ratings[k], 3, 1, 5));
    out.scans.push({ ts: num(sc.ts, 0), date: isKey(sc.date) ? sc.date : dateKey(), thumb: safeThumb(sc.thumb), summary: str(sc.summary, 500), ratings,
      strengths: muscleKeys(sc.strengths).slice(0, 3), priorities: muscleKeys(sc.priorities).slice(0, 4), posture: str(sc.posture, 160), focus: str(sc.focus, 300), caveat: str(sc.caveat, 160) });
  }
  out.scans = out.scans.slice(-6);
  for (const c of Array.isArray(s.chat) ? s.chat : []) {
    if (!isObj(c) || !['user', 'model', 'log'].includes(c.role) || c.err) continue;
    const text = str(c.text, 4000); if (!text) continue;
    const rec = { role: c.role, text };
    if (c.role === 'log') { rec.ids = (Array.isArray(c.ids) ? c.ids : []).filter(i => typeof i === 'string').slice(0, 20); if (c.undone) rec.undone = true; }
    out.chat.push(rec);
  }
  out.chat = out.chat.slice(-60);
  return out;
}

// version N -> N+1. Add an entry here whenever SCHEMA is bumped.
const MIGRATIONS = {
  1: s => ({ ...s, prevPlan: null, meta: { created: Date.now(), lastBackup: '' } }), // v1 -> v2
};
function migrate(raw) {
  let s = isObj(raw) ? raw : {};
  for (let v = Math.max(1, Math.round(num(s.v, 1))); v < SCHEMA; v++) if (MIGRATIONS[v]) s = MIGRATIONS[v](s);
  return sanitize(merge(defaults(), s));
}

// ---------- persistence, backups, recovery
let state = defaults();
const subs = new Set();
let timer = null, blocked = false, recovery = null, warned = false, xpCache = null;
const emit = (type, detail) => window.dispatchEvent(new CustomEvent('alveon:' + type, { detail }));

function lite(s) {
  const c = clone(s);
  c.meals.forEach(m => delete m.thumb); c.scans.forEach(x => delete x.thumb);
  c.chat = c.chat.slice(-10); c.settings.apiKey = '';
  return c;
}
function writeBackup(reason, s = state) {
  try { localStorage.setItem(BAK, JSON.stringify({ ts: Date.now(), reason, data: lite(s) })); return true; } catch { return false; }
}
function readBackup() { try { const b = JSON.parse(localStorage.getItem(BAK)); return isObj(b) && isObj(b.data) ? b : null; } catch { return null; } }

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { blocked = true; }
  recovery = null;
  if (!raw) { state = defaults(); return state; }
  try {
    const parsed = JSON.parse(raw);
    if (!isObj(parsed)) throw new Error('not an object');
    if (num(parsed.v, 1) < SCHEMA) writeBackup('pre-migration', migrate({ ...parsed, v: SCHEMA }));
    state = migrate(parsed);
    if (num(parsed.v, 1) !== SCHEMA) persist();
  } catch {
    try { localStorage.setItem(BAD, raw.slice(0, 2000000)); } catch { /* no room for a copy */ }
    const b = readBackup();
    if (b) { try { state = migrate(b.data); recovery = { from: 'backup', ts: b.ts }; } catch { state = defaults(); recovery = { from: 'none' }; } }
    else { state = defaults(); recovery = { from: 'none' }; }
    persist();
  }
  return state;
}
/** Returns (once) a notice if the last load had to recover from corrupted data. */
export function takeRecovery() { const r = recovery; recovery = null; return r; }
export const get = () => state;

export function update(fn) {
  try { fn(state); } finally {
    xpCache = null; persistSoon(); subs.forEach(f => { try { f(state); } catch { /* a bad subscriber must not break saving */ } });
  }
}
export const subscribe = f => (subs.add(f), () => subs.delete(f));

function persistSoon() { clearTimeout(timer); timer = setTimeout(persist, 250); }

const LADDER = [
  { note: 'older meal photos', fn: () => { const t = state.meals.filter(m => m.thumb).sort((a, b) => a.ts - b.ts); t.slice(0, Math.max(5, t.length >> 1)).forEach(m => delete m.thumb); } },
  { note: 'saved diagnostics', fn: () => { try { localStorage.removeItem(BAD); } catch { /* ignore */ } } },
  { note: 'all meal and scan photos', fn: () => { state.meals.forEach(m => delete m.thumb); state.scans.forEach(x => delete x.thumb); } },
  { note: 'the automatic backup', fn: () => { try { localStorage.removeItem(BAK); } catch { /* ignore */ } } },
  { note: 'older chat messages', fn: () => { state.chat = state.chat.slice(-10); } },
];

export function persist() {
  clearTimeout(timer);
  if (blocked) return false;
  const today = dateKey();
  if (state.meta.lastBackup !== today && (state.workouts.length || state.meals.length)) { if (writeBackup('daily')) state.meta.lastBackup = today; }
  const write = () => { const json = JSON.stringify(state); localStorage.setItem(KEY, json); return json.length; };
  try {
    const n = write();
    if (n > 3500000 && !warned) { warned = true; emit('storage', { level: 'warn', chars: n }); }
    return true;
  } catch { /* quota or blocked: climb the ladder */ }
  for (const step of LADDER) {
    step.fn();
    try { write(); emit('storage', { level: 'trimmed', note: step.note }); return true; } catch { /* next step */ }
  }
  emit('storage', { level: 'error' });
  return false;
}
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist());
// another tab saved: adopt its data instead of overwriting it with ours later
window.addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  try { state = migrate(JSON.parse(e.newValue)); xpCache = null; subs.forEach(f => f(state)); emit('external', {}); } catch { /* ignore a half-written value */ }
});

export function storageInfo() {
  let chars = 0, backup = 0;
  try { chars = (localStorage.getItem(KEY) || '').length; backup = (localStorage.getItem(BAK) || '').length; } catch { /* ignore */ }
  const thumbs = state.meals.filter(m => m.thumb).length + state.scans.filter(s => s.thumb).length;
  return { chars, backup, pct: Math.min(100, Math.round((chars / 5000000) * 100)), thumbs, blocked };
}
export async function requestPersistence() {
  try { return (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { return false; }
}
/** Free space on demand: drops every stored photo thumbnail. Returns how many were removed. */
export function clearPhotos() {
  let n = 0;
  update(s => { s.meals.forEach(m => { if (m.thumb) { delete m.thumb; n++; } }); s.scans.forEach(x => { if (x.thumb) { delete x.thumb; n++; } }); });
  return n;
}

// ---------- import / export
export function exportData() {
  return JSON.stringify({ app: 'alveon-prive', schema: SCHEMA, exportedAt: new Date().toISOString(), ...state, settings: { ...state.settings, apiKey: '' } }, null, 2);
}
const countsOf = s => ({ workouts: s.workouts.length, meals: s.meals.length, weights: s.weights.length, scans: s.scans.length });

/** Validate a backup file and say what it contains, without changing anything. */
export function inspectBackup(json) {
  let inc; try { inc = JSON.parse(json); } catch { throw new Error('That file is not valid JSON.'); }
  if (!isObj(inc) || !(Array.isArray(inc.workouts) || Array.isArray(inc.meals) || isObj(inc.plan))) throw new Error('This does not look like an ALVéON backup.');
  if (num(inc.schema ?? inc.v, 1) > SCHEMA) throw new Error('This backup comes from a newer version of ALVéON. Update the app first.');
  const next = migrate(inc);
  return { data: next, counts: countsOf(next), exportedAt: str(inc.exportedAt, 40) };
}
/** mode 'replace' swaps everything (your API key and a safety snapshot are kept); 'merge' only adds what is missing. */
export function importData(json, mode = 'replace') {
  const { data } = inspectBackup(json);
  const before = countsOf(state);
  writeBackup('pre-import');
  if (mode === 'merge') {
    const ids = a => new Set(a.map(x => x.id));
    update(s => {
      const wi = ids(s.workouts), mi = ids(s.meals), si = new Set(s.scans.map(x => x.ts)), wd = new Set(s.weights.map(x => x.date));
      s.workouts.push(...data.workouts.filter(w => !wi.has(w.id))); s.workouts.sort((a, b) => (a.date < b.date ? -1 : 1));
      s.meals.push(...data.meals.filter(m => !mi.has(m.id)));
      s.scans.push(...data.scans.filter(x => !si.has(x.ts))); s.scans = s.scans.slice(-6);
      s.weights.push(...data.weights.filter(w => !wd.has(w.date))); s.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
      for (const k of Object.keys(data.water)) s.water[k] = Math.max(s.water[k] || 0, data.water[k]);
    });
  } else {
    const key = state.settings.apiKey;
    state = data; state.settings.apiKey = key; state.onboarded = true;
    xpCache = null; persist(); subs.forEach(f => f(state));
  }
  const after = countsOf(state);
  return { mode, added: { workouts: after.workouts - before.workouts, meals: after.meals - before.meals, weights: after.weights - before.weights }, total: after };
}
export function resetAll() {
  state = defaults(); xpCache = null; clearTimeout(timer);
  try { [KEY, BAK, BAD, SESSION_KEY].forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
  persist();
}

// ---------- plan changes (with one-step revert)
export function applyPlan(plan) {
  const valid = validatePlan(plan); if (!valid) throw new Error('That plan is not valid.');
  update(s => { s.prevPlan = { plan: s.plan, at: Date.now() }; s.plan = valid; });
}
export function revertPlan() {
  if (!state.prevPlan) return false;
  update(s => { const cur = s.plan; s.plan = s.prevPlan.plan; s.prevPlan = { plan: cur, at: Date.now() }; });
  return true;
}

// ---------- selectors
export const mealsOn = key => state.meals.filter(m => dateKey(new Date(m.ts)) === key).sort((a, b) => a.ts - b.ts);
export function totalsOn(key) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const m of mealsOn(key)) { t.kcal += +m.kcal || 0; t.p += +m.p || 0; t.c += +m.c || 0; t.f += +m.f || 0; }
  return t;
}
export const waterOn = key => state.water[key] || 0;

export function muscleStats() {
  if (!xpCache) {
    const raw = computeXP(state.workouts);
    xpCache = {};
    for (const m of Object.keys(MUSCLES)) xpCache[m] = { ...levelInfo(raw[m].xp), last: raw[m].last };
  }
  return xpCache;
}
export function physiqueIndex() {
  const ms = Object.values(muscleStats());
  return Math.round((ms.reduce((a, m) => a + m.frac, 0) / ms.length / 5) * 100);
}
export const workoutDates = () => new Set(state.workouts.map(w => w.key));
export function streak() {
  const days = workoutDates();
  let n = 0; const d = new Date();
  if (!days.has(dateKey(d))) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) { // planned rest days do not break the streak
    const k = dateKey(d), planned = state.plan.days[weekdayIdx(d)];
    if (days.has(k)) n++; else if (!(planned && planned.rest)) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
/** Best set (by weight × reps) from the most recent session containing this exercise. */
export function lastPerf(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const e = state.workouts[i].exercises.find(x => x.id === exId);
    if (e && e.sets.length) return e.sets.reduce((best, s) => ((+s.w || 0) * (+s.r || 0) >= (+best.w || 0) * (+best.r || 0) ? s : best), e.sets[0]);
  }
  return null;
}
