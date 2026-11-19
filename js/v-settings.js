import { get, update, exportData, importData, inspectBackup, clearPhotos, storageInfo, resetAll } from './store.js';
import { ping } from './ai.js';
import { $, esc, openSheet, toast, confirmSheet, plate } from './ui.js';
import { rerender } from './quick.js';
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
    <p class="muted sm pad-b" id="stor"></p>
    <div class="stack"><button class="btn ghost block" id="exp">Export backup</button><label class="btn ghost block filebtn">Import backup<input type="file" id="imp" accept="application/json" hidden></label><button class="btn ghost block" id="clrph">Free space: remove meal photos</button><button class="btn danger block" id="reset">Erase all data</button></div>`}
    ${plate('thorns', 'Discipline is the price.', 'wall')}
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
      $('#save', el).onclick = () => { saveAll(); syncPush(); sh.close(); toast('Saved'); rerender(); };
      $('#test', el)?.addEventListener('click', async () => {
        saveAll(); const b = $('#test', el); b.textContent = 'Testing…';
        if (!navigator.onLine) { b.textContent = 'Test connection'; toast('You are offline'); return; }
        try { await ping(); b.textContent = '✓ Connected'; } catch (e) { b.textContent = 'Test connection'; toast(e.code === 'NO_KEY' || e.message === 'NO_KEY' ? 'Paste your key first' : e.message, 5000); }
      });
      $('#alerts', el)?.addEventListener('click', () => { saveAll(); openAlertsSheet(); });
      $('#notif', el)?.addEventListener('click', async () => { saveAll(); const ok = await enableNotifications(); toast(ok ? 'Notifications enabled' : 'Permission not granted'); if (ok) testNotification(); });
      const stor = () => { const i = storageInfo(), kb = n => (n / 1024 >= 1024 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'); const t = $('#stor', el); if (t) t.textContent = `Using about ${kb(i.chars)} of roughly 5 MB (${i.pct}%) · ${i.thumbs} photo${i.thumbs === 1 ? '' : 's'} stored. Export a backup now and then; it is your only copy.`; };
      stor();
      $('#exp', el)?.addEventListener('click', () => {
        const json = exportData(), c = inspectBackup(json).counts;
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = `alveon-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast(`Backup saved · ${c.workouts} sessions, ${c.meals} meals. The API key is not included.`, 5000);
      });
      $('#imp', el)?.addEventListener('change', async e => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        let text, info;
        try { if (f.size > 20e6) throw new Error('That file is too large to be a backup.'); text = await f.text(); info = inspectBackup(text); } catch (err) { toast(err.message, 5000); return; }
        const c = info.counts;
        const sh2 = openSheet({ title: 'Import backup', body: `<p class="muted pad-b">This backup holds <b>${c.workouts}</b> sessions, <b>${c.meals}</b> meals and <b>${c.weights}</b> weigh-ins${info.exportedAt ? `, exported ${esc(info.exportedAt.slice(0, 10))}` : ''}.</p>
          <div class="stack"><button class="btn primary block" id="mg">Merge: add what is missing</button><button class="btn ghost block" id="rp">Replace everything on this device</button></div>
          <p class="muted sm pad">Your API key stays. A safety snapshot is taken first.</p>`,
          onMount: x => {
            const run = mode => { try { const r = importData(text, mode); sh2.close(); sh.close(); toast(mode === 'merge' ? `Merged · ${r.added.workouts} sessions, ${r.added.meals} meals, ${r.added.weights} weigh-ins added` : 'Backup restored', 5000); rerender(); } catch (err) { toast(err.message, 5000); } };
            $('#mg', x).onclick = () => run('merge');
            $('#rp', x).onclick = async () => { if (await confirmSheet({ title: 'Replace all data?', text: 'Everything currently on this device is swapped for the backup.', ok: 'Replace', danger: true })) run('replace'); };
          } });
      });
      $('#clrph', el)?.addEventListener('click', () => { const n = clearPhotos(); toast(n ? `Removed ${n} photo${n === 1 ? '' : 's'}` : 'No photos stored'); stor(); });
      $('#reset', el)?.addEventListener('click', async () => {
        if (await confirmSheet({ title: 'Erase everything?', text: 'All workouts, meals and settings on this device will be deleted. Export a backup first if unsure.', ok: 'Erase', danger: true })) { resetAll(); sh.close(); rerender(); toast('All data erased'); }
      });
    },
  });
}
