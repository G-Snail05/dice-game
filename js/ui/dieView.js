import { artHTML } from '../art.js';
import { faceKey, specialOf, dieName, facesOf, isCounter, isLink, bitsOf, counterBits } from '../dice.js';
import { esc } from './dom.js';

// CSS-drawn fallback die (used if a key has no art or its image fails to load).
export const cssDie = (shape, face) => `<span class="cssdie s-${shape}"><b>${esc(face)}</b></span>`;

// Binary counter, drawn in CSS (LED look) until the pack has counter art: a housing with one LED per bit
// (8-bit: two rows of 4), and the decimal value underneath. `bits` null = not rolled (all LEDs dark).
export function counterHTML(die, bits, { alt = '' } = {}) {
  const n = bitsOf(die), on = bits || Array(n).fill(0);
  const leds = on.map((b, j) => `<i class="led ${b ? 'on' : 'off'}" data-bit="${j}"></i>`).join('');
  const val = bits ? String(parseInt(bits.join(''), 2)) : `${n}-bit`;
  return `<span class="ctr die-art b${n}${isLink(die) ? ' link' : ''}${bits ? '' : ' dark'}" role="img" aria-label="${esc(alt || dieName(die))}"><span class="leds">${leds}</span><em class="ctrval">${esc(val)}</em></span>`;
}
const ctrBitsFor = (die, face) => (face == null ? null : face === die.face ? counterBits(die) : counterBits({ ...die, bits: null, face }));

// Face-down art for a die in the hand (before the roll).
export function blankArt(die, alt = '') {
  if (isCounter(die)) return counterHTML(die, null, { alt: alt || `${dieName(die)}, not rolled yet` });
  return artHTML(`die_${die.shape}_blank`, { cls: 'die-art', alt, fallback: cssDie(die.shape, '?') });
}

export function dieArt(die, face = die.face) {
  if (isCounter(die)) return counterHTML(die, ctrBitsFor(die, face), { alt: `${dieName(die)} showing ${face}` });
  return artHTML(faceKey(die.shape, face), { cls: 'die-art', alt: `${dieName(die)} showing ${face}`, fallback: cssDie(die.shape, face) });
}

export function badge(die) {
  const s = specialOf(die);
  if (!s) return '';
  const fb = s.counter ? (s.link ? '<i class="ctrbadge">LINK</i>' : `<i class="ctrbadge">${s.bits}b</i>`) : `<i>${esc(s.name[0])}</i>`;
  return `<span class="badge l-${s.layer}">${artHTML(s.icon, { alt: s.name, fallback: fb })}</span>`;
}

// Tray die: a toggle button. `locked` adds the lock state.
export function trayDie(die, i, { locked = false, broken = false, disabled = false } = {}) {
  const s = specialOf(die);
  return `<button class="die ${locked ? 'locked' : ''} ${s ? 'special l-' + s.layer : ''}" data-act="lock" data-i="${i}" aria-pressed="${locked}" ${disabled ? 'disabled' : ''}
    aria-label="${esc(dieName(die))} showing ${die.face}${locked ? ', locked' : ''}${s ? '. ' + esc(s.desc) : ''}">
    ${dieArt(die)}${badge(die)}${locked ? `<span class="lockmark">${artHTML('icon_lock', { alt: '', fallback: '🔒' })} LOCKED</span>` : ''}
    <span class="dname">${esc(dieName(die))}</span></button>`;
}

// Static die for shop and bag lists (shows its top face).
export function staticDie(die) {
  const f = facesOf(die);
  return `<span class="sdie">${dieArt(die, f[f.length - 1])}${badge(die)}</span>`;
}
