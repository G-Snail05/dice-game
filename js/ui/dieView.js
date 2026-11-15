import { artHTML } from '../art.js';
import { faceKey, specialOf, dieName, facesOf } from '../dice.js';
import { esc } from './dom.js';

// CSS-drawn fallback die (used if a key has no art or its image fails to load).
export const cssDie = (shape, face) => `<span class="cssdie s-${shape}"><b>${esc(face)}</b></span>`;

export function dieArt(die, face = die.face) {
  return artHTML(faceKey(die.shape, face), { cls: 'die-art', alt: `${dieName(die)} showing ${face}`, fallback: cssDie(die.shape, face) });
}

export function badge(die) {
  const s = specialOf(die);
  return s ? `<span class="badge l-${s.layer}">${artHTML(s.icon, { alt: s.name, fallback: `<i>${esc(s.name[0])}</i>` })}</span>` : '';
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
