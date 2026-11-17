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
  // Casino: every face scores casino.basePoints (7); a slot face also adds casino.faceMult[tag] mult (+7/+14/+21).
  casinoSlot: {
    score: c => {
      const m = casinoFaceMult(c.die.tag);
      if (!m) return { note: 'plain 7', layer: 'mult', idle: true };
      const jackpot = c.die.tag === 'slot777';
      return { addMult: m, note: `${SLOT_LABEL[c.die.tag]}: +${m} mult${jackpot ? ' (JACKPOT!)' : ''}`, layer: 'mult', jackpot };
    },
  },
  // Parity Coin: +parity.addMult mult for every other die whose scored value (after Link chains / Echo) is
  // non-zero and has the coin's parity. 0 counts as neither (coins showing 0, chain members, a 0 counter).
  parity: {
    score: c => {
      const side = c.die.tag, want = side === 'even' ? 0 : 1, add = parityAdd();
      if (side !== 'odd' && side !== 'even') return { note: 'not flipped', layer: 'mult', idle: true };
      const matches = [];
      c.pts.forEach((v, j) => { if (j !== c.i && !isParityCoin(c.dice[j]) && v > 0 && v % 2 === want) matches.push(j); });
      if (!matches.length) return { note: `${side.toUpperCase()}: no ${side} dice`, layer: 'mult', idle: true, parity: side, matches };
      return { addMult: add * matches.length, note: `${side.toUpperCase()}: +${add} mult × ${matches.length} ${side} ${matches.length === 1 ? 'die' : 'dice'}`, layer: 'mult', parity: side, matches };
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

const SLOT_LABEL = { slot7: '7', slot77: '77', slot777: '777' };
const isParityCoin = d => !!d && d.special === 'paritycoin';

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

// Exotic sets with their own sprites: Casino (d12/d20) and Odds & Evens (Odds d6, Evens d6, Parity Coin).
// Rarity, price and shop weight come from data/balance.json `casino.dice` / `parity.dice`; each set has its
// own shop chance (see shop.js rollExotic). `set` names the group.
const CAS = () => (B && B.casino) || {}, PAR = () => (B && B.parity) || {};
export const casinoBase = () => CAS().basePoints ?? 7;
export const casinoFaceMult = tag => (tag && CAS().faceMult && CAS().faceMult[tag] != null ? CAS().faceMult[tag] : tag ? ({ slot7: 7, slot77: 14, slot777: 21 })[tag] || 0 : 0);
export const parityAdd = () => PAR().addMult ?? 2;
const setBal = (set, id, k, dflt) => { const g = set === 'casino' ? CAS() : PAR(); return g.dice && g.dice[id] && g.dice[id][k] != null ? g.dice[id][k] : dflt; };
const exotic = (o, rarity, price) => Object.defineProperties(o, {
  rarity: { get: () => setBal(o.set, o.id, 'rarity', rarity), enumerable: true },
  price: { get: () => setBal(o.set, o.id, 'price', price), enumerable: true },
  weight: { get: () => setBal(o.set, o.id, 'weight', 1), enumerable: true },
});
const SLOTS = ['slot7', 'slot77', 'slot777'];
const casino = (shape, n) => exotic({
  id: `casino${n}`, set: 'casino', name: 'Casino', tag: `Casino ${shape}`, shape, icon: `icon_casino_${shape}`, layer: 'mult',
  get desc() { const m = SLOTS.map(casinoFaceMult); return `Every face scores ${casinoBase()}. ${n - 3} plain 7s and three slot faces: 7 (+${m[0]} mult), 77 (+${m[1]} mult), 777 (+${m[2]} mult, JACKPOT).`; },
  sides: () => [...Array.from({ length: n - 3 }, () => ({ v: casinoBase(), tag: null })), ...SLOTS.map(tag => ({ v: casinoBase(), tag }))],
  showcase: () => ({ face: casinoBase(), tag: 'slot777' }),
  label: (f, tag) => (tag ? SLOT_LABEL[tag] : String(f)),
  art: { face: (sh, f, tag) => `die_casino_${sh}_${tag || '7'}`, blank: sh => `die_casino_${sh}_blank`, roll: sh => [`die_casino_${sh}_blank`, `die_casino_${sh}_roll_1`, `die_casino_${sh}_roll_2`] },
  effect: { type: 'casinoSlot' },
}, 'rare', n === 12 ? 14 : 16);
const parityDie = (kind, faces) => exotic({
  id: kind, set: 'parity', name: kind === 'odds' ? 'Odds' : 'Evens', tag: kind === 'odds' ? 'Odds' : 'Evens', shape: 'd6', icon: `icon_${kind}_d6`, layer: 'points',
  desc: `A d6 with only ${kind === 'odds' ? 'odd' : 'even'} faces: ${faces.join(', ')}.`, faces,
  art: { face: (sh, f) => `die_${kind}_d6_${f}`, blank: () => `die_${kind}_d6_blank`, roll: () => [`die_${kind}_d6_blank`, `die_${kind}_d6_roll_1`, `die_${kind}_d6_roll_2`] },
  effect: { type: 'none' },
}, 'uncommon', 4);
SPECIALS.push(
  casino('d12', 12), casino('d20', 20),
  parityDie('odds', [1, 3, 5, 7, 9, 11]), parityDie('evens', [2, 4, 6, 8, 10, 12]),
  exotic({
    id: 'paritycoin', set: 'parity', name: 'Parity Coin', tag: 'Parity', shape: 'coin', icon: 'icon_parity_coin', layer: 'mult',
    get desc() { return `Scores 0. Flips ODD or EVEN: every other die showing a number of that parity gets +${parityAdd()} mult.`; },
    sides: () => [{ v: 0, tag: 'odd' }, { v: 0, tag: 'even' }],
    showcase: () => ({ face: 0, tag: 'even' }),
    label: (f, tag) => (tag ? tag.toUpperCase() : '?'),
    art: { face: (sh, f, tag) => `die_parity_coin_${tag || 'odd'}`, blank: () => 'die_parity_coin_flip_1', roll: () => Array.from({ length: 8 }, (_, k) => `die_parity_coin_flip_${k + 1}`) },
    effect: { type: 'parity' },
  }, 'rare', 6),
);
export const CASINO_IDS = ['casino12', 'casino20'], PARITY_IDS = ['odds', 'evens', 'paritycoin'];

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
