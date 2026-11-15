// Headless players for tests/sim.mjs. Engine only, no DOM.
import { handDice, toggleLock, reroll, canReroll, preview, scoreCurrent, selectIndices, reveal, rollNeed } from '../js/round.js';
import { settleRound, nextRound, continueEndless } from '../js/run.js';
import { buy, rerollShop, sell, sellValue, canSell } from '../js/shop.js';
import { meanFace, maxFace, specialOf } from '../js/dice.js';
import { makeRng } from '../js/rng.js';

const SPECIAL_VALUE = { ruby: 9, matching: 8, lastcall: 8, ember: 16, glass: 10, overcharged: 6.5, twin: 7.5, coin: 5, gold: 4.5, echo: 4 };
export const dieValue = d => (d.special ? SPECIAL_VALUE[d.special] ?? 5 : meanFace(d));

function wantLock(d, i, dice) {
  const s = specialOf(d);
  if (s && s.effect.type === 'echo') return true;
  if (s && ['xMult', 'glass', 'addMultPerEven', 'goldPerSix', 'twinReroll'].includes(s.effect.type) && d.face >= meanFace(d)) return true;
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
      const offers = run.shop.offers.map((o, i) => ({ o, i, v: dieValue(o) })).filter(x => !x.o.sold).sort((a, b) => b.v - a.v);
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
