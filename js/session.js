// ALVéON PRIVÉ — live workout logger (full-screen), rest timer, XP summary
import { get, update, uid, dateKey, lastPerf, muscleStats } from './store.js';
import { EX, EXERCISES, MUSCLES, levelInfo, setXP, parseReps, computeXP } from './data.js';
import { $, $$, esc, icon, openSheet, toast, confirmSheet, mmss, fmt } from './ui.js';

const SKEY = 'alveon.session';
let S = null, root = null, tick = null, rest = null; // rest = {end, total}

export const getSession = () => { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } };
const save = () => { try { S ? localStorage.setItem(SKEY, JSON.stringify(S)) : localStorage.removeItem(SKEY); } catch { /* ignore */ } };

function blankSets(exId, count, target) {
  const ex = EX[exId], last = lastPerf(exId);
  const r = last ? last.r : (ex.type === 'time' ? parseReps(target) || 30 : parseReps(target));
  const w = last ? last.w : '';
  return Array.from({ length: count }, () => ({ w: ex.type === 'time' ? '' : w, r: target === 'max' && !last ? '' : r, done: false }));
}

export function startSession({ name, dayIdx = null, items = [] }) {
  if (getSession() && !S) { resumeSession(); return; }
  S = {
    id: uid(), name, dayIdx, start: Date.now(),
    exercises: items.map(it => ({ id: it.id, target: it.reps || '', sets: blankSets(it.id, it.sets || 3, it.reps) })),
  };
  save(); mount();
}
export function resumeSession() { S = getSession(); if (S) mount(); }

function mount() {
  root?.remove();
  root = document.createElement('div');
  root.className = 'session';
  document.body.appendChild(root);
  document.body.classList.add('noscroll');
  render();
  clearInterval(tick);
  tick = setInterval(updateClock, 500);
  root.addEventListener('input', onInput);
  root.addEventListener('click', onClick);
  requestAnimationFrame(() => root.classList.add('on'));
}
function unmount() {
  clearInterval(tick); rest = null;
  root?.classList.remove('on');
  const r = root; setTimeout(() => r?.remove(), 350);
  root = null; document.body.classList.remove('noscroll');
}

function render() {
  const scroll = root.querySelector('.s-body')?.scrollTop || 0;
  const cards = S.exercises.map((e, ei) => {
    const ex = EX[e.id]; const last = lastPerf(e.id);
    const unit = ex.type === 'time' ? 'sec' : 'reps';
    const wl = ex.type === 'wt' ? 'kg' : ex.type === 'bw' ? '+kg' : '';
    const rows = e.sets.map((s, si) => `
      <div class="set${s.done ? ' done' : ''}">
        <span class="sn">${si + 1}</span>
        ${ex.type === 'time' ? '<span class="wspace"></span>' : `<label class="num"><input inputmode="decimal" data-e="${ei}" data-s="${si}" data-f="w" value="${esc(s.w)}" placeholder="${ex.type === 'bw' ? '0' : '—'}" aria-label="Weight"><i>${wl}</i></label>`}
        <label class="num"><input inputmode="numeric" data-e="${ei}" data-s="${si}" data-f="r" value="${esc(s.r)}" placeholder="${esc(e.target && e.target !== 'max' ? parseReps(e.target) : '—')}" aria-label="${unit}"><i>${unit}</i></label>
        <button class="chk${s.done ? ' on' : ''}" data-act="check" data-e="${ei}" data-s="${si}" aria-label="Complete set">${icon('check')}</button>
      </div>`).join('');
    return `<article class="ex-card">
      <header><div><h3>${esc(ex.name)}</h3><p class="muted sm">${ex.p.map(m => MUSCLES[m]).join(' · ')}${e.target ? ` · target ${esc(e.target)}` : ''}${last ? ` · last ${last.w ? last.w + ' kg × ' : ''}${last.r}` : ''}</p></div>
      <button class="icon-btn" data-act="rmex" data-e="${ei}" aria-label="Remove exercise">${icon('trash')}</button></header>
      ${rows}
      <button class="link" data-act="addset" data-e="${ei}">+ Add set</button>
    </article>`;
  }).join('');
  root.innerHTML = `
    <header class="s-top"><button class="btn ghost sm" data-act="close">Minimise</button>
      <div class="s-title"><strong>${esc(S.name)}</strong><span class="clock" id="clock">0:00</span></div>
      <button class="btn primary sm" data-act="finish">Finish</button></header>
    <div class="s-body">${cards || '<p class="muted center pad">Add your first exercise.</p>'}
      <button class="btn ghost block" data-act="addex">${icon('plus')} Add exercise</button>
      <button class="link danger-t" data-act="discard">Discard session</button></div>
    <div class="rest" id="rest" hidden><span class="rl">Rest</span><b id="rt">1:30</b><button data-act="r-15">−15</button><button data-act="r+15">+15</button><button data-act="rskip">Skip</button></div>`;
  root.querySelector('.s-body').scrollTop = scroll;
  updateClock();
}

function updateClock() {
  if (!root) return;
  const c = $('#clock', root); if (c) c.textContent = mmss((Date.now() - S.start) / 1000);
  const box = $('#rest', root);
  if (!box) return;
  if (rest) {
    const left = Math.ceil((rest.end - Date.now()) / 1000);
    if (left <= 0) { rest = null; box.hidden = true; if (navigator.vibrate) navigator.vibrate([120, 60, 120]); toast('Rest over — next set'); }
    else { box.hidden = false; $('#rt', root).textContent = mmss(left); }
  } else box.hidden = true;
}

