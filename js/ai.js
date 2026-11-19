// ALVéON PRIVÉ — Gemini layer (called straight from the browser with your own key).
// Every call has a timeout, one retry on transient failures, clear errors and tolerant JSON parsing.
import { get, mealsOn, totalsOn, dateKey, muscleStats, validatePlan, weekdayIdx } from './store.js';
import { EXERCISES, EX, MUSCLES, WD } from './data.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
export const hasKey = () => !!get().settings.apiKey;

export class AIError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const MSG = {
  NO_KEY: 'Add your Gemini key in Settings first.',
  OFFLINE: 'You are offline. Reconnect to use the coach.',
  TIMEOUT: 'Gemini took too long to answer. Try again in a moment.',
  AUTH: 'Gemini rejected the API key. Check it in Settings → Gemini AI.',
  RATE: 'Gemini is rate-limiting this key. Wait a minute and try again.',
  SERVER: 'Gemini is having trouble right now. Try again shortly.',
  EMPTY: 'Gemini sent an empty answer. Try again.',
  PARSE: 'I could not read the AI response. Try again.',
};
const wait = ms => new Promise(r => setTimeout(r, ms));

async function request(model, body, apiKey, timeoutMs) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (e) {
    if (e.name === 'AbortError') throw new AIError('TIMEOUT', MSG.TIMEOUT);
    throw new AIError(navigator.onLine === false ? 'OFFLINE' : 'NETWORK', navigator.onLine === false ? MSG.OFFLINE : 'Could not reach Gemini. Check your connection.');
  } finally { clearTimeout(t); }
}

function httpError(res, data) {
  const m = String(data?.error?.message || '');
  if (res.status === 400 && /api key/i.test(m)) return new AIError('AUTH', MSG.AUTH);
  if (res.status === 401 || res.status === 403) return new AIError('AUTH', /location|region/i.test(m) ? 'Gemini is not available in your region with this key.' : MSG.AUTH);
  if (res.status === 429) return new AIError('RATE', MSG.RATE);
  if (res.status >= 500) return new AIError('SERVER', MSG.SERVER);
  return new AIError('HTTP', m ? `Gemini: ${m.slice(0, 160)}` : `Gemini error ${res.status}`);
}

async function gen({ system, contents, json = false, temperature = 0.6, timeout = 40000 }) {
  const { apiKey, model } = get().settings;
  if (!apiKey) throw new AIError('NO_KEY', MSG.NO_KEY);
  if (navigator.onLine === false) throw new AIError('OFFLINE', MSG.OFFLINE);
  const body = { contents, generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const models = [...new Set([model || 'gemini-2.5-flash', 'gemini-flash-latest'])];
  let lastErr;
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { res, data } = await request(m, body, apiKey, timeout);
      if (res.ok) {
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
        if (text) return text;
        throw data.promptFeedback?.blockReason ? new AIError('BLOCKED', 'Gemini blocked this request: ' + data.promptFeedback.blockReason) : new AIError('EMPTY', MSG.EMPTY);
      }
      lastErr = httpError(res, data);
      if (res.status === 404) break;                                  // wrong model name: try the next one
      if ((res.status === 429 || res.status >= 500) && attempt === 0) { await wait(1300); continue; } // one polite retry
      throw lastErr;
    }
  }
  throw lastErr;
}

// ---------- tolerant JSON
/** Pull the first JSON object/array out of model text; repairs trailing commas and truncated output. */
export function parseJSON(t) {
  t = String(t).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const tryParse = s => { try { return JSON.parse(s); } catch { return undefined; } };
  let v = tryParse(t); if (v !== undefined) return v;
  const start = t.search(/[{[]/); if (start < 0) throw new AIError('PARSE', MSG.PARSE);
  let s = t.slice(start), depth = [], inStr = false, esc = false, end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') { depth.pop(); if (!depth.length) { end = i; break; } }
  }
  if (end >= 0) s = s.slice(0, end + 1);
  else { if (inStr) s += '"'; s = s.replace(/[,:\s]+$/, '') + depth.reverse().join(''); } // truncated: close what is open
  s = s.replace(/,\s*([}\]])/g, '$1');
  v = tryParse(s); if (v !== undefined) return v;
  throw new AIError('PARSE', MSG.PARSE);
}
/** JSON call with one automatic "return valid JSON only" retry, then a shape check. */
async function genJSON(opts, check) {
  let last;
  for (let i = 0; i < 2; i++) {
    const o = i ? { ...opts, temperature: 0, contents: [...opts.contents, { role: 'user', parts: [{ text: 'Your previous reply was not valid JSON for the requested schema. Reply again with ONLY the JSON object.' }] }] } : opts;
    try { const r = parseJSON(await gen({ ...o, json: true })); return check ? check(r) : r; }
    catch (e) { last = e; if (!(e instanceof AIError && e.code === 'PARSE') && !e.retryable) throw e; }
  }
  throw last;
}

