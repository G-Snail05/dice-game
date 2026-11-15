import { SPECIALS_BY_ID, MOD_SHAPES } from './specials.js';
const MOD_SHAPE_SET = new Set(MOD_SHAPES);

export const SHAPES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, coin: 2 };
export const SHAPE_ORDER = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

export const specialOf = die => (die.special ? SPECIALS_BY_ID[die.special] : null);

// Binary counters: not polyhedral dice. Each rolls `bits` independent bits (MSB first) and scores the raw
// binary value. Shapes live apart from SHAPES so the face-art key lists stay unchanged.
export const COUNTER_SHAPES = { bin4: 4, bin8: 8 };
export const isCounter = die => !!die && COUNTER_SHAPES[die.shape] != null;
export const bitsOf = die => COUNTER_SHAPES[die.shape] || 0;
export const isLink = die => !!(specialOf(die) && specialOf(die).link);
export const bitsToInt = bits => bits.reduce((v, b) => v * 2 + b, 0);
export const intToBits = (v, n) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);

export function facesOf(die) {
  const s = specialOf(die);
  if (s && s.faces) return s.faces;
  if (s && s.faceOffset && SHAPES[die.shape]) return Array.from({ length: SHAPES[die.shape] }, (_, i) => i + 1 + s.faceOffset);
  if (isCounter(die)) return Array.from({ length: 2 ** bitsOf(die) }, (_, i) => i);
  return Array.from({ length: SHAPES[die.shape] }, (_, i) => i + 1);
}

export function makeDie(run, shape, special = null, cost = 0) {
  const s = special ? SPECIALS_BY_ID[special] : null;
  // Modifiers keep the shape they were bought on (any d4–d20); other specials have a fixed shape.
  const sh = s ? (s.mod && MOD_SHAPE_SET.has(shape) ? shape : s.shape) : shape;
  return { uid: run.nextUid++, shape: sh, special, cost, face: null };
}

export function rollDie(die, rng) {
  if (isCounter(die)) {
    die.bits = Array.from({ length: bitsOf(die) }, () => rng.int(2));
    die.face = bitsToInt(die.bits);
    return die.face;
  }
  const f = facesOf(die);
  die.face = f[rng.int(f.length)];
  return die.face;
}

// Counter bits for display/scoring (derived from face if a die was set by hand, e.g. in tests).
export const counterBits = die => (die.bits && die.bits.length === bitsOf(die) && bitsToInt(die.bits) === die.face ? die.bits : intToBits(die.face || 0, bitsOf(die)));

export const maxFace = die => (isCounter(die) ? 2 ** bitsOf(die) - 1 : Math.max(...facesOf(die)));
export const meanFace = die => { if (isCounter(die)) return (2 ** bitsOf(die) - 1) / 2; const f = facesOf(die); return f.reduce((a, b) => a + b, 0) / f.length; };

export function dieName(die) {
  const s = specialOf(die);
  if (!s) return die.shape;
  return die.shape === 'coin' || isCounter(die) ? s.name : `${s.name} ${die.shape}`;
}

// Logical art key for a die face, e.g. die_d6_face3, die_coin_face10.
export const faceKey = (shape, face) => `die_${shape}_face${face}`;
