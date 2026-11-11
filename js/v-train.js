import { get, update, weekdayIdx, dateKey } from './store.js';
import { EX, MUSCLES, WEEKDAYS, WD } from './data.js';
import { esc, icon, $, $$, openSheet, fmt, toast } from './ui.js';
import { startSession, getSession, resumeSession, pickExercise } from './session.js';
import { openSettings } from './v-settings.js';

let tab = 'plan';

export function trainView(el) {
  const s = get(), di = weekdayIdx();
  const sess = getSession();
  el.innerHTML = `
  <header class="lt"><div><div class="eyebrow">Programme</div><h1>Train</h1></div><button class="icon-btn lg" id="gear">${icon('gear')}</button></header>
  ${sess ? `<button class="card resume" id="resume"><span class="pulse"></span><div><b>Session in progress</b><small>${esc(sess.name)} · tap to resume</small></div>${icon('chev')}</button>` : ''}
  <div class="seg" id="seg"><button data-t="plan" class="${tab === 'plan' ? 'on' : ''}">Plan</button><button data-t="hist" class="${tab === 'hist' ? 'on' : ''}">History</button></div>
  <div id="pane"></div>`;
  $('#gear', el).onclick = openSettings;
  $('#resume', el)?.addEventListener('click', resumeSession);
  $('#seg', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; $$('#seg button', el).forEach(x => x.classList.toggle('on', x === b)); draw(); };
  const pane = $('#pane', el);

  function draw() { tab === 'plan' ? plan() : hist(); }

  function plan() {
    const st = get();
    pane.innerHTML = `
    <div class="plan-h"><div><b class="serif-m">${esc(st.plan.name)}</b><p class="muted sm">${esc(st.plan.rationale || '')}</p></div></div>
    <div class="list">${st.plan.days.map((d, i) => `
      <button class="row day${i === di ? ' today' : ''}" data-d="${i}">
        <span class="dn">${WD[i]}</span>
        <span class="grow"><b>${esc(d.title)}</b><small>${d.rest ? 'Recovery' : esc(d.focus)}</small></span>${d.ex.length ? `<span class="trail">${d.ex.length} ex</span>` : ''}${icon('chev')}
      </button>`).join('')}</div>
    <button class="btn ghost block" id="open">${icon('plus')} Start an open session</button>
    <p class="muted sm center pad">Ask the Coach to rebuild this plan around what you want to improve.</p>`;
    $('#open', pane).onclick = () => startSession({ name: 'Open session', dayIdx: di, items: [] });
    pane.onclick = e => { const r = e.target.closest('[data-d]'); if (r) dayDetail(+r.dataset.d); };
  }

  function hist() {
    const ws = [...get().workouts].reverse();
    pane.onclick = e => { const r = e.target.closest('[data-w]'); if (r) workoutDetail(r.dataset.w); };
    if (!ws.length) { pane.innerHTML = `<div class="empty"><div class="big-serif">No sessions yet</div><p class="muted">Your first logged session starts the muscle map.</p></div>`; return; }
    pane.innerHTML = `<div class="list">${ws.map(w => {
      const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
      const d = new Date(w.date);
      return `<button class="row" data-w="${w.id}"><span class="grow"><b>${esc(w.name)}</b><small>${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${w.dur} min · ${sets} sets</small></span>${icon('chev')}</button>`;
    }).join('')}</div>`;
  }
  draw();
}

function workoutDetail(id) {
  const w = get().workouts.find(x => x.id === id); if (!w) return;
  openSheet({
    title: w.name, tall: true,
    body: `<p class="muted pad-b">${new Date(w.date).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })} · ${w.dur} min</p>
    ${w.exercises.map(e => `<div class="card flat"><b>${esc(EX[e.id]?.name || e.id)}</b><div class="setline">${e.sets.map((s, i) => `<span>${i + 1} · ${s.w ? s.w + ' kg × ' : ''}${s.r}${EX[e.id]?.type === 'time' ? ' s' : ''}</span>`).join('')}</div></div>`).join('')}
    <button class="btn danger block" id="del">Delete session</button>`,
    onMount: (el, sh) => { $('#del', el).onclick = () => { update(s => { s.workouts = s.workouts.filter(x => x.id !== id); }); sh.close(); toast('Session deleted'); location.reload(); }; },
  });
}

function dayDetail(i) {
  const draft = JSON.parse(JSON.stringify(get().plan.days[i]));
  const sh = openSheet({
    title: WEEKDAYS[i], tall: true,
    onMount: (el, api) => {
      const draw = () => {
        el.innerHTML = `
        <label class="field"><span>Title</span><input class="input" id="t" value="${esc(draft.title)}"></label>
        <label class="field"><span>Focus</span><input class="input" id="f" value="${esc(draft.focus)}"></label>
        <label class="toggle"><span>Rest day</span><input type="checkbox" id="r" ${draft.rest ? 'checked' : ''}><i></i></label>
        <div id="exs">${draft.rest ? '' : draft.ex.map((e, k) => `
          <div class="ex-edit"><span class="grow"><b>${esc(EX[e.id]?.name)}</b><small>${EX[e.id]?.p.map(m => MUSCLES[m]).join(' · ')}</small></span>
          <input class="mini" inputmode="numeric" data-k="${k}" data-f="sets" value="${e.sets}" aria-label="Sets"><em>×</em><input class="mini w" data-k="${k}" data-f="reps" value="${esc(e.reps)}" aria-label="Reps">
          <button class="icon-btn" data-rm="${k}">${icon('x')}</button></div>`).join('')}
          ${draft.rest ? '' : `<button class="btn ghost block" id="add">${icon('plus')} Add exercise</button>`}</div>
        <div class="stack"><button class="btn primary block" id="save">Save</button>${draft.rest ? '' : `<button class="btn ghost block" id="go">Start this session</button>`}</div>`;
        $('#t', el).oninput = e => (draft.title = e.target.value);
        $('#f', el).oninput = e => (draft.focus = e.target.value);
        $('#r', el).onchange = e => { draft.rest = e.target.checked; if (draft.rest) { draft.title = 'Rest'; draft.focus = 'Recovery'; } else if (draft.title === 'Rest') { draft.title = 'Session'; draft.focus = ''; } draw(); };
        $$('[data-f]', el).forEach(inp => (inp.oninput = e => { const x = draft.ex[+e.target.dataset.k]; x[e.target.dataset.f] = e.target.dataset.f === 'sets' ? Math.max(1, parseInt(e.target.value) || 1) : e.target.value; }));
        $$('[data-rm]', el).forEach(b => (b.onclick = () => { draft.ex.splice(+b.dataset.rm, 1); draw(); }));
        $('#add', el)?.addEventListener('click', () => pickExercise(id => { draft.ex.push({ id, sets: 3, reps: '10' }); draw(); }));
        $('#save', el).onclick = () => { update(s => { s.plan.days[i] = { ...draft, ex: draft.rest ? [] : draft.ex }; }); api.close(); toast('Plan saved'); location.reload(); };
        $('#go', el)?.addEventListener('click', () => { api.close(); startSession({ name: draft.title, dayIdx: i, items: draft.ex }); });
      };
      draw();
    },
  });
}
