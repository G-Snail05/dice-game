import { SPECIALS_BY_ID } from './specials.js';

export const SHAPES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, coin: 2 };
export const SHAPE_ORDER = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

export const specialOf = die => (die.special ? SPECIALS_BY_ID[die.special] : null);

export function facesOf(die) {
  const s = specialOf(die);
  if (s && s.faces) return s.faces;
  return Array.from({ length: SHAPES[die.shape] }, (_, i) => i + 1);
}

export function makeDie(run, shape, special = null, cost = 0) {
  const s = special ? SPECIALS_BY_ID[special] : null;
  return { uid: run.nextUid++, shape: s ? s.shape : shape, special, cost, face: null };
}

export function rollDie(die, rng) {
  const f = facesOf(die);
  die.face = f[rng.int(f.length)];
  return die.face;
}

export const maxFace = die => Math.max(...facesOf(die));
export const meanFace = die => { const f = facesOf(die); return f.reduce((a, b) => a + b, 0) / f.length; };

export function dieName(die) {
  const s = specialOf(die);
  if (!s) return die.shape;
  return die.shape === 'coin' ? s.name : `${s.name} ${die.shape}`;
}

// Logical art key for a die face, e.g. die_d6_face3, die_coin_face10.
export const faceKey = (shape, face) => `die_${shape}_face${face}`;
