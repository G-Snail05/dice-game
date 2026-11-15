export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtMult = m => (Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/0$/, ''));
import { artHTML, buttonSkin } from '../art.js';
// A button with an optional art icon from the manifest (text always shown, so missing art is harmless).
// If the icon key is a button skin (label baked into the pixel art), the skin is shown with `caption` under it
// and `label` becomes the accessible name.
export function btn(action, label, { icon, cls = '', disabled = false, data = '', caption } = {}) {
  const skin = icon && buttonSkin(icon, disabled);
  if (skin) return `<button class="btn skinned ${cls}" data-act="${action}" ${data} ${disabled ? 'disabled' : ''} aria-label="${esc(label)}"><span class="skinwrap">${skin}</span>${caption ? `<span class="cap">${caption}</span>` : ''}</button>`;
  return `<button class="btn ${cls}" data-act="${action}" ${data} ${disabled ? 'disabled' : ''}>${icon ? artHTML(icon, { cls: 'btn-ic' }) : ''}<span>${label}</span></button>`;
}
export const coin = n => `<span class="gold">${artHTML('icon_coin', { cls: 'ic', alt: '' })}$${n}</span>`;
