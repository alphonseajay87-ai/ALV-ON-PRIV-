// ALVéON PRIVÉ — progress intelligence: overload hints, PRs, weight trend, weekly stats, recovery, what to train next.
// Pure functions over the store; no DOM.
import { get, muscleStats, dateKey } from './store.js';
import { EX, EXERCISES, MUSCLES } from './data.js';
import { calDaysSince, keyToDate, weekStart } from './dates.js';

// ---------- single-exercise history
/** How strong a set is, comparable across sessions. */
export function setScore(ex, s) {
  const w = +s.w || 0, r = +s.r || 0;
  if (!ex || !r) return 0;
  if (ex.type === 'time') return r;
  if (ex.type === 'bw') return r + w * 0.5;
  return w * (1 + r / 30); // Epley estimated 1RM
}
const bestOf = (ex, sets) => sets.reduce((b, s) => (setScore(ex, s) > setScore(ex, b) ? s : b), sets[0]);

/** Newest-first list of past sessions that included this exercise. */
export function history(exId, limit = 8) {
  const ex = EX[exId], out = [];
  const ws = get().workouts;
  for (let i = ws.length - 1; i >= 0 && out.length < limit; i--) {
    const e = ws[i].exercises.find(x => x.id === exId);
    if (!e || !e.sets.length) continue;
    const best = bestOf(ex, e.sets);
    out.push({ key: ws[i].key, name: ws[i].name, sets: e.sets, best, score: setScore(ex, best), volume: e.sets.reduce((a, s) => a + (+s.w || 0) * (+s.r || 0), 0) });
  }
  return out;
}
export const lastSession = exId => history(exId, 1)[0] || null;

export function personalBest(exId) {
  const ex = EX[exId]; let best = null;
  for (const w of get().workouts) {
    const e = w.exercises.find(x => x.id === exId); if (!e) continue;
    for (const s of e.sets) { const sc = setScore(ex, s); if (!best || sc > best.score) best = { ...s, score: sc, key: w.key }; }
  }
  return best;
}
/** Would this set beat everything logged before? (Needs at least one earlier session.) */
export function isPR(exId, set) {
  const ex = EX[exId], pb = personalBest(exId);
  return !!pb && setScore(ex, set) > pb.score + 1e-6;
}

// ---------- progressive overload
const range = target => {
  const m = String(target || '').match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { lo: +m[1], hi: +m[2] };
  if (/^\d+$/.test(String(target || '').trim())) return { lo: +target, hi: +target };
  return null; // "max" or empty
};
const round = (n, step) => Math.round(n / step) * step;

/**
 * A concrete suggestion for the next time an exercise is done, from the last session.
 * Double progression: earn the top of the rep range on every set, then add load and start again at the bottom.
 * @returns {{w:number, r:number, text:string, why:string}|null}
 */
export function overloadHint(exId, target = '') {
  const ex = EX[exId], last = lastSession(exId);
  if (!ex || !last) return null;
  const sets = last.sets, rg = range(target);
  const minR = Math.min(...sets.map(s => +s.r || 0)), topW = Math.max(...sets.map(s => +s.w || 0));
  if (ex.type === 'time') {
    const r = Math.round(minR + 5);
    return { w: 0, r, text: `Hold ${r} s`, why: `Last time you held ${minR} s` };
  }
  if (ex.type === 'bw') {
    if (rg && minR >= rg.hi) return { w: topW ? topW + 1 : 2.5, r: rg.lo, text: topW ? `Add ${topW + 1} kg` : 'Add 2.5 kg or a harder variation', why: `You hit ${minR}+ reps on every set` };
    const r = rg ? Math.min(rg.hi, minR + 1) : minR + 1;
    return { w: topW, r, text: `Beat it: ${r} reps`, why: `Last time your lowest set was ${minR}` };
  }
  const inc = exId.startsWith('db_') ? 1 : 2.5;
  if (rg && minR >= rg.hi && topW > 0) {
    const w = round(topW + inc, 0.5);
    return { w, r: rg.lo, text: `${w} kg × ${rg.lo}`, why: `You hit ${rg.hi} reps on every set at ${topW} kg` };
  }
  const r = rg ? Math.min(rg.hi, minR + 1) : minR + 1;
  return { w: topW, r, text: `${topW ? topW + ' kg × ' : ''}${r}`, why: `Aim one more rep than your lowest set (${minR})` };
}

/** Sessions where a lift beat its previous best, newest first. */
export function recentPRs(limit = 4, days = 45) {
  const best = {}, out = [];
  for (const w of get().workouts) {
    for (const e of w.exercises) {
      const ex = EX[e.id]; if (!ex) continue;
      const top = bestOf(ex, e.sets), sc = setScore(ex, top);
      if (best[e.id] != null && sc > best[e.id] + 1e-6 && calDaysSince(w.key) <= days) out.push({ id: e.id, key: w.key, set: top });
      best[e.id] = Math.max(best[e.id] ?? 0, sc);
    }
  }
  return out.reverse().slice(0, limit);
}

