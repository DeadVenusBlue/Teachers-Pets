import { PETS } from './model.js';

// Erin's six original pet drawings, retained from My_Art_Pets_Cutie_Edition.html.
// New illustrations below use the same rounded plum strokes and pastel fills.
export function drawPet(t) {
  const extras = [
    '<path d="M54 63 L47 22 Q46 12 57 21 L76 46 M126 46 L145 21 Q156 12 153 22 L146 63" fill="#ffd3df" stroke="#866d9e" stroke-width="4"/>',
    '<circle cx="47" cy="59" r="16" fill="#b2e7c8" stroke="#866d9e" stroke-width="4"/><circle cx="153" cy="59" r="16" fill="#b2e7c8" stroke="#866d9e" stroke-width="4"/>',
    '<path d="M66 65 Q28 16 26 72 Q43 58 66 76 M134 65 Q172 16 174 72 Q157 58 134 76" fill="#aa9ce5" stroke="#866d9e" stroke-width="4"/>',
    '<path d="M59 67 Q49 19 78 37 Q100 15 122 37 Q151 19 141 67" fill="#fff" stroke="#866d9e" stroke-width="4"/>',
    '<path d="M56 63 Q35 29 55 29 Q75 26 74 54 M144 63 Q165 29 145 29 Q125 26 126 54" fill="#ffc7e2" stroke="#866d9e" stroke-width="4"/>',
    '<path d="M51 74 Q21 52 42 36 Q55 27 70 52 M149 74 Q179 52 158 36 Q145 27 130 52" fill="#ffe1a9" stroke="#866d9e" stroke-width="4"/>'
  ];
  const body = ['#ffe1eb', '#c4f3d8', '#c7b8f7', '#fff9ff', '#fbd2e7', '#ffe3ad'][t];
  return `<svg viewBox="0 0 200 200" aria-label="Cute ${PETS[t]} pet" role="img" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="177" rx="57" ry="10" fill="#8b6f9b" opacity=".13"/><path d="${t === 3 ? 'M44 113 Q38 47 100 43 Q162 47 156 113 L156 160 Q143 148 129 160 Q115 174 100 160 Q85 148 71 160 Q57 148 44 160 Z' : 'M46 108 Q39 53 100 49 Q161 53 154 108 Q163 170 100 169 Q37 170 46 108 Z'}" fill="${body}" stroke="#866d9e" stroke-width="4"/>${extras[t]}<ellipse cx="76" cy="106" rx="8" ry="12" fill="#39304f"/><ellipse cx="124" cy="106" rx="8" ry="12" fill="#39304f"/><circle cx="78" cy="101" r="3" fill="white"/><circle cx="126" cy="101" r="3" fill="white"/><ellipse cx="57" cy="124" rx="12" ry="7" fill="#f7a7c3" opacity=".72"/><ellipse cx="143" cy="124" rx="12" ry="7" fill="#f7a7c3" opacity=".72"/><path d="M92 126 Q100 138 108 126" stroke="#775c82" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M85 152 Q100 160 115 152" stroke="white" stroke-width="4" opacity=".6" fill="none"/><g fill="#fff"><path d="M31 93 l4 -8 4 8 8 4 -8 4 -4 8 -4 -8 -8 -4z"/><circle cx="166" cy="111" r="4"/></g></svg>`;
}

