import { B } from './balance.js';

// Special dice are pure data. Each one names an effect `type` from EFFECTS plus its parameters.
// EFFECTS are small handlers the scorer calls left to right across the tray.
//   value(ctx)  -> {value, note}            change this die's point value before summing (pre-pass)
//   score(ctx)  -> {addPoints|addMult|xMult|gold|breakForRound|shatter, note, layer}
// ctx = {die, i, dice, pts, p (the effect params), env: {throwsLeft, gold, facesOf}, rng (null in preview)}
// Layers: 'points' (blue), 'mult' (red), 'gold' (gold), 'rule' (rule-bending).

const otherPts = c => c.pts.filter((_, j) => j !== c.i);

export const EFFECTS = {
  none: {},
  xMult: { score: c => ({ xMult: c.p.x, note: `×${c.p.x}`, layer: 'mult' }) },
  xMultIf: {
    score: c => {
      const ok = COND[c.p.cond](c);
      return ok ? { xMult: c.p.x, note: `×${c.p.x} (${c.p.label})`, layer: 'mult' } : { note: `no bonus (needs ${c.p.label})`, layer: 'mult', idle: true };
    },
  },
  addMultPerEven: {
    score: c => {
      const n = otherPts(c).filter(v => v % 2 === 0 && v > 0).length;
      return n ? { addMult: c.p.add * n, note: `+${c.p.add * n} mult (${n} other even)`, layer: 'mult' } : { note: 'no other even dice', layer: 'mult', idle: true };
    },
  },
  // Gold: pays for every die in the throw (itself included) showing at least the Gold die's own top face;
  // the payout per hit depends on the Gold die's shape (balance.json mods.goldPayout).
  goldPerHigh: {
    score: c => {
      const t = goldThreshold(c.die, c.env.facesOf), pay = goldPay(c.die.shape);
      const n = c.pts.filter(v => v >= t).length;
      return n ? { gold: pay * n, note: `+$${pay * n} (${n} at ${t}+)`, layer: 'gold' } : { note: `none at ${t}+`, layer: 'gold', idle: true };
    },
  },
  echo: {
    value: c => (c.i > 0 ? { value: c.pts[c.i - 1], note: `copies the die to its left (${c.pts[c.i - 1]})` } : null),
  },
  glass: {
    score: c => {
      const r = { xMult: c.p.x, note: `×${c.p.x}, then breaks for this round`, layer: 'mult', breakForRound: true };
      if (c.rng && c.rng.next() < c.p.shatterChance) { r.shatter = true; r.note = `×${c.p.x}, then shatters for good!`; }
      return r;
    },
  },
  twinReroll: {
    score: c => {
      let hi = 0;
      c.pts.forEach((v, j) => { if (v > c.pts[hi]) hi = j; });
      const src = c.dice[hi], faces = c.env.facesOf(src);
      if (!c.rng) return { note: `+? (re-rolls a copy of the highest die, ${faces[0]}–${faces[faces.length - 1]})`, layer: 'points', pending: true };
      const v = faces[c.rng.int(faces.length)];
      return { addPoints: v, note: `re-rolled a copy of the highest die: +${v}`, layer: 'points' };
    },
  },
};

const COND = {
  lastThrow: c => c.env.throwsLeft === 1,
  match: c => otherPts(c).includes(c.pts[c.i]),
  run3: c => {
    const s = new Set(c.pts);
    return [...s].some(v => s.has(v + 1) && s.has(v + 2));
  },
};

// The chosen ~10 (numbers refer to the research brief's 22 ideas).
export const SPECIALS = [
  { id: 'ruby', mod: true, name: 'Ruby', idea: 7, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_mult_x1_5', layer: 'mult',
    desc: '×1.5 to the throw.', effect: { type: 'xMult', x: 1.5 } },
  { id: 'ember', mod: true, name: 'Ember', idea: 8, shape: 'd6', rarity: 'uncommon', price: 8, icon: 'icon_ember', layer: 'mult',
    desc: '+2 mult for each other die showing an even number.', effect: { type: 'addMultPerEven', add: 2 } },
  { id: 'lastcall', mod: true, name: 'Last Call', idea: 9, shape: 'd6', rarity: 'uncommon', price: 5, icon: 'icon_mult_x3', layer: 'mult',
    desc: '×3 on your final throw of the round.', effect: { type: 'xMultIf', x: 3, cond: 'lastThrow', label: 'final throw' } },
  { id: 'matching', mod: true, name: 'Matching', idea: 10, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_mult_x2', layer: 'mult',
    desc: '×2 if any other die shows the same face.', effect: { type: 'xMultIf', x: 2, cond: 'match', label: 'a matching face' } },
  { id: 'overcharged', mod: true, name: 'Overcharged', idea: 6, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_overcharged', layer: 'points',
    desc: '+3 on every face (d6: 4–9, d20: 4–23).', faceOffset: 3, effect: { type: 'none' } },
  { id: 'coin', name: 'Coin', idea: 3, shape: 'coin', rarity: 'common', price: 3, icon: 'icon_coin_flip', layer: 'points',
    desc: 'Two faces: 0 or 10. Pure variance.', faces: [0, 10], effect: { type: 'none' } },
  { id: 'gold', mod: true, name: 'Gold', idea: 18, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_gold', layer: 'gold',
    desc: 'Pays for every die showing at least its own top face (d6: 6+, $1 each; d8/d10 $2, d12 $3, d20 $4 per hit).', effect: { type: 'goldPerHigh' } },
  { id: 'twin', mod: true, name: 'Twin', idea: 13, shape: 'd6', rarity: 'uncommon', price: 6, icon: 'icon_twin', layer: 'points',
    desc: 'When scored, a copy of the highest die rolls once more and adds its face.', effect: { type: 'twinReroll' } },
  { id: 'echo', mod: true, name: 'Echo', idea: 12, shape: 'd6', rarity: 'uncommon', price: 5, icon: 'icon_echo', layer: 'rule',
    desc: 'Scores the value of the die to its left. Its place in the tray matters.', effect: { type: 'echo' } },
  { id: 'glass', mod: true, name: 'Glass', idea: 19, shape: 'd8', rarity: 'rare', price: 8, icon: 'icon_glass', layer: 'mult',
    desc: '×3 to the throw, then breaks for the rest of the round. 1 in 4 chance to shatter for good.', effect: { type: 'glass', x: 3, shatterChance: 0.25 } },
];

