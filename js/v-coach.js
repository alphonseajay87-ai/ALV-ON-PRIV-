// ALVéON PRIVÉ — Coach: chat grounded in your data, natural-language logging, and plan changes you review before applying.
import { get, update, applyPlan, revertPlan } from './store.js';
import { chat, generatePlan, hasKey, extractLog, AIError } from './ai.js';
import { localExtract, applyLog, undoLog } from './logger.js';
import { EX, WD } from './data.js';
import { esc, icon, $, $$, md, toast, openSheet, plate, pageHeader } from './ui.js';
import { openSettings } from './v-settings.js';

const FOCUS = ['Bigger chest', 'Wider back', 'Stronger legs', 'Bigger arms', 'Rounder shoulders', 'Muscle-up', 'Core & abs', 'Fix my weakest muscles'];
const ASK = ['How is my week going?', 'What should I eat tonight?', 'Why am I not progressing on pull-ups?'];
const GATE = /\d|\b(did|done|finish\w*|train\w*|workout|session|yesterday|weigh\w*|ran|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/i;
let busy = false, failed = null; // failed = { text, note, history } of the last reply that errored (kept out of the saved chat)

/** Keep the saved chat bounded: once it passes 40 messages, cut back to the latest 30 (hysteresis avoids trimming every turn). */
const trim = s => { if (s.chat.length > 40) s.chat = s.chat.slice(-30); };

export function coachView(el) {
  const draw = () => {
    const msgs = get().chat, offline = navigator.onLine === false;
    el.innerHTML = `
    ${pageHeader('Private coach', 'Coach')}
    ${hasKey() ? '' : `<button class="card nudge" id="key"><span>${icon('spark')}</span><div><b>Connect Gemini</b><small>Add your API key to unlock the coach, plan adaptation and meal photo analysis. Logging past workouts works without it.</small></div>${icon('chev')}</button>`}
    <section class="card adapt"><div class="eyebrow">Adapt my plan</div><p class="muted sm">Choose what you want to improve. The coach rebuilds your week from your real data, and you review every change before it applies.</p>
      <div class="chips wrap" id="focus" role="group">${FOCUS.map(f => `<button class="chip" data-f="${esc(f)}" aria-pressed="false">${esc(f)}</button>`).join('')}</div>
      <div class="inline"><input class="input" id="custom" placeholder="Or describe a goal…" maxlength="200" aria-label="Describe a goal"><button class="btn primary sm" id="build">Build</button></div></section>
    <div class="chat" id="chat" aria-live="polite">${msgs.length ? msgs.map(bubble).join('') : `<div class="empty">${plate('jacob', 'Don’t let go.', 'dim')}<p class="muted">Ask anything about training, food or recovery. You can also tell me what you did: “50 push-ups and 5×10 dips yesterday”.</p><div class="chips wrap">${ASK.map(a => `<button class="chip" data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>`}
      ${failed ? `<div class="bub err" role="alert"><span>${esc(failed.msg)}</span><button class="undo" id="retry">Retry</button></div>` : ''}</div>
    <form class="composer" id="form"><textarea id="msg" rows="1" placeholder="${offline ? 'Offline. Logging still works' : 'Message your coach'}" aria-label="Message" maxlength="1500"></textarea><button class="send" aria-label="Send">${icon('send')}</button></form>`;
    $('#gear', el).onclick = openSettings;
    $('#key', el)?.addEventListener('click', openSettings);
    const picked = new Set();
    $('#focus', el).onclick = e => { const c = e.target.closest('.chip'); if (!c) return; const on = c.classList.toggle('on'); c.setAttribute('aria-pressed', String(on)); on ? picked.add(c.dataset.f) : picked.delete(c.dataset.f); };
    $('#build', el).onclick = () => build([...picked, $('#custom', el).value.trim()].filter(Boolean).join('; '));
    const msg = $('#msg', el);
    msg.oninput = () => { msg.style.height = 'auto'; msg.style.height = Math.min(120, msg.scrollHeight) + 'px'; };
    msg.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover:hover)').matches) { e.preventDefault(); $('#form', el).requestSubmit(); } };
    $('#form', el).onsubmit = e => { e.preventDefault(); const t = msg.value.trim(); if (t) { msg.value = ''; msg.style.height = 'auto'; send(t); } };
    $$('[data-a]', el).forEach(b => (b.onclick = () => send(b.dataset.a)));
    $('#retry', el)?.addEventListener('click', () => { const f = failed; failed = null; if (f) answer(f.text, f.note, f.history); });
    $$('[data-undo]', el).forEach(b => (b.onclick = () => {
      const i = +b.dataset.undo, m = get().chat[i]; if (!m || m.undone) return;
      undoLog(m.ids); update(st => { st.chat[i].undone = true; }); toast('Removed from your history'); draw();
    }));
    $('#chat', el).lastElementChild?.scrollIntoView({ block: 'end' });
  };

  const typing = () => { const box = $('#chat', el); box.insertAdjacentHTML('beforeend', '<div class="bub ai typing" aria-label="Coach is typing"><i></i><i></i><i></i></div>'); box.lastElementChild.scrollIntoView({ block: 'end' }); };

  /** Ask the model. Failures are shown as a retryable notice and never saved into the conversation. */
  async function answer(text, note, history) {
    busy = true; failed = null; draw(); typing();
    try {
      const reply = await chat(history, text, note);
      update(s => { s.chat.push({ role: 'model', text: reply }); trim(s); });
    } catch (e) {
      failed = { text, note, history, msg: e instanceof AIError ? e.message : 'The coach could not answer. Try again.' };
    }
    busy = false; draw();
  }

  async function send(text) {
    if (busy) return;
    failed = null;
    const maybeLog = GATE.test(text);
    if (!hasKey()) {
      const loc = maybeLog ? localExtract(text) : null;
      const r = loc ? applyLog(loc) : null;
      if (r && r.lines.length) {
        update(s => { s.chat.push({ role: 'user', text }, { role: 'log', text: r.lines.join('\n'), ids: r.ids }, { role: 'model', text: 'Logged. Connect Gemini in Settings and I can coach you on it too.' }); trim(s); });
        draw(); return;
      }
      toast('Add your Gemini key to chat with the coach'); openSettings(); return;
    }
    busy = true;
    const history = get().chat.slice();
    update(s => { s.chat.push({ role: 'user', text }); trim(s); });
    draw(); typing();
    let note = '';
    if (maybeLog) {
      let res = null;
      try { res = await extractLog(text); } catch { /* fall back below */ }
      if (!res || (!res.workouts.length && !res.weight)) res = localExtract(text); // offline, API error, or the model found nothing
      const r = res ? applyLog(res) : null;
      if (r && r.lines.length) {
        update(s => { s.chat.push({ role: 'log', text: r.lines.join('\n'), ids: r.ids }); });
        note = `\n\n[App note: I already added this to the user's past training history: ${r.lines.join('; ')}. Acknowledge it in one short line, then answer. Do not ask them to log it again.]`;
      }
    }
    if (navigator.onLine === false) { // logging worked offline; the answer needs a connection
      failed = { text, note, history, msg: 'You are offline, so the coach cannot reply yet.' }; busy = false; draw(); return;
    }
    await answer(text, note, history);
  }

  async function build(focus) {
    if (!hasKey()) { toast('Add your Gemini key first'); openSettings(); return; }
    if (busy) return; busy = true;
    const sh = openSheet({ title: 'Designing your week', body: '<div class="analyzing plain"><div class="scanline"></div></div><p class="muted center pad">Reading your levels, sessions and nutrition…</p>' });
    try {
      const plan = await generatePlan(focus);
      sh.close(); busy = false;
      setTimeout(() => previewPlan(plan), 320);
    } catch (e) { sh.close(); busy = false; toast(e instanceof AIError ? e.message : 'The plan could not be built. Try again.', 5000); }
  }
  draw();
}

const bubble = (m, i) => m.role === 'log'
  ? `<div class="bub logc"><div class="eyebrow">${m.undone ? 'Removed from history' : 'Added to your history'}</div>${m.text.split('\n').map(l => `<div class="ll">${icon('check')}<span>${esc(l)}</span></div>`).join('')}${m.undone || !(m.ids || []).length ? '' : `<button class="undo" data-undo="${i}">Undo</button>`}</div>`
  : `<div class="bub ${m.role === 'user' ? 'me' : 'ai'}">${m.role === 'user' ? esc(m.text) : md(m.text)}</div>`;

// ---------- plan review: what changes, day by day, before anything is applied
const exTxt = e => `${EX[e.id]?.name || e.id} ${e.sets}×${e.reps}`;

/** Compare two plans day by day. */
export function diffPlans(oldP, newP) {
  return newP.days.map((nd, i) => {
    const od = oldP.days[i], oldMap = new Map(od.ex.map(e => [e.id, e])), newMap = new Map(nd.ex.map(e => [e.id, e]));
    const added = nd.ex.filter(e => !oldMap.has(e.id)), removed = od.ex.filter(e => !newMap.has(e.id));
    const changed = nd.ex.filter(e => oldMap.has(e.id) && (oldMap.get(e.id).sets !== e.sets || String(oldMap.get(e.id).reps) !== String(e.reps))).map(e => ({ from: oldMap.get(e.id), to: e }));
    const kind = od.rest && !nd.rest ? 'on' : !od.rest && nd.rest ? 'off' : added.length || removed.length || changed.length || od.title !== nd.title ? 'edit' : 'same';
    return { i, od, nd, added, removed, changed, kind };
  });
}

export function previewPlan(plan) {
  const cur = get().plan, diff = diffPlans(cur, plan);
  const changedDays = diff.filter(d => d.kind !== 'same'), same = diff.filter(d => d.kind === 'same');
  const sum = diff.reduce((a, d) => ({ add: a.add + d.added.length, rm: a.rm + d.removed.length, ch: a.ch + d.changed.length }), { add: 0, rm: 0, ch: 0 });
  const card = d => `<div class="card flat diff ${d.kind}">
    <div class="split"><b>${WD[d.i]} · ${d.od.title !== d.nd.title ? `<s>${esc(d.od.title)}</s> ${esc(d.nd.title)}` : esc(d.nd.title)}</b><small class="muted">${d.kind === 'on' ? 'New training day' : d.kind === 'off' ? 'Now rest' : ''}</small></div>
    <p class="muted sm">${d.nd.rest ? 'Recovery' : esc(d.nd.focus)}</p>
    <div class="tags dtags">${d.added.map(e => `<span class="add">+ ${esc(exTxt(e))}</span>`).join('')}${d.changed.map(c => `<span class="chg">~ ${esc(EX[c.to.id]?.name)} ${c.from.sets}×${esc(c.from.reps)} → ${c.to.sets}×${esc(c.to.reps)}</span>`).join('')}${d.removed.map(e => `<span class="rm">− ${esc(exTxt(e))}</span>`).join('')}${d.kind === 'off' ? d.removed.length ? '' : '<span class="rm">− session removed</span>' : ''}</div></div>`;
  openSheet({
    title: plan.name, tall: true,
    body: `<p class="muted pad-b">${esc(plan.rationale)}</p>
    <div class="diffsum" aria-label="Summary of changes"><span><b>${changedDays.length}</b> day${changedDays.length === 1 ? '' : 's'} changed</span><span><b>+${sum.add}</b> added</span><span><b>~${sum.ch}</b> adjusted</span><span><b>−${sum.rm}</b> removed</span></div>
    ${changedDays.length ? changedDays.map(card).join('') : '<div class="empty"><p class="muted">This plan is the same as your current one.</p></div>'}
    ${same.length ? `<details class="card flat"><summary>${same.length} day${same.length === 1 ? '' : 's'} unchanged</summary><p class="muted sm pad">${same.map(d => `${WD[d.i]} · ${esc(d.nd.title)}`).join('<br>')}</p></details>` : ''}
    <p class="muted sm center pad">Nothing changes until you apply it, and you can revert afterwards.</p>
    <div class="stack"><button class="btn primary block" id="apply" ${changedDays.length ? '' : 'disabled'}>Apply changes</button><button class="btn ghost block" id="no">Keep my current plan</button></div>`,
    onMount: (el, sh) => {
      $('#apply', el).onclick = () => {
        try { applyPlan(plan); } catch (e) { toast(e.message); return; }
        sh.close(); window.dispatchEvent(new Event('alveon:rerender'));
        toast('Plan updated', 6000, { label: 'Revert', fn: () => { if (revertPlan()) { toast('Previous plan restored'); window.dispatchEvent(new Event('alveon:rerender')); } } });
        location.hash = '#train';
      };
      $('#no', el).onclick = sh.close;
    },
  });
}
