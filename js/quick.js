// ALVéON PRIVÉ — quick daily actions shared by several screens (water, bodyweight).
import { get, update, dateKey } from './store.js';
import { weightTrend } from './progress.js';
import { $, esc, openSheet, toast } from './ui.js';

export const rerender = () => window.dispatchEvent(new Event('alveon:rerender'));

export function addWater(ml) {
  const k = dateKey();
  update(s => { s.water[k] = Math.max(0, Math.min(20000, (s.water[k] || 0) + ml)); });
  rerender();
}

/** One-tap bodyweight logging: replaces today's entry, keeps the profile weight in sync. */
export function openWeightSheet(onSaved) {
  const last = get().weights.slice(-1)[0];
  openSheet({
    title: 'Log bodyweight',
    body: `<p class="muted pad-b">${last ? `Last entry: ${last.kg} kg on ${esc(new Date(last.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}.` : 'Weigh in the morning, after the bathroom, for the cleanest trend.'}</p>
      <label class="field"><span>Weight (kg)</span><input class="input big" id="kg" inputmode="decimal" autocomplete="off" value="${last ? last.kg : get().profile.weight || ''}" placeholder="78.4"></label>
      <div class="err-t" id="err" role="alert" hidden></div>
      <button class="btn primary block" id="save">Save</button>`,
    onMount: (el, sh) => {
      const inp = $('#kg', el); inp.select();
      const save = () => {
        const kg = Math.round(parseFloat(inp.value.replace(',', '.')) * 10) / 10;
        if (!(kg >= 30 && kg <= 250)) { const e = $('#err', el); e.hidden = false; e.textContent = 'Enter a weight between 30 and 250 kg.'; inp.focus(); return; }
        const k = dateKey();
        update(s => { const i = s.weights.findIndex(w => w.date === k); if (i >= 0) s.weights[i].kg = kg; else s.weights.push({ date: k, kg }); s.weights.sort((a, b) => (a.date < b.date ? -1 : 1)); s.profile.weight = kg; });
        const t = weightTrend(30);
        sh.close();
        toast(t.points.length > 1 ? `Logged ${kg} kg · 7-day average ${t.points[t.points.length - 1].avg} kg` : `Logged ${kg} kg`);
        onSaved ? onSaved() : rerender();
      };
      $('#save', el).onclick = save; inp.onkeydown = e => { if (e.key === 'Enter') save(); };
    },
  });
}
