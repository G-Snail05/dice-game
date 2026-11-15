// node tools/counter-stats.mjs [N] -> sensible-bot win rate with and without binary counters, plus how often
// counters are bought, how often Link chains form and what they score. Prints only, writes nothing.
//   NO_COUNTERS=1  remove counters from the shop     NO_SHUFFLE=1  keep pick order as landing order
import fs from 'node:fs';
import { setBalance } from '../js/balance.js';
const ROOT = new URL('..', import.meta.url).pathname;
const BAL = JSON.parse(fs.readFileSync(ROOT + 'data/balance.json', 'utf8'));
setBalance(BAL);
const { newRun } = await import('../js/run.js');
const { sensible, playRun } = await import('../tests/bots.mjs');
const round = await import('../js/round.js');
const N = +(process.argv[2] || 2000), SEED = process.env.SEED || 'sim-';

function measure(label) {
  // Wrap scoreCurrent through the bot by observing run.round.last after each throw.
  let wins = 0, throws = 0, chainN = 0, chainSum = 0, chainBits = {}, chainBest = 0, ctrThrows = 0, ctrPts = 0, ctrN = 0, runsWithCounter = 0, bought = {};
  for (let i = 0; i < N; i++) {
    const run = newRun(SEED + i);
    const orig = sensible.playThrow;
    let hadCounter = false;
    const bot = { ...sensible, playThrow(r) {
      const res = orig.call(sensible, r);
      throws++;
        if (res && res.chains) for (const c of res.chains) { chainN++; chainSum += c.value; chainBits[c.bits] = (chainBits[c.bits] || 0) + 1; chainBest = Math.max(chainBest, c.value); }
      return res;
    } };
    playRun(run, bot);
    for (const d of run.bag) if (d.special && /counter|link/.test(d.special)) { hadCounter = true; bought[d.special] = (bought[d.special] || 0) + 1; }
    if (hadCounter) runsWithCounter++;
    if (run.phase === 'win') wins++;
  }
  console.log(`${label}: sensible ${wins}/${N} = ${(100 * wins / N).toFixed(1)}% | runs ending with a counter in bag ${(100 * runsWithCounter / N).toFixed(1)}% ${JSON.stringify(bought)}`);
  console.log(`   chains: ${chainN} in ${throws} throws (${(100 * chainN / throws).toFixed(2)}% of throws), avg ${(chainSum / (chainN || 1)).toFixed(0)}, best ${chainBest}, by bits ${JSON.stringify(chainBits)}`);
}
// OVR='{"link4":{"rarity":"uncommon"}}' merges into counters.dice for quick what-ifs.
if (process.env.OVR) for (const [k, v] of Object.entries(JSON.parse(process.env.OVR))) Object.assign(BAL.counters.dice[k], v);
if (process.env.TARGETS) BAL.targets = process.env.TARGETS.split(",").map(Number);
if (process.env.NO_SHUFFLE) BAL.shuffleLanding = false;
if (process.env.NO_COUNTERS) for (const k of Object.keys(BAL.counters.dice)) BAL.counters.dice[k].rarity = 'none';
measure(`${process.env.NO_COUNTERS ? 'no counters' : 'counters'}${process.env.NO_SHUFFLE ? ', no shuffle' : ''}`);
