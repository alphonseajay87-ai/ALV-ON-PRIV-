// ALVéON PRIVÉ — hidden physique scan. Reached only by a secret gesture:
//   Body tab: press and hold the figure · Today tab: tap the greeting three times quickly.
import { get, update, dateKey } from './store.js';
import { analyzePhysique, generatePlan, hasKey } from './ai.js';
import { MUSCLES } from './data.js';
import { esc, icon, $, openSheet, toast, readImage, plate } from './ui.js';
import { previewPlan } from './v-coach.js';
import { openSettings } from './v-settings.js';

export function onLongPress(el, fn, ms = 800) {
  if (!el) return;
  let t = null, x = 0, y = 0;
  const stop = () => { clearTimeout(t); t = null; };
  el.addEventListener('pointerdown', e => { x = e.clientX; y = e.clientY; stop(); t = setTimeout(() => { t = null; try { navigator.vibrate && navigator.vibrate(18); } catch {} fn(); }, ms); });
  el.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x, e.clientY - y) > 12) stop(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => el.addEventListener(n, stop));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
export function onTripleTap(el, fn) {
  if (!el) return;
  let n = 0, t = null;
  el.addEventListener('click', () => { n++; clearTimeout(t); t = setTimeout(() => (n = 0), 650); if (n >= 3) { n = 0; clearTimeout(t); fn(); } });
}

export function openScan() {
  if (!hasKey()) { toast('Add your Gemini key to use this'); openSettings(); return; }
  if (!navigator.onLine) { toast('You are offline. The scan needs a connection.'); return; }
  const last = (get().scans || []).slice(-1)[0];
  openSheet({
    title: 'Physique scan', tall: true,
    body: `${plate('back', '', 'banner')}<div id="scanbody"></div>`,
    onMount: (el, sh) => {
      const root = $('#scanbody', el);
      const home = () => {
        root.innerHTML = `
        <p class="muted pad-b">Share a clear, well-lit photo (front, side or back). The coach reads your build, finds what to bring up and can rebuild your week around it.</p>
        <div class="scan-drop"><div class="scanline-static"></div>${icon('body')}<b>Add a photo</b><small>Camera or library</small></div>
        <label class="field"><span>Anything the coach should know (optional)</span><input class="input" id="snote" placeholder="e.g. cutting, left shoulder is weaker, 3 weeks of training"></label>
        <label class="btn primary block filebtn">Choose photo<input type="file" id="sfile" accept="image/*" hidden></label>
        ${last ? `<button class="btn ghost block" id="sprev">View last scan · ${esc(last.date)}</button>` : ''}
        <p class="muted sm center pad">Private. The photo goes only to Gemini for this analysis. Only a small thumbnail is kept on this device.</p>`;
        $('#sfile', root).onchange = async e => {
          const f = e.target.files[0]; if (!f) return;
          root.innerHTML = '<div class="analyzing plain"><div class="scanline"></div></div><p class="muted center pad">Reading your build…</p>';
          try {
            const img = await readImage(f);
            const r = await analyzePhysique({ b64: img.b64, note: ($('#snote', el)?.value || '').trim() });
            const rec = { ts: Date.now(), date: dateKey(), thumb: img.thumb, ...r };
            update(s => { s.scans = [...(s.scans || []), rec].slice(-6); });
            result(rec);
          } catch (err) { toast(err.message, 6000); home(); }
        };
        $('#sprev', root)?.addEventListener('click', () => result(last));
      };
      const result = rec => {
        const rows = Object.entries(rec.ratings || {}).sort((a, b) => a[1] - b[1]);
        root.innerHTML = `
        <div class="scan-head">${rec.thumb ? `<img src="${rec.thumb}" alt="">` : ''}<p>${esc(rec.summary)}</p></div>
        ${(rec.priorities || []).length ? `<div class="eyebrow pad-t">Bring up first</div><div class="chips wrap">${(rec.priorities || []).map(m => `<span class="chip on">${MUSCLES[m]}</span>`).join('')}</div>` : ''}
        ${(rec.strengths || []).length ? `<div class="eyebrow pad-t">Already strong</div><div class="chips wrap">${(rec.strengths || []).map(m => `<span class="chip">${MUSCLES[m]}</span>`).join('')}</div>` : ''}
        <div class="eyebrow pad-t">Development</div>
        <div class="rates">${rows.map(([m, v]) => `<div class="rate"><span>${MUSCLES[m]}</span><i><b style="width:${v * 20}%"></b></i><em>${v}</em></div>`).join('')}</div>
        ${rec.posture ? `<p class="muted sm pad-t">${esc(rec.posture)}</p>` : ''}
        ${rec.caveat ? `<p class="muted sm">${esc(rec.caveat)}</p>` : ''}
        <div class="stack pad-t"><button class="btn primary block" id="sbuild">Rebuild my plan from this</button><button class="btn ghost block" id="sdone">Done</button></div>`;
        $('#sdone', root).onclick = sh.close;
        $('#sbuild', root).onclick = async () => {
          root.innerHTML = '<div class="analyzing plain"><div class="scanline"></div></div><p class="muted center pad">Designing your week around your physique…</p>';
          try {
            const focus = `${rec.focus} Bring up first: ${(rec.priorities || []).map(m => MUSCLES[m]).join(', ') || 'balance'}. Goal: build muscle and strength.`;
            const plan = await generatePlan(focus);
            sh.close(); setTimeout(() => previewPlan(plan), 320);
          } catch (err) { toast(err.message, 6000); result(rec); }
        };
      };
      home();
    },
  });
}
