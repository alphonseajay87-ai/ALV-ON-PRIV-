// ALVéON PRIVÉ — per-exercise history sheet: personal best, trend, last sessions, next-time suggestion.
import { EX, MUSCLES } from './data.js';
import { history, personalBest, overloadHint } from './progress.js';
import { dayLabel } from './dates.js';
import { esc, openSheet, fmt } from './ui.js';

const setTxt = (ex, s) => (ex.type === 'time' ? `${s.r} s` : `${s.w ? s.w + ' kg × ' : ''}${s.r}`);

function spark(vals) {
  if (vals.length < 2) return '';
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => [6 + (i / (vals.length - 1)) * 288, 40 - ((v - min) / span) * 30]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const e = pts[pts.length - 1];
  return `<svg class="wchart" viewBox="0 0 300 48" aria-hidden="true"><path d="${d}" fill="none" stroke="#ecdcb8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3.6" fill="#000" stroke="#ecdcb8" stroke-width="1.6"/></svg>`;
}

export function openExerciseHistory(exId, target = '') {
  const ex = EX[exId]; if (!ex) return;
  const rows = history(exId, 8), pb = personalBest(exId), hint = overloadHint(exId, target);
  const body = !rows.length
    ? `<div class="empty"><p class="muted">No history yet. Log this exercise once and your personal best, trend and next-time suggestion appear here.</p></div>`
    : `${pb ? `<div class="card flat pbcard"><div class="eyebrow">Personal best</div><div class="big-serif">${esc(setTxt(ex, pb))}</div><p class="muted sm">${esc(dayLabel(pb.key))}</p></div>` : ''}
      ${hint ? `<div class="hint"><b>Next time · ${esc(hint.text)}</b><small>${esc(hint.why)}</small></div>` : ''}
      ${spark(rows.slice().reverse().map(r => r.score))}
      <div class="eyebrow pad-t">Recent sessions</div>
      ${rows.map((r, i) => {
        const prev = rows[i + 1], diff = prev ? r.score - prev.score : 0;
        const arrow = !prev ? '' : diff > 0.01 ? '<em class="up">↑</em>' : diff < -0.01 ? '<em class="dn">↓</em>' : '<em>→</em>';
        return `<div class="card flat"><div class="split"><b>${esc(dayLabel(r.key))}</b>${arrow}</div><div class="setline">${r.sets.map((s, k) => `<span>${k + 1} · ${esc(setTxt(ex, s))}</span>`).join('')}</div>${r.volume ? `<p class="muted sm">${fmt(r.volume)} kg volume</p>` : ''}</div>`;
      }).join('')}`;
  openSheet({ title: ex.name, tall: true, body: `<p class="muted pad-b">${ex.p.map(m => MUSCLES[m]).join(' · ')}</p>${body}` });
}
