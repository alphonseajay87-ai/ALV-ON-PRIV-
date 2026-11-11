import { get, dateKey, weekdayIdx, totalsOn, waterOn, workoutDates, streak, physiqueIndex, muscleStats, update, mealsOn } from './store.js';
import { EX, MUSCLES, WD } from './data.js';
import { esc, icon, rings, fmt, dateLong, greeting, go, $ } from './ui.js';
import { getSession, resumeSession, startSession } from './session.js';
import { openSettings } from './v-settings.js';
import { renderBody } from './musclemap.js';

export function todayView(el) {
  const s = get(), key = dateKey(), di = weekdayIdx(), day = s.plan.days[di];
  const t = totalsOn(key), water = waterOn(key), p = s.profile;
  const done = workoutDates().has(key);
  const stats = muscleStats();
  const weakest = Object.entries(stats).sort((a, b) => a[1].frac - b[1].frac)[0];
  const sess = getSession();
  const wk = (() => { // current week dots
    const d = new Date(); d.setDate(d.getDate() - di);
    return WD.map((w, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); const k = dateKey(dd); return { w: w[0], on: workoutDates().has(k), today: i === di, rest: s.plan.days[i].rest }; });
  })();
  const remainP = Math.max(0, p.protein - t.p), remainK = Math.max(0, p.kcal - t.kcal);
  const meals = mealsOn(key);
  const h = new Date().getHours();
  const nudge = meals.length === 0 && h >= 9 ? 'Nothing logged yet today.' : meals.length && remainP > 25 && h >= 14 ? `${fmt(remainP)} g protein to go.` : '';

  el.innerHTML = `
  <header class="lt"><div><div class="eyebrow">${dateLong()}</div><h1>${greeting()},<br><em>${esc(p.name)}</em></h1></div>
  <button class="icon-btn lg" id="gear" aria-label="Settings">${icon('gear')}</button></header>

  ${sess ? `<button class="card resume" id="resume"><span class="pulse"></span><div><b>Session in progress</b><small>${esc(sess.name)} · tap to resume</small></div>${icon('chev')}</button>` : ''}

  <section class="card hero">
    <div class="eyebrow">${day.rest ? 'Recovery' : 'Today’s session'}</div>
    <h2 class="serif-l">${day.rest ? 'Rest & restore' : esc(day.title)}</h2>
    <p class="muted">${day.rest ? 'Sleep, protein and a walk. Growth happens now.' : esc(day.focus)}</p>
    ${day.rest ? '' : `<ul class="mini-list">${day.ex.slice(0, 4).map(e => `<li>${esc(EX[e.id]?.name)}<span>${e.sets} × ${esc(e.reps)}</span></li>`).join('')}${day.ex.length > 4 ? `<li class="more">+ ${day.ex.length - 4} more</li>` : ''}</ul>`}
    ${done ? `<button class="btn ghost block" id="hist">${icon('check')} Completed today — view</button>`
      : day.rest ? `<button class="btn ghost block" id="quick">Train anyway</button>`
      : `<button class="btn primary block" id="begin">Begin session</button>`}
  </section>

  <section class="card rings-card">
    <div class="rings-wrap">${rings([
      { pct: t.kcal / p.kcal, color: 'var(--c1)' },
      { pct: t.p / p.protein, color: 'var(--ivory)' },
      { pct: water / p.water, color: 'var(--c3)' },
    ], 150)}</div>
    <div class="legend">
      <div><i style="background:var(--c1)"></i><span>Energy</span><b>${fmt(t.kcal)}<small> / ${fmt(p.kcal)} kcal</small></b></div>
      <div><i style="background:var(--ivory)"></i><span>Protein</span><b>${fmt(t.p)}<small> / ${fmt(p.protein)} g</small></b></div>
      <div><i style="background:var(--c3)"></i><span>Water</span><b>${(water / 1000).toFixed(1)}<small> / ${(p.water / 1000).toFixed(1)} L</small></b></div>
    </div>
  </section>
  ${nudge ? `<button class="card nudge" id="nudge"><span>${icon('flame')}</span><div><b>${nudge}</b><small>${fmt(remainK)} kcal left today — snap your next meal</small></div>${icon('chev')}</button>` : ''}

  <section class="card">
    <div class="split"><div class="eyebrow">This week</div><div class="muted sm">${streak()} day streak</div></div>
    <div class="week">${wk.map(d => `<div class="wd${d.on ? ' on' : ''}${d.today ? ' today' : ''}${d.rest ? ' rest' : ''}"><i></i><span>${d.w}</span></div>`).join('')}</div>
  </section>

  <button class="card phys" id="phys">
    <div class="phys-fig">${renderBody('front', stats, { size: 'mini' })}</div>
    <div class="phys-t"><div class="eyebrow">Physique index</div><div class="big-serif">${physiqueIndex()}<small>/100</small></div>
    ${weakest ? `<p class="muted sm">Next priority · <b>${MUSCLES[weakest[0]]}</b> (${weakest[1].name})</p>` : ''}<span class="link-s">Open body map ${icon('chev')}</span></div>
  </button>`;

  $('#gear', el).onclick = openSettings;
  $('#resume', el)?.addEventListener('click', resumeSession);
  $('#hist', el)?.addEventListener('click', () => go('#train'));
  $('#begin', el)?.addEventListener('click', () => startSession({ name: day.title, dayIdx: di, items: day.ex }));
  $('#quick', el)?.addEventListener('click', () => startSession({ name: 'Open session', dayIdx: di, items: [] }));
  $('#nudge', el)?.addEventListener('click', () => go('#fuel'));
  $('#phys', el).onclick = () => go('#body');
}
