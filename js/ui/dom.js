export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtMult = m => (Number.isInteger(m) ? String(m) : m.toFixed(2).replace(/0$/, ''));
import { artHTML } from '../art.js';
// A button with an optional art icon from the manifest (text always shown, so missing art is harmless).
export function btn(action, label, { icon, cls = '', disabled = false, data = '' } = {}) {
  return `<button class="btn ${cls}" data-act="${action}" ${data} ${disabled ? 'disabled' : ''}>${icon ? artHTML(icon, { cls: 'btn-ic' }) : ''}<span>${label}</span></button>`;
}
export const coin = n => `<span class="gold">${artHTML('icon_coin', { cls: 'ic', alt: '' })}$${n}</span>`;
