// ALVéON PRIVÉ — Train: weekly plan, editable days, session history and consistency.
import { get, update, weekdayIdx, revertPlan } from './store.js';
import { EX, MUSCLES, WEEKDAYS, WD } from './data.js';
import { esc, icon, $, $$, openSheet, fmt, toast, plate, pageHeader, resumeCard, emptyState, errorState, segHTML, bindSeg, withUndo } from './ui.js';
import { startSession, getSession, resumeSession, pickExercise } from './session.js';
import { openSettings } from './v-settings.js';
import { openExerciseHistory } from './history.js';
import { weeklyStats, recentPRs } from './progress.js';
import { dayLabel } from './dates.js';
import { rerender } from './quick.js';

let tab = 'plan';

export function trainView(el) {
  const di = weekdayIdx();
  el.innerHTML = `${pageHeader('Programme', 'Train')}${resumeCard(getSession())}
  ${segHTML('seg', [['plan', 'Plan'], ['hist', 'History']], tab)}
  <div id="pane"></div>
  ${plate('david', 'Strength is quiet.', 'right')}`;
  $('#gear', el).onclick = openSettings;
  $('#resume', el)?.addEventListener('click', resumeSession);
  const pane = $('#pane', el);
  bindSeg(el, 'seg', v => { tab = v; draw(); });

  function draw() {
    try { tab === 'plan' ? plan() : hist(); }
    catch (e) { console.error(e); pane.innerHTML = errorState('This list could not load.'); $('[data-retry]', pane)?.addEventListener('click', draw); }
  }

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
    ${st.prevPlan ? `<button class="link" id="revert">Revert to the previous plan</button>` : ''}
    <p class="muted sm center pad">Ask the Coach to rebuild this plan around what you want to improve.</p>`;
    $('#open', pane).onclick = () => startSession({ name: 'Open session', dayIdx: di, items: [] });
    $('#revert', pane)?.addEventListener('click', () => { if (revertPlan()) { toast('Previous plan restored'); rerender(); } });
    pane.onclick = e => { const r = e.target.closest('[data-d]'); if (r) dayDetail(+r.dataset.d); };
  }

  function hist() {
    const ws = [...get().workouts].reverse();
    pane.onclick = e => { const r = e.target.closest('[data-w]'); if (r) workoutDetail(r.dataset.w); };
    if (!ws.length) { pane.innerHTML = emptyState({ title: 'No sessions yet', text: 'Your first logged session starts the muscle map. Past training counts too: tell the Coach what you did.', art: plate('cliff', 'Every rep is a vow.', 'vig dim') }); return; }
    const weeks = weeklyStats(4), prs = recentPRs(3, 60);
    const bars = `<section class="card"><div class="split"><div class="eyebrow">Consistency</div><div class="muted sm">sessions per week</div></div>
      <div class="wbars" role="img" aria-label="Sessions per week: ${weeks.map(w => `${w.label} ${w.sessions} of ${w.planned}`).join(', ')}">${weeks.map(w => `<div class="wb${w.sessions >= w.planned ? ' full' : ''}"><i style="height:${Math.max(6, Math.min(100, (w.sessions / w.planned) * 100))}%"></i><b>${w.sessions}</b><span>${esc(w.label)}</span></div>`).join('')}</div></section>
      ${prs.length ? `<section class="card flat"><div class="eyebrow">Recent personal bests</div>${prs.map(p => `<button class="row slim" data-x="${p.id}"><span class="grow"><b>${esc(EX[p.id]?.name)}</b><small>${esc(dayLabel(p.key))}</small></span><span class="trail">${p.set.w ? p.set.w + ' kg × ' : ''}${p.set.r}</span></button>`).join('')}</section>` : ''}`;
    let month = '';
    const rows = ws.map(w => {
      const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0), d = new Date(w.date);
      const m = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const head = m !== month ? `<div class="eyebrow month">${esc(m)}</div>` : ''; month = m;
      return `${head}<button class="row" data-w="${w.id}"><span class="grow"><b>${esc(w.name)}${w.logged ? ' <em class="tag">logged</em>' : ''}</b><small>${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${w.dur ? w.dur + ' min · ' : ''}${sets} sets</small></span>${icon('chev')}</button>`;
    }).join('');
    pane.innerHTML = `${bars}<div class="list">${rows}</div>`;
    pane.onclick = e => { const x = e.target.closest('[data-x]'); if (x) return openExerciseHistory(x.dataset.x); const r = e.target.closest('[data-w]'); if (r) workoutDetail(r.dataset.w); };
  }
  draw();
}

function workoutDetail(id) {
  const w = get().workouts.find(x => x.id === id); if (!w) return;
  openSheet({
    title: w.name, tall: true,
    body: `<p class="muted pad-b">${new Date(w.date).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}${w.dur ? ` · ${w.dur} min` : ''}</p>
    ${w.exercises.map(e => `<button class="card flat exlink" data-x="${e.id}"><div class="split"><b>${esc(EX[e.id]?.name || e.id)}</b>${icon('chev')}</div><div class="setline">${e.sets.map((s, i) => `<span>${i + 1} · ${s.w ? s.w + ' kg × ' : ''}${s.r}${EX[e.id]?.type === 'time' ? ' s' : ''}</span>`).join('')}</div></button>`).join('')}
    <button class="btn danger block" id="del">Delete session</button>`,
    onMount: (el, sh) => {
      $$('[data-x]', el).forEach(b => (b.onclick = () => openExerciseHistory(b.dataset.x)));
      $('#del', el).onclick = () => {
        const copy = JSON.parse(JSON.stringify(w));
        sh.close();
        withUndo('Session deleted', () => { update(s => { s.workouts = s.workouts.filter(x => x.id !== id); }); rerender(); },
          () => { update(s => { s.workouts.push(copy); s.workouts.sort((a, b) => (a.date < b.date ? -1 : 1)); }); rerender(); toast('Session restored'); });
      };
    },
  });
}

function dayDetail(i) {
  const draft = JSON.parse(JSON.stringify(get().plan.days[i]));
  openSheet({
    title: WEEKDAYS[i], tall: true,
    onMount: (el, api) => {
      const draw = () => {
        el.innerHTML = `
        <label class="field"><span>Title</span><input class="input" id="t" value="${esc(draft.title)}" maxlength="40"></label>
        <label class="field"><span>Focus</span><input class="input" id="f" value="${esc(draft.focus)}" maxlength="70"></label>
        <label class="toggle"><span>Rest day</span><input type="checkbox" id="r" ${draft.rest ? 'checked' : ''}><i></i></label>
        <div id="exs">${draft.rest ? '' : draft.ex.map((e, k) => `
          <div class="ex-edit"><span class="grow"><b>${esc(EX[e.id]?.name)}</b><small>${EX[e.id]?.p.map(m => MUSCLES[m]).join(' · ')}</small></span>
          <input class="mini" inputmode="numeric" data-k="${k}" data-f="sets" value="${e.sets}" aria-label="Sets"><em>×</em><input class="mini w" data-k="${k}" data-f="reps" value="${esc(e.reps)}" aria-label="Reps">
          <button class="icon-btn" data-rm="${k}" aria-label="Remove ${esc(EX[e.id]?.name)}">${icon('x')}</button></div>`).join('')}
          ${draft.rest ? '' : `<button class="btn ghost block" id="add">${icon('plus')} Add exercise</button>`}</div>
        <div class="stack"><button class="btn primary block" id="save">Save</button>${draft.rest ? '' : `<button class="btn ghost block" id="go">Start this session</button>`}</div>`;
        $('#t', el).oninput = e => (draft.title = e.target.value);
        $('#f', el).oninput = e => (draft.focus = e.target.value);
        $('#r', el).onchange = e => { draft.rest = e.target.checked; if (draft.rest) { draft.title = 'Rest'; draft.focus = 'Recovery'; } else if (draft.title === 'Rest') { draft.title = 'Session'; draft.focus = ''; } draw(); };
        $$('[data-f]', el).forEach(inp => (inp.oninput = e => { const x = draft.ex[+e.target.dataset.k]; x[e.target.dataset.f] = e.target.dataset.f === 'sets' ? Math.min(8, Math.max(1, parseInt(e.target.value) || 1)) : e.target.value.slice(0, 12); }));
        $$('[data-rm]', el).forEach(b => (b.onclick = () => { draft.ex.splice(+b.dataset.rm, 1); draw(); }));
        $('#add', el)?.addEventListener('click', () => pickExercise(id => { draft.ex.push({ id, sets: 3, reps: '10' }); draw(); }));
        $('#save', el).onclick = () => {
          if (!draft.rest && !draft.ex.length) { toast('Add at least one exercise, or mark it as a rest day'); return; }
          update(s => { s.plan.days[i] = { ...draft, ex: draft.rest ? [] : draft.ex }; });
          api.close(); toast('Plan saved'); rerender();
        };
        $('#go', el)?.addEventListener('click', () => { api.close(); startSession({ name: draft.title, dayIdx: i, items: draft.ex }); });
      };
      draw();
    },
  });
}