export const ping = () => gen({ contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ready' }] }], temperature: 0, timeout: 20000 });

// ---------- meal photo -> macros
export async function analyzeMeal({ b64, mime = 'image/jpeg', note = '' }) {
  const system = `You are a meticulous sports-nutrition analyst. Look at the meal photo and estimate what is on the plate.
Return ONLY JSON: {"name": string, "items": [{"name": string, "grams": number, "kcal": number}], "kcal": number, "protein": number, "carbs": number, "fat": number, "confidence": number between 0 and 1, "comment": string (one short sentence)}.
Totals must equal the sum of the items. Use realistic portion sizes. If it is not food, return kcal 0 and say so in comment.`;
  const parts = [{ inline_data: { mime_type: mime, data: b64 } }, { text: note ? `Context from the user: ${note}` : 'Analyze this meal.' }];
  const n = v => Math.max(0, Math.round(+v || 0));
  return genJSON({ system, contents: [{ role: 'user', parts }], temperature: 0.2, timeout: 60000 }, r => {
    if (!r || typeof r !== 'object') throw new AIError('PARSE', MSG.PARSE);
    return {
      name: String(r.name || 'Meal').slice(0, 80),
      items: Array.isArray(r.items) ? r.items.slice(0, 12).map(i => ({ name: String(i.name || '').slice(0, 60), grams: n(i.grams), kcal: n(i.kcal) })) : [],
      kcal: n(r.kcal), p: n(r.protein), c: n(r.carbs), f: n(r.fat),
      confidence: Math.min(1, Math.max(0, +r.confidence || 0.5)), comment: String(r.comment || '').slice(0, 200),
    };
  });
}

// ---------- coach context (bounded so prompts stay small and cheap)
const CTX_MAX = 4200;
export function compactContext() {
  const s = get(), stats = muscleStats(), p = s.profile;
  const levels = Object.entries(stats).map(([k, v]) => `${MUSCLES[k]} L${v.level}`).join(', ');
  const recent = s.workouts.slice(-6).map(w => {
    const ex = w.exercises.slice(0, 7).map(e => {
      const best = e.sets.reduce((b, x) => ((x.w || 0) * (x.r || 0) >= (b.w || 0) * (b.r || 0) ? x : b), e.sets[0] || {});
      return `${EX[e.id]?.name || e.id} ${e.sets.length}x best ${best.w ? best.w + 'kg×' : ''}${best.r || 0}`;
    }).join('; ');
    return `${w.key} ${w.name}: ${ex}`;
  }).join('\n') || 'No sessions logged yet.';
  const days = [0, 1, 2].map(i => { const d = new Date(); d.setDate(d.getDate() - i); const k = dateKey(d); const t = totalsOn(k); return `${k}: ${Math.round(t.kcal)} kcal P${Math.round(t.p)} C${Math.round(t.c)} F${Math.round(t.f)}`; }).join(' | ');
  const w = s.weights.slice(-5).map(x => `${x.date}:${x.kg}`).join(', ') || 'none logged';
  const plan = s.plan.days.map((d, i) => `${WD[i]}: ${d.rest ? 'Rest' : d.title + ' [' + d.ex.map(e => EX[e.id]?.name).join(', ') + ']'}`).join('\n');
  const sc = s.scans.slice(-1)[0];
  const scan = sc ? `\nLATEST PHOTO SCAN (${sc.date}): ${sc.summary} Priorities: ${sc.priorities.map(m => MUSCLES[m]).join(', ') || 'none'}.` : '';
  const now = new Date();
  const txt = `TODAY: ${dateKey(now)} (${now.toLocaleDateString('en-GB', { weekday: 'long' })}); planned today: ${s.plan.days[weekdayIdx()].rest ? 'Rest' : s.plan.days[weekdayIdx()].title}.
PROFILE: ${p.name}; targets ${p.kcal} kcal, ${p.protein} g protein, ${p.carbs} g carbs, ${p.fat} g fat; ${p.days} training days/week; bodyweight ${p.weight ?? 'unknown'} kg.${p.goal ? ' Main goal: ' + p.goal + '.' : ''}
EQUIPMENT: ${p.equipment}
MUSCLE LEVELS (0-5): ${levels}
BODYWEIGHT LOG (kg): ${w}
NUTRITION (today, -1, -2): ${days}
RECENT SESSIONS:\n${recent}
CURRENT PLAN:\n${plan}${scan}`;
  return txt.length > CTX_MAX ? txt.slice(0, CTX_MAX) + '\n…(trimmed)' : txt;
}

const PERSONA = `You are the private coach inside ALVéON PRIVÉ, a luxury, minimalist fitness app used by one person. Tone: calm, precise, premium. Never cheesy, never preachy, no emojis.
Rules: Answer in at most 120 words unless asked for detail; at most 5 bullets; one clear next action. Ground every claim in the LIVE DATA below; if the data needed is missing, say what to log instead of guessing. Use kg and grams. Base advice on progressive overload, recovery and consistency, with concrete numbers (sets, reps, grams). Never push extreme dieting or unsafe training; for pain, injury or medical concerns recommend a professional. You may use **bold** sparingly. To change the weekly plan, point the user to "Adapt my plan" on this screen; do not paste a full plan in chat.`;

/** Keep the conversation short and valid for Gemini: recent turns only, merged same-role runs, starts with the user. */
export function pruneChat(history, max = 12, cap = 1200) {
  const turns = history.filter(m => (m.role === 'user' || m.role === 'model') && m.text && !m.err).slice(-max)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: String(m.text).slice(0, cap) }));
  const out = [];
  for (const t of turns) { const l = out[out.length - 1]; if (l && l.role === t.role) l.text += '\n' + t.text; else out.push({ ...t }); }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.map(t => ({ role: t.role, parts: [{ text: t.text }] }));
}

