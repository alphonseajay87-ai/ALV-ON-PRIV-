// ALVéON PRIVÉ — Today: a daily command center. One clear next action, quick logging, readiness, and progress.
import { ART } from './art.js';
import { onTripleTap, openScan } from './scan.js';
import { get, dateKey, weekdayIdx, totalsOn, waterOn, workoutDates, streak, physiqueIndex, muscleStats, mealsOn } from './store.js';
import { EX, MUSCLES, WD } from './data.js';
import { esc, icon, rings, fmt, dateLong, greeting, go, $, plate, resumeCard, pageHeader, emptyState } from './ui.js';
import { getSession, resumeSession, startSession } from './session.js';
import { openSettings } from './v-settings.js';
import { renderBody } from './musclemap.js';
import { overloadHint, nextToTrain, physiqueRank, recentPRs, weeklyStats } from './progress.js';
import { addWater, openWeightSheet } from './quick.js';

export function todayView(el) {
  const s = get(), key = dateKey(), di = weekdayIdx(), day = s.plan.days[di];
  const t = totalsOn(key), water = waterOn(key), p = s.profile;
  const todays = s.workouts.filter(w => w.key === key);
  const done = todays.length > 0;
  const stats = muscleStats(), sess = getSession();
  const next = nextToTrain(3), idx = physiqueIndex(), rank = physiqueRank(idx);
  const pr = recentPRs(1, 7)[0], wkNow = weeklyStats(1)[0];
  const remainP = Math.max(0, p.protein - t.p), remainK = Math.max(0, p.kcal - t.kcal);
  const meals = mealsOn(key), h = new Date().getHours();
  const wk = WD.map((w, i) => { const d = new Date(); d.setDate(d.getDate() - di + i); return { w: w[0], on: workoutDates().has(dateKey(d)), today: i === di, rest: s.plan.days[i].rest }; });
  const nudge = meals.length === 0 && h >= 9 ? ['Nothing logged yet today', `${fmt(p.kcal)} kcal to fuel. Snap your first meal.`]
    : meals.length && remainP > 25 && h >= 14 ? [`${fmt(remainP)} g protein to go`, `${fmt(remainK)} kcal left today. Snap your next meal.`] : null;
  const sets = day.ex.reduce((a, e) => a + e.sets, 0);
  const first = !s.workouts.length;

  const sessionCard = done
    ? `<section class="card hero"><img class="hero-art wide" src="${ART.sword}" alt="" draggable="false"><div class="eyebrow">Today</div><h2 class="serif-l">Session complete</h2>
        <p class="muted">${esc(todays.map(w => w.name).join(' · '))} · ${todays.reduce((a, w) => a + w.dur, 0)} min · ${(n => `${n} set${n === 1 ? '' : 's'}`)(todays.reduce((a, w) => a + w.exercises.reduce((x, e) => x + e.sets.length, 0), 0))}. Eat well and sleep, that is the other half.</p>
        <button class="btn ghost block" id="hist">${icon('check')} View in history</button></section>`
    : day.rest
      ? `<section class="card hero"><img class="hero-art wide" src="${ART.clouds}" alt="" draggable="false"><div class="eyebrow">Recovery</div><h2 class="serif-l">Rest &amp; restore</h2>
        <p class="muted">Sleep, protein and a walk. Growth happens now.${next[0] && next[0].rec.state !== 'recovering' ? ` Tomorrow’s priority: <b>${MUSCLES[next[0].m]}</b>.` : ''}</p>
        <button class="btn ghost block" id="quick">Train anyway</button></section>`
      : `<section class="card hero">
        <img class="hero-art" src="${ART.selfmade}" alt="" draggable="false">
        <div class="eyebrow">Today’s session · ~${Math.max(20, Math.round(sets * 2.5))} min</div>
        <h2 class="serif-l">${esc(day.title)}</h2><p class="muted">${esc(day.focus)}</p>
        <ul class="mini-list">${day.ex.slice(0, 4).map(e => { const hint = overloadHint(e.id, e.reps); return `<li><span class="nm">${esc(EX[e.id]?.name)}${hint ? `<small class="ovl">↑ ${esc(hint.text)}</small>` : ''}</span><span>${e.sets} × ${esc(e.reps)}</span></li>`; }).join('')}${day.ex.length > 4 ? `<li class="more">+ ${day.ex.length - 4} more</li>` : ''}</ul>
        <button class="btn primary block" id="begin">Begin session</button></section>`;

  el.innerHTML = `
  <header class="lt"><div><div class="eyebrow">${dateLong()}</div><h1>${greeting()},<br><em>${esc(p.name)}</em></h1></div>
  <button class="icon-btn lg" id="gear" aria-label="Settings">${icon('gear')}</button></header>
  ${resumeCard(sess)}
  ${sessionCard}
  ${first && !sess ? `<div class="card flat firstrun"><b>Start your record.</b><p class="muted sm">Finish a session and each muscle on your body map begins to level up. You can also tell the Coach what you already did: “I did 60 pull-ups yesterday”.</p></div>` : ''}

  <div class="quick" role="group" aria-label="Quick log">
    <button data-q="water" aria-label="Add 250 millilitres of water">${icon('drop')}<span>+250 ml</span></button>
    <button data-q="weight" aria-label="Log bodyweight">${icon('scale')}<span>Weight</span></button>
    <button data-q="meal" aria-label="Log a meal">${icon('flame')}<span>Meal</span></button>
  </div>

  <section class="card rings-card">
    <div class="rings-wrap">${rings([
      { pct: t.kcal / p.kcal, color: 'var(--c1)' }, { pct: t.p / p.protein, color: 'var(--ivory)' }, { pct: water / p.water, color: 'var(--c3)' },
    ], 150)}</div>
    <div class="legend">
      <div><i style="background:var(--c1)"></i><span>Energy</span><b>${fmt(t.kcal)}<small> / ${fmt(p.kcal)} kcal</small></b></div>
      <div><i style="background:var(--ivory)"></i><span>Protein</span><b>${fmt(t.p)}<small> / ${fmt(p.protein)} g</small></b></div>
      <div><i style="background:var(--c3)"></i><span>Water</span><b>${(water / 1000).toFixed(2).replace(/0$/, '')}<small> / ${(p.water / 1000).toFixed(1)} L</small></b></div>
    </div>
  </section>
  ${nudge ? `<button class="card nudge" id="nudge"><span>${icon('flame')}</span><div><b>${esc(nudge[0])}</b><small>${esc(nudge[1])}</small></div>${icon('chev')}</button>` : ''}

  <section class="card">
    <div class="split"><div class="eyebrow">This week</div><div class="muted sm">${wkNow.sessions} of ${wkNow.planned} sessions · ${streak()} day streak</div></div>
    <div class="week">${wk.map(d => `<div class="wd${d.on ? ' on' : ''}${d.today ? ' today' : ''}${d.rest ? ' rest' : ''}"><i></i><span>${d.w}</span></div>`).join('')}</div>
  </section>

  ${pr ? `<div class="card flat prcard"><span class="prb">PR</span><div><b>${esc(EX[pr.id]?.name || '')}</b><small>${pr.set.w ? pr.set.w + ' kg × ' : ''}${pr.set.r}${EX[pr.id]?.type === 'time' ? ' s' : ''} · new personal best</small></div></div>` : ''}

  <section class="card">
    <div class="split"><div class="eyebrow">Readiness</div><button class="link-s" id="to-body">Body map ${icon('chev')}</button></div>
    <div class="ready">${next.map(n => `<button class="rdy ${n.rec.state}" data-m="${n.m}"><b>${MUSCLES[n.m]}</b><small>${esc(n.why)}</small></button>`).join('')}</div>
  </section>

  <button class="card phys" id="phys">
    <div class="phys-fig">${renderBody('front', stats, { size: 'mini' })}</div>
    <div class="phys-t"><div class="eyebrow">Physique index · ${esc(rank.name)}</div><div class="big-serif">${idx}<small>/100</small></div>
    <p class="muted sm">${rank.next ? `${rank.toNext} to <b>${rank.next}</b>` : 'Top rank reached'}</p><span class="link-s">Open body map ${icon('chev')}</span></div>
  </button>
`;

  $('#gear', el).onclick = openSettings;
  onTripleTap($('.lt h1', el), openScan); // hidden: tap the greeting three times
  $('#resume', el)?.addEventListener('click', resumeSession);
  $('#hist', el)?.addEventListener('click', () => go('#train'));
  $('#begin', el)?.addEventListener('click', () => startSession({ name: day.title, dayIdx: di, items: day.ex }));
  $('#quick', el)?.addEventListener('click', () => startSession({ name: 'Open session', dayIdx: di, items: [] }));
  $('#nudge', el)?.addEventListener('click', () => go('#fuel'));
  $('#phys', el).onclick = () => go('#body');
  $('#to-body', el).onclick = () => go('#body');
  el.querySelectorAll('.rdy').forEach(b => (b.onclick = () => go('#body')));
  el.querySelector('.quick').onclick = e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    if (b.dataset.q === 'water') addWater(250); else if (b.dataset.q === 'weight') openWeightSheet(); else go('#fuel');
  };
}
