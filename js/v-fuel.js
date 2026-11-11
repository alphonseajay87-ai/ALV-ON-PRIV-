import { get, update, uid, dateKey, keyToDate, mealsOn, totalsOn, waterOn } from './store.js';
import { analyzeMeal, hasKey } from './ai.js';
import { esc, icon, $, $$, openSheet, toast, fmt, rings, readImage, confirmSheet } from './ui.js';
import { openSettings } from './v-settings.js';

let day = dateKey();

export function fuelView(el) {
  const draw = () => {
    const p = get().profile, t = totalsOn(day), meals = mealsOn(day), w = waterOn(day);
    const isToday = day === dateKey();
    const label = isToday ? 'Today' : keyToDate(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const bar = (n, v, goal) => `<div class="mac"><div class="split"><span>${n}</span><b>${fmt(v)}<small> / ${fmt(goal)} g</small></b></div><div class="bar"><i style="width:${Math.min(100, (v / goal) * 100)}%"></i></div></div>`;
    el.innerHTML = `
    <header class="lt"><div><div class="eyebrow">Nutrition</div><h1>Fuel</h1></div><button class="icon-btn lg" id="gear">${icon('gear')}</button></header>
    <div class="datenav"><button class="icon-btn" id="prev" aria-label="Previous day">${icon('left')}</button><b>${label}</b><button class="icon-btn" id="next" aria-label="Next day" ${isToday ? 'disabled' : ''}>${icon('chev')}</button></div>
    <section class="card">
      <div class="fuel-top"><div class="rings-wrap sm">${rings([{ pct: t.kcal / p.kcal, color: 'var(--c1)' }], 110)}<div class="ring-c"><b>${fmt(Math.max(0, p.kcal - t.kcal))}</b><small>kcal left</small></div></div>
      <div class="macs">${bar('Protein', t.p, p.protein)}${bar('Carbs', t.c, p.carbs)}${bar('Fat', t.f, p.fat)}</div></div>
    </section>
    <div class="snap-row"><button class="btn primary grow" id="snap">${icon('camera')} Snap a meal</button><button class="btn ghost" id="manual">${icon('plus')} Manual</button></div>
    <input type="file" id="file" accept="image/*" hidden>
    <section class="card water"><div class="split"><div class="eyebrow">Hydration</div><b>${(w / 1000).toFixed(2)}<small> / ${(p.water / 1000).toFixed(1)} L</small></b></div>
      <div class="bar"><i style="width:${Math.min(100, (w / p.water) * 100)}%"></i></div>
      <div class="chips"><button class="chip" data-w="250">+ 250 ml</button><button class="chip" data-w="500">+ 500 ml</button><button class="chip" data-w="-250">− 250</button></div></section>
    <div class="sec-h">Meals</div>
    <div class="list">${meals.length ? meals.map(m => `
      <button class="row meal" data-m="${m.id}">${m.thumb ? `<img src="${m.thumb}" alt="">` : `<span class="ph">${icon('flame')}</span>`}
      <span class="grow"><b>${esc(m.name)}</b><small>${new Date(m.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · P ${fmt(m.p)} · C ${fmt(m.c)} · F ${fmt(m.f)}</small></span><b>${fmt(m.kcal)}<small> kcal</small></b></button>`).join('')
      : '<div class="empty"><p class="muted">No meals logged. Snap a photo and ALVéON estimates the rest.</p></div>'}</div>`;
    $('#gear', el).onclick = openSettings;
    $('#prev', el).onclick = () => { const d = keyToDate(day); d.setDate(d.getDate() - 1); day = dateKey(d); draw(); };
    $('#next', el).onclick = () => { const d = keyToDate(day); d.setDate(d.getDate() + 1); day = dateKey(d); draw(); };
    $('#manual', el).onclick = () => mealSheet({ name: '', kcal: '', p: '', c: '', f: '' }, null, draw);
    const file = $('#file', el);
    $('#snap', el).onclick = () => file.click();
    file.onchange = async () => { const f = file.files[0]; file.value = ''; if (f) snap(f, draw); };
    $$('[data-w]', el).forEach(b => (b.onclick = () => { update(s => { s.water[day] = Math.max(0, (s.water[day] || 0) + +b.dataset.w); }); draw(); }));
    $$('[data-m]', el).forEach(b => (b.onclick = () => { const m = get().meals.find(x => x.id === b.dataset.m); mealSheet(m, m, draw); }));
  };
  draw();
}

async function snap(file, done) {
  let img;
  try { img = await readImage(file); } catch (e) { toast(e.message); return; }
  if (!hasKey()) {
    toast('Add your Gemini key in Settings for automatic analysis');
    mealSheet({ name: '', kcal: '', p: '', c: '', f: '', thumb: img.thumb }, null, done);
    return;
  }
  const sh = openSheet({
    title: 'Analysing', body: `<div class="analyzing"><img src="${img.thumb}" alt=""><div class="scanline"></div></div><p class="muted center pad">Reading your plate…</p>`,
  });
  try {
    const r = await analyzeMeal({ b64: img.b64 });
    sh.close();
    setTimeout(() => mealSheet({ name: r.name, kcal: r.kcal, p: r.p, c: r.c, f: r.f, thumb: img.thumb, items: r.items, comment: r.comment, confidence: r.confidence, src: 'ai' }, null, done), 320);
  } catch (e) {
    sh.close();
    toast('Analysis failed: ' + e.message, 4500);
    setTimeout(() => mealSheet({ name: '', kcal: '', p: '', c: '', f: '', thumb: img.thumb }, null, done), 320);
  }
}

function mealSheet(m, existing, done) {
  const num = v => (v === '' || v == null ? '' : Math.round(+v));
  openSheet({
    title: existing ? 'Edit meal' : m.src === 'ai' ? 'Review meal' : 'Add meal', tall: true,
    body: `${m.thumb ? `<img class="meal-img" src="${m.thumb}" alt="">` : ''}
    ${m.comment ? `<p class="muted sm pad-b">${esc(m.comment)}${m.confidence != null ? ` · confidence ${Math.round(m.confidence * 100)}%` : ''}</p>` : ''}
    <label class="field"><span>Name</span><input class="input" id="n" value="${esc(m.name)}" placeholder="Meal"></label>
    <div class="grid2"><label class="field"><span>Calories</span><input class="input" inputmode="numeric" id="k" value="${num(m.kcal)}"></label>
    <label class="field"><span>Protein g</span><input class="input" inputmode="numeric" id="p" value="${num(m.p)}"></label>
    <label class="field"><span>Carbs g</span><input class="input" inputmode="numeric" id="c" value="${num(m.c)}"></label>
    <label class="field"><span>Fat g</span><input class="input" inputmode="numeric" id="f" value="${num(m.f)}"></label></div>
    ${m.items?.length ? `<div class="items">${m.items.map(i => `<div><span>${esc(i.name)}${i.grams ? ` · ${i.grams} g` : ''}</span><b>${i.kcal} kcal</b></div>`).join('')}</div>` : ''}
    <div class="stack"><button class="btn primary block" id="ok">${existing ? 'Save' : 'Log meal'}</button>${existing ? '<button class="btn danger block" id="del">Delete</button>' : ''}</div>`,
    onMount: (el, sh) => {
      $('#ok', el).onclick = () => {
        const rec = { name: $('#n', el).value.trim() || 'Meal', kcal: +$('#k', el).value || 0, p: +$('#p', el).value || 0, c: +$('#c', el).value || 0, f: +$('#f', el).value || 0 };
        update(s => {
          if (existing) Object.assign(s.meals.find(x => x.id === existing.id), rec);
          else {
            const d = keyToDate(day), now = new Date();
            d.setHours(now.getHours(), now.getMinutes(), 0, 0);
            s.meals.push({ id: uid(), ts: d.getTime(), thumb: m.thumb, items: m.items, src: m.src || 'manual', ...rec });
          }
        });
        sh.close(); done(); toast(existing ? 'Meal updated' : 'Meal logged');
      };
      $('#del', el)?.addEventListener('click', async () => { update(s => { s.meals = s.meals.filter(x => x.id !== existing.id); }); sh.close(); done(); });
    },
  });
}
