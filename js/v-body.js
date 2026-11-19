// ALVéON PRIVÉ — Body: the Spartan map, what to train next, per-muscle detail, and bodyweight trend.
import { onLongPress, openScan } from './scan.js';
import { get, muscleStats, physiqueIndex } from './store.js';
import { MUSCLES, LEVELS, EX } from './data.js';
import { icon, $, $$, fmt, clamp, plate, esc, openSheet, pageHeader, segHTML, bindSeg, emptyState } from './ui.js';
import { renderBody } from './musclemap.js';
import { openSettings } from './v-settings.js';
import { RANKS, nextToTrain, physiqueRank, recoveryOf, weightTrend, exercisesFor } from './progress.js';
import { agoShort, trainedAgo, keyToDate } from './dates.js';
import { startSession } from './session.js';
import { openWeightSheet } from './quick.js';

const GROUPS = [
  ['Upper body', ['chest', 'shoulders', 'traps', 'lats', 'biceps', 'triceps', 'forearms']],
  ['Core', ['abs', 'obliques', 'lowerback']],
  ['Lower body', ['glutes', 'quads', 'hamstrings', 'calves']],
];
// which side of the figure shows each muscle
const SIDE = { chest: 'front', biceps: 'front', abs: 'front', obliques: 'front', forearms: 'front', quads: 'front', calves: 'front', glutes: 'back', hamstrings: 'back', lats: 'back', lowerback: 'back', triceps: 'back' };

let view = 'front', sel = null, range = '30';

export function lvRing(level, pct, size = 38) {
  const r = 15, c = 2 * Math.PI * r, p = level >= 5 ? 1 : clamp(pct, 0, 1);
  return `<svg class="lvr l${level}" viewBox="0 0 38 38" width="${size}" height="${size}" aria-hidden="true"><circle class="t" cx="19" cy="19" r="${r}"/><circle class="v" cx="19" cy="19" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" transform="rotate(-90 19 19)"/><text x="19" y="19.5">${level}</text></svg>`;
}

