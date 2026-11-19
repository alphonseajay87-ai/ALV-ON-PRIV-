// ALVéON PRIVÉ — calendar-day helpers (local time). One place so every view agrees on "today" and "yesterday".

export const pad = n => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const keyToDate = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const weekdayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // Mon = 0
export const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const isKey = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const toDate = v => (v instanceof Date ? v : isKey(v) ? keyToDate(v) : new Date(v));

/** Whole calendar days between today and `v` (0 = today, 1 = yesterday). Not 24-hour blocks. */
export const calDaysSince = v => Math.round((startOfDay(new Date()) - startOfDay(toDate(v))) / 86400000);

/** 'Today' · 'Yesterday' · '3d ago' · '—' */
export function agoShort(v) {
  if (!v) return '—';
  const n = calDaysSince(v);
  return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n}d ago`;
}
/** 'Trained today' · 'Trained yesterday' · 'Trained 3 days ago' · 'Not trained yet' */
export function trainedAgo(v) {
  if (!v) return 'Not trained yet';
  const n = calDaysSince(v);
  return n <= 0 ? 'Trained today' : n === 1 ? 'Trained yesterday' : `Trained ${n} days ago`;
}
/** 'today' · 'yesterday' · '3 days ago' · 'Tue 4 Nov' */
export function dayLabel(key) {
  const n = calDaysSince(key);
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : n > 0 && n < 7 ? `${n} days ago` : keyToDate(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
/** Monday of the week containing d, as a Date at 00:00. */
export function weekStart(d = new Date()) { const x = startOfDay(d); x.setDate(x.getDate() - weekdayIdx(x)); return x; }
