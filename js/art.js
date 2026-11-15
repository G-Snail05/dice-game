// All visuals go through here. Logical keys (die_d6_face3, icon_mult_x2, ui_btn_roll ...) are resolved
// via assets/manifest.json. See ASSETS.md for the format, the 1x/2x/3x convention and the full key list.
import { SHAPES, faceKey } from './dice.js';
import { SPECIALS } from './specials.js';

export const UI_KEYS = ['ui_logo', 'ui_btn_roll', 'ui_btn_score', 'ui_btn_buy', 'ui_btn_shop_reroll', 'ui_btn_sell', 'ui_btn_next', 'ui_btn_new_run', 'ui_btn_settings', 'ui_btn_pause', 'ui_btn_info', 'ui_btn_reroll'];
export const ICON_KEYS = ['icon_coin', 'icon_lock'];
export const BG_KEYS = ['bg_table_tile', 'bg_shop_tile', 'bg_hc_tile'];
// Animation frames: roll tumble per shape (blank -> roll_1 -> roll_2), score particles per colour layer,
// target-cleared flames, coin spin (money) and glass shatter.
export const FX_LAYERS = ['points', 'mult', 'gold', 'rule'];
export function fxKeys() {
  const k = [];
  for (const shape of Object.keys(SHAPES)) k.push(`die_${shape}_blank`, `die_${shape}_roll_1`, `die_${shape}_roll_2`);
  for (const l of FX_LAYERS) for (let n = 1; n <= 4; n++) k.push(`fx_pop_${l}_${n}`);
  for (const c of ['blue', 'red']) for (let n = 1; n <= 4; n++) k.push(`fx_flame_${c}_${n}`);
  for (let n = 1; n <= 4; n++) k.push(`fx_coin_spin_${n}`);
  for (let n = 1; n <= 3; n++) k.push(`fx_glass_shatter_${n}`);
  return k;
}

// Every key the game can ask for (pure; used by tests and ASSETS.md).
export function requiredKeys() {
  const keys = [];
  const faces = { coin: new Set([0, 10]) };
  for (const shape of Object.keys(SHAPES)) if (shape !== 'coin') faces[shape] = new Set(Array.from({ length: SHAPES[shape] }, (_, i) => i + 1));
  for (const s of SPECIALS) if (s.faces) s.faces.forEach(f => faces[s.shape].add(f));
  for (const [shape, set] of Object.entries(faces)) [...set].sort((a, b) => a - b).forEach(f => keys.push(faceKey(shape, f)));
  for (const s of SPECIALS) if (!s.counter && !keys.includes(s.icon)) keys.push(s.icon);
  return keys.concat(ICON_KEYS, UI_KEYS, BG_KEYS, fxKeys());
}

// Binary counter art (requested from Ælfstan, not in the pack yet). The game draws counters with CSS
// (LED look) and uses any of these keys as soon as the manifest has them; each also wants an `_hc` twin.
export function counterArtKeys() {
  return ['die_bin4_body', 'die_bin8_body', 'die_bin4_blank', 'die_bin8_blank', 'led_bit_on', 'led_bit_off', 'led_bit_tumble_1', 'led_bit_tumble_2',
    'icon_counter4', 'icon_counter8', 'icon_link', 'fx_link_bracket_l', 'fx_link_bracket_m', 'fx_link_bracket_r', 'fx_link_glow_1', 'fx_link_glow_2', 'fx_link_glow_3'];
}

let M = { base: 'assets/', assets: {} }, F = null, variant = '';
// `fallback` is the placeholder manifest: used per key when the active one lacks it or its file fails.
export function initArt(manifest, fallback = null) { M = { base: 'assets/', assets: {}, ...manifest }; F = fallback ? { base: 'assets/', assets: {}, ...fallback } : null; }
// '' (normal) or 'hc' (high contrast: entries with an `hc` twin use it).
export function setVariant(v) { variant = v || ''; }
export const hasHighContrast = () => Object.values(M.assets).some(e => e && e.hc);
export const entryOf = key => M.assets[key] || null;

const srcsetOf = (src, scales) => scales.map(n => (n === 1 ? `${src} 1x` : `${src.replace(/(\.\w+)$/, `@${n}x$1`)} ${n}x`)).join(', ');

function fromEntry(e, base = M.base) {
  if (!e) return null;
  if (typeof e === 'string') e = { src: e };
  if (variant && e[variant]) e = e[variant];
  const src = base + e.src;
  let srcset = '';
  if (e.srcset) srcset = [`${src} 1x`, ...Object.entries(e.srcset).map(([k, v]) => `${base + v} ${k}`)].join(', ');
  else if (e.scales && e.scales.length > 1) srcset = srcsetOf(src, e.scales);
  return { src, srcset };
}

