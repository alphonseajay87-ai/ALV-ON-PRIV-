// ALVéON PRIVÉ — first-run welcome: three short steps that leave you with a plan, sensible targets and (optionally) the coach.
import { get, update, requestPersistence } from './store.js';
import { planForDays } from './data.js';
import { $, $$, esc, openSheet, toast, plate } from './ui.js';

const GOALS = ['Build muscle', 'Get stronger', 'Lean & athletic', 'Stay consistent'];
const KIT = [['home', 'Dumbbells at home', 'Home: dumbbells (adjustable handles + plates, about 22 kg total). Outdoors: pull-up bar and dips, bodyweight only.'], ['gym', 'Full gym', 'Full gym: barbells, dumbbells, cables and machines.'], ['street', 'Bodyweight & street', 'Bodyweight only: pull-up bar, dips bars, floor work.']];

/** Evidence-based starting targets, shown as suggestions: ~10% above maintenance, 2 g/kg protein, 0.9 g/kg fat, rest carbs. */
export function suggestTargets(kg, goal) {
  const k = Math.min(200, Math.max(35, +kg || 75));
  const mult = goal === 'Lean & athletic' ? 30 : goal === 'Stay consistent' ? 32 : 35;
  const kcal = Math.round((k * mult) / 50) * 50, protein = Math.round(k * 2), fat = Math.round(k * 0.9);
  return { kcal, protein, fat, carbs: Math.max(100, Math.round((kcal - protein * 4 - fat * 9) / 4)) };
}

export function openOnboarding() {
  const draft = { name: get().profile.name === 'Alph' ? '' : get().profile.name, goal: get().profile.goal || GOALS[0], weight: get().profile.weight || '', days: get().profile.days >= 3 ? Math.min(6, get().profile.days) : 5, kit: 'home', key: '' };
  let step = 0, finished = false;
  const finish = (skip = false) => {
    if (finished) return; finished = true;
    const t = suggestTargets(draft.weight, draft.goal);
    update(s => {
      s.onboarded = true;
      if (skip) return;
      s.profile.name = draft.name.trim() || s.profile.name; s.profile.goal = draft.goal;
      if (+draft.weight >= 30 && +draft.weight <= 250) s.profile.weight = +draft.weight;
      s.profile.days = draft.days; Object.assign(s.profile, { kcal: t.kcal, protein: t.protein, fat: t.fat, carbs: t.carbs });
      s.profile.equipment = KIT.find(k => k[0] === draft.kit)[2];
      if (!s.workouts.length) s.plan = planForDays(draft.days); // never overwrite a plan the user already trained on
      if (draft.key.trim()) s.settings.apiKey = draft.key.trim();
    });
    requestPersistence();
    window.dispatchEvent(new Event('alveon:rerender'));
  };
  let sh;
  openSheet({
    title: 'Welcome', tall: true, onClose: () => finish(true),
    body: '<div id="ob"></div>',
    onMount: (el, api) => {
      sh = api;
      const root = $('#ob', el);
      const dots = () => `<div class="dots" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>`;
      const draw = () => {
        sh.setTitle(['Welcome', 'Your numbers', 'Make it yours'][step]);
        if (step === 0) {
          root.innerHTML = `${plate('hands', '', 'banner dim')}${dots()}
            <p class="muted pad-b">ALVéON is private by design: everything stays on this device. Three quick questions and your week is ready.</p>
            <label class="field"><span>What should I call you?</span><input class="input" id="ob-name" value="${esc(draft.name)}" placeholder="Your name" maxlength="40" autocomplete="given-name"></label>
            <div class="field"><span>Main goal</span><div class="chips wrap" id="ob-goal" role="group">${GOALS.map(g => `<button type="button" class="chip${g === draft.goal ? ' on' : ''}" aria-pressed="${g === draft.goal}" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div></div>
            <div class="stack pad-t"><button class="btn primary block" id="next">Continue</button><button class="btn ghost block" id="skip">Skip for now</button></div>`;
          $('#ob-name', root).oninput = e => { draft.name = e.target.value; };
          $('#ob-goal', root).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; draft.goal = c.dataset.g; $$('.chip', root).forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); }); };
        } else if (step === 1) {
          const t = suggestTargets(draft.weight, draft.goal);
          root.innerHTML = `${dots()}
            <label class="field"><span>Bodyweight (kg)</span><input class="input" id="ob-w" inputmode="decimal" value="${esc(draft.weight)}" placeholder="e.g. 78"></label>
            <div class="field"><span>Training days per week</span><div class="seg" id="ob-days" role="group">${[3, 4, 5, 6].map(n => `<button type="button" data-d="${n}" class="${n === draft.days ? 'on' : ''}" aria-pressed="${n === draft.days}">${n}</button>`).join('')}</div></div>
            <div class="field"><span>Where do you train?</span><div class="chips wrap" id="ob-kit" role="group">${KIT.map(([id, l]) => `<button type="button" class="chip${id === draft.kit ? ' on' : ''}" aria-pressed="${id === draft.kit}" data-k="${id}">${esc(l)}</button>`).join('')}</div></div>
            <div class="card flat" id="ob-t"><div class="eyebrow">Suggested daily targets</div><div class="tgt">${tg(t)}</div><p class="muted sm">A starting point you can change anytime in Settings.</p></div>
            <div class="stack pad-t"><button class="btn primary block" id="next">Continue</button><button class="btn ghost block" id="back">Back</button></div>`;
          const upd = () => { $('#ob-t .tgt', root).innerHTML = tg(suggestTargets(draft.weight, draft.goal)); };
          $('#ob-w', root).oninput = e => { draft.weight = e.target.value.replace(',', '.'); upd(); };
          $('#ob-days', root).onclick = e => { const b = e.target.closest('button'); if (!b) return; draft.days = +b.dataset.d; $$('#ob-days button', root).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); };
          $('#ob-kit', root).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; draft.kit = c.dataset.k; $$('#ob-kit .chip', root).forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); }); };
        } else {
          root.innerHTML = `${plate('fall', '', 'banner dim cap')}${dots()}
            <p class="muted pad-b">Your ${draft.days}-day plan is ready. To unlock the coach, plan adaptation and meal photo analysis, add a free Gemini API key. You can also do this later.</p>
            <label class="field"><span>Gemini API key (optional)</span><input class="input" id="ob-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste key" value="${esc(draft.key)}"></label>
            <p class="muted sm">Stored only on this device and sent only to Google when you use the coach.</p>
            <div class="stack pad-t"><button class="btn primary block" id="next">Enter ALVéON</button><button class="btn ghost block" id="back">Back</button></div>`;
          $('#ob-key', root).oninput = e => { draft.key = e.target.value; };
        }
        $('#next', root).onclick = () => { if (step < 2) { step++; draw(); } else { finish(); sh.close(); toast(`Welcome${draft.name.trim() ? ', ' + draft.name.trim() : ''}. Your week is set.`, 3200); } };
        $('#back', root)?.addEventListener('click', () => { step--; draw(); });
        $('#skip', root)?.addEventListener('click', () => { finish(true); sh.close(); });
      };
      draw();
    },
  });
}
const tg = t => `<span><b>${t.kcal}</b><small>kcal</small></span><span><b>${t.protein}</b><small>protein g</small></span><span><b>${t.carbs}</b><small>carbs g</small></span><span><b>${t.fat}</b><small>fat g</small></span>`;
