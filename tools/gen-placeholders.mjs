// node tools/gen-placeholders.mjs -> writes assets/placeholder/*.svg and assets/manifest.json
// Placeholder art only. The real pack replaces entries in the manifest (see ASSETS.md).
import fs from 'node:fs';
import { requiredKeys } from '../js/art.js';
const ROOT = new URL('..', import.meta.url).pathname, OUT = ROOT + 'assets/placeholder/';
fs.mkdirSync(OUT, { recursive: true });

const BODY = {
  d4: { d: 'M50 6 L95 90 L5 90 Z', ty: 72, fill: '#f2d7a6' },
  d6: { d: 'M14 8 H86 Q92 8 92 14 V86 Q92 92 86 92 H14 Q8 92 8 86 V14 Q8 8 14 8 Z', ty: 62, fill: '#f6f1e3' },
  d8: { d: 'M50 4 L96 50 L50 96 L4 50 Z', ty: 62, fill: '#cfe3f7' },
  d10: { d: 'M50 4 L94 40 L50 96 L6 40 Z', ty: 58, fill: '#d7f0d0' },
  d12: { d: 'M50 4 L95 37 L78 92 L22 92 L5 37 Z', ty: 64, fill: '#ead6f5' },
  d20: { d: 'M50 3 L92 27 L92 73 L50 97 L8 73 L8 27 Z', ty: 63, fill: '#f8d0d0', extra: '<path d="M50 20 L80 72 L20 72 Z" fill="none" stroke="#0002" stroke-width="2"/>' },
  coin: { circle: true, ty: 62, fill: '#f3c64b' },
};
const PIPS = { 1: [[50, 50]], 2: [[30, 30], [70, 70]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[30, 30], [70, 30], [30, 70], [70, 70]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]] };