export async function chat(history, userText, note = '') {
  const system = `${PERSONA}\n\nLIVE DATA FROM THE APP (trust it):\n${compactContext()}`;
  const contents = pruneChat(history);
  const last = contents[contents.length - 1];
  const msg = String(userText).slice(0, 1500) + note;
  if (last && last.role === 'user') last.parts[0].text += '\n' + msg; else contents.push({ role: 'user', parts: [{ text: msg }] });
  return gen({ system, contents, temperature: 0.7 });
}

// ---------- plan generation
export async function generatePlan(focus) {
  const lib = EXERCISES.map(e => `${e.id}|${e.name}|${e.p.join('+')}|${e.type}|${e.loc}`).join('\n');
  const maxTrain = Math.min(7, Math.max(1, get().profile.days));
  const system = `${PERSONA}
You design weekly training programs. Use ONLY exercise ids from this library (id|name|primary muscles|type|where):
${lib}
Types: wt = weighted reps, bw = bodyweight reps, time = seconds (reps field is then seconds).
Return ONLY JSON:
{"name": string, "rationale": string (2-3 sentences: what changes and why, referencing the user's data), "days": [7 items, Monday first, each {"title": string, "focus": string, "rest": boolean, "exercises": [{"id": string, "sets": 1-6, "reps": string like "8-10" or "max" or "45"}]}]}
Use exactly ${maxTrain} training day(s) and rest on the others. Respect the equipment and recovery (do not hit the same muscle hard two days in a row). 4-7 exercises per training day. Rest days have an empty exercises array.`;
  const user = `${compactContext()}\n\nWHAT I WANT TO IMPROVE: ${String(focus || 'balanced overall progress, prioritising my weakest muscle levels').slice(0, 400)}\nBuild next week's program.`;
  return genJSON({ system, contents: [{ role: 'user', parts: [{ text: user }] }], temperature: 0.5, timeout: 60000 }, r => {
    if (!r || !Array.isArray(r.days) || r.days.length < 7) throw new AIError('PARSE', 'The plan came back incomplete. Try again.');
    const plan = validatePlan({
      name: r.name, rationale: r.rationale,
      days: r.days.slice(0, 7).map(d => ({ title: d.title, focus: d.focus, rest: d.rest, ex: (d.exercises || []).map(e => ({ id: e.id, sets: e.sets, reps: e.reps })) })),
    });
    if (!plan) throw new AIError('PARSE', 'The plan came back incomplete. Try again.');
    // honour the training-day budget even if the model overshoots: turn the lightest days into rest
    let train = plan.days.map((d, i) => ({ i, n: d.ex.length })).filter(x => x.n);
    train.sort((a, b) => a.n - b.n);
    while (train.length > maxTrain) { const x = train.shift(); plan.days[x.i] = { title: 'Rest', focus: 'Recovery', rest: true, ex: [] }; }
    if (!plan.days.some(d => !d.rest)) throw new AIError('PARSE', 'The plan had no training days. Try again.');
    return plan;
  });
}

