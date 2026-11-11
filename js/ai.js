// ALVéON PRIVÉ — Gemini layer (called straight from the browser with your own key)
import { get, mealsOn, totalsOn, dateKey, muscleStats } from './store.js';
import { EXERCISES, EX, MUSCLES, WD } from './data.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
export const hasKey = () => !!get().settings.apiKey;

async function gen({ system, contents, json = false, temperature = 0.6 }) {
  const { apiKey, model } = get().settings;
  if (!apiKey) throw new Error('NO_KEY');
  const body = {
    contents,
    generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const models = [...new Set([model || 'gemini-2.5-flash', 'gemini-flash-latest'])];
  let lastErr;
  for (const m of models) {
    let res, data;
    try {
      res = await fetch(`${BASE}${encodeURIComponent(m)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
      data = await res.json().catch(() => ({}));
    } catch { throw new Error('Network error — check your connection.'); }
    if (res.ok) {
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (text) return text;
      throw new Error(data.promptFeedback?.blockReason ? 'Blocked by Gemini: ' + data.promptFeedback.blockReason : 'Empty response from Gemini.');
    }
    lastErr = new Error(data?.error?.message || `Gemini error ${res.status}`);
    if (res.status !== 404) break; // only retry other model names on "not found"
  }
  throw lastErr;
}

function parseJSON(t) {
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Could not read the AI response — try again.');
  }
}

export async function ping() {
  const t = await gen({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ready' }] }], temperature: 0 });
  return t;
}

// ---------- meal photo -> macros
export async function analyzeMeal({ b64, mime = 'image/jpeg', note = '' }) {
  const system = `You are a meticulous sports-nutrition analyst. Look at the meal photo and estimate what is on the plate.
Return ONLY JSON: {"name": string, "items": [{"name": string, "grams": number, "kcal": number}], "kcal": number, "protein": number, "carbs": number, "fat": number, "confidence": number between 0 and 1, "comment": string (one short sentence)}.
Totals must equal the sum of the items. Use realistic portion sizes. If it is not food, return kcal 0 and say so in comment.`;
  const parts = [{ inline_data: { mime_type: mime, data: b64 } }];
  parts.push({ text: note ? `Context from the user: ${note}` : 'Analyze this meal.' });
  const r = parseJSON(await gen({ system, contents: [{ role: 'user', parts }], json: true, temperature: 0.2 }));
  const n = v => Math.max(0, Math.round(+v || 0));
  return {
    name: String(r.name || 'Meal').slice(0, 80),
    items: Array.isArray(r.items) ? r.items.slice(0, 12).map(i => ({ name: String(i.name || '').slice(0, 60), grams: n(i.grams), kcal: n(i.kcal) })) : [],
    kcal: n(r.kcal), p: n(r.protein), c: n(r.carbs), f: n(r.fat),
    confidence: Math.min(1, Math.max(0, +r.confidence || 0.5)),
    comment: String(r.comment || ''),
  };
}

// ---------- coach context
function compactContext() {
  const s = get();
  const stats = muscleStats();
  const levels = Object.entries(stats).map(([k, v]) => `${MUSCLES[k]}: L${v.level} (${Math.round(v.xp)}xp)`).join(', ');
  const recent = s.workouts.slice(-8).map(w => {
    const ex = w.exercises.map(e => {
      const best = e.sets.reduce((b, x) => ((x.w || 0) * (x.r || 0) >= (b.w || 0) * (b.r || 0) ? x : b), e.sets[0] || {});
      return `${EX[e.id]?.name || e.id} ${e.sets.length}x best ${best.w ? best.w + 'kg×' : ''}${best.r || 0}`;
    }).join('; ');
    return `${w.key} ${w.name} (${w.dur || '?'} min): ${ex}`;
  }).join('\n') || 'No sessions logged yet.';
  const days = [0, 1, 2].map(i => { const d = new Date(); d.setDate(d.getDate() - i); const k = dateKey(d); const t = totalsOn(k); return `${k}: ${Math.round(t.kcal)} kcal, P${Math.round(t.p)} C${Math.round(t.c)} F${Math.round(t.f)}`; }).join(' | ');
  const w = s.weights.slice(-6).map(x => `${x.date}:${x.kg}kg`).join(', ') || 'no bodyweight logged';
  const plan = s.plan.days.map((d, i) => `${WD[i]}: ${d.rest ? 'Rest' : d.title + ' [' + d.ex.map(e => EX[e.id]?.name).join(', ') + ']'}`).join('\n');
  return `PROFILE: ${s.profile.name}; goals ${s.profile.kcal} kcal, ${s.profile.protein} g protein, ${s.profile.carbs} g carbs, ${s.profile.fat} g fat; ${s.profile.days} training days/week.
EQUIPMENT: ${s.profile.equipment}
MUSCLE LEVELS: ${levels}
BODYWEIGHT: ${w}
NUTRITION (today, -1, -2): ${days}
RECENT SESSIONS:\n${recent}
CURRENT PLAN:\n${plan}`;
}

const PERSONA = `You are the private coach inside ALVéON PRIVÉ, a luxury, minimalist fitness app used by one person. Tone: calm, precise, premium — never cheesy, never preachy. Be concise (short paragraphs, at most 5 bullets). Base advice on progressive overload, recovery and consistency. Give concrete numbers (sets, reps, grams) when useful. Never push extreme dieting, crash cuts or unsafe training; for pain, injury or medical concerns suggest seeing a professional. You may use **bold** sparingly.`;

export async function chat(history, userText) {
  const system = `${PERSONA}\n\nLIVE DATA FROM THE APP (trust it):\n${compactContext()}`;
  const contents = history.slice(-14).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
  contents.push({ role: 'user', parts: [{ text: userText }] });
  return gen({ system, contents, temperature: 0.7 });
}

// ---------- plan generation
export async function generatePlan(focus) {
  const lib = EXERCISES.map(e => `${e.id}|${e.name}|${e.p.join('+')}|${e.type}|${e.loc}`).join('\n');
  const system = `${PERSONA}
You design weekly training programs. Use ONLY exercise ids from this library (id|name|primary muscles|type|where):
${lib}
Types: wt = weighted reps, bw = bodyweight reps, time = seconds (reps field is then seconds).
Return ONLY JSON:
{"name": string, "rationale": string (2-3 sentences: what changes and why, referencing the user's data), "days": [7 items, Monday first, each {"title": string, "focus": string, "rest": boolean, "exercises": [{"id": string, "sets": 1-6, "reps": string like "8-10" or "max" or "45"}]}]}
Respect the equipment, the number of training days and recovery (do not hit the same muscle hard two days in a row). 4-7 exercises per training day. Rest days have an empty exercises array.`;
  const user = `${compactContext()}\n\nWHAT I WANT TO IMPROVE: ${focus || 'balanced overall progress, prioritising my weakest muscle levels'}\nBuild next week's program.`;
  const r = parseJSON(await gen({ system, contents: [{ role: 'user', parts: [{ text: user }] }], json: true, temperature: 0.5 }));
  if (!Array.isArray(r.days) || r.days.length < 7) throw new Error('The plan came back incomplete — try again.');
  const days = r.days.slice(0, 7).map((d, i) => {
    const ex = (d.exercises || []).filter(e => EX[e.id]).map(e => ({
      id: e.id, sets: Math.min(8, Math.max(1, Math.round(+e.sets || 3))), reps: String(e.reps || '10'),
    }));
    const rest = !!d.rest || ex.length === 0;
    return { title: rest ? 'Rest' : String(d.title || 'Session').slice(0, 40), focus: rest ? 'Recovery' : String(d.focus || '').slice(0, 70), rest, ex: rest ? [] : ex };
  });
  return { name: String(r.name || 'Adapted plan').slice(0, 60), rationale: String(r.rationale || ''), days };
}
