import { artHTML, artSrc, bitCells, POINTED_SHAPES, MOD_BADGE_NUDGE, badgePillX, textAreaOf } from '../art.js';
import { specialOf, dieName, isCounter, isLink, bitsOf, counterBits, faceArtKey, blankArtKey, faceLabel, showcaseOf } from '../dice.js';
import { descOf } from '../specials.js';
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
  return withMod(die, artHTML(blankArtKey(die), { cls: 'die-art', alt, fallback: cssDie(die.shape, '?') }));
}

// Modifier art hook (see modArtKeys in art.js): per-shape overlay, else a generic badge sprite, else null
// (the icon badge from badge() is used). On pointed shapes the badge sits MOD_BADGE_NUDGE px higher so the apex
// shows: the per-shape sprite is clipped out of the old badge zone, the layer ring fills the uncovered rows, and
// the badge sprite is drawn 2px up. All in native px of the 42x42 overlay (die at 2,8; badge at 13,0).
const P42 = v => `${+(v / 42 * 100).toFixed(4)}%`;
export function modArt(die) {
  const s = specialOf(die);
  if (!s || !s.mod) return null;
  const per = `mod_${s.id}_${die.shape}`, gen = `mod_badge_${s.id}`, ring = `fx_ring_${die.shape}_${s.layer}`;
  const pointed = POINTED_SHAPES.includes(die.shape), pill = badgePillX(gen);
  if (artSrc(per)) {
    if (!pointed || pill == null || !artSrc(gen) || !artSrc(ring)) return artHTML(per, { cls: 'modovl', alt: '' });
    // Badge zone in the per-shape sprite: x >= 12 + pill (pill + 1px gap), y < 12 (11 rows + 1px gap).
    const zx = P42(12 + pill), zy = P42(12), gy = P42(11 - MOD_BADGE_NUDGE + 1); // first ring row below the nudged badge + gap
    return artHTML(per, { cls: 'modovl', alt: '' }).replace('<img ', `<img style="clip-path:polygon(0 0,${zx} 0,${zx} ${zy},100% ${zy},100% 100%,0 100%)" `)
      + artHTML(ring, { cls: 'modovl modring', alt: '' }).replace('<img ', `<img style="clip-path:polygon(${zx} ${gy},100% ${gy},100% ${zy},${zx} ${zy})" `)
      + artHTML(gen, { cls: 'modbadge nudge', alt: '' });
  }
  if (artSrc(gen)) return artHTML(gen, { cls: `modbadge${pointed ? ' nudge' : ''}`, alt: '' });
  return null;
}
const withMod = (die, html) => { const m = modArt(die); return m ? `<span class="modwrap">${html}${m}</span>` : html; };
export const specialDesc = die => descOf(specialOf(die), die.shape);

export function dieArt(die, face = die.face, tag = face === die.face ? die.tag : null, { parity = null } = {}) {
  if (isCounter(die)) return counterHTML(die, ctrBitsFor(die, face), { alt: `${dieName(die)} showing ${face}` });
  const html = dieArtPlain(die, face, tag);
  if (parity) return `<span class="modwrap">${html}${modArt(die) || ''}${parityTag(parity.side, parity.add)}</span>`;
  return withMod(die, html);
}
function dieArtPlain(die, face, tag) {
  const lbl = faceLabel(die, face, tag);
  return artHTML(faceArtKey(die, face, tag), { cls: 'die-art', alt: `${dieName(die)} showing ${lbl}`, fallback: cssDie(die.shape, lbl) });
}

// Parity tag (ui_parity_tag_<odd|even>_blank, 28x11 native) under a die that a Parity Coin matches; the value
// (+2, or +4 with two coins) is drawn inside the tag's text_area. CSS fallback: a pill in the parity colours.
const P28 = v => `${+(v / 28 * 100).toFixed(4)}%`, P11 = v => `${+(v / 11 * 100).toFixed(4)}%`;
export function parityTag(side, add) {
  const key = `ui_parity_tag_${side}_blank`, ta = textAreaOf(key) || (side === 'odd' ? [11, 2, 25, 8] : [12, 2, 25, 8]);
  const box = `left:${P28(ta[0])};top:${P11(ta[1])};width:${P28(ta[2] - ta[0] + 1)};height:${P11(ta[3] - ta[1] + 1)}`;
  return `<span class="partag p-${side}${artSrc(key) ? ' art' : ''}" aria-hidden="true">${artHTML(key, { cls: 'partag-img', alt: '' })}<b style="${box}">+${add}</b></span>`;
}

export function badge(die) {
  const s = specialOf(die);
  if (!s) return '';
  if (modArt(die)) return ''; // the mod overlay/badge sprite replaces the icon badge
  if (s.link && artSrc('overlay_chain')) return ''; // the Link overlay sprite carries its own badge
  if (s.set && artSrc(faceArtKey(die, showcaseOf(die).face, showcaseOf(die).tag))) return ''; // Casino / Odds & Evens: the dice have their own sprites
  const fb = s.counter ? (s.link ? '<i class="ctrbadge">LINK</i>' : `<i class="ctrbadge">${s.bits}b</i>`) : `<i>${esc(s.name[0])}</i>`;
  return `<span class="badge l-${s.layer}">${artHTML(s.icon, { alt: s.name, fallback: fb })}</span>`;
}

// Tray die: a toggle button. `locked` adds the lock state.
export function trayDie(die, i, { locked = false, broken = false, disabled = false } = {}) {
  const s = specialOf(die);
  return `<button class="die ${locked ? 'locked' : ''} ${s ? 'special l-' + s.layer : ''}" data-act="lock" data-i="${i}" aria-pressed="${locked}" ${disabled ? 'disabled' : ''}
    aria-label="${esc(dieName(die))} showing ${die.face}${locked ? ', locked' : ''}${s ? '. ' + esc(specialDesc(die)) : ''}">
    ${dieArt(die)}${badge(die)}${locked ? `<span class="lockmark">${artHTML('icon_lock', { alt: '', fallback: '🔒' })} LOCKED</span>` : ''}
    <span class="dname">${esc(dieName(die))}</span></button>`;
}

// Static die for shop and bag lists (shows its top face).
// Casino / Odds & Evens use the pack's shop icon (icon_<...>, _disabled when it can't be bought).
export function staticDie(die, { disabled = false } = {}) {
  const s = specialOf(die);
  if (s && s.set && artSrc(s.icon)) return `<span class="sdie seticon">${artHTML(disabled && artSrc(`${s.icon}_disabled`) ? `${s.icon}_disabled` : s.icon, { cls: 'die-art', alt: dieName(die) })}</span>`;
  const sc = showcaseOf(die);
  return `<span class="sdie">${dieArt(die, sc.face, sc.tag)}${badge(die)}</span>`;
}