function onInput(e) {
  const t = e.target; if (!t.dataset.f) return;
  S.exercises[+t.dataset.e].sets[+t.dataset.s][t.dataset.f] = t.value.replace(',', '.');
  save();
}

async function onClick(ev) {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, ei = +b.dataset.e, si = +b.dataset.s;
  if (act === 'check') {
    const sets = S.exercises[ei].sets, s = sets[si]; s.done = !s.done;
    if (s.done) {
      const prev = sets[si - 1];
      if (prev && (s.w === '' || s.w == null) && prev.w !== '' && prev.w != null) s.w = prev.w; // carry weight forward
      if (prev && (s.r === '' || s.r == null) && prev.r) s.r = prev.r;
      // later empty sets inherit the weight just used
      for (let k = si + 1; k < sets.length; k++) if (!sets[k].done && (sets[k].w === '' || sets[k].w == null) && s.w !== '') sets[k].w = s.w; const secs = get().profile.restSec || 90; rest = { end: Date.now() + secs * 1000 }; if (navigator.vibrate) navigator.vibrate(18); }
    save(); render();
  } else if (act === 'addset') {
    const sets = S.exercises[ei].sets; const l = sets[sets.length - 1] || {};
    sets.push({ w: l.w ?? '', r: l.r ?? '', done: false }); save(); render();
  } else if (act === 'rmex') { S.exercises.splice(ei, 1); save(); render(); }
  else if (act === 'addex') pickExercise(id => { S.exercises.push({ id, target: '', sets: blankSets(id, 3, '') }); save(); render(); });
  else if (act === 'r-15' && rest) { rest.end -= 15000; updateClock(); }
  else if (act === 'r+15' && rest) { rest.end += 15000; updateClock(); }
  else if (act === 'rskip') { rest = null; updateClock(); }
  else if (act === 'close') unmount();
  else if (act === 'discard') { if (await confirmSheet({ title: 'Discard session?', text: 'Nothing from this session will be saved.', ok: 'Discard', danger: true })) { S = null; save(); unmount(); } }
  else if (act === 'finish') finish();
}

export function pickExercise(onPick) {
  let q = '', m = 'all';
  const sheet = openSheet({
    title: 'Add exercise', tall: true,
    body: `<input class="input" placeholder="Search" id="q"><div class="chips" id="mc"><button class="chip on" data-m="all">All</button>${Object.entries(MUSCLES).map(([k, v]) => `<button class="chip" data-m="${k}">${v}</button>`).join('')}</div><div id="exl" class="list"></div>`,
    onMount: el => {
      const draw = () => {
        const list = EXERCISES.filter(e => (m === 'all' || e.p.includes(m) || e.s.includes(m)) && e.name.toLowerCase().includes(q));
        $('#exl', el).innerHTML = list.map(e => `<button class="row" data-id="${e.id}"><span class="grow"><b>${esc(e.name)}</b><small>${e.p.map(x => MUSCLES[x]).join(' · ')} · ${e.loc === 'home' ? 'Home' : e.loc === 'street' ? 'Street' : 'Anywhere'}</small></span>${icon('plus')}</button>`).join('') || '<p class="muted center pad">No match.</p>';
      };
      draw();
      $('#q', el).oninput = e => { q = e.target.value.toLowerCase(); draw(); };
      $('#mc', el).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; m = c.dataset.m; $$('.chip', el).forEach(x => x.classList.toggle('on', x === c)); draw(); };
      $('#exl', el).onclick = e => { const r = e.target.closest('[data-id]'); if (r) { onPick(r.dataset.id); sheet.close(); } };
    },
  });
}

function finish() {
  const done = S.exercises.map(e => ({ id: e.id, sets: e.sets.filter(s => s.done && (+s.r || 0) > 0).map(s => ({ w: +s.w || 0, r: +s.r || 0 })) })).filter(e => e.sets.length);
  if (!done.length) {
    toast('Complete at least one set to save the session');
    return;
  }
  const before = muscleStats();
  const workout = { id: S.id, date: new Date().toISOString(), key: dateKey(), name: S.name, dayIdx: S.dayIdx, dur: Math.max(1, Math.round((Date.now() - S.start) / 60000)), exercises: done };
  const gain = computeXP([workout]);
  update(st => { st.workouts.push(workout); });
  const after = muscleStats();
  S = null; save(); unmount();
  summary(workout, gain, before, after);
}

function summary(w, gain, before, after) {
  const vol = w.exercises.reduce((a, e) => a + e.sets.reduce((x, s) => x + (s.w || 0) * s.r, 0), 0);
  const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const rows = Object.entries(gain).filter(([, v]) => v.xp > 0.5).sort((a, b) => b[1].xp - a[1].xp).map(([m, v]) => {
    const up = after[m].level > before[m].level;
    return `<div class="gain"><span>${MUSCLES[m]}${up ? ` <em class="up">Level ${after[m].level} · ${after[m].name}</em>` : ''}</span><b>+${fmt(v.xp)} XP</b><div class="bar"><i style="width:${Math.round(after[m].pct * 100)}%"></i></div></div>`;
  }).join('');
  openSheet({
    title: 'Session complete',
    body: `<div class="sum-hero"><div class="big-serif">${esc(w.name)}</div><p class="muted">${w.dur} min · ${sets} sets${vol ? ` · ${fmt(vol)} kg volume` : ''}</p></div><h4 class="eyebrow">Muscle progress</h4><div class="gains">${rows}</div>`,
  });
}
