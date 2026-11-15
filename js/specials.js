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
  goldPerSix: {
    score: c => {
      const n = c.pts.filter(v => v === 6).length;
      return n ? { gold: c.p.gold * n, note: `+$${c.p.gold * n} (${n} six${n > 1 ? 'es' : ''})`, layer: 'gold' } : { note: 'no sixes', layer: 'gold', idle: true };
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
  { id: 'ruby', name: 'Ruby', idea: 7, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_mult_x1_5', layer: 'mult',
    desc: '×1.5 to the throw.', effect: { type: 'xMult', x: 1.5 } },
  { id: 'ember', name: 'Ember', idea: 8, shape: 'd6', rarity: 'uncommon', price: 8, icon: 'icon_ember', layer: 'mult',
    desc: '+2 mult for each other die showing an even number.', effect: { type: 'addMultPerEven', add: 2 } },
  { id: 'lastcall', name: 'Last Call', idea: 9, shape: 'd6', rarity: 'uncommon', price: 5, icon: 'icon_mult_x3', layer: 'mult',
    desc: '×3 on your final throw of the round.', effect: { type: 'xMultIf', x: 3, cond: 'lastThrow', label: 'final throw' } },
  { id: 'matching', name: 'Matching', idea: 10, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_mult_x2', layer: 'mult',
    desc: '×2 if any other die shows the same face.', effect: { type: 'xMultIf', x: 2, cond: 'match', label: 'a matching face' } },
  { id: 'overcharged', name: 'Overcharged', idea: 6, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_overcharged', layer: 'points',
    desc: 'Faces 4–9 instead of 1–6.', faces: [4, 5, 6, 7, 8, 9], effect: { type: 'none' } },
  { id: 'coin', name: 'Coin', idea: 3, shape: 'coin', rarity: 'common', price: 3, icon: 'icon_coin_flip', layer: 'points',
    desc: 'Two faces: 0 or 10. Pure variance.', faces: [0, 10], effect: { type: 'none' } },
  { id: 'gold', name: 'Gold', idea: 18, shape: 'd6', rarity: 'common', price: 4, icon: 'icon_gold', layer: 'gold',
    desc: '+$1 for every 6 in the throw (paid before interest).', effect: { type: 'goldPerSix', gold: 1 } },
  { id: 'twin', name: 'Twin', idea: 13, shape: 'd6', rarity: 'uncommon', price: 6, icon: 'icon_twin', layer: 'points',
    desc: 'When scored, a copy of the highest die rolls once more and adds its face.', effect: { type: 'twinReroll' } },
  { id: 'echo', name: 'Echo', idea: 12, shape: 'd6', rarity: 'uncommon', price: 5, icon: 'icon_echo', layer: 'rule',
    desc: 'Scores the value of the die to its left. Its place in the tray matters.', effect: { type: 'echo' } },
  { id: 'glass', name: 'Glass', idea: 19, shape: 'd8', rarity: 'rare', price: 8, icon: 'icon_glass', layer: 'mult',
    desc: '×3 to the throw, then breaks for the rest of the round. 1 in 4 chance to shatter for good.', effect: { type: 'glass', x: 3, shatterChance: 0.25 } },
];

export const SPECIALS_BY_ID = Object.fromEntries(SPECIALS.map(s => [s.id, s]));

export function validateSpecials() {
  const errs = [];
  for (const s of SPECIALS) {
    if (!EFFECTS[s.effect.type]) errs.push(`${s.id}: unknown effect ${s.effect.type}`);
    if (s.effect.cond && !COND[s.effect.cond]) errs.push(`${s.id}: unknown cond ${s.effect.cond}`);
  }
  return errs;
}
