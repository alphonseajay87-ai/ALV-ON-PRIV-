// ALVéON PRIVÉ — live workout logger (full-screen): sets, rest timer, overload hints, PR detection, XP summary.
//
// State lives in `S` and is mirrored to localStorage on every change so a crash, reload or phone restart loses nothing.
// The rest timer is timestamp-based (survives backgrounding) and is stored with the session.
import { get, update, uid, dateKey, muscleStats, SESSION_KEY } from './store.js';
import { EX, EXERCISES, MUSCLES, parseReps, computeXP } from './data.js';
import { $, $$, esc, icon, openSheet, toast, confirmSheet, mmss, fmt, plate } from './ui.js';
import { lastSession, overloadHint, isPR } from './progress.js';
import { openExerciseHistory } from './history.js';
import { dayLabel } from './dates.js';

const STALE_MS = 14 * 3600 * 1000; // a session this old is offered for saving/discarding instead of silently resumed
let S = null, root = null, tick = null;

export const getSession = () => { try { const s = JSON.parse(localStorage.getItem(SESSION_KEY)); return s && Array.isArray(s.exercises) && s.start ? s : null; } catch { return null; } };
const save = () => { try { S ? localStorage.setItem(SESSION_KEY, JSON.stringify(S)) : localStorage.removeItem(SESSION_KEY); } catch { /* storage full: the session still works in memory */ } };
export const isSessionOpen = () => !!root;

// ---------- building a session
/** Pre-fill from the previous session, set by set, so the numbers are already where you left them. */
function blankSets(exId, count, target) {
  const ex = EX[exId], last = lastSession(exId);
  return Array.from({ length: count }, (_, i) => {
    const ref = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
    const r = ref ? ref.r : target === 'max' ? '' : ex.type === 'time' ? parseReps(target) || 30 : parseReps(target);
    return { w: ex.type === 'time' ? '' : ref ? ref.w || '' : '', r, done: false };
  });
}
const freshSession = ({ name, dayIdx, items }) => ({
  id: uid(), name, dayIdx, start: Date.now(), rest: null, prs: [],
  exercises: items.filter(it => EX[it.id]).map(it => ({ id: it.id, target: it.reps || '', sets: blankSets(it.id, it.sets || 3, it.reps) })),
});

/** Start a session. If one is already running the user chooses: resume it or replace it — never silently overwritten. */
export async function startSession(opts) {
  const existing = S || getSession();
  if (existing) {
    const choice = await choose({
      title: 'A session is already open',
      text: `“${existing.name}” is still in progress. Resume it, or start “${opts.name}” instead (the open one will be discarded).`,
      options: [['resume', 'Resume it', 'primary'], ['replace', 'Start new session', 'danger'], ['cancel', 'Cancel', 'ghost']],
    });
    if (choice === 'resume') return resumeSession();
    if (choice !== 'replace') return;
  }
  S = freshSession(opts); save(); mount();
}

export async function resumeSession() {
  const stored = getSession(); if (!stored) { S = null; return; }
  S = stored;
  if (Date.now() - S.start > STALE_MS) {
    const choice = await choose({
      title: 'Old session found',
      text: `“${S.name}” was started ${dayLabel(dateKey(new Date(S.start)))} at ${new Date(S.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`,
      options: [['resume', 'Resume', 'primary'], ['save', 'Save completed sets', 'ghost'], ['discard', 'Discard', 'danger']],
    });
    if (choice === 'save') { finish(true); return; }
    if (choice === 'discard') { S = null; save(); return; }
    if (choice !== 'resume') { S = null; return; }
  }
  mount();
}

/** Small multi-choice sheet; resolves with the chosen value or null if dismissed. */
function choose({ title, text, options }) {
  return new Promise(res => {
    let done = false;
    openSheet({
      title, body: `<p class="muted pad-b">${esc(text)}</p><div class="stack">${options.map(([v, l, k]) => `<button class="btn ${k} block" data-v="${v}">${esc(l)}</button>`).join('')}</div>`,
      onClose: () => { if (!done) res(null); },
      onMount: (el, sh) => { $$('[data-v]', el).forEach(b => (b.onclick = () => { done = true; res(b.dataset.v); sh.close(); })); },
    });
  });
}

// ---------- mounting
function mount() {
  root?.remove();
  root = document.createElement('div');
  root.className = 'session';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Workout session');
  document.body.appendChild(root);
  document.body.classList.add('noscroll');
  render();
  clearInterval(tick); tick = setInterval(updateClock, 500);
  root.addEventListener('input', onInput);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('.sheet-wrap')) unmount(); });
  requestAnimationFrame(() => { root?.classList.add('on'); root?.querySelector('.s-top button')?.focus({ preventScroll: true }); });
}
function unmount() {
  clearInterval(tick);
  const r = root; r?.classList.remove('on'); setTimeout(() => r?.remove(), 350);
  root = null; document.body.classList.remove('noscroll');
}

