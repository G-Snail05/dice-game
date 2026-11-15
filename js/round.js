// One round: up to `throws` throws; each throw draws `handSize` dice from the bag and rolls them.
// `rerolls` is a shared pool for the round: re-roll every unlocked die, keep the locked ones.
import { B, roundInfo } from './balance.js';
import { rollDie, facesOf } from './dice.js';
import { scoreThrow } from './scoring.js';

export function startRound(run) {
  const info = roundInfo(run.roundNo);
  run.round = { ...info, score: 0, throwsLeft: B.throws, rerollsLeft: B.rerolls, hand: [], locked: [], broken: [], last: null, status: 'playing', goldEarned: 0 };
  drawThrow(run);
}

export const handDice = run => run.round.hand.map(uid => run.bag.find(d => d.uid === uid)).filter(Boolean);

export function drawThrow(run) {
  const r = run.round;
  const pool = run.bag.filter(d => !r.broken.includes(d.uid)).map(d => d.uid);
  run.rng.shuffle(pool);
  r.hand = pool.slice(0, B.handSize);
  r.locked = r.hand.map(() => false);
  for (const d of handDice(run)) rollDie(d, run.rng);
  // Faces are decided at draw time (keeps the RNG sequence independent of the UI); the UI shows the dice
  // in the hand face-down until the player rolls them onto the table (reveal). Engine logic ignores this flag.
  r.revealed = false;
}

export function reveal(run) {
  if (!run.round || run.round.status !== 'playing' || run.round.revealed) return false;
  run.round.revealed = true;
  return true;
}

export function toggleLock(run, i) {
  const r = run.round;
  if (r.status !== 'playing' || i < 0 || i >= r.hand.length) return false;
  r.locked[i] = !r.locked[i];
  return true;
}

export const canReroll = run => run.round.status === 'playing' && run.round.rerollsLeft > 0 && run.round.locked.some(l => !l);

export function reroll(run) {
  if (!canReroll(run)) return false;
  const r = run.round;
  handDice(run).forEach((d, i) => { if (!r.locked[i]) rollDie(d, run.rng); });
  r.rerollsLeft--;
  return true;
}

export function preview(run) {
  return scoreThrow(handDice(run), { throwsLeft: run.round.throwsLeft, gold: run.gold, facesOf }, null);
}

// Score the current throw. Returns the scoring result; sets round.status to 'won' / 'lost' / 'playing'.
export function scoreCurrent(run) {
  const r = run.round;
  if (r.status !== 'playing') return null;
  const res = scoreThrow(handDice(run), { throwsLeft: r.throwsLeft, gold: run.gold, facesOf }, run.rng);
  r.score += res.total;
  run.gold += res.gold;
  r.goldEarned += res.gold;
  r.broken.push(...res.broken);
  if (res.shattered.length) run.bag = run.bag.filter(d => !res.shattered.includes(d.uid));
  r.throwsLeft--;
  r.last = { total: res.total, points: res.points, mult: res.mult, lines: res.lines, gold: res.gold, shattered: res.shattered.length, pts: res.pts };
  run.stats.throws++;
  run.stats.bestThrow = Math.max(run.stats.bestThrow, res.total);
  run.stats.totalScore += res.total;
  if (r.score >= r.target) r.status = 'won';
  else if (r.throwsLeft <= 0 || run.bag.length === 0) r.status = 'lost';
  else drawThrow(run);
  return res;
}