// ---------- bodyweight trend
/** Weight points for the last `days` days with a trailing 7-day average and an honest weekly rate. */
export function weightTrend(days = 30) {
  const all = get().weights;
  if (!all.length) return { points: [], latest: null, count: 0 };
  const cutoff = days >= 3650 ? '0000-00-00' : dateKey(new Date(Date.now() - days * 86400000));
  const pts = all.filter(w => w.date >= cutoff);
  const avg = pts.map(p => {
    const t = keyToDate(p.date).getTime();
    const win = all.filter(w => { const d = keyToDate(w.date).getTime(); return d <= t && t - d < 7 * 86400000; });
    return { ...p, avg: Math.round((win.reduce((a, w) => a + w.kg, 0) / win.length) * 10) / 10 };
  });
  const latest = all[all.length - 1];
  const at = n => { const t = keyToDate(latest.date).getTime() - n * 86400000; const c = [...all].reverse().find(w => keyToDate(w.date).getTime() <= t); return c ? c.kg : null; };
  const d7 = at(7), d30 = at(30);
  // weekly rate from a least-squares line over the last 28 days (needs ≥3 entries and ≥7 days of spread)
  const recent = all.filter(w => calDaysSince(w.date) <= 28);
  let rate = null;
  if (recent.length >= 3) {
    const xs = recent.map(w => keyToDate(w.date).getTime() / 86400000), ys = recent.map(w => w.kg);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    if (den > 0 && Math.max(...xs) - Math.min(...xs) >= 7) rate = (xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den) * 7;
  }
  return { points: avg, latest, count: all.length, d7: d7 == null ? null : latest.kg - d7, d30: d30 == null ? null : latest.kg - d30, rate };
}

// ---------- weekly consistency
/** Last `n` calendar weeks (Mon–Sun), oldest first: sessions done vs planned, sets and volume. */
export function weeklyStats(n = 4) {
  const planned = get().plan.days.filter(d => !d.rest).length || 1;
  const start = weekStart(); const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = new Date(start); a.setDate(a.getDate() - i * 7);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    const ka = dateKey(a), kb = dateKey(b);
    const ws = get().workouts.filter(w => w.key >= ka && w.key < kb);
    const days = new Set(ws.map(w => w.key));
    out.push({
      label: i === 0 ? 'This week' : a.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      sessions: days.size, planned,
      sets: ws.reduce((x, w) => x + w.exercises.reduce((y, e) => y + e.sets.length, 0), 0),
      volume: Math.round(ws.reduce((x, w) => x + w.exercises.reduce((y, e) => y + e.sets.reduce((z, s) => z + (s.w || 0) * s.r, 0), 0), 0)),
    });
  }
  return out;
}

// ---------- recovery and "what next"
/** fresh = never trained · recovering = under ~40 h · ready · overdue = a week or more */
export function recoveryOf(m, stats = muscleStats()) {
  const last = stats[m]?.last;
  if (!last) return { state: 'untrained', label: 'Not trained yet', hours: null };
  const hours = (Date.now() - new Date(last).getTime()) / 3600000;
  if (hours < 40) return { state: 'recovering', label: 'Recovering', hours };
  if (hours < 24 * 7) return { state: 'ready', label: 'Ready', hours };
  return { state: 'overdue', label: 'Overdue', hours };
}
/** Muscles to train next: low level first, rested, and not left alone too long. */
export function nextToTrain(n = 3) {
  const stats = muscleStats();
  return Object.keys(MUSCLES).map(m => {
    const rec = recoveryOf(m, stats), s = stats[m];
    const days = s.last ? calDaysSince(s.last) : 14;
    const score = (5 - s.frac) + Math.min(days, 10) * 0.3 - (rec.state === 'recovering' ? 100 : 0);
    const why = rec.state === 'recovering' ? 'Recovering' : s.level <= 1 ? `${s.name} — biggest gap` : rec.state === 'overdue' ? `Untouched for ${days} days` : rec.state === 'untrained' ? 'Not trained yet' : `Level ${s.level}, rested`;
    return { m, score, why, rec };
  }).sort((a, b) => b.score - a.score).slice(0, n);
}
/** A sensible short session for one muscle: what the plan already uses for it first, then the library. */
export function exercisesFor(muscle, n = 4) {
  const planned = [];
  for (const d of get().plan.days) for (const e of d.ex) if (EX[e.id]?.p.includes(muscle) && !planned.some(x => x.id === e.id)) planned.push({ id: e.id, sets: e.sets, reps: e.reps });
  const out = planned.slice(0, n);
  for (const e of EXERCISES) {
    if (out.length >= n) break;
    if (e.p.includes(muscle) && !out.some(x => x.id === e.id)) out.push({ id: e.id, sets: 3, reps: e.type === 'time' ? '30' : e.type === 'bw' ? '8' : '10' });
  }
  return out;
}

// ---------- rank
export const RANKS = [[0, 'Recruit'], [10, 'Initiate'], [25, 'Hoplite'], [40, 'Warrior'], [55, 'Champion'], [70, 'Spartan'], [85, 'Legend']];
export function physiqueRank(idx) {
  let i = 0; RANKS.forEach(([t], k) => { if (idx >= t) i = k; });
  const next = RANKS[i + 1];
  return { name: RANKS[i][1], next: next ? next[1] : null, toNext: next ? next[0] - idx : 0 };
}