// Binary counters (exotic dice). Rarity, price and shop weight come from data/balance.json `counters.dice`
// so they can be tuned without code. `link: true` = the Link modifier (see scoring.js chains()).
const fromBal = (id, k, dflt) => (B && B.counters && B.counters.dice && B.counters.dice[id] && B.counters.dice[id][k] != null ? B.counters.dice[id][k] : dflt);
const counter = (id, name, shape, bits, link, desc, rarity, price) => ({
  id, name, tag: `${link ? 'Link ' : ''}${bits}-bit`, shape, bits, link, counter: true, icon: link ? 'icon_link' : `icon_counter${bits}`, layer: link ? 'rule' : 'points', desc, effect: { type: 'none' },
  get rarity() { return fromBal(id, 'rarity', rarity); }, get price() { return fromBal(id, 'price', price); }, get weight() { return fromBal(id, 'weight', 1); },
});
SPECIALS.push(
  counter('counter4', '4-bit Counter', 'bin4', 4, false, 'Rolls 4 bits: scores its raw binary value, 0–15.', 'uncommon', 6),
  counter('counter8', '8-bit Counter', 'bin8', 8, false, 'Rolls 8 bits: scores its raw binary value, 0–255.', 'rare', 14),
  counter('link4', 'Link 4-bit Counter', 'bin4', 4, true, 'A 4-bit counter that links the unbroken run of counters to its left into one binary number (max 12 bits). A regular die breaks the chain.', 'rare', 9),
  counter('link8', 'Link 8-bit Counter', 'bin8', 8, true, 'An 8-bit counter that links the unbroken run of counters to its left into one binary number (max 12 bits). A regular die breaks the chain.', 'rare', 16),
);
export const COUNTER_IDS = SPECIALS.filter(s => s.counter).map(s => s.id);

// Modifiers (mod: true) fit any polyhedral shape (d4–d20; not the Coin or binary counters). Their `shape` above
// is only the default (info screen, tests); a bought die keeps the shape it was offered on.
export const MOD_SHAPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
const M = () => (B && B.mods) || {};
export const goldPay = shape => (M().goldPayout && M().goldPayout[shape]) || 1;
export const goldThreshold = (die, facesOf) => Math.max(...facesOf(die));
export function modPrice(shape) { return ((B && B.prices && B.prices[shape]) || 0) + (M().priceAdd ?? 2); }
// Description for a special on a given shape (shape-dependent for Overcharged and Gold).
export function descOf(s, shape = s.shape) {
  if (!s) return '';
  const n = SIDES[shape];
  if (s.mod && s.faceOffset && n) return `Faces ${1 + s.faceOffset}–${n + s.faceOffset} instead of 1–${n} (+${s.faceOffset} on every face).`;
  if (s.mod && s.effect.type === 'goldPerHigh' && n) return `+$${goldPay(shape)} for every die showing ${n} or more, itself included (paid before interest).`;
  return s.desc;
}

export const SPECIALS_BY_ID = Object.fromEntries(SPECIALS.map(s => [s.id, s]));

export function validateSpecials() {
  const errs = [];
  for (const s of SPECIALS) {
    if (!EFFECTS[s.effect.type]) errs.push(`${s.id}: unknown effect ${s.effect.type}`);
    if (s.effect.cond && !COND[s.effect.cond]) errs.push(`${s.id}: unknown cond ${s.effect.cond}`);
    if (s.mod && (s.counter || s.shape === 'coin')) errs.push(`${s.id}: modifiers cannot be counters or coins`);
  }
  return errs;
}