// another window finished or changed this session: follow it rather than fight it
window.addEventListener('storage', e => {
  if (e.key !== SESSION_KEY || !root) return;
  const next = getSession();
  if (!next) { S = null; unmount(); toast('This session was ended in another window.'); }
  else if (next.id === S?.id && !root.contains(document.activeElement)) { S = next; render(); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && root) updateClock(); });

// ---------- rendering
const unitOf = ex => (ex.type === 'time' ? 'sec' : 'reps');
const setTxt = (ex, s) => (ex.type === 'time' ? `${s.r} s` : `${s.w ? s.w + '×' : ''}${s.r}`);

function exCard(e, ei) {
  const ex = EX[e.id], last = lastSession(e.id), hint = overloadHint(e.id, e.target);
  const wl = ex.type === 'wt' ? 'kg' : ex.type === 'bw' ? '+kg' : '';
  const doneN = e.sets.filter(s => s.done).length;
  const rows = e.sets.map((s, si) => `
    <div class="set${s.done ? ' done' : ''}${s.pr ? ' pr' : ''}">
      <span class="sn">${si + 1}</span>
      ${ex.type === 'time' ? '<span class="wspace"></span>' : `<label class="num"><input inputmode="decimal" data-e="${ei}" data-s="${si}" data-f="w" value="${esc(s.w)}" placeholder="${ex.type === 'bw' ? '0' : '—'}" aria-label="Set ${si + 1} weight"><i>${wl}</i></label>`}
      <label class="num"><input inputmode="numeric" data-e="${ei}" data-s="${si}" data-f="r" value="${esc(s.r)}" placeholder="${esc(e.target && e.target !== 'max' ? parseReps(e.target) : '—')}" aria-label="Set ${si + 1} ${unitOf(ex)}"><i>${unitOf(ex)}</i></label>
      <button class="chk${s.done ? ' on' : ''}" data-act="check" data-e="${ei}" data-s="${si}" aria-pressed="${!!s.done}" aria-label="Set ${si + 1} complete">${icon('check')}</button>
      ${s.pr ? '<span class="prb">PR</span>' : ''}
    </div>`).join('');
  return `<article class="ex-card">
    <header><button class="exname" data-act="hist" data-e="${ei}" aria-label="History for ${esc(ex.name)}"><h3>${esc(ex.name)}</h3><p class="muted sm">${ex.p.map(m => MUSCLES[m]).join(' · ')}${e.target ? ` · target ${esc(e.target)}` : ''} · ${doneN}/${e.sets.length}</p></button>
    <button class="icon-btn" data-act="rmex" data-e="${ei}" aria-label="Remove ${esc(ex.name)}">${icon('trash')}</button></header>
    ${last ? `<p class="lastline"><span>Last · ${dayLabel(last.key)}</span>${last.sets.slice(0, 5).map(s => `<i>${esc(setTxt(ex, s))}</i>`).join('')}</p>` : '<p class="lastline muted">First time. Set your baseline.</p>'}
    ${hint ? `<button class="hint" data-act="usehint" data-e="${ei}"><b>Try ${esc(hint.text)}</b><small>${esc(hint.why)} · tap to apply</small></button>` : ''}
    ${rows}
    <button class="link" data-act="addset" data-e="${ei}">+ Add set</button>
  </article>`;
}

function render() {
  const scroll = root.querySelector('.s-body')?.scrollTop || 0;
  root.innerHTML = `
    <header class="s-top"><button class="btn ghost sm" data-act="close">Minimise</button>
      <div class="s-title"><strong>${esc(S.name)}</strong><span class="clock" id="clock">0:00</span></div>
      <button class="btn primary sm" data-act="finish">Finish</button></header>
    <div class="s-body">${S.exercises.map(exCard).join('') || '<div class="empty"><p class="muted">Add your first exercise to begin.</p></div>'}
      <button class="btn ghost block" data-act="addex">${icon('plus')} Add exercise</button>
      <button class="link danger-t" data-act="discard">Discard session</button></div>
    <div class="rest" id="rest" hidden role="timer" aria-live="off">
      <svg class="rring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="t"/><circle cx="18" cy="18" r="15.5" class="v" id="rv" transform="rotate(-90 18 18)"/></svg>
      <div class="rtxt"><span class="rl" id="rlab">Rest</span><b id="rt">1:30</b></div>
      <button data-act="r-15" aria-label="Minus 15 seconds">−15</button><button data-act="r+15" aria-label="Plus 15 seconds">+15</button><button data-act="rskip">Skip</button></div>
    <div class="sr-only" id="live" aria-live="polite"></div>`;
  root.querySelector('.s-body').scrollTop = scroll;
  updateClock(true);
}

