import { get, update, muscleStats, physiqueIndex, dateKey } from './store.js';
import { MUSCLES, LEVELS } from './data.js';
import { icon, $, $$, fmt, openSheet, toast, clamp } from './ui.js';
import { renderBody } from './musclemap.js';
import { openSettings } from './v-settings.js';

const GROUPS = [
  ['Upper body', ['chest', 'shoulders', 'traps', 'lats', 'biceps', 'triceps', 'forearms']],
  ['Core', ['abs', 'obliques', 'lowerback']],
  ['Lower body', ['glutes', 'quads', 'hamstrings', 'calves']],
];
// muscles that only show on one side of the figure
const SIDE = { chest: 'front', biceps: 'front', abs: 'front', obliques: 'front', quads: 'front', lats: 'back', lowerback: 'back', triceps: 'back', glutes: 'back', hamstrings: 'back' };

let view = 'front', sel = null;

export function lvRing(level, pct, size = 38) {
  const r = 15, c = 2 * Math.PI * r, p = level >= 5 ? 1 : clamp(pct, 0, 1);
  return `<svg class="lvr l${level}" viewBox="0 0 38 38" width="${size}" height="${size}" aria-hidden="true"><circle class="t" cx="19" cy="19" r="${r}"/><circle class="v" cx="19" cy="19" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" transform="rotate(-90 19 19)"/><text x="19" y="19.5">${level}</text></svg>`;
}

