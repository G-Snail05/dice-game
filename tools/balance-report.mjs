// node tools/balance-report.mjs [N] -> sensible-bot win rate, where runs end (rounds cleared histogram,
// per-round loss rate) and how far winners get in endless. Prints only, writes nothing.
import fs from 'node:fs';
import { setBalance, totalRounds } from '../js/balance.js';
const ROOT = new URL('..', import.meta.url).pathname;
const BAL = JSON.parse(fs.readFileSync(ROOT + 'data/balance.json', 'utf8'));
if (process.env.TARGETS) BAL.targets = process.env.TARGETS.split(',').map(Number);
setBalance(BAL);
const { newRun, settleRound, nextRound, continueEndless } = await import('../js/run.js');
const { sensible, playRun } = await import('../tests/bots.mjs');
const N = +(process.argv[2] || 4000), R = totalRounds(), SEED = process.env.SEED || 'sim-';
let wins = 0; const cleared = Array(R + 1).fill(0), endless = [], bought = {};
for (let i = 0; i < N; i++) {
  const run = newRun(SEED + i);
  const r = playRun(run, sensible);
  for (const d of run.bag) if (d.special) { const k = `${d.special}/${d.shape}`; bought[k] = (bought[k] || 0) + 1; }
  if (!r.won) { cleared[run.stats.roundsWon]++; continue; }
  wins++; cleared[R]++;
  continueEndless(run); let g = 0;
  while (run.phase !== 'lose' && g++ < 400) { if (run.phase === 'round') { sensible.playThrow(run); settleRound(run); } else { sensible.shop(run); nextRound(run); } }
  endless.push(run.roundNo - R - 1); // endless rounds cleared
}
const reach = cleared.map((_, k) => cleared.slice(k).reduce((a, b) => a + b, 0)); // runs that cleared >= k rounds
const lossAt = Array.from({ length: R }, (_, k) => `R${k + 1} ${(100 * cleared[k] / reach[k]).toFixed(1)}%`);
endless.sort((a, b) => a - b);
const q = p => endless[Math.min(endless.length - 1, Math.floor(p * endless.length))];
console.log(`sensible bot: ${wins}/${N} = ${(100 * wins / N).toFixed(1)}% wins; avg rounds cleared ${(cleared.reduce((s, c, k) => s + c * k, 0) / N).toFixed(2)} of ${R}`);
console.log(`rounds cleared histogram ${JSON.stringify(cleared)}`);
console.log(`loss rate per round (of runs reaching it): ${lossAt.join(', ')}`);
console.log(`endless (winners): median ${q(0.5)} rounds cleared, p25 ${q(0.25)}, p75 ${q(0.75)}, p90 ${q(0.9)}, max ${endless[endless.length - 1]}`);
const top = Object.entries(bought).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`specials in final bags (top): ${top}`);