function fromPack(key) {
  const P = M.pack;
  if (!P) return null;
  const ext = P.ext || '.png', scales = P.scales || [1];
  if (P.layout === 'folders') {
    const at = n => `${M.base}${P.dir}${n}x/${key}${ext}`;
    return { src: at(1), srcset: scales.map(n => `${at(n)} ${n}x`).join(', ') };
  }
  const src = `${M.base}${P.dir}${key}${ext}`;
  return { src, srcset: scales.length > 1 ? srcsetOf(src, scales) : '' };
}

// Candidate sources in order: pack (when preferPack) -> explicit entry -> pack -> fallback (placeholder) manifest.
export function resolve(key) {
  const entry = fromEntry(M.assets[key]), pack = fromPack(key), fb = F ? fromEntry(F.assets[key], F.base) : null;
  const c = M.preferPack ? [pack, entry, fb] : [entry, pack, fb];
  return c.filter(Boolean).filter((x, i, a) => a.findIndex(y => y.src === x.src) === i);
}

// Button skin (labels baked into the art): normal/pressed/disabled images; null if the key is not a skin.
export function buttonSkin(key, disabled) {
  const e = M.assets[key];
  if (!e || e.kind !== 'button') return null;
  const st = e.states || {};
  const pick = s => fromEntry(s);
  const show = disabled && st.disabled ? pick(st.disabled) : fromEntry(e);
  const img = (r, cls) => `<img class="art px skin ${cls}" src="${esc(r.src)}"${r.srcset ? ` srcset="${esc(r.srcset)}"` : ''} alt="" draggable="false" data-key="${esc(key)}" data-next="[]" data-fallback="">`;
  return img(show, 'skin-normal') + (!disabled && st.pressed ? img(pick(st.pressed), 'skin-pressed') : '');
}

// CSS background for a tile key: image-set over 1x/2x/3x.
// URLs are made absolute so the value also works inside CSS custom properties (resolved against the stylesheet).
export function bgCSS(key) {
  const c = resolve(key)[0];
  if (!c) return '';
  const abs = u => (typeof document !== 'undefined' ? new URL(u, document.baseURI).href : u);
  if (!c.srcset) return `url("${abs(c.src)}")`;
  return `image-set(${c.srcset.split(', ').map(p => { const [u, d] = p.split(' '); return `url("${abs(u)}") ${d}`; }).join(', ')})`;
}

const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// Returns an <img> for the key, or `fallbackHTML` (CSS-drawn) if the key has no art.
// If an image fails to load, the next candidate is tried, then the CSS fallback.
export function artHTML(key, { alt = '', cls = '', fallback = '' } = {}) {
  const c = resolve(key);
  if (!c.length) return fallback;
  const [first, ...rest] = c;
  return `<img class="art ${cls}${M.pixelated ? ' px' : ''}" src="${esc(first.src)}"${first.srcset ? ` srcset="${esc(first.srcset)}"` : ''} alt="${esc(alt)}" draggable="false" data-key="${esc(key)}" data-next="${esc(JSON.stringify(rest))}" data-fallback="${esc(fallback)}">`;
}

// Install once in the browser: handles image load errors for every .art image.
export function installArtFallbacks(root = document) {
  root.addEventListener('error', ev => {
    const img = ev.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('art')) return;
    const next = JSON.parse(img.dataset.next || '[]');
    if (next.length) {
      const n = next.shift();
      img.dataset.next = JSON.stringify(next);
      if (n.srcset) img.srcset = n.srcset; else img.removeAttribute('srcset');
      img.src = n.src;
      return;
    }
    console.warn('art: missing', img.dataset.key);
    const t = document.createElement('template');
    t.innerHTML = img.dataset.fallback || '';
    img.replaceWith(t.content);
  }, true);
}

// First candidate {src, srcset} for a key (used by animations to swap frames on an existing <img>).
export function artSrc(key) { return resolve(key)[0] || null; }
export function setImg(img, key) {
  const c = artSrc(key);
  if (!c) return false;
  if (c.srcset) img.srcset = c.srcset; else img.removeAttribute('srcset');
  img.src = c.src;
  return true;
}
// Warm the cache so frame swaps don't flash.
export function preload(keys) {
  for (const k of keys) { const c = artSrc(k); if (!c) continue; const i = new Image(); if (c.srcset) i.srcset = c.srcset; i.src = c.src; }
}
