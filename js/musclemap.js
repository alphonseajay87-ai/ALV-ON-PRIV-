// ALVéON PRIVÉ — animated anatomical muscle map (SVG). Right-side paths are mirrored across x=100.
import { MUSCLES } from './data.js';

const rr = (x, y, w, h, r) =>
  `M${x + r} ${y}h${w - 2 * r}q${r} 0 ${r} ${r}v${h - 2 * r}q0 ${r} ${-r} ${r}h${-(w - 2 * r)}q${-r} 0 ${-r} ${-r}v${-(h - 2 * r)}q0 ${-r} ${r} ${-r}z`;

const SHOULDER = 'M127 70C140 67 152 72 155 86C157 97 153 106 147 111C144 100 138 90 129 82C126 78 125 74 127 70Z';
const ARM = 'M146 114C154 112 160 120 161 134C161 144 158 152 154 156C148 152 145 142 145 128C145 121 145 117 146 114Z';
const FOREARM = 'M154 160C160 158 166 168 170 192C172 206 172 214 170 220C164 216 158 202 154 186C152 176 152 166 154 160Z';
const CALF = 'M108 332C116 330 125 334 126 346C128 364 124 386 120 402C114 404 110 402 108 398C106 378 106 352 108 332Z';

// [muscle, path, mirrored]
const FRONT = [
  ['traps', 'M101 60L116 65C124 68 128 70 127 75C118 73 108 71 101 71Z', true],
  ['chest', 'M101 80C112 76 126 80 134 90C138 100 132 112 120 114C110 115 103 110 101 104Z', true],
  ['shoulders', SHOULDER, true],
  ['biceps', ARM, true],
  ['forearms', FOREARM, true],
  ...[0, 1, 2, 3].map(i => ['abs', rr(102.5, 118 + i * 16, 13.5, 13, 3.2), true]),
  ['obliques', 'M118 120C126 126 129 150 125 180L118 180C119 162 119 140 118 120Z', true],
  ['quads', 'M104 224C116 222 130 228 132 248C134 272 130 300 124 322C116 326 108 322 106 316C104 292 102 252 104 224Z', true],
  ['calves', CALF, true],
];
const BACK = [
  ['lats', 'M114 98C126 94 139 104 139 124C139 146 129 164 119 172C112 156 108 128 114 98Z', true],
  ['lowerback', 'M88 146C94 142 106 142 112 146L114 178L86 178Z', false],
  ['traps', 'M100 58C108 62 120 66 128 72C130 78 122 84 116 90L100 128L84 90C78 84 70 78 72 72C80 66 92 62 100 58Z', false],
  ['shoulders', SHOULDER, true],
  ['triceps', ARM, true],
  ['forearms', FOREARM, true],
  ['glutes', 'M101 184C112 180 128 186 130 202C130 216 120 224 108 224C102 222 101 206 101 184Z', true],
  ['hamstrings', 'M104 228C116 226 130 232 132 252C134 274 130 302 124 322C116 326 108 322 106 316C104 294 102 256 104 228Z', true],
  ['calves', CALF, true],
];

const BASE = `
<path class="ghost" d="M100 60C118 62 150 66 156 88C158 110 140 140 130 186L100 192L70 186C60 140 42 110 44 88C50 66 82 62 100 60Z"/>
<path class="ghost" d="M76 182C84 190 94 192 100 192C106 192 116 190 124 182L132 214C124 226 110 228 100 228C90 228 76 226 68 214Z"/>
<rect class="ghost" x="92" y="46" width="16" height="18" rx="6"/>
<ellipse class="ghost head" cx="100" cy="30" rx="15" ry="19"/>
<ellipse class="ghost" cx="172" cy="229" rx="6" ry="9"/><ellipse class="ghost" cx="28" cy="229" rx="6" ry="9"/>
<ellipse class="ghost" cx="118" cy="411" rx="11" ry="5"/><ellipse class="ghost" cx="82" cy="411" rx="11" ry="5"/>`;

export function renderBody(view, stats, { sel = null, size = 'full' } = {}) {
  const list = view === 'back' ? BACK : FRONT;
  const now = Date.now();
  let i = 0;
  const paths = list.map(([m, d, mirror]) => {
    const st = stats[m] || { level: 0 };
    const hot = st.last && now - new Date(st.last).getTime() < 48 * 3600 * 1000;
    const cls = `mus l${st.level}${hot ? ' hot' : ''}${sel === m ? ' sel' : ''}`;
    const p = `<path class="${cls}" data-m="${m}" style="--i:${i++}" d="${d}"><title>${MUSCLES[m]}</title></path>`;
    return mirror ? `<g transform="translate(200 0) scale(-1 1)">${p}</g>${p}` : p;
  }).join('');
  return `<svg class="bodymap ${size}" viewBox="14 6 172 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Muscle level map, ${view}">
<defs><linearGradient id="scanG" x1="0" x2="1"><stop offset="0" stop-color="#ecdcb8" stop-opacity="0"/><stop offset=".5" stop-color="#ecdcb8" stop-opacity=".95"/><stop offset="1" stop-color="#ecdcb8" stop-opacity="0"/></linearGradient>
<radialGradient id="floorG"><stop offset="0" stop-color="#ecdcb8" stop-opacity=".32"/><stop offset="1" stop-color="#ecdcb8" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="100" cy="418" rx="64" ry="6" fill="url(#floorG)"/>
${BASE}${paths}
<rect class="scan" x="20" y="14" width="160" height="1.6" fill="url(#scanG)"/></svg>`;
}