// ---------- chat message -> logged past workouts
export async function extractLog(text) {
  const now = new Date();
  const lib = EXERCISES.map(e => `${e.id}|${e.name}|${e.type}`).join('\n');
  const system = `You extract COMPLETED training from a message a person sends to their coach inside a fitness app.
Today is ${dateKey(now)} (${now.toLocaleDateString('en-GB', { weekday: 'long' })}). Resolve words like "yesterday", "this morning", "last Tuesday", "2 days ago" to a real date (YYYY-MM-DD, never in the future; if no day is given for something already done, use today).
Exercise library (id|name|type), use ONLY these ids, choosing the closest match:
${lib}
Return ONLY JSON: {"workouts":[{"date":"YYYY-MM-DD","name":string,"exercises":[{"id":string,"sets":[{"w":kg number (0 for bodyweight),"r":reps or seconds}]}]}],"weight":null or {"date":"YYYY-MM-DD","kg":number}}.
Rules: if the person gives only a total ("60 pull-ups") record ONE set with r = that total; if they give sets x reps ("5x12") expand to that many sets; keep the real numbers, never invent extra volume. Time-based exercises use seconds. Pounds -> kg. Include "weight" only if they state their bodyweight. Group exercises done the same day into one workout. Questions, plans and future intentions are NOT completed training: return {"workouts":[],"weight":null}.`;
  return genJSON({ system, contents: [{ role: 'user', parts: [{ text: String(text).slice(0, 1500) }] }], temperature: 0 }, r => ({
    workouts: Array.isArray(r?.workouts) ? r.workouts : [], weight: r?.weight && typeof r.weight === 'object' ? r.weight : null,
  }));
}

// ---------- body photo -> physique read
export async function analyzePhysique({ b64, mime = 'image/jpeg', note = '' }) {
  const keys = Object.keys(MUSCLES).join(', ');
  const system = `${PERSONA}
You are reviewing a physique photo the user chose to share privately, purely to tailor a muscle- and strength-building program. Be respectful, objective and training-focused. Do not comment on attractiveness, do not give medical or body-fat-percentage claims, and do not shame. Judge only what is visible (lighting, pump and angle limit accuracy; say so in "caveat").
If the image does not clearly show a person's body, return {"valid": false, "reason": string}.
Otherwise return ONLY JSON: {"valid": true, "summary": string (2-3 sentences: overall frame, balance, what to build), "ratings": {muscle: number 1-5 development as visible, for each of: ${keys}} (use null for muscles not visible), "strengths": [muscle keys, max 3], "priorities": [muscle keys to bring up first, max 4], "posture": string (one short line, or ""), "focus": string (one sentence describing the training goal to hand to a program designer), "caveat": string (one short line)}.
Muscle keys must come exactly from: ${keys}.`;
  const parts = [{ inline_data: { mime_type: mime, data: b64 } }, { text: `${note ? 'Context from the user: ' + String(note).slice(0, 300) + '\n' : ''}${compactContext()}\n\nAnalyze my physique for training purposes.` }];
  return genJSON({ system, contents: [{ role: 'user', parts }], temperature: 0.3, timeout: 60000 }, r => {
    if (!r || typeof r !== 'object') throw new AIError('PARSE', MSG.PARSE);
    if (r.valid === false) throw new AIError('INVALID', r.reason || 'I could not see a clear body photo. Try a well-lit, full or upper-body shot.');
    const ok = k => k in MUSCLES, ratings = {};
    for (const k of Object.keys(MUSCLES)) { const v = r.ratings?.[k]; if (v != null && isFinite(+v)) ratings[k] = Math.min(5, Math.max(1, Math.round(+v))); }
    return {
      summary: String(r.summary || '').slice(0, 500), ratings,
      strengths: (r.strengths || []).filter(ok).slice(0, 3), priorities: (r.priorities || []).filter(ok).slice(0, 4),
      posture: String(r.posture || '').slice(0, 160), focus: String(r.focus || '').slice(0, 300), caveat: String(r.caveat || '').slice(0, 160),
    };
  });
}

