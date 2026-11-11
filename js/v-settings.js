import { get, update, exportData, importData, resetAll } from './store.js';
import { ping } from './ai.js';
import { $, esc, openSheet, toast, confirmSheet } from './ui.js';
import { enableNotifications, testNotification, openAlertsSheet, syncPush } from './reminders.js';

export function openSettings(opts = {}) {
  const s = get(), p = s.profile, r = s.settings.remind;
  const field = (id, label, val, extra = '') => `<label class="field"><span>${label}</span><input class="input" id="${id}" value="${esc(val ?? '')}" ${extra}></label>`;
  openSheet({
    title: opts.welcome ? 'Welcome to ALVéON PRIVÉ' : 'Settings', tall: true,
    body: `
    ${opts.welcome ? '<p class="muted pad-b">Set your targets. Everything can be changed later.</p>' : ''}
    <h4 class="eyebrow">Profile & targets</h4>
    ${field('name', 'Name', p.name)}
    <div class="grid2">${field('weight', 'Bodyweight (kg)', p.weight, 'inputmode="decimal"')}${field('kcal', 'Calories / day', p.kcal, 'inputmode="numeric"')}
    ${field('protein', 'Protein g', p.protein, 'inputmode="numeric"')}${field('carbs', 'Carbs g', p.carbs, 'inputmode="numeric"')}
    ${field('fat', 'Fat g', p.fat, 'inputmode="numeric"')}${field('water', 'Water ml', p.water, 'inputmode="numeric"')}
    ${field('days', 'Training days / week', p.days, 'inputmode="numeric"')}${field('rest', 'Rest timer (s)', p.restSec, 'inputmode="numeric"')}</div>
    <label class="field"><span>Equipment & constraints (the coach uses this)</span><textarea class="input" id="equip" rows="3">${esc(p.equipment)}</textarea></label>
    ${opts.welcome ? '' : `
    <h4 class="eyebrow pad-t">Gemini AI</h4>
    <label class="field"><span>API key</span><input class="input" id="key" type="password" autocomplete="off" placeholder="Paste your Gemini API key" value="${esc(s.settings.apiKey)}"></label>
    ${field('model', 'Model', s.settings.model)}
    <button class="btn ghost block" id="test">Test connection</button>
    <p class="muted sm pad-b">The key is stored only on this device and sent only to Google’s Gemini API.</p>
    <h4 class="eyebrow pad-t">Reminders</h4>
    <label class="toggle"><span>Meal & training reminders</span><input type="checkbox" id="rem" ${r.enabled ? 'checked' : ''}><i></i></label>
    ${field('meals', 'Meal times (comma separated)', r.meals.join(', '))}${field('train', 'Training reminder', r.train, 'type="time"')}
    <button class="btn primary block" id="alerts">Phone alerts that work when closed</button>
    <p class="muted sm pad-b" style="padding-top:8px">Calendar alarms or ntfy push. The toggle above only alerts while ALVéON is open.</p>
    <button class="btn ghost block" id="notif">Allow in-app notifications &amp; send a test</button>
    <h4 class="eyebrow pad-t">Data</h4>
    <div class="stack"><button class="btn ghost block" id="exp">Export backup</button><label class="btn ghost block filebtn">Import backup<input type="file" id="imp" accept="application/json" hidden></label><button class="btn danger block" id="reset">Erase all data</button></div>`}
    <button class="btn primary block sticky" id="save">${opts.welcome ? 'Begin' : 'Save'}</button>
    <p class="center muted sm pad">L’excellence est personnelle.</p>`,
    onMount: (el, sh) => {
      const v = id => $('#' + id, el)?.value;
      const num = (id, fb) => { const n = parseFloat(String(v(id)).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : fb; };
      const saveAll = () => update(st => {
        const q = st.profile;
        q.name = v('name').trim() || 'Alph'; q.weight = num('weight', null); q.kcal = num('kcal', q.kcal); q.protein = num('protein', q.protein);
        q.carbs = num('carbs', q.carbs); q.fat = num('fat', q.fat); q.water = num('water', q.water); q.days = Math.min(7, num('days', q.days));
        q.restSec = num('rest', q.restSec); q.equipment = v('equip').trim();
        if ($('#key', el)) {
          st.settings.apiKey = v('key').trim(); st.settings.model = v('model').trim() || 'gemini-2.5-flash';
          st.settings.remind.enabled = $('#rem', el).checked; st.settings.remind.train = v('train') || '17:30';
          const times = v('meals').split(',').map(x => x.trim()).filter(x => /^\d{1,2}:\d{2}$/.test(x)).map(x => x.padStart(5, '0'));
          if (times.length) st.settings.remind.meals = times;
        }
        st.onboarded = true;
      });
      $('#save', el).onclick = () => { saveAll(); syncPush(); sh.close(); toast('Saved'); setTimeout(() => location.reload(), 350); };
      $('#test', el)?.addEventListener('click', async () => {
        saveAll(); const b = $('#test', el); b.textContent = 'Testing…';
        try { await ping(); b.textContent = '✓ Connected'; } catch (e) { b.textContent = 'Test connection'; toast(e.message === 'NO_KEY' ? 'Paste your key first' : e.message, 5000); }
      });
      $('#alerts', el)?.addEventListener('click', () => { saveAll(); openAlertsSheet(); });
      $('#notif', el)?.addEventListener('click', async () => { saveAll(); const ok = await enableNotifications(); toast(ok ? 'Notifications enabled' : 'Permission not granted'); if (ok) testNotification(); });
      $('#exp', el)?.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
        a.download = `alveon-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      });
      $('#imp', el)?.addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try { importData(await f.text()); toast('Backup restored'); setTimeout(() => location.reload(), 400); } catch (err) { toast(err.message); }
      });
      $('#reset', el)?.addEventListener('click', async () => {
        if (await confirmSheet({ title: 'Erase everything?', text: 'All workouts, meals and settings on this device will be deleted. Export a backup first if unsure.', ok: 'Erase', danger: true })) { resetAll(); location.reload(); }
      });
    },
  });
}