function ago(iso) {
  if (!iso) return '—';
  const n = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n}d ago`;
}

export function bodyView(el) {
  const stats = muscleStats();
  const weakest = Object.entries(stats).sort((a, b) => a[1].frac - b[1].frac)[0][0];

  el.innerHTML = `
  <header class="lt"><div><div class="eyebrow">Physique</div><h1>Body</h1></div><button class="icon-btn lg" id="gear" aria-label="Settings">${icon('gear')}</button></header>
  <section class="bhero">
    <div class="bh-top">
      <div class="idx"><span class="eyebrow">Physique index</span><div class="big-serif">${physiqueIndex()}<small>/100</small></div></div>
      <div class="seg slim" id="vseg"><button data-v="front" class="${view === 'front' ? 'on' : ''}">Front</button><button data-v="back" class="${view === 'back' ? 'on' : ''}">Back</button></div>
    </div>
    <div class="fig enter" id="fig"></div>
    <div class="lvl-strip" aria-hidden="true"><span>Untrained</span>${LEVELS.map((l, i) => `<i class="sw l${i}"></i>`).join('')}<span>Prestige</span></div>
    <div class="bdetail" id="detail"></div>
  </section>
  ${GROUPS.map(([title, ms]) => `
    <div class="sec-h">${title}</div>
    <div class="list">${ms.map(m => {
      const v = stats[m];
      return `<button class="row mrow" data-m="${m}">${lvRing(v.level, v.pct)}<span class="grow"><b>${MUSCLES[m]}</b><small>${v.name} · ${fmt(v.xp)} XP</small></span><span class="trail">${ago(v.last)}</span></button>`;
    }).join('')}</div>`).join('')}
  <div class="sec-h">Bodyweight</div>
  <div id="wslot"></div>`;

  const fig = $('#fig', el), detail = $('#detail', el);

  function detailHTML() {
    if (sel) {
      const s = stats[sel];
      return `<div class="dt-main">${lvRing(s.level, s.pct, 46)}
        <div class="grow"><b>${MUSCLES[sel]}</b><small>${s.name} · ${fmt(s.xp)} XP</small></div>
        <span class="dt-r">${ago(s.last) === '—' ? 'Not trained yet' : 'Trained ' + ago(s.last).toLowerCase()}</span></div>
        <div class="bar"><i style="width:${Math.round((s.level >= 5 ? 1 : s.pct) * 100)}%"></i></div>
        <small class="dt-foot">${s.next ? `${fmt(s.next - s.xp)} XP to ${LEVELS[s.level + 1].n}` : 'Maximum level reached'}</small>`;
    }
    return `<div class="dt-hint"><span>Tap a muscle to see its level</span><button class="pill" data-focus="${weakest}">Focus · ${MUSCLES[weakest]}</button></div>`;
  }
  function paint() {
    $$('.mus', el).forEach(p => p.classList.toggle('sel', p.dataset.m === sel));
    $$('.mrow', el).forEach(r => r.classList.toggle('sel', r.dataset.m === sel));
    detail.innerHTML = detailHTML();
    $('[data-focus]', detail)?.addEventListener('click', e => choose(e.currentTarget.dataset.focus, true));
  }
  function drawFig() {
    fig.innerHTML = renderBody(view, stats, { sel });
    fig.classList.remove('enter', 'flip-out'); void fig.offsetWidth; fig.classList.add('enter');
  }
  function setView(v) {
    if (v === view) return;
    view = v;
    $$('#vseg button', el).forEach(b => b.classList.toggle('on', b.dataset.v === v));
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
  $('#vseg', el).onclick = e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); };
  fig.onclick = e => { const m = e.target.closest('[data-m]')?.dataset.m; if (m) choose(m, false); };
  $$('.mrow', el).forEach(r => (r.onclick = () => choose(r.dataset.m, true)));

  const slot = $('#wslot', el);
  const drawW = () => {
    slot.innerHTML = weightCard();
    $('#wlog', slot).onclick = () => weightSheet(drawW);
  };
  drawW();
}

function weightCard() {
  const ws = get().weights.slice(-30);
  const last = ws[ws.length - 1];
  let chart = '', delta = 'Log your weight to see the trend';
  if (last && ws.length > 1) {
    const d = last.kg - ws[0].kg;
    delta = `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1)} kg since ${new Date(ws[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    const vals = ws.map(w => w.kg), min = Math.min(...vals) - 0.4, max = Math.max(...vals) + 0.4;
    const pts = ws.map((w, i) => [8 + (i / (ws.length - 1)) * 284, 66 - ((w.kg - min) / (max - min)) * 54]);
    const d0 = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    const e = pts[pts.length - 1];
    chart = `<svg class="wchart" viewBox="0 0 300 76" aria-hidden="true"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecdcb8" stop-opacity=".22"/><stop offset="1" stop-color="#ecdcb8" stop-opacity="0"/></linearGradient></defs>
      <path d="${d0}L${e[0].toFixed(1)} 76L${pts[0][0].toFixed(1)} 76Z" fill="url(#wg)"/><path d="${d0}" fill="none" stroke="#ecdcb8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="4" fill="#000" stroke="#ecdcb8" stroke-width="1.6"/></svg>`;
  } else if (last) delta = 'Add another entry to see the trend';
  return `<div class="card wcard"><div class="split"><div><div class="big-serif">${last ? last.kg.toFixed(1) : '—'}<small> kg</small></div><p class="muted sm">${delta}</p></div><button class="btn ghost sm" id="wlog">${icon('plus')} Log</button></div>${chart}</div>`;
}

function weightSheet(done) {
  const last = get().weights.slice(-1)[0];
  openSheet({
    title: 'Log bodyweight',
    body: `<label class="field"><span>Weight (kg)</span><input class="input big-in" id="w" inputmode="decimal" value="${last ? last.kg : get().profile.weight || ''}"></label><button class="btn primary block" id="ok">Save</button>`,
    onMount: (el, sh) => {
      $('#ok', el).onclick = () => {
        const kg = parseFloat($('#w', el).value.replace(',', '.'));
        if (!(kg > 20 && kg < 300)) { toast('Enter a realistic weight in kg'); return; }
        update(s => { const k = dateKey(); s.weights = s.weights.filter(x => x.date !== k); s.weights.push({ date: k, kg }); s.profile.weight = kg; });
        sh.close(); done(); toast('Weight saved');
      };
    },
  });
}
