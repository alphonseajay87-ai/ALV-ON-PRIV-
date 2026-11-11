// ALVéON PRIVÉ — tiny UI toolkit: icons, sheets, toasts, rings, formatting
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const fmt = n => Math.round(+n || 0).toLocaleString('en-US');
export const go = h => { location.hash = h; };

const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  today: ic('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5v2M12 18.5v2"/>'),
  train: ic('<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>'),
  fuel: ic('<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .2 1.2 1 2 2 2-.6-3 0-5 1-8z"/>'),
  body: ic('<circle cx="12" cy="5" r="2.2"/><path d="M8 21l1-7-2-5.5 3-1.5h4l3 1.5-2 5.5 1 7"/>'),
  coach: ic('<path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  minus: ic('<path d="M5 12h14"/>'),
  check: ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>'),
  camera: ic('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>'),
  drop: ic('<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>'),
  chev: ic('<path d="M9 6l6 6-6 6"/>'),
  left: ic('<path d="M15 6l-6 6 6 6"/>'),
  send: ic('<path d="M5 12l14-7-5 14-2.5-5.5z"/>'),
  trash: ic('<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12h8l1-12"/>'),
  flame: ic('<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .2 1.2 1 2 2 2-.6-3 0-5 1-8z"/>'),
  swap: ic('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),
  spark: ic('<path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/>'),
};
export const icon = n => ICONS[n] || '';

// ---------- toasts
export function toast(msg, ms = 2600) {
  const root = $('#toast-root');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, ms);
}

// ---------- sheets
export function openSheet({ title = '', body = '', tall = false, onMount, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg"></div><section class="sheet${tall ? ' tall' : ''}" role="dialog" aria-modal="true"><div class="grab"></div><header class="sheet-h"><h2>${esc(title)}</h2><button class="icon-btn x" aria-label="Close">${icon('x')}</button></header><div class="sheet-b"></div></section>`;
  $('#sheet-root').appendChild(wrap);
  const sheet = $('.sheet', wrap), bodyEl = $('.sheet-b', wrap);
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('on')));
  let closed = false;
  const api = {
    el: bodyEl,
    setTitle: t => { $('h2', wrap).textContent = t; },
    close() {
      if (closed) return; closed = true;
      wrap.classList.remove('on');
      setTimeout(() => { wrap.remove(); onClose && onClose(); }, 300);
    },
  };
  $('.sheet-bg', wrap).onclick = api.close;
  $('.x', wrap).onclick = api.close;
  // drag-to-dismiss from the grabber / header
  let y0 = null;
  const handle = [$('.grab', wrap), $('.sheet-h', wrap)];
  handle.forEach(h => {
    h.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
    h.addEventListener('touchmove', e => { if (y0 == null) return; const dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    h.addEventListener('touchend', e => {
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0; y0 = null;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 90) api.close();
    });
  });
  onMount && onMount(bodyEl, api);
  return api;
}

export function confirmSheet({ title, text, ok = 'Confirm', danger = false }) {
  return new Promise(res => {
    let done = false;
    const s = openSheet({
      title,
      body: `<p class="muted pad-b">${esc(text)}</p><div class="stack"><button class="btn ${danger ? 'danger' : 'primary'} block" data-ok>${esc(ok)}</button><button class="btn ghost block" data-no>Cancel</button></div>`,
      onClose: () => { if (!done) res(false); },
      onMount: el => {
        $('[data-ok]', el).onclick = () => { done = true; res(true); s.close(); };
        $('[data-no]', el).onclick = () => s.close();
      },
    });
  });
}

// ---------- rings (Apple-style concentric)
export function rings(vals, size = 160) {
  const sw = 11, gap = 5, c0 = size / 2;
  let out = `<svg viewBox="0 0 ${size} ${size}" class="rings" role="img">`;
  vals.forEach((v, i) => {
    const r = c0 - sw / 2 - 2 - i * (sw + gap);
    const c = 2 * Math.PI * r, p = clamp(v.pct, 0, 1);
    out += `<circle cx="${c0}" cy="${c0}" r="${r}" class="rt" stroke-width="${sw}"/>`;
    out += `<circle cx="${c0}" cy="${c0}" r="${r}" class="rv" stroke-width="${sw}" stroke="${v.color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${c0} ${c0})" style="--c:${c};animation-delay:${i * 120}ms"/>`;
  });
  return out + '</svg>';
}

// ---------- formatting
export const dateLong = (d = new Date()) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
export function greeting() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 18 ? 'Good afternoon' : 'Good evening';
}
export const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function relDay(iso) {
  if (!iso) return 'Not trained yet';
  const d0 = new Date(iso); const n = Math.floor((Date.now() - d0.getTime()) / 86400000);
  return n <= 0 ? 'Trained today' : n === 1 ? 'Trained yesterday' : `Trained ${n} days ago`;
}
export function md(text) {
  // minimal, safe markdown: **bold**, bullet lines, paragraphs
  const lines = esc(text).split('\n');
  let html = '', list = false;
  for (const l of lines) {
    const b = l.match(/^\s*[-*•]\s+(.*)/);
    const f = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (b) { if (!list) { html += '<ul>'; list = true; } html += `<li>${f(b[1])}</li>`; }
    else { if (list) { html += '</ul>'; list = false; } if (l.trim()) html += `<p>${f(l)}</p>`; }
  }
  return html + (list ? '</ul>' : '');
}

// downscale an image file for AI + thumbnail
export function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const draw = max => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c;
      };
      const big = draw(1024).toDataURL('image/jpeg', 0.82);
      const thumb = draw(300).toDataURL('image/jpeg', 0.6);
      URL.revokeObjectURL(url);
      resolve({ b64: big.split(',')[1], thumb });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}
