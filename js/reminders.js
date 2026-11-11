// ALVéON PRIVÉ — reminders and phone alerts.
// A static web app cannot wake a phone on its own, so there are three layers:
//  1. In-app: fires while the app is open (toast, or a system notification if allowed).
//  2. Calendar: a generated .ics with repeating alarms; the phone itself fires them, offline.
//  3. ntfy push: each time the app opens it schedules the next 3 days of alerts on ntfy.sh.
import { get, update, dateKey, totalsOn, weekdayIdx, workoutDates } from './store.js';
import { toast, openSheet, esc, $ } from './ui.js';

const MEAL_NAMES = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Meal'];
const mealName = i => MEAL_NAMES[Math.min(i, 4)];
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const p2 = n => String(n).padStart(2, '0');
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const atTime = (d, t) => { const x = new Date(d); const [h, m] = t.split(':').map(Number); x.setHours(h, m, 0, 0); return x; };

// ---------- 1. in-app / system notifications while open
export async function enableNotifications() {
  if (!('Notification' in window)) return false;
  const res = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  return res === 'granted';
}

async function show(title, body, tag) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) { await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }); return; }
      new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
      return;
    } catch { /* fall through */ }
  }
  toast(`${title} — ${body}`, 5000);
}
export const testNotification = () => show('ALVéON PRIVÉ', 'Notifications are on. L’excellence est personnelle.', 'test');

function check() {
  const s = get(), r = s.settings.remind;
  if (!r.enabled) return;
  const now = new Date(), key = dateKey(now);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const fired = r.fired[key] || [];
  const fire = (id, title, body) => {
    if (fired.includes(id)) return;
    update(st => { const f = st.settings.remind.fired; for (const k of Object.keys(f)) if (k !== key) delete f[k]; (f[key] = f[key] || []).push(id); });
    show(title, body, id);
  };
  r.meals.forEach((t, i) => {
    const d = nowM - mins(t);
    if (d >= 0 && d < 45) {
      const tot = totalsOn(key), p = s.profile;
      const left = Math.max(0, Math.round(p.protein - tot.p));
      fire('m' + t, `${mealName(i)} time`, left > 0 ? `${left} g protein to reach today’s target. Snap your plate.` : 'Targets met — log it anyway.');
    }
  });
  const day = s.plan.days[weekdayIdx()];
  if (r.train && !day.rest && !workoutDates().has(key)) {
    const d = nowM - mins(r.train);
    if (d >= 0 && d < 60) fire('train', `${day.title} today`, 'Your session is waiting. Show up.');
  }
}

// ---------- 2. calendar alerts (.ics)
const icsEsc = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const fold = line => { const out = []; let l = line; while (l.length > 70) { out.push(l.slice(0, 70)); l = ' ' + l.slice(70); } out.push(l); return out.join('\r\n'); };
const utcStamp = d => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
const ymd = d => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;

