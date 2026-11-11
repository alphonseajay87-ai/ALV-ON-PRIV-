// ALVéON PRIVÉ — static data: muscles, levels, exercise library, default program

export const MUSCLES = {
  chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', traps: 'Traps',
  lats: 'Lats', lowerback: 'Lower back', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', calves: 'Calves',
};

export const LEVELS = [
  { n: 'Untrained', xp: 0 },
  { n: 'Foundation', xp: 60 },
  { n: 'Developing', xp: 220 },
  { n: 'Refined', xp: 600 },
  { n: 'Elite', xp: 1300 },
  { n: 'Prestige', xp: 2600 },
];

export function levelInfo(xp) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].xp) i = k;
  const cur = LEVELS[i], next = LEVELS[i + 1];
  const pct = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { level: i, name: cur.n, xp, next: next ? next.xp : null, pct, frac: i + (next ? pct : 0) };
}

// type: wt = weight × reps · bw = bodyweight reps (+ optional added kg) · time = seconds
const E = (id, name, p, s, type, loc) => ({ id, name, p, s, type, loc });
export const EXERCISES = [
  // Home · dumbbells
  E('db_press', 'Dumbbell Press', ['chest'], ['shoulders', 'triceps'], 'wt', 'home'),
  E('db_incline', 'Incline Dumbbell Press', ['chest'], ['shoulders', 'triceps'], 'wt', 'home'),
  E('db_fly', 'Dumbbell Fly', ['chest'], ['shoulders'], 'wt', 'home'),
  E('db_row', 'One-Arm Dumbbell Row', ['lats'], ['biceps', 'traps', 'lowerback'], 'wt', 'home'),
  E('db_shoulder', 'Dumbbell Shoulder Press', ['shoulders'], ['triceps', 'traps'], 'wt', 'home'),
  E('db_lateral', 'Lateral Raise', ['shoulders'], [], 'wt', 'home'),
  E('db_rear', 'Rear Delt Raise', ['shoulders'], ['traps'], 'wt', 'home'),
  E('db_curl', 'Dumbbell Curl', ['biceps'], ['forearms'], 'wt', 'home'),
  E('db_hammer', 'Hammer Curl', ['biceps'], ['forearms'], 'wt', 'home'),
  E('db_ext', 'Overhead Triceps Extension', ['triceps'], [], 'wt', 'home'),
  E('db_kickback', 'Triceps Kickback', ['triceps'], [], 'wt', 'home'),
  E('db_goblet', 'Goblet Squat', ['quads'], ['glutes', 'abs'], 'wt', 'home'),
  E('db_lunge', 'Walking Lunge', ['quads', 'glutes'], ['hamstrings'], 'wt', 'home'),
  E('db_bulg', 'Bulgarian Split Squat', ['quads'], ['glutes'], 'wt', 'home'),
  E('db_rdl', 'Romanian Deadlift', ['hamstrings'], ['glutes', 'lowerback'], 'wt', 'home'),
  E('db_hipthrust', 'Hip Thrust', ['glutes'], ['hamstrings'], 'wt', 'home'),
  E('db_calf', 'Standing Calf Raise', ['calves'], [], 'wt', 'home'),
  E('db_shrug', 'Dumbbell Shrug', ['traps'], ['forearms'], 'wt', 'home'),
  E('db_wrist', 'Wrist Curl', ['forearms'], [], 'wt', 'home'),
  // Street · bodyweight
  E('pullup', 'Pull-Up', ['lats'], ['biceps', 'traps', 'forearms'], 'bw', 'street'),
  E('chinup', 'Chin-Up', ['lats', 'biceps'], ['forearms'], 'bw', 'street'),
  E('chesttobar', 'Chest-to-Bar Pull-Up', ['lats'], ['biceps', 'traps', 'abs'], 'bw', 'street'),
  E('muscleup', 'Muscle-Up', ['lats', 'chest'], ['triceps', 'biceps', 'shoulders', 'abs'], 'bw', 'street'),
  E('dips', 'Dips', ['chest', 'triceps'], ['shoulders'], 'bw', 'street'),
  E('pushup', 'Push-Up', ['chest'], ['triceps', 'shoulders', 'abs'], 'bw', 'any'),
  E('diamond', 'Diamond Push-Up', ['triceps'], ['chest', 'shoulders'], 'bw', 'any'),
  E('pike', 'Pike Push-Up', ['shoulders'], ['triceps', 'traps'], 'bw', 'any'),
  E('hangleg', 'Hanging Leg Raise', ['abs'], ['forearms', 'obliques'], 'bw', 'street'),
  E('bwsquat', 'Bodyweight Squat', ['quads'], ['glutes'], 'bw', 'any'),
  E('pistol', 'Pistol Squat', ['quads', 'glutes'], ['abs'], 'bw', 'any'),
  E('nordic', 'Nordic Curl', ['hamstrings'], ['glutes'], 'bw', 'any'),
  E('superman', 'Back Extension', ['lowerback'], ['glutes'], 'bw', 'any'),
  E('calfbw', 'Single-Leg Calf Raise', ['calves'], [], 'bw', 'any'),
  // Time
  E('plank', 'Plank', ['abs'], ['obliques', 'shoulders'], 'time', 'any'),
  E('sideplank', 'Side Plank', ['obliques'], ['abs'], 'time', 'any'),
  E('rope', 'Skipping Rope', ['calves'], ['quads', 'forearms'], 'time', 'any'),
];
export const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const d = (title, focus, ex) => ({ title, focus, rest: false, ex: ex.map(([id, sets, reps]) => ({ id, sets, reps: String(reps) })) });