let lastLeft = null;
function updateClock(force) {
  if (!root || !S) return;
  const c = $('#clock', root); if (c) c.textContent = mmss((Date.now() - S.start) / 1000);
  const box = $('#rest', root); if (!box) return;
  const r = S.rest;
  if (!r) { box.hidden = true; lastLeft = null; return; }
  const left = Math.ceil((r.end - Date.now()) / 1000);
  if (left <= 0) {
    S.rest = null; save(); box.hidden = true; lastLeft = null;
    if (!force) { try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch { /* ignore */ } toast('Rest over. Next set.'); const l = $('#live', root); if (l) l.textContent = 'Rest over'; }
    return;
  }
  box.hidden = false; box.classList.toggle('low', left <= 5);
  $('#rt', root).textContent = mmss(left);
  const total = Math.max(r.total || left, left), v = $('#rv', root);
  if (v) { v.style.strokeDasharray = '97.4'; v.style.strokeDashoffset = String(97.4 * (1 - left / total)); }
  if (r.label) $('#rlab', root).textContent = r.label;
  if (left !== lastLeft && (left === 10 || left === 3)) { const l = $('#live', root); if (l) l.textContent = `${left} seconds`; }
  lastLeft = left;
}

// ---------- interaction
function onInput(e) {
  const t = e.target; if (!t.dataset.f) return;
  S.exercises[+t.dataset.e].sets[+t.dataset.s][t.dataset.f] = t.value.replace(',', '.');
  save();
}

function startRest(secs, label) { S.rest = { end: Date.now() + secs * 1000, total: secs, label }; }

async function onClick(ev) {
  const b = ev.target.closest('[data-act]'); if (!b || !S) return;
  const act = b.dataset.act, ei = +b.dataset.e, si = +b.dataset.s, e = S.exercises[ei];
  if (act === 'check') {
    const sets = e.sets, s = sets[si]; s.done = !s.done;
    if (s.done) {
      const prev = sets[si - 1];
      if (prev && (s.w === '' || s.w == null) && prev.w !== '' && prev.w != null) s.w = prev.w; // carry weight forward
      if (prev && (s.r === '' || s.r == null) && prev.r) s.r = prev.r;
      for (let k = si + 1; k < sets.length; k++) if (!sets[k].done && (sets[k].w === '' || sets[k].w == null) && s.w !== '') sets[k].w = s.w;
      const cur = { w: +s.w || 0, r: +s.r || 0 };
      if (cur.r > 0 && isPR(e.id, cur) && !S.prs.some(p => p.id === e.id && p.si === si && p.ei === ei)) {
        s.pr = true; S.prs.push({ id: e.id, ei, si, w: cur.w, r: cur.r });
        toast(`New personal best · ${EX[e.id].name}`, 3200);
        try { navigator.vibrate && navigator.vibrate([30, 40, 30]); } catch { /* ignore */ }
      } else { s.pr = false; try { navigator.vibrate && navigator.vibrate(18); } catch { /* ignore */ } }
      if (si < sets.length - 1 || ei < S.exercises.length - 1) startRest(get().profile.restSec || 90, si < sets.length - 1 ? `Next · set ${si + 2}` : `Next · ${EX[S.exercises[ei + 1]?.id]?.name || 'exercise'}`);
      else S.rest = null;
    } else { s.pr = false; S.prs = S.prs.filter(p => !(p.ei === ei && p.si === si)); }
    save(); render();
    const chk = root.querySelector(`.chk[data-e="${ei}"][data-s="${si}"]`); if (s.done && chk) { chk.classList.add('pop'); }
  } else if (act === 'addset') {
    const l = e.sets[e.sets.length - 1] || {}; e.sets.push({ w: l.w ?? '', r: l.r ?? '', done: false }); save(); render();
  } else if (act === 'usehint') {
    const h = overloadHint(e.id, e.target); if (!h) return;
    e.sets.forEach(s => { if (!s.done) { if (EX[e.id].type !== 'time') s.w = h.w || s.w; s.r = h.r; } }); save(); render(); toast('Targets updated');
  } else if (act === 'hist') openExerciseHistory(e.id, e.target);
  else if (act === 'rmex') {
    if (e.sets.some(s => s.done) && !(await confirmSheet({ title: 'Remove exercise?', text: 'Its completed sets will be dropped from this session.', ok: 'Remove', danger: true }))) return;
    S.exercises.splice(ei, 1); save(); render();
  } else if (act === 'addex') pickExercise(id => { S.exercises.push({ id, target: '', sets: blankSets(id, 3, '') }); save(); render(); });
  else if (act === 'r-15' && S.rest) { S.rest.end -= 15000; S.rest.total = Math.max(S.rest.total, 15); save(); updateClock(); }
  else if (act === 'r+15' && S.rest) { S.rest.end += 15000; S.rest.total += 15; save(); updateClock(); }
  else if (act === 'rskip') { S.rest = null; save(); updateClock(); }
  else if (act === 'close') unmount();
  else if (act === 'discard') {
    if (await confirmSheet({ title: 'Discard session?', text: 'Nothing from this session will be saved.', ok: 'Discard', danger: true })) { S = null; save(); unmount(); }
  } else if (act === 'finish') finish();
}