export function buildICS() {
  const s = get(), r = s.settings.remind, now = new Date(), ev = [];
  const vevent = ({ uid, start, rrule, summary, desc }) => [
    'BEGIN:VEVENT', `UID:${uid}@alveon.prive`, `DTSTAMP:${utcStamp(now)}`, `DTSTART:${start}`, 'DURATION:PT20M', `RRULE:${rrule}`,
    `SUMMARY:${icsEsc(summary)}`, `DESCRIPTION:${icsEsc(desc)}`, 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(summary)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT',
  ].map(fold).join('\r\n');

  r.meals.forEach((t, i) => {
    const hm = t.replace(':', '');
    ev.push(vevent({ uid: `meal-${hm}`, start: `${ymd(now)}T${hm}00`, rrule: 'FREQ=DAILY', summary: `${mealName(i)} · log it in ALVéON`, desc: 'Snap your plate and log it in ALVéON PRIVÉ.' }));
  });
  if (r.train) {
    const hm = r.train.replace(':', '');
    s.plan.days.forEach((d, i) => {
      if (d.rest) return;
      const first = new Date(now); first.setDate(first.getDate() + ((i - weekdayIdx(now) + 7) % 7));
      ev.push(vevent({ uid: `train-${BYDAY[i]}`, start: `${ymd(first)}T${hm}00`, rrule: `FREQ=WEEKLY;BYDAY=${BYDAY[i]}`, summary: `${d.title} · ALVéON session`, desc: `${d.focus}. ${d.ex.length} exercises.` }));
    });
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ALVEON PRIVE//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:ALVéON PRIVÉ', ...ev, 'END:VCALENDAR', ''].join('\r\n');
}

export async function addToCalendar() {
  const ics = buildICS();
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const file = new File([blob], 'alveon-reminders.ics', { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'ALVéON PRIVÉ reminders' }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'alveon-reminders.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'download';
}

// ---------- 3. ntfy push (scheduled up to 3 days ahead)
export function makeTopic() {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return 'alveon-' + [...a].map(b => (b % 36).toString(36)).join('');
}

async function publish(msg) {
  const p = get().settings.remind.push;
  let res;
  // string body => text/plain, a "simple" request, so the browser skips the CORS preflight
  try { res = await fetch(p.server.replace(/\/+$/, '') + '/', { method: 'POST', body: JSON.stringify({ topic: p.topic, priority: 3, ...msg }) }); }
  catch { throw new Error('Could not reach ntfy. Check your connection.'); }
  if (!res.ok) throw new Error(res.status === 429 ? 'ntfy is rate limiting this device. Try again later.' : `ntfy error ${res.status}`);
}
export const pushTest = () => publish({ title: 'ALVéON PRIVÉ', message: 'Push alerts are working. L’excellence est personnelle.', tags: ['white_check_mark'] });

export function plannedEvents() {
  const s = get(), r = s.settings.remind, out = [], now = Date.now();
  for (let k = 0; k <= 3; k++) {
    const d = new Date(); d.setDate(d.getDate() + k);
    const key = dateKey(d);
    r.meals.forEach((t, i) => out.push({ id: `m-${key}-${t}`, at: atTime(d, t), title: `${mealName(i)} time`, body: 'Snap your plate and log it in ALVéON.', tag: 'fork_and_knife' }));
    const day = s.plan.days[weekdayIdx(d)];
    if (r.train && day && !day.rest) out.push({ id: `t-${key}-${r.train}`, at: atTime(d, r.train), title: `${day.title} today`, body: `${day.focus}. ${day.ex.length} exercises. Show up.`, tag: 'muscle' });
  }
  // ntfy accepts 10 seconds to 3 days ahead
  return out.filter(e => e.at.getTime() - now > 60e3 && e.at.getTime() - now < 71 * 3600e3);
}

let syncing = false;
export async function syncPush() {
  const push = get().settings.remind.push;
  if (!push.on || !push.topic || syncing) return null;
  syncing = true;
  const done = {}; let failed = null;
  try {
    for (const e of plannedEvents().filter(x => !push.sent[x.id])) {
      try { await publish({ title: e.title, message: e.body, tags: [e.tag], delay: String(Math.round(e.at.getTime() / 1000)) }); done[e.id] = e.at.getTime(); }
      catch (err) { failed = err; break; }
    }
    update(s => {
      const p = s.settings.remind.push; Object.assign(p.sent, done);
      for (const [id, ts] of Object.entries(p.sent)) if (ts < Date.now() - 3600e3) delete p.sent[id];
      if (!failed) p.last = Date.now();
    });
    return { added: Object.keys(done).length, failed };
  } finally { syncing = false; }
}

// ---------- phone alerts sheet
export function openAlertsSheet() {
  if (!get().settings.remind.push.topic) update(s => { s.settings.remind.push.topic = makeTopic(); });
  openSheet({
    title: 'Phone alerts', tall: true,
    onMount: el => {
      const draw = () => {
        const r = get().settings.remind, p = r.push;
        const queued = Object.values(p.sent).filter(t => t > Date.now()).length;
        const status = !p.on ? 'Off' : `${queued} alert${queued === 1 ? '' : 's'} queued${p.last ? ` · synced ${new Date(p.last).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}`;
        el.innerHTML = `
        <p class="muted pad-b">A web app cannot wake your phone by itself. Choose a method so alerts reach you while ALVéON is closed.</p>
        <div class="card flat">
          <div class="split"><b>Calendar alerts</b><span class="pill">Recommended</span></div>
          <p class="muted sm pad-b" style="padding-top:6px">Repeating events with alarms in your phone’s Calendar: ${r.meals.length} meal times a day and your training days at ${esc(r.train)}. Works offline, no account.</p>
          <button class="btn primary block" id="cal">Add to Calendar</button>
          <p class="muted sm" style="padding-top:10px">On iPhone, pick a calendar and tap Add All. Add them again after changing times or your plan; events update instead of duplicating.</p>
        </div>
        <div class="card flat">
          <b>Push with ntfy</b>
          <p class="muted sm" style="padding-top:6px">A free push app. Each time you open ALVéON it schedules the next 3 days of alerts.</p>
          <ol class="steps"><li>Install the <b>ntfy</b> app (iOS or Android).</li><li>Subscribe to this topic:<div class="topic"><code id="tp">${esc(p.topic)}</code><button class="btn ghost sm" id="cp">Copy</button></div></li><li>Turn on scheduled pushes and send a test.</li></ol>
          <label class="toggle"><span>Scheduled pushes</span><input type="checkbox" id="pon" ${p.on ? 'checked' : ''}><i></i></label>
          <div class="btnrow"><button class="btn ghost sm" id="ptest">Send test</button><button class="btn ghost sm" id="psync">Sync now</button></div>
          <p class="muted sm" id="pst" style="padding-top:10px">${status}</p>
          <p class="muted sm" style="padding-top:8px">Open ALVéON at least every 3 days. If you change times, old alerts stay queued for up to 3 days. Messages pass through ntfy.sh and contain only generic text; the topic name acts as a password.</p>
        </div>`;
        $('#cal', el).onclick = async () => {
          const res = await addToCalendar();
          if (res === 'download') toast('Downloaded. Open the file to add the events.', 4200);
          else if (res === 'shared') toast('Choose Calendar to add the events', 3500);
        };
        $('#cp', el).onclick = async () => { try { await navigator.clipboard.writeText(p.topic); toast('Topic copied'); } catch { toast('Select and copy the topic name'); } };
        $('#pon', el).onchange = async e => {
          update(s => { s.settings.remind.push.on = e.target.checked; });
          if (e.target.checked) { const r2 = await syncPush(); if (r2 && r2.failed) toast(r2.failed.message, 5000); }
          draw();
        };
        $('#ptest', el).onclick = async () => { try { await pushTest(); toast('Test sent. Check the ntfy app.', 4000); } catch (err) { toast(err.message, 5000); } };
        $('#psync', el).onclick = async () => {
          if (!get().settings.remind.push.on) { toast('Turn on scheduled pushes first'); return; }
          const r2 = await syncPush();
          toast(r2 && r2.failed ? r2.failed.message : r2 && r2.added ? `${r2.added} alerts scheduled` : 'Already up to date', 4000);
          draw();
        };
      };
      draw();
    },
  });
}

export function startReminders() {
  check(); syncPush();
  setInterval(check, 30000);
  setInterval(syncPush, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check(); syncPush(); } });
}