export function bodyView(el) {
  const stats = muscleStats(), idx = physiqueIndex(), rank = physiqueRank(idx), next = nextToTrain(3);
  const untouched = !Object.values(stats).some(s => s.xp > 0);

  el.innerHTML = `
  ${pageHeader('Physique', 'Body')}
  <section class="bhero">
    <div class="bh-top">
      <div class="idx"><span class="eyebrow">Physique index · ${esc(rank.name)}</span><div class="big-serif">${idx}<small>/100</small></div>
        <p class="muted sm">${rank.next ? `${rank.toNext} to <b>${rank.next}</b>` : 'Top rank reached'}</p><button class="link-s" id="how">How ranks work</button></div>
      ${segHTML('vseg', [['front', 'Front'], ['back', 'Back']], view, 'slim')}
    </div>
    <div class="fig enter" id="fig"></div>
    <div class="lvl-strip" aria-hidden="true"><span>Untrained</span>${LEVELS.map((l, i) => `<i class="sw l${i}"></i>`).join('')}<span>Prestige</span></div>
    <div class="bdetail" id="detail" aria-live="polite"></div>
  </section>
  ${untouched ? emptyState({ art: plate('back', '', 'banner dim'), title: 'Your map is waiting', text: 'Complete a session, or tell the Coach what you have already done, and each muscle starts to light up.' }) : ''}
  <div class="sec-h">Train next</div>
  <div class="list nextl">${next.map(n => `<button class="row mrow" data-m="${n.m}">${lvRing(stats[n.m].level, stats[n.m].pct)}<span class="grow"><b>${MUSCLES[n.m]}</b><small>${esc(n.why)}</small></span><span class="rec ${n.rec.state}">${n.rec.label}</span></button>`).join('')}</div>
  ${GROUPS.map(([title, ms]) => `
    <div class="sec-h">${title}</div>
    <div class="list">${ms.map(m => {
      const v = stats[m], rec = recoveryOf(m, stats);
      return `<button class="row mrow" data-m="${m}">${lvRing(v.level, v.pct)}<span class="grow"><b>${MUSCLES[m]}</b><small>${v.name} · ${fmt(v.xp)} XP</small></span><span class="trail"><i class="dot ${rec.state}"></i>${agoShort(v.last)}</span></button>`;
    }).join('')}</div>`).join('')}
  <div class="sec-h">Bodyweight</div>
  <div id="wslot"></div>
  ${plate('atlas', 'Carry it.', 'vig')}`;

  const fig = $('#fig', el), detail = $('#detail', el);

  function detailHTML() {
    if (!sel) return `<div class="dt-hint"><span>Tap a muscle to see its level</span><button class="pill" data-pick="${next[0].m}">Focus · ${MUSCLES[next[0].m]}</button></div>`;
    const s = stats[sel], rec = recoveryOf(sel, stats), ex = exercisesFor(sel, 3);
    return `<div class="dt-main">${lvRing(s.level, s.pct, 46)}
      <div class="grow"><b>${MUSCLES[sel]}</b><small>${s.name} · ${fmt(s.xp)} XP</small></div>
      <span class="rec ${rec.state}">${rec.label}</span></div>
      <div class="bar"><i style="width:${Math.round((s.level >= 5 ? 1 : s.pct) * 100)}%"></i></div>
      <small class="dt-foot">${s.next ? `${fmt(s.next - s.xp)} XP to ${LEVELS[s.level + 1].n}` : 'Maximum level reached'} · ${trainedAgo(s.last)}</small>
      ${ex.length ? `<div class="tags dt-ex">${ex.map(e => `<span>${esc(EX[e.id].name)}</span>`).join('')}</div>` : ''}
      <button class="btn primary block sm" id="train-m">Train ${MUSCLES[sel].toLowerCase()}</button>`;
  }
  function paint() {
    $$('.hit', el).forEach(p => { const on = p.dataset.m === sel; p.classList.toggle('sel', on); p.setAttribute('aria-pressed', String(on)); });
    $$('.mrow', el).forEach(r => r.classList.toggle('sel', r.dataset.m === sel));
    detail.innerHTML = detailHTML();
    $('[data-pick]', detail)?.addEventListener('click', e => choose(e.currentTarget.dataset.pick, true));
    $('#train-m', detail)?.addEventListener('click', () => startSession({ name: `${MUSCLES[sel]} focus`, dayIdx: null, items: exercisesFor(sel, 4) }));
  }
  function drawFig() {
    fig.innerHTML = renderBody(view, stats, { sel });
    fig.classList.remove('enter', 'flip-out'); void fig.offsetWidth; fig.classList.add('enter');
  }
  function setView(v) {
    if (v === view) return;
    view = v;
    $$('#vseg button', el).forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    fig.classList.add('flip-out');
    setTimeout(drawFig, 200);
  }
  function choose(m, fromList) {
    sel = !fromList && sel === m ? null : m;
    if (sel && SIDE[sel] && SIDE[sel] !== view) { setView(SIDE[sel]); setTimeout(paint, 210); } else paint();
    if (fromList && sel) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  drawFig(); paint();
  $('#gear', el).onclick = openSettings;
  $('#how', el).onclick = () => openRanks(idx);
  onLongPress(fig, openScan, 800); // hidden: press and hold the figure
  bindSeg(el, 'vseg', v => setView(v));
  fig.onclick = e => { const m = e.target.closest('[data-m]')?.dataset.m; if (m) choose(m, false); };
  fig.onkeydown = e => { if (e.key !== 'Enter' && e.key !== ' ') return; const m = e.target.closest?.('[data-m]')?.dataset.m; if (m) { e.preventDefault(); choose(m, false); } };
  $$('.mrow', el).forEach(r => (r.onclick = () => choose(r.dataset.m, true)));

  const slot = $('#wslot', el);
  const drawW = () => {
    slot.innerHTML = weightCard();
    $$('[data-log]', slot).forEach(b => (b.onclick = () => openWeightSheet(drawW)));
    bindSeg(slot, 'wrange', v => { range = v; drawW(); });
  };
  drawW();
}

// ---------- bodyweight: raw points, 7-day average line, and the numbers that matter
const signed = (n, d = 1) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(d)}`);

function weightCard() {
  const days = range === 'all' ? 3650 : +range, t = weightTrend(days);
  if (!t.count) return `<div class="card wcard">${emptyState({ title: 'No weigh-ins yet', text: 'Log your weight a few times a week. The trend line smooths daily noise so you can see what is really happening.', cta: '<button class="btn primary sm" data-log>Log weight</button>' })}</div>`;
  const pts = t.points;
  let chart = '';
  if (pts.length > 1) {
    const vals = pts.flatMap(p => [p.kg, p.avg]), min = Math.min(...vals) - 0.4, max = Math.max(...vals) + 0.4;
    const t0 = keyToDate(pts[0].date).getTime(), span = Math.max(1, keyToDate(pts[pts.length - 1].date).getTime() - t0);
    const X = p => 10 + ((keyToDate(p.date).getTime() - t0) / span) * 280, Y = v => 70 - ((v - min) / (max - min)) * 58;
    const line = k => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('');
    const e = pts[pts.length - 1];
    chart = `<svg class="wchart" viewBox="0 0 300 88" role="img" aria-label="Bodyweight, ${pts.length} entries, latest ${e.kg} kilograms, 7-day average ${e.avg}">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecdcb8" stop-opacity=".2"/><stop offset="1" stop-color="#ecdcb8" stop-opacity="0"/></linearGradient></defs>
      <path d="${line('avg')}L${X(e).toFixed(1)} 76L${X(pts[0]).toFixed(1)} 76Z" fill="url(#wg)"/>
      <path d="${line('avg')}" fill="none" stroke="#ecdcb8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(p => `<circle cx="${X(p).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="1.9" fill="rgba(236,220,184,.5)"/>`).join('')}
      <circle cx="${X(e).toFixed(1)}" cy="${Y(e.avg).toFixed(1)}" r="4" fill="#000" stroke="#ecdcb8" stroke-width="1.6"/>
      <text x="10" y="86" class="ax">${new Date(pts[0].date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text><text x="290" y="86" text-anchor="end" class="ax">${new Date(e.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>
      <text x="290" y="10" text-anchor="end" class="ax">${max.toFixed(1)}</text><text x="290" y="72" text-anchor="end" class="ax">${min.toFixed(1)}</text></svg>`;
  }
  const last = pts.length ? pts[pts.length - 1] : t.latest;
  return `<div class="card wcard">
    <div class="split"><div><div class="big-serif">${t.latest.kg.toFixed(1)}<small> kg</small></div><p class="muted sm">${pts.length ? `7-day average ${last.avg.toFixed(1)} kg` : 'Nothing in this range'}</p></div><button class="btn ghost sm" data-log>${icon('plus')} Log</button></div>
    ${segHTML('wrange', [['30', '30 d'], ['90', '90 d'], ['all', 'All']], range, 'slim')}
    ${chart || (pts.length ? '<p class="muted sm pad">Add another entry to draw the trend.</p>' : '')}
    <div class="stats3"><div><b>${signed(t.d7)}</b><small>vs 7 days</small></div><div><b>${signed(t.d30)}</b><small>vs 30 days</small></div><div><b>${t.rate == null ? '—' : signed(t.rate, 2)}</b><small>kg / week</small></div></div>
    ${t.rate == null ? '<p class="muted sm">The weekly rate appears after three entries across at least a week.</p>' : ''}</div>`;
}

// One rule, said plainly: index = average muscle level. Seven ranks, no hidden maths.
function openRanks(idx) {
  const cur = physiqueRank(idx).name;
  openSheet({
    title: 'Physique Index',
    body: `<p class="muted pad-b">Each of your 14 muscles has a level from 0 to 5, earned by the sets you log. The index is the average of all of them: every muscle at level 5 is 100. Raise what is behind and the number moves fastest.</p>
    <div class="list ranks">${RANKS.map(([t, n]) => `<div class="row slim${n === cur ? ' sel' : ''}"><span class="grow"><b>${esc(n)}</b></span><span class="trail">${t === 0 ? 'Start' : t + '+'}</span></div>`).join('')}</div>`,
  });
}
