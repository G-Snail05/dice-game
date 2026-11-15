// The run: starting bag, round -> shop -> round ... win after the last round (or lose), then optional endless.
import { B, totalRounds } from './balance.js';
import { makeRng, hashSeed } from './rng.js';
import { makeDie } from './dice.js';
import { startRound } from './round.js';
import { openShop } from './shop.js';

export const SAVE_VERSION = 1;

// Showcase starting bags for ?demo=<name> (debug/preview links; normal runs use balance startingBag).
export const DEMO_BAGS = {
  counters: [{ shape: 'd6', count: 5 }, { shape: 'bin4', special: 'counter4', count: 2 }, { shape: 'bin4', special: 'link4', count: 1 }],
};

export function newRun(seed, { demo = null } = {}) {
  const run = {
    v: SAVE_VERSION, seed: String(seed), rng: makeRng(hashSeed(seed)), nextUid: 1, bag: [], gold: B.startGold,
    roundNo: 1, phase: 'round', endless: false, round: null, shop: null, earnings: null,
    stats: { throws: 0, bestThrow: 0, totalScore: 0, shops: 0, bought: 0, roundsWon: 0 },
  };
  const bag = (demo && DEMO_BAGS[demo]) || B.startingBag;
  if (bag !== B.startingBag) run.demo = demo;
  for (const { shape, special, count } of bag)
    for (let i = 0; i < count; i++) run.bag.push(makeDie(run, shape, special || null, B.prices[shape] || 0));
  startRound(run);
  return run;
}

// Call after scoreCurrent(). Moves the run to shop / win / lose as needed.
export function settleRound(run) {
  const r = run.round;
  if (r.status === 'lost') { run.phase = 'lose'; return run.phase; }
  if (r.status !== 'won') return run.phase;
  run.stats.roundsWon++;
  const rw = B.reward;
  const interest = Math.min(Math.floor(run.gold / rw.interestPer), rw.interestCap);
  const unused = r.throwsLeft * rw.perUnusedThrow;
  run.earnings = { reward: r.reward, unused, interest, dieGold: r.goldEarned, total: r.reward + unused + interest };
  run.gold += run.earnings.total;
  if (run.roundNo === totalRounds() && !run.endless) { run.phase = 'win'; return run.phase; }
  run.phase = 'shop';
  openShop(run);
  return run.phase;
}

export function continueEndless(run) {
  if (run.phase !== 'win') return false;
  run.endless = true;
  run.phase = 'shop';
  openShop(run);
  return true;
}

export function nextRound(run) {
  if (run.phase !== 'shop') return false;
  run.roundNo++;
  run.shop = null;
  run.phase = 'round';
  startRound(run);
  return true;
}

export const serialize = run => JSON.stringify(run);
export function deserialize(str) {
  const o = JSON.parse(str);
  if (!o || o.v !== SAVE_VERSION) return null;
  o.rng = makeRng(o.rng.state);
  return o;
}
