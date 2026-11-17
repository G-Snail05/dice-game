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
  if (s && s.sides) return s.sides(die.shape).map(x => x.v);
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
  const s = specialOf(die);
  // Tagged sides (Casino slot faces, Parity Coin odd/even): the face is the points value, `tag` names the side.
  if (s && s.sides) {
    const sides = s.sides(die.shape), x = sides[rng.int(sides.length)];
    die.face = x.v; die.tag = x.tag;
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

// Dice with their own sprite set (Casino, Odds & Evens, Parity Coin) name their keys via the special's `art`.
// Everything else uses the shared per-shape keys.
export function faceArtKey(die, face = die.face, tag = die.tag) {
  const s = specialOf(die);
  return s && s.art ? s.art.face(die.shape, face, tag) : faceKey(die.shape, face);
}
export function blankArtKey(die) {
  const s = specialOf(die);
  return s && s.art ? s.art.blank(die.shape) : `die_${die.shape}_blank`;
}
export function rollArtKeys(die) {
  const s = specialOf(die);
  return s && s.art ? s.art.roll(die.shape) : [`die_${die.shape}_blank`, `die_${die.shape}_roll_1`, `die_${die.shape}_roll_2`];
}
// Short text for the CSS fallback die / labels (777, ODD, ...).
export function faceLabel(die, face = die.face, tag = die.tag) {
  const s = specialOf(die);
  return s && s.label ? s.label(face, tag) : String(face);
}
// The face a shop/bag icon shows: the special's showcase side, else the top face.
export function showcaseOf(die) {
  const s = specialOf(die);
  if (s && s.showcase) return s.showcase(die.shape);
  const f = facesOf(die);
  return { face: f[f.length - 1], tag: null };
}