const wrap = (content, viewBox = '0 0 120 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false"><g stroke="#866d9e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;
const star = '<path d="M60 17l11 22 24 4-18 18 4 25-21-12-22 12 4-25-18-18 25-4z" fill="#ffe8a0"/>';
const sparkle = '<path d="M102 17v14m-7-7h14M18 68v10m-5-5h10" stroke="#d4b375" stroke-width="2.5"/>';

export function drawItem(id) {
  const shapes = {
    bow: '<path d="M51 46Q15 9 14 35v35q2 20 37-12M69 46q36-37 37-11v35q-2 20-37-12" fill="#f4b9d5"/><path d="M48 57L35 87l21-7 5 9 10-32" fill="#f4b9d5"/><rect x="47" y="39" width="26" height="27" rx="9" fill="#e999c2"/><path d="M23 35l18 13M98 35L80 48" stroke="#fff1fa"/>',
    glasses: '<path d="M8 43h104M52 49q8-7 16 0" fill="none"/><path d="M17 43h31v19q-15 23-29-1zM72 43h31l-2 18q-14 23-29 1z" fill="#a99acb"/><path d="M23 49l9 8M78 49l9 8" stroke="#eae4fb" stroke-width="5"/>',
    crown: '<path d="M25 75L16 31l28 17 16-29 16 29 28-17-9 44z" fill="#ffe3a0"/><rect x="25" y="69" width="70" height="13" rx="6" fill="#f4cf80"/><path d="M60 48l4 8 9 1-6 7 1 9-8-4-8 4 1-9-6-7 9-1z" fill="#f4b4d5" stroke-width="2"/><g fill="#fff2cc"><circle cx="16" cy="28" r="6"/><circle cx="60" cy="16" r="6"/><circle cx="104" cy="28" r="6"/></g>',
    headphones: '<path d="M24 62V48q0-37 36-37t36 37v14" fill="none" stroke="#b29fdc" stroke-width="13"/><path d="M24 51V43q0-31 36-31t36 31v8" fill="none"/><rect x="15" y="44" width="25" height="37" rx="11" fill="#e7c9ef"/><rect x="80" y="44" width="25" height="37" rx="11" fill="#e7c9ef"/><path d="M23 54v16m65-16v16" stroke="white"/>',
    sparkle: '<path d="M34 29q26-15 52 0 20 16-26 61-46-45-26-61z" fill="#f4b0ce"/><path d="M60 29Q34 6 38 24q-20-7-12 4 11 14 34 1 23 13 34-1 8-11-12-4 4-18-22 5z" fill="#b5dfbe"/><path d="M46 45l-2 4m28-4 2 4M55 66l1 4m11-13 1 4" stroke="#fff4d2"/><circle cx="48" cy="55" r="2" fill="#59415d" stroke="none"/><circle cx="70" cy="55" r="2" fill="#59415d" stroke="none"/><path d="M56 60q4 5 8 0" fill="none" stroke-width="2"/>'
  };
  return wrap((shapes[id] || star) + sparkle);
}

export function drawBadge(earned) {
  return wrap(`<path d="M36 60L23 94l22-7 10 10 9-31M58 67l15 30 9-11 21 6-16-34" fill="${earned ? '#e2c2eb' : '#e7dfed'}"/><circle cx="60" cy="45" r="32" fill="${earned ? '#fff0bc' : '#f4eff7'}"/><path d="M60 24l7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" fill="${earned ? '#e7bd68' : '#d5c8de'}" stroke-width="2"/>`);
}

export function drawWelcome() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 330 220" aria-hidden="true"><ellipse cx="165" cy="190" rx="146" ry="13" fill="#eaddec"/><path d="M19 159q1-50 47-54 31-47 78-14 53-32 94 5 71 3 67 63z" fill="#eee5fa"/><g transform="translate(83 15) rotate(7 90 90)">${drawPet(0)}</g><g transform="translate(5 71) scale(.65)">${drawPet(1)}</g><g transform="translate(224 116) rotate(16)"><rect width="51" height="66" rx="4" fill="#fff8df" stroke="#a789ab" stroke-width="3"/><path d="M10 16h30M10 27h23M10 39h30" stroke="#dcc5df" stroke-width="3"/></g><g fill="#e8c57f"><path d="M42 32l5 12 13 5-13 5-5 12-5-12-13-5 13-5z"/><path d="M274 53l4 9 9 4-9 4-4 9-4-9-9-4 9-4z"/></g><path d="M202 52q12-22 22-10 15-7 14 6-6 14-33 19z" fill="#f7ccdf" stroke="#c58aaf" stroke-width="2"/></svg>`;
}

export function drawCareArt() {
  return wrap('<path d="M20 76q-2-25 23-32h43q20 4 15 32z" fill="#fff0c5"/><path d="M27 76q30 13 67 0" fill="none"/><path d="M39 44l-8-24 14 4 12-9 11 28M70 42l6-24 13 8 12-3-10 28" fill="#e2c6ed"/><path d="M47 57q10-4 14 0m10 0q9-4 13 0M59 65q6 5 12 0" fill="none" stroke-width="2.5"/><path d="M12 27q-8-14 2-13 8-9 11 1 1 9-13 12z" fill="#f1bcd4"/>');
}

export function drawArcade() {
  return wrap('<g transform="rotate(-13 44 53)"><rect x="12" y="12" width="64" height="78" rx="11" fill="#d9c9ef"/><path d="M44 29l7 14 15 2-11 11 2 16-13-7-14 7 3-16-12-11 16-2z" fill="#fff2b8"/></g><g transform="rotate(12 83 55)"><rect x="49" y="20" width="62" height="76" rx="10" fill="#fff7fd"/><path d="M62 49l-2-14 14 9m17 0 13-9-2 18" fill="#f8cedf"/><ellipse cx="82" cy="63" rx="23" ry="22" fill="#ffe0eb"/><g fill="#44364f" stroke="none"><ellipse cx="74" cy="60" rx="3" ry="4"/><ellipse cx="91" cy="60" rx="3" ry="4"/></g><path d="M79 70q4 4 7-1" fill="none" stroke-width="2"/></g>', '0 0 125 110');
}