export const DEFAULT_PLAN = {
  name: 'Foundation · 6-day split',
  rationale: 'A starter push / pull / legs rhythm. Ask the Coach to adapt it to what you want to improve.',
  days: [
    d('Push', 'Chest · Shoulders · Triceps', [['db_press', 4, '8-10'], ['db_incline', 3, '10-12'], ['db_shoulder', 3, '10'], ['db_lateral', 3, '12-15'], ['db_ext', 3, '12'], ['pushup', 2, 'max']]),
    d('Pull · Skills', 'Back · Biceps · Muscle-up', [['muscleup', 4, '2'], ['chesttobar', 4, '3-5'], ['pullup', 4, '5-8'], ['chinup', 3, '8'], ['hangleg', 3, '10'], ['rope', 1, '180']]),
    d('Legs', 'Quads · Hamstrings · Glutes · Calves', [['db_goblet', 4, '12'], ['db_bulg', 3, '10'], ['db_rdl', 4, '10'], ['db_hipthrust', 3, '12'], ['db_calf', 4, '15'], ['plank', 3, '45']]),
    d('Shoulders & Arms', 'Delts · Biceps · Triceps', [['db_shoulder', 4, '8-10'], ['db_lateral', 4, '12-15'], ['db_rear', 3, '15'], ['db_curl', 4, '10'], ['db_hammer', 3, '12'], ['db_ext', 3, '12']]),
    d('Street Strength', 'Dips · Pull · Muscle-up', [['dips', 4, '6-8'], ['muscleup', 3, '2'], ['pullup', 3, 'max'], ['diamond', 3, '12'], ['pike', 3, '8-10'], ['rope', 1, '180']]),
    d('Legs & Core', 'Quads · Posterior chain · Abs', [['db_lunge', 4, '12'], ['db_rdl', 3, '12'], ['db_goblet', 3, '15'], ['db_calf', 4, '20'], ['hangleg', 3, '12'], ['sideplank', 3, '30']]),
    { title: 'Rest', focus: 'Recovery', rest: true, ex: [] },
  ],
};

// XP earned by one completed set
export function setXP(ex, s) {
  const r = +s.r || 0, w = +s.w || 0;
  if (!ex || !r) return 0;
  if (ex.type === 'time') return 6 + Math.min(r / 6, 24);
  if (ex.type === 'bw') return 10 + r * 1.2 + (w * r) / 15;
  return 10 + Math.min((w * r) / 15, 40);
}

// workouts -> { muscle: { xp, last } }
export function computeXP(workouts) {
  const out = {};
  Object.keys(MUSCLES).forEach(m => (out[m] = { xp: 0, last: null }));
  for (const w of workouts) {
    for (const e of w.exercises || []) {
      const ex = EX[e.id];
      if (!ex) continue;
      let total = 0;
      for (const s of e.sets || []) total += setXP(ex, s);
      for (const m of ex.p) bump(out, m, total, w.date);
      for (const m of ex.s) bump(out, m, total * 0.4, w.date);
    }
  }
  return out;
}
function bump(out, m, xp, date) {
  const o = out[m];
  if (!o) return;
  o.xp += xp;
  if (!o.last || date > o.last) o.last = date;
}

export function parseReps(str) {
  const m = String(str || '').match(/\d+/);
  return m ? +m[0] : 8;
}
