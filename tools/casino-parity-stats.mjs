// node tools/casino-parity-stats.mjs [N] -> sensible-bot win rate with/without the Casino and Odds & Evens sets,
// how often each new die ends up bought, jackpot/slot rates and Parity Coin matches. Prints only, writes nothing.
//   NO_CASINO=1 / NO_PARITY=1   remove a set from the shop
//   CASINO_SHOP=0.03 PARITY_SHOP=0.08   override shop chances
//   PRICES=casino12:14,casino20:16,odds:4,evens:4,paritycoin:6   override prices
//   FACEMULT=7,14,21   override the slot faces' mult
//   START=casino12,paritycoin   add these dice to the starting bag (strength check)
//   SEEDS=1 -> also print demo seeds (?demo=casino first throw with a 777, ?demo=parity with many matches)
import fs from 'node:fs';
import { setBalance, totalRounds } from '../js/balance.js';
const ROOT = new URL('..', import.meta.url).pathname;
const BAL = JSON.parse(fs.readFileSync(ROOT + 'data/balance.json', 'utf8'));
const E = process.env;
if (E.NO_CASINO) BAL.casino.shopChance = 0;
if (E.NO_PARITY) BAL.parity.shopChance = 0;
if (E.CASINO_SHOP) BAL.casino.shopChance = +E.CASINO_SHOP;
if (E.PARITY_SHOP) BAL.parity.shopChance = +E.PARITY_SHOP;
if (E.PRICES) for (const kv of E.PRICES.split(',')) { const [id, p] = kv.split(':'); (BAL.casino.dice[id] || BAL.parity.dice[id]).price = +p; }
if (E.RARITY) for (const kv of E.RARITY.split(',')) { const [id, r] = kv.split(':'); (BAL.casino.dice[id] || BAL.parity.dice[id]).rarity = r; }
if (E.START) for (const id of E.START.split(',')) { const [sp, sh] = id.split('/'); BAL.startingBag = [...BAL.startingBag, { shape: sh || ({ casino12: 'd12', casino20: 'd20', paritycoin: 'coin' })[sp] || 'd6', special: sp === 'plain' ? null : sp, count: 1 }]; }
if (E.FACEMULT) { const [a, b, c] = E.FACEMULT.split(',').map(Number); BAL.casino.faceMult = { slot7: a, slot77: b, slot777: c }; }
setBalance(BAL);
const { newRun } = await import('../js/run.js');
const { sensible, playRun } = await import('../tests/bots.mjs');
const { selectIndices, reveal, handDice, preview } = await import('../js/round.js');
const N = +(process.argv[2] || 4000);
let wins = 0; const owned = {}, winOwned = {}, ownedRuns = {};
const ids = ['casino12', 'casino20', 'odds', 'evens', 'paritycoin'];
for (let i = 0; i < N; i++) {
  const run = newRun('sim-' + i), r = playRun(run, sensible);
  if (r.won) wins++;
  for (const id of ids) { const n = run.bag.filter(d => d.special === id).length; if (n) { owned[id] = (owned[id] || 0) + n; ownedRuns[id] = (ownedRuns[id] || 0) + 1; if (r.won) winOwned[id] = (winOwned[id] || 0) + 1; } }
}
console.log(`sensible bot: ${wins}/${N} = ${(100 * wins / N).toFixed(1)}% wins (casino shopChance ${BAL.casino.shopChance}, parity ${BAL.parity.shopChance})`);
for (const id of ids) console.log(`  ${id}: in ${ownedRuns[id] || 0} final bags (${(100 * (ownedRuns[id] || 0) / N).toFixed(1)}%), win rate when owned ${ownedRuns[id] ? (100 * (winOwned[id] || 0) / ownedRuns[id]).toFixed(1) : '-'}%`);
if (E.SEEDS) {
  const pickFirst = (run, want) => { const h = handDice(run), idx = h.map((d, i) => i).filter(i => want.includes(h[i].special)); for (let i = 0; i < h.length && idx.length < 5; i++) if (!idx.includes(i)) idx.push(i); selectIndices(run, idx.slice(0, 5)); reveal(run); };
  const found = { casino: [], parity: [] };
  for (let s = 1; s < 200000 && (found.casino.length < 5 || found.parity.length < 5); s++) {
    let run = newRun(String(s), { demo: 'casino' }); pickFirst(run, ['casino12', 'casino20']);
    const cd = handDice(run).filter(d => d.special && d.special.startsWith('casino'));
    if (found.casino.length < 5 && cd.some(d => d.tag === 'slot777')) found.casino.push(`${s} (${cd.map(d => d.tag || '7').join(', ')}; total ${preview(run).total})`);
    run = newRun(String(s), { demo: 'parity' }); pickFirst(run, ['odds', 'evens', 'paritycoin']);
    const pv = preview(run), line = pv.lines.find(l => l.parity);
    if (found.parity.length < 5 && line && line.matches && line.matches.length >= 3) found.parity.push(`${s} (${line.parity}, ${line.matches.length} matches, total ${pv.total})`);
  }
  console.log('casino demo seeds (pick both Casino dice + the first 3 d6s):', found.casino.join(' | '));
  console.log('parity demo seeds (pick Odds, Evens, Coin + the first 2 d6s):', found.parity.join(' | '));
}
