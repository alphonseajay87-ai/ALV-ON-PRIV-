// ALVéON PRIVÉ — turns "I did 60 pull-ups yesterday" into real past workouts
import { update, dateKey, uid } from './store.js';
import { EXERCISES, EX } from './data.js';

import { dayLabel, startOfDay } from './dates.js';
export { dayLabel };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ---- offline fallback parser (used when there is no key or the AI call fails)
const ALIAS = {
  pullup: ['pull ?-?ups?', 'pullups?'], chinup: ['chin ?-?ups?'], chesttobar: ['chest ?-?to ?-?bar( pull ?-?ups?)?'],
  muscleup: ['muscle ?-?ups?'], dips: ['dips?'], pushup: ['push ?-?ups?', 'press ?-?ups?'], diamond: ['diamond push ?-?ups?'],
  pike: ['pike push ?-?ups?'], hangleg: ['hanging leg raises?', 'leg raises?'], bwsquat: ['(?:body ?weight )?squats?', 'air squats?'],
  pistol: ['pistol squats?'], plank: ['planks?'], sideplank: ['side planks?'], rope: ['skipping', 'jump rope', 'rope skipping'],
  superman: ['back extensions?'], nordic: ['nordic curls?'], calfbw: ['calf raises?'],
  db_curl: ['(?:dumbbell |db )?curls?'], db_press: ['dumbbell press', 'db press'], db_lateral: ['lateral raises?'],
};
const TIMEEX = new Set(EXERCISES.filter(e => e.type === 'time').map(e => e.id));

const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const digitize = t => t
  .replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, a, b) => NUMW[a] + NUMW[b])
  .replace(new RegExp(`\\b(${Object.keys(NUMW).join('|')})\\b`, 'g'), w => NUMW[w]);

function localWeight(t, date) {
  const m = t.match(/\b(?:i\s+)?(?:weigh(?:ed)?|bodyweight(?:\s+is)?|body\s+weight(?:\s+is)?|my\s+weight(?:\s+is)?|weight\s+is)\s*(?:in\s+at\s+|about\s+|around\s+)?(\d{2,3}(?:[.,]\d)?)\s*(kg|kgs|kilos?|lbs?|pounds?)?/);
  if (!m) return null;
  let kg = parseFloat(m[1].replace(',', '.')); if (/lb|pound/.test(m[2] || '')) kg *= 0.45359;
  return kg >= 30 && kg <= 250 ? { date, kg: Math.round(kg * 10) / 10 } : null;
}

