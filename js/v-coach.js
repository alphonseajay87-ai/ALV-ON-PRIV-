import { get, update } from './store.js';
import { chat, generatePlan, hasKey } from './ai.js';
import { EX, MUSCLES, WD } from './data.js';
import { esc, icon, $, $$, md, toast, openSheet } from './ui.js';
import { openSettings } from './v-settings.js';

const FOCUS = ['Bigger chest', 'Wider back', 'Stronger legs', 'Bigger arms', 'Rounder shoulders', 'Muscle-up', 'Core & abs', 'Fix my weakest muscles'];
const ASK = ['How is my week going?', 'What should I eat tonight?', 'Why am I not progressing on pull-ups?'];
let busy = false;

export function coachView(el) {
  const draw = () => {
    const msgs = get().chat;
    el.innerHTML = `
    <header class="lt"><div><div class="eyebrow">Private coach</div><h1>Coach</h1></div><button class="icon-btn lg" id="gear">${icon('gear')}</button></header>
    ${hasKey() ? '' : `<button class="card nudge" id="key"><span>${icon('spark')}</span><div><b>Connect Gemini</b><small>Add your API key to unlock the coach, plan adaptation and meal photo analysis</small></div>${icon('chev')}</button>`}
    <section class="card adapt"><div class="eyebrow">Adapt my plan</div><p class="muted sm">Choose what you want to improve — the coach rebuilds your week from your real data.</p>
      <div class="chips wrap" id="focus">${FOCUS.map(f => `<button class="chip" data-f="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      <div class="inline"><input class="input" id="custom" placeholder="Or describe a goal…"><button class="btn primary sm" id="build">Build</button></div></section>
    <div class="chat" id="chat">${msgs.length ? msgs.map(bubble).join('') : `<div class="empty"><p class="muted">Ask anything about training, food or recovery.</p><div class="chips wrap">${ASK.map(a => `<button class="chip" data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>`}</div>
    <form class="composer" id="form"><textarea id="msg" rows="1" placeholder="Message your coach" aria-label="Message"></textarea><button class="send" aria-label="Send">${icon('send')}</button></form>`;
    $('#gear', el).onclick = openSettings;
    $('#key', el)?.addEventListener('click', openSettings);
    const picked = new Set();
    $('#focus', el).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; c.classList.toggle('on'); c.classList.contains('on') ? picked.add(c.dataset.f) : picked.delete(c.dataset.f); };
    $('#build', el).onclick = () => build([...picked, $('#custom', el).value.trim()].filter(Boolean).join('; '));
    const msg = $('#msg', el);
    msg.oninput = () => { msg.style.height = 'auto'; msg.style.height = Math.min(120, msg.scrollHeight) + 'px'; };
    msg.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover:hover)').matches) { e.preventDefault(); $('#form', el).requestSubmit(); } };
    $('#form', el).onsubmit = e => { e.preventDefault(); const t = msg.value.trim(); if (t) { msg.value = ''; msg.style.height = 'auto'; send(t); } };
    $$('[data-a]', el).forEach(b => (b.onclick = () => send(b.dataset.a)));
    $('#chat', el).lastElementChild?.scrollIntoView({ block: 'end' });
  };

  async function send(text) {
    if (busy) return;
    if (!hasKey()) { toast('Add your Gemini key first'); openSettings(); return; }
    busy = true;
    const history = get().chat.slice();
    update(s => { s.chat.push({ role: 'user', text }); });
    draw();
    const box = $('#chat', el);
    box.insertAdjacentHTML('beforeend', '<div class="bub ai typing"><i></i><i></i><i></i></div>');
    box.lastElementChild.scrollIntoView({ block: 'end' });
    try {
      const reply = await chat(history, text);
      update(s => { s.chat.push({ role: 'model', text: reply }); s.chat = s.chat.slice(-40); });
    } catch (e) {
      update(s => { s.chat.push({ role: 'model', text: '⚠️ ' + e.message }); });
    }
    busy = false; draw();
  }

  async function build(focus) {
    if (!hasKey()) { toast('Add your Gemini key first'); openSettings(); return; }
    if (busy) return; busy = true;
    const sh = openSheet({ title: 'Designing your week', body: '<div class="analyzing plain"><div class="scanline"></div></div><p class="muted center pad">Reading your levels, sessions and nutrition…</p>' });
    try {
      const plan = await generatePlan(focus);
      sh.close(); busy = false;
      setTimeout(() => previewPlan(plan), 320);
    } catch (e) { sh.close(); busy = false; toast(e.message, 5000); }
  }
  draw();
}

const bubble = m => `<div class="bub ${m.role === 'user' ? 'me' : 'ai'}">${m.role === 'user' ? esc(m.text) : md(m.text)}</div>`;

function previewPlan(plan) {
  openSheet({
    title: plan.name, tall: true,
    body: `<p class="muted pad-b">${esc(plan.rationale)}</p>
    ${plan.days.map((d, i) => `<div class="card flat"><div class="split"><b>${WD[i]} · ${esc(d.title)}</b><small class="muted">${d.rest ? '' : d.ex.length + ' ex'}</small></div>
      <p class="muted sm">${d.rest ? 'Recovery' : esc(d.focus)}</p>${d.rest ? '' : `<div class="tags">${d.ex.map(e => `<span>${esc(EX[e.id].name)} ${e.sets}×${esc(e.reps)}</span>`).join('')}</div>`}</div>`).join('')}
    <div class="stack"><button class="btn primary block" id="apply">Apply this plan</button><button class="btn ghost block" id="no">Not now</button></div>`,
    onMount: (el, sh) => {
      $('#apply', el).onclick = () => { update(s => { s.plan = plan; }); sh.close(); toast('Plan updated'); location.hash = '#train'; };
      $('#no', el).onclick = sh.close;
    },
  });
}
