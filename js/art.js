// All visuals go through here. Logical keys (die_d6_face3, icon_mult_x2, ui_btn_roll ...) are resolved
// via assets/manifest.json. See ASSETS.md for the format, the 1x/2x/3x convention and the full key list.
import { SHAPES, faceKey } from './dice.js';
import { SPECIALS } from './specials.js';

export const UI_KEYS = ['ui_logo', 'ui_btn_roll', 'ui_btn_score', 'ui_btn_buy', 'ui_btn_shop_reroll', 'ui_btn_sell', 'ui_btn_next', 'ui_btn_new_run'];
export const ICON_KEYS = ['icon_coin', 'icon_lock'];

// Every key the game can ask for (pure; used by tests and ASSETS.md).
export function requiredKeys() {
  const keys = [];
  const faces = { coin: new Set([0, 10]) };
  for (const shape of Object.keys(SHAPES)) if (shape !== 'coin') faces[shape] = new Set(Array.from({ length: SHAPES[shape] }, (_, i) => i + 1));
  for (const s of SPECIALS) if (s.faces) s.faces.forEach(f => faces[s.shape].add(f));
  for (const [shape, set] of Object.entries(faces)) [...set].sort((a, b) => a - b).forEach(f => keys.push(faceKey(shape, f)));
  for (const s of SPECIALS) if (!keys.includes(s.icon)) keys.push(s.icon);
  return keys.concat(ICON_KEYS, UI_KEYS);
}

let M = { base: 'assets/', assets: {} };
export function initArt(manifest) { M = { base: 'assets/', assets: {}, ...manifest }; }

const srcsetOf = (src, scales) => scales.map(n => (n === 1 ? `${src} 1x` : `${src.replace(/(\.\w+)$/, `@${n}x$1`)} ${n}x`)).join(', ');

function fromEntry(e) {
  if (!e) return null;
  if (typeof e === 'string') e = { src: e };
  const src = M.base + e.src;
  let srcset = '';
  if (e.srcset) srcset = [`${src} 1x`, ...Object.entries(e.srcset).map(([k, v]) => `${M.base + v} ${k}`)].join(', ');
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

// Candidate sources in order: pack (when preferPack, or no explicit entry) -> explicit entry.
export function resolve(key) {
  const entry = fromEntry(M.assets[key]), pack = fromPack(key);
  const c = M.preferPack ? [pack, entry] : [entry, pack];
  return c.filter(Boolean);
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