function die(shape, face) {
  const b = BODY[shape];
  const body = b.circle ? `<circle cx="50" cy="50" r="45" fill="${b.fill}" stroke="#2b2118" stroke-width="4"/><circle cx="50" cy="50" r="36" fill="none" stroke="#0003" stroke-width="2"/>`
    : `<path d="${b.d}" fill="${b.fill}" stroke="#2b2118" stroke-width="4" stroke-linejoin="round"/>${b.extra || ''}`;
  let mark;
  if (shape === 'd6' && face >= 1 && face <= 6) mark = PIPS[face].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#2b2118"/>`).join('');
  else { const fs2 = String(face).length > 1 ? 30 : 36; mark = `<text x="50" y="${b.ty}" font-family="system-ui,sans-serif" font-weight="800" font-size="${shape === 'd4' ? fs2 - 6 : fs2}" text-anchor="middle" fill="#2b2118">${face}</text>`; }
  return svg(body + mark);
}
const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>\n`;
const badge = (bg, txt, fg = '#fff', size = 40) => svg(`<circle cx="50" cy="50" r="46" fill="${bg}" stroke="#1a1a1a" stroke-width="5"/><text x="50" y="${50 + size * 0.36}" font-family="system-ui,sans-serif" font-weight="900" font-size="${size}" text-anchor="middle" fill="${fg}">${txt}</text>`);
const RED = '#d23b3b', BLUE = '#2f6fd6', GOLD = '#e0a91b', GREY = '#666';
const ICONS = {
  icon_mult_x1_5: badge(RED, '×1.5', '#fff', 30), icon_mult_x2: badge(RED, '×2'), icon_mult_x3: badge(RED, '×3'),
  icon_ember: badge(RED, '+2', '#fff', 40), icon_overcharged: badge(BLUE, '4–9', '#fff', 30), icon_coin_flip: badge(BLUE, '0|10', '#fff', 26),
  icon_gold: badge(GOLD, '$6', '#1a1a1a', 36), icon_twin: badge(BLUE, '×➋', '#fff', 30), icon_echo: badge('#7a4fd0', '◀=', '#fff', 34),
  icon_glass: badge('#8fd3e8', '◇×3', '#1a1a1a', 28), icon_coin: badge(GOLD, '$', '#1a1a1a', 52), icon_lock: badge(GREY, '🔒', '#fff', 44),
  ui_logo: svg('<rect x="4" y="22" width="56" height="56" rx="10" fill="#f6f1e3" stroke="#2b2118" stroke-width="4" transform="rotate(-12 32 50)"/><circle cx="24" cy="44" r="6" fill="#2b2118"/><circle cx="40" cy="58" r="6" fill="#2b2118"/><path d="M62 20 L96 50 L62 80 L44 50 Z" fill="#cfe3f7" stroke="#2b2118" stroke-width="4"/><text x="70" y="60" font-family="system-ui" font-weight="900" font-size="24" text-anchor="middle" fill="#2b2118">8</text>'),
  ui_btn_roll: svg('<path d="M50 12 A38 38 0 1 1 16 32" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M6 14 L22 38 L34 16 Z" fill="#fff"/>'),
  ui_btn_score: svg('<path d="M14 52 L40 78 L88 22" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'),
  ui_btn_buy: svg('<path d="M8 18 H24 L34 66 H82 L90 32 H30" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><circle cx="40" cy="82" r="7" fill="#fff"/><circle cx="76" cy="82" r="7" fill="#fff"/>'),
  ui_btn_shop_reroll: svg('<path d="M80 50 A30 30 0 1 1 64 23" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M56 8 L82 20 L60 38 Z" fill="#fff"/>'),
  ui_btn_sell: badge(GOLD, '−$', '#1a1a1a', 40),
  ui_btn_next: svg('<path d="M16 50 H78 M54 24 L82 50 L54 76" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'),
  ui_btn_settings: svg('<circle cx="50" cy="50" r="22" fill="none" stroke="#fff" stroke-width="12"/><path d="M50 6 V22 M50 78 V94 M6 50 H22 M78 50 H94 M19 19 L30 30 M70 70 L81 81 M19 81 L30 70 M70 30 L81 19" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'),
  ui_btn_pause: svg('<rect x="24" y="18" width="18" height="64" rx="4" fill="#fff"/><rect x="58" y="18" width="18" height="64" rx="4" fill="#fff"/>'),
  ui_btn_info: badge('#2f6fd6', 'i', '#fff', 60),
  bg_table_tile: svg('<rect width="100" height="100" fill="#1d4d36"/><path d="M0 0 L100 100 M100 0 L0 100" stroke="#ffffff10" stroke-width="2"/>'),
  bg_shop_tile: svg('<rect width="100" height="100" fill="#2b1f4a"/><path d="M0 0 L100 100 M100 0 L0 100" stroke="#ffffff10" stroke-width="2"/>'),
  bg_hc_tile: svg('<rect width="100" height="100" fill="#0c0c14"/>'),
  ui_btn_new_run: svg('<path d="M50 14 V86 M14 50 H86" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'),
};

// Animation placeholders: blank/tumble die bodies, particle bursts, flames, coin spin, glass shatter.
function blank(shape, rot = 0, mark = '') {
  const b = BODY[shape];
  const body = b.circle ? `<circle cx="50" cy="50" r="45" fill="${b.fill}" stroke="#2b2118" stroke-width="4"/>` : `<path d="${b.d}" fill="${b.fill}" stroke="#2b2118" stroke-width="4" stroke-linejoin="round"/>`;
  return svg(`<g transform="rotate(${rot} 50 50)">${body}${mark}</g>`);
}
const LCOL = { points: BLUE, mult: RED, gold: GOLD, rule: '#7a4fd0' };
const pop = (col, n) => svg(Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4, r = 12 + n * 9; return `<circle cx="${50 + Math.cos(a) * r}" cy="${50 + Math.sin(a) * r}" r="${Math.max(2, 9 - n * 2)}" fill="${col}"/>`; }).join(''));
const flame = (col, n) => svg(`<path d="M50 ${8 + n * 4} C ${70 + n * 3} 40 85 60 70 88 Q 50 98 30 88 C 15 60 ${30 - n * 3} 40 50 ${8 + n * 4} Z" fill="${col}" opacity=".9"/><path d="M50 50 C 60 62 62 76 56 88 Q 50 92 44 88 C 38 76 40 62 50 50 Z" fill="#fff6c0"/>`);
for (const shape of Object.keys(BODY)) {
  ICONS[`die_${shape}_blank`] = blank(shape);
  ICONS[`die_${shape}_roll_1`] = blank(shape, 30, '<circle cx="40" cy="40" r="6" fill="#2b2118"/>');
  ICONS[`die_${shape}_roll_2`] = blank(shape, 60, '<circle cx="60" cy="60" r="6" fill="#2b2118"/>');
}
for (const [l, col] of Object.entries(LCOL)) for (let n = 1; n <= 4; n++) ICONS[`fx_pop_${l}_${n}`] = pop(col, n);
for (const [c, col] of [['blue', '#3d8ef0'], ['red', '#e8434a']]) for (let n = 1; n <= 4; n++) ICONS[`fx_flame_${c}_${n}`] = flame(col, n);
for (let n = 1; n <= 4; n++) ICONS[`fx_coin_spin_${n}`] = svg(`<ellipse cx="50" cy="50" rx="${[40, 26, 8, 26][n - 1]}" ry="40" fill="${GOLD}" stroke="#1a1a1a" stroke-width="5"/>`);
for (let n = 1; n <= 3; n++) ICONS[`fx_glass_shatter_${n}`] = svg(Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3, r = n * 14; return `<path d="M${50 + Math.cos(a) * r} ${50 + Math.sin(a) * r} l10 -6 l-4 12 z" fill="#8fd3e8" stroke="#1a1a1a" stroke-width="2"/>`; }).join(''));
ICONS.ui_btn_reroll = ICONS.ui_btn_shop_reroll;
ICONS.ui_btn_continue = ICONS.ui_btn_next;
ICONS.ui_btn_endless = ICONS.ui_btn_next;

const assets = {};
for (const key of requiredKeys()) {
  let content;
  const m = key.match(/^die_(\w+?)_face(\d+)$/);
  if (m) content = die(m[1], +m[2]); else content = ICONS[key];
  if (!content) throw new Error('no placeholder for ' + key);
  fs.writeFileSync(OUT + key + '.svg', content);
  assets[key] = { src: `placeholder/${key}.svg` };
}
const manifest = {
  _doc: 'FALLBACK placeholder manifest (the active one is assets/manifest.json). Logical art keys -> files. See ASSETS.md. Paths are relative to `base`. Entry forms: {src}, {src, scales:[1,2,3]} (@2x/@3x suffixes), or {src, srcset:{"2x":..., "3x":...}}. Set `pack` (+ `preferPack`: true) to load a whole folder by key name.',
  version: 1,
  base: 'assets/',
  pixelated: false,
  preferPack: false,
  pack: null,
  assets,
};
fs.writeFileSync(ROOT + 'assets/manifest.placeholder.json', JSON.stringify(manifest, null, 1) + '\n');
console.log('wrote', Object.keys(assets).length, 'placeholder assets');