function localDate(t) {
  const now = new Date(); const base = startOfDay(now);
  let m;
  if (/\byesterday\b|\blast night\b/.test(t)) base.setDate(base.getDate() - 1);
  else if ((m = t.match(/\b(\d{1,2}) days? ago\b/))) base.setDate(base.getDate() - Math.min(60, +m[1]));
  else if ((m = t.match(/\b(?:last|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/))) {
    const want = DAYS.indexOf(m[1]); let back = (base.getDay() - want + 7) % 7 || 7; base.setDate(base.getDate() - back);
  }
  return dateKey(base);
}

export function localExtract(text) {
  const t = digitize(text.toLowerCase().replace(/[,;]/g, ' '));
  if (/\?\s*$/.test(t.trim()) || /\b(should|can i|could i|how many|how much|will i|going to|gonna|plan to|want to|tomorrow)\b/.test(t)) return null;
  const date = localDate(t), weight = localWeight(t, date);
  const cue = /\b(did|done|hit|finished|completed|performed|managed|knocked|smashed|crushed|got|smashed|trained|yesterday|today|this morning|last night|ago)\b/.test(t);
  if (!cue) return weight ? { workouts: [], weight } : null;
  const exs = [];
  for (const [id, als] of Object.entries(ALIAS)) {
    for (const a of als) {
      // 5x12 pull ups | 5 sets of 12 pull ups
      let m = t.match(new RegExp(`(\\d{1,2})\\s*(?:x|sets? of)\\s*(\\d{1,3})\\s*(?:reps? of\\s*)?${a}\\b`));
      if (m) { exs.push({ id, sets: Array.from({ length: Math.min(12, +m[1]) }, () => ({ w: 0, r: +m[2] })) }); break; }
      // pull ups 5x12
      m = t.match(new RegExp(`${a}\\s*(?:[:-]\\s*)?(\\d{1,2})\\s*x\\s*(\\d{1,3})\\b`));
      if (m) { exs.push({ id, sets: Array.from({ length: Math.min(12, +m[1]) }, () => ({ w: 0, r: +m[2] })) }); break; }
      // 60 pull ups | 60 reps of pull ups
      m = t.match(new RegExp(`(\\d{1,4})\\s*(?:reps? of\\s*|seconds? of\\s*|s of\\s*)?${a}\\b`));
      if (m) { exs.push({ id, sets: [{ w: 0, r: +m[1] }] }); break; }
    }
  }
  // drop generic hits swallowed by a more specific one (e.g. "chest to bar pull ups" also matches pull ups)
  const ids = new Set(exs.map(e => e.id));
  const out = exs.filter(e => !(e.id === 'pullup' && ids.has('chesttobar') && /chest ?-?to ?-?bar/.test(t)) && !(e.id === 'pushup' && (ids.has('diamond') || ids.has('pike')) && /(diamond|pike)/.test(t)) && !(e.id === 'plank' && ids.has('sideplank') && /side plank/.test(t) && !/(?<!side )plank/.test(t)));
  if (!out.length) return weight ? { workouts: [], weight } : null;
  return { workouts: [{ date, name: 'Logged from chat', exercises: out }], weight };
}

// ---- write to the store; returns what was logged (for the card + undo)
export function applyLog(res) {
  const todayKey = dateKey(), made = [], lines = [];
  const minKey = (() => { const d = new Date(); d.setDate(d.getDate() - 400); return dateKey(d); })();
  update(st => {
    for (const w of res.workouts || []) {
      let key = /^\d{4}-\d{2}-\d{2}$/.test(w.date || '') ? w.date : todayKey;
      if (key > todayKey) key = todayKey; if (key < minKey) continue;
      const exercises = (w.exercises || []).filter(e => EX[e.id]).map(e => ({
        id: e.id,
        sets: (e.sets || []).map(s => ({ w: Math.max(0, Math.min(500, +s.w || 0)), r: Math.max(0, Math.min(5000, Math.round(+s.r || 0))) })).filter(s => s.r > 0).slice(0, 15),
      })).filter(e => e.sets.length);
      if (!exercises.length) continue;
      const [y, m, d] = key.split('-').map(Number);
      const rec = { id: uid(), date: new Date(y, m - 1, d, 12, 0, 0).toISOString(), key, name: String(w.name || 'Logged session').slice(0, 40), dayIdx: null, dur: 0, logged: true, exercises };
      st.workouts.push(rec); made.push(rec.id);
      for (const e of exercises) {
        const ex = EX[e.id], tot = e.sets.reduce((a, s) => a + s.r, 0);
        lines.push(`${ex.name} · ${e.sets.length > 1 ? e.sets.length + ' sets · ' : ''}${tot} ${ex.type === 'time' ? 's' : 'reps'} · ${dayLabel(key)}`);
      }
    }
    st.workouts.sort((a, b) => (a.date < b.date ? -1 : 1));
    const wt = res.weight;
    if (wt && +wt.kg >= 30 && +wt.kg <= 250) {
      const k = /^\d{4}-\d{2}-\d{2}$/.test(wt.date || '') && wt.date <= todayKey ? wt.date : todayKey;
      st.weights = st.weights.filter(x => x.date !== k); st.weights.push({ date: k, kg: Math.round(+wt.kg * 10) / 10 });
      st.weights.sort((a, b) => (a.date < b.date ? -1 : 1));
      if (k === todayKey) st.profile.weight = Math.round(+wt.kg * 10) / 10;
      lines.push(`Bodyweight · ${Math.round(+wt.kg * 10) / 10} kg · ${dayLabel(k)}`);
    }
  });
  return { ids: made, lines };
}

export function undoLog(ids) {
  const set = new Set(ids || []);
  update(st => { st.workouts = st.workouts.filter(w => !set.has(w.id)); });
}
