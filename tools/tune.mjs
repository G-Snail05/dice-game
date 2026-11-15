// node tools/tune.mjs [t1] -> grid-search a geometric target curve against the sim bots (prints, writes nothing).
import fs from 'node:fs';
import { setBalance } from '../js/balance.js';
const ROOT = new URL('..', import.meta.url).pathname;
const BAL = JSON.parse(fs.readFileSync(ROOT + 'data/balance.json', 'utf8'));
setBalance(BAL);
const { newRun } = await import('../js/run.js');
const { sensible, randomBot, playRun } = await import('../tests/bots.mjs');
const N = 400, t1s = process.argv[2] ? process.argv[2].split(',').map(Number) : [35, 40, 45];
const rate = (mk, seedBase) => { let w = 0; for (let i = 0; i < N; i++) if (playRun(newRun(seedBase + i), mk(i)).won) w++; return w / N; };
for (const t1 of t1s) for (const g of (process.env.G || '1.18,1.22,1.26,1.3,1.34,1.38').split(',').map(Number)) {
  BAL.targets = Array.from({ length: BAL.rounds }, (_, i) => Math.round(t1 * g ** i / 5) * 5);
  console.log(t1, g, BAL.targets.join(','), 'sensible', rate(() => sensible, 'tune-'), 'random', rate(i => randomBot(5000 + i), 'tune-'));
}