export function pickExercise(onPick) {
  let q = '', m = 'all';
  const sheet = openSheet({
    title: 'Add exercise', tall: true,
    body: `<input class="input" placeholder="Search" id="q" aria-label="Search exercises"><div class="chips" id="mc"><button class="chip on" data-m="all" aria-pressed="true">All</button>${Object.entries(MUSCLES).map(([k, v]) => `<button class="chip" data-m="${k}" aria-pressed="false">${v}</button>`).join('')}</div><div id="exl" class="list"></div>`,
    onMount: el => {
      const draw = () => {
        const list = EXERCISES.filter(e => (m === 'all' || e.p.includes(m) || e.s.includes(m)) && e.name.toLowerCase().includes(q));
        $('#exl', el).innerHTML = list.map(e => `<button class="row" data-id="${e.id}"><span class="grow"><b>${esc(e.name)}</b><small>${e.p.map(x => MUSCLES[x]).join(' · ')} · ${e.loc === 'home' ? 'Home' : e.loc === 'street' ? 'Street' : 'Anywhere'}</small></span>${icon('plus')}</button>`).join('') || '<p class="muted center pad">No match.</p>';
      };
      draw();
      $('#q', el).oninput = e => { q = e.target.value.toLowerCase().trim(); draw(); };
      $('#mc', el).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; m = c.dataset.m; $$('.chip', el).forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); }); draw(); };
      $('#exl', el).onclick = e => { const r = e.target.closest('[data-id]'); if (r) { onPick(r.dataset.id); sheet.close(); } };
    },
  });
}

// ---------- finishing
function finish(fromStale = false) {
  const done = S.exercises.map(e => ({ id: e.id, sets: e.sets.filter(s => s.done && (+s.r || 0) > 0).map(s => ({ w: +s.w || 0, r: +s.r || 0 })) })).filter(e => e.sets.length);
  if (!done.length) {
    if (fromStale) { toast('Nothing was completed, so nothing was saved.'); S = null; save(); return; }
    toast('Complete at least one set to save the session'); return;
  }
  const started = new Date(S.start), before = muscleStats();
  const workout = {
    id: S.id, date: started.toISOString(), key: dateKey(started), name: S.name, dayIdx: S.dayIdx,
    dur: Math.max(1, Math.min(240, Math.round((Date.now() - S.start) / 60000))), exercises: done,
  };
  const gain = computeXP([workout]), prs = S.prs.slice();
  update(st => { st.workouts.push(workout); st.workouts.sort((a, b) => (a.date < b.date ? -1 : 1)); });
  const after = muscleStats();
  S = null; save(); unmount();
  summary(workout, gain, before, after, prs);
}

function summary(w, gain, before, after, prs) {
  const vol = w.exercises.reduce((a, e) => a + e.sets.reduce((x, s) => x + (s.w || 0) * s.r, 0), 0);
  const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const rows = Object.entries(gain).filter(([, v]) => v.xp > 0.5).sort((a, b) => b[1].xp - a[1].xp).map(([m, v]) => {
    const up = after[m].level > before[m].level;
    return `<div class="gain"><span>${MUSCLES[m]}${up ? ` <em class="up">Level ${after[m].level} · ${after[m].name}</em>` : ''}</span><b>+${fmt(v.xp)} XP</b><div class="bar"><i style="width:${Math.round(after[m].pct * 100)}%"></i></div></div>`;
  }).join('');
  const prRows = prs.length ? `<h4 class="eyebrow pad-t">Personal bests</h4><div class="gains">${prs.map(p => `<div class="gain"><span>${esc(EX[p.id].name)}</span><b>${p.w ? p.w + ' kg × ' : ''}${p.r}</b></div>`).join('')}</div>` : '';
  openSheet({
    title: 'Session complete',
    body: `${plate('sword', '', 'banner dim')}<div class="sum-hero"><div class="big-serif">${esc(w.name)}</div><p class="muted">${w.dur} min · ${sets} sets${vol ? ` · ${fmt(vol)} kg volume` : ''}</p></div>${prRows}<h4 class="eyebrow pad-t">Muscle progress</h4><div class="gains">${rows}</div>`,
  });
}
