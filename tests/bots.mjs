// Headless players for tests/sim.mjs. Engine only, no DOM.
import { handDice, toggleLock, reroll, canReroll, preview, scoreCurrent, selectIndices, reveal, rollNeed } from '../js/round.js';
import { settleRound, nextRound, continueEndless } from '../js/run.js';
import { buy, rerollShop, sell, sellValue, canSell } from '../js/shop.js';
import { meanFace, maxFace, specialOf } from '../js/dice.js';
import { makeRng } from '../js/rng.js';

const SPECIAL_VALUE = { ruby: 9, matching: 8, lastcall: 8, ember: 16, glass: 10, overcharged: 6.5, twin: 7.5, coin: 5, gold: 4.5, echo: 4,
  counter4: 5.5, counter8: 127.5, link4: 12, link8: 135,
  casino12: 30, casino20: 22, odds: 6, evens: 7, paritycoin: 16 };
// Modifier dice: the d6 value of the effect, shifted by how much bigger the shape's average face is
// (Overcharged is just its +3 faces). Gold on a big shape rarely pays: its threshold is its own top face.
const MODV = d => {
  if (d.special === 'overcharged') return meanFace(d);
  if (d.special === 'gold') return meanFace(d) + 0.6 * (({ d4: 1, d6: 1, d8: 2, d10: 2, d12: 3, d20: 4 })[d.shape] || 1) * (6 / maxFace(d));
  return (SPECIAL_VALUE[d.special] ?? 5) - 3.5 + meanFace(d);
};
export const dieValue = d => (!d.special ? meanFace(d) : specialOf(d) && specialOf(d).mod ? MODV(d) : SPECIAL_VALUE[d.special] ?? 5);
// Shop value with the bag in mind: counters and Link counters are worth more together (chains).
const isCtr = d => d && /^(counter|link)/.test(d.special || '');
export function shopValue(d, bag) {
  let v = dieValue(d);
  if (!isCtr(d)) return v;
  const links = bag.filter(x => /^link/.test(x.special || '')).length, ctrs = bag.filter(isCtr).length;
  if (/^link/.test(d.special)) v += 20 * Math.min(ctrs, 2);
  else if (links) v += 15 * Math.min(links, 2);
  return v;
}

function wantLock(d, i, dice) {
  const s = specialOf(d);
  // Casino: keep a slot face, re-roll a plain 7 for another shot at a slot. Parity Coin: keep a side that
  // already matches at least two other dice.
  if (s && s.effect.type === 'casinoSlot') return !!d.tag;
  if (s && s.effect.type === 'parity') return dice.filter((o, j) => j !== i && o.face > 0 && o.face % 2 === (d.tag === 'even' ? 0 : 1)).length >= 2;
  if (s && s.effect.type === 'echo') return true;
  if (s && ['xMult', 'glass', 'addMultPerEven', 'goldPerHigh', 'twinReroll'].includes(s.effect.type) && d.face >= meanFace(d)) return true;
  if (d.special === 'matching' && dice.some((o, j) => j !== i && o.face === d.face)) return true;
  return d.face > meanFace(d);
}

// Pick which `rollNeed` dice of the drawn hand to roll: highest value first, with Last Call only worth it
// on the final throw.
export function chooseBest(run) {
  const r = run.round;
  const v = d => (d.special === 'lastcall' ? (r.throwsLeft === 1 ? 12 : 3) : dieValue(d));
  const order = handDice(run).map((d, i) => [i, v(d)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  selectIndices(run, order.slice(0, rollNeed(run)));
  reveal(run);
}

export const sensible = {
  name: 'sensible',
  playThrow(run) {
    const r = run.round;
    if (!r.revealed) chooseBest(run);
    const perThrow = r.throwsLeft <= 1 ? r.rerollsLeft : 1;
    for (let k = 0; k < perThrow; k++) {
      if (r.score + preview(run).total >= r.target) break;
      const dice = handDice(run);
      dice.forEach((d, i) => { const w = wantLock(d, i, dice); if (r.locked[i] !== w) toggleLock(run, i); });
      if (!canReroll(run)) break;
      reroll(run);
    }
    return scoreCurrent(run);
  },
  shop(run) {
    for (let pass = 0; pass < 3; pass++) {
      let bought = false;
      const worst = () => run.bag.reduce((w, d) => (dieValue(d) < dieValue(w) ? d : w), run.bag[0]);
      const offers = run.shop.offers.map((o, i) => ({ o, i, v: shopValue(o, run.bag) })).filter(x => !x.o.sold).sort((a, b) => b.v - a.v);
      for (const { o, i, v } of offers) {
        if (v <= dieValue(worst()) + 0.5) continue;
        const w = worst();
        // Sell the weakest die first if the bag is full, to fund and thin.
        if (run.bag.length >= 8 && canSell(run) && run.gold + sellValue(w) >= o.price) sell(run, w.uid);
        if (buy(run, i)) bought = true;
      }
      if (!bought && run.gold >= run.shop.rerollCost + 8) rerollShop(run); else if (!bought) break;
    }
  },
};

export function randomBot(seed) {
  const rng = makeRng(seed);
  return {
    name: 'random',
    playThrow(run) {
      const r = run.round;
      if (!r.revealed) { const idx = rng.shuffle(r.hand.map((_, i) => i)); selectIndices(run, idx.slice(0, rollNeed(run))); reveal(run); }
      while (rng.next() < 0.5 && canReroll(run)) {
        r.hand.forEach((_, i) => { if (rng.next() < 0.5) toggleLock(run, i); });
        if (!canReroll(run)) break;
        reroll(run);
      }
      return scoreCurrent(run);
    },
    shop(run) {
      run.shop.offers.forEach((o, i) => { if (rng.next() < 0.5) buy(run, i); });
    },
  };
}

// Play a whole run. Returns {won, roundReached, endlessReached}.
export function playRun(run, bot, { endlessRounds = 0 } = {}) {
  let won = false, guard = 0;
  while (guard++ < 1000) {
    if (run.phase === 'round') { bot.playThrow(run); settleRound(run); }
    else if (run.phase === 'shop') { bot.shop(run); nextRound(run); }
    else if (run.phase === 'win') { won = true; if (endlessRounds > 0) continueEndless(run); else break; }
    else break;
  }
  return { won, roundReached: run.roundNo, phase: run.phase };
}
