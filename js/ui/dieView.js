import { artHTML, artSrc, bitCells } from '../art.js';
import { faceKey, specialOf, dieName, facesOf, isCounter, isLink, bitsOf, counterBits } from '../dice.js';
import { esc } from './dom.js';

// CSS-drawn fallback die (used if a key has no art or its image fails to load).
export const cssDie = (shape, face) => `<span class="cssdie s-${shape}"><b>${esc(face)}</b></span>`;

// Binary counter. With the pack art: the body sprite (bezel + screen) as background, one 4x7 seven-segment
// cell per bit placed at the manifest's bit_cells (8-bit: MSB nibble on the top row), the Link overlay
// (violet ring + left half-link + badge) on Link counters, and a decimal readout tag above the counter.
// Without art: the same structure drawn in CSS. `bits` null = not rolled (blank screen).
const pct = v => `${+(v * 100).toFixed(4)}%`;
export function counterHTML(die, bits, { alt = '' } = {}) {
  const n = bitsOf(die), art = !!artSrc(`die_bin${n}_body`), cells = bitCells(n);
  const leds = bits || !art ? (bits || Array(n).fill(0)).map((b, j) => `<i class="led ${bits ? (b ? 'on' : 'off') : 'blank'}" data-bit="${j}" style="left:${pct(cells[j][0] / 32)};top:${pct(cells[j][1] / 32)}"></i>`).join('') : '';
  const val = bits ? `<em class="ctrval"><b>${parseInt(bits.join(''), 2)}</b></em>` : '';
  const ovl = isLink(die) && artSrc('overlay_chain') ? artHTML('overlay_chain', { cls: 'ctrovl', alt: '' }) : '';
  return `<span class="ctr die-art b${n}${art ? ' art' : ''}${isLink(die) ? ' link' : ''}${bits ? '' : ' dark'}" role="img" aria-label="${esc(alt || dieName(die))}"><span class="leds">${leds}</span>${ovl}${val}</span>`;
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
  if (s.link && artSrc('overlay_chain')) return ''; // the Link overlay sprite carries its own badge
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
