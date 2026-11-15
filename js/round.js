// One round: up to `throws` throws. Each throw draws `handDraw` dice (7) from the bag into the hand; the player
// picks `rollCount` of them (5) and rolls those onto the table (reveal). The rest sit out this throw.
// `rerolls` is a shared pool for the round: re-roll every unlocked (not held) die, keep the held ones.
// After scoring, every die (rolled or not) goes back to the bag and the next throw draws a fresh 7.
import { B, roundInfo } from './balance.js';
import { rollDie, facesOf } from './dice.js';
import { scoreThrow } from './scoring.js';

export function startRound(run) {
  const info = roundInfo(run.roundNo);
  run.round = { ...info, score: 0, throwsLeft: B.throws, rerollsLeft: B.rerolls, hand: [], bench: [], selected: [], locked: [], broken: [], last: null, status: 'playing', goldEarned: 0 };
  drawThrow(run);
}

export const handDice = run => run.round.hand.map(uid => run.bag.find(d => d.uid === uid)).filter(Boolean);

export function drawThrow(run) {
  const r = run.round;
  const pool = run.bag.filter(d => !r.broken.includes(d.uid)).map(d => d.uid);
  run.rng.shuffle(pool);
  r.hand = pool.slice(0, B.handDraw);
  r.bench = [];
  r.selected = r.hand.map(() => false);
  r.locked = [];
  for (const d of handDice(run)) d.face = null;
  r.revealed = false;
}

// How many dice must be picked before rolling (fewer if the hand is short).
export const rollNeed = run => Math.min(B.rollCount, run.round.hand.length);
export const selectedCount = run => (run.round.selected || []).filter(Boolean).length;
export const canRoll = run => run.round.status === 'playing' && !run.round.revealed && selectedCount(run) === rollNeed(run);

export function toggleSelect(run, i) {
  const r = run.round;
  if (r.status !== 'playing' || r.revealed || i < 0 || i >= r.hand.length) return false;
  if (!r.selected) r.selected = r.hand.map(() => false);
  if (!r.selected[i] && selectedCount(run) >= rollNeed(run)) return false;
  r.selected[i] = !r.selected[i];
  return true;
}

// Set the selection to exactly these hand indices (used by bots and tests).
export function selectIndices(run, idx) {
  const r = run.round;
  if (r.revealed) return false;
  r.selected = r.hand.map((_, i) => idx.includes(i));
  return selectedCount(run) === rollNeed(run);
}

// Roll the selected dice onto the table: they become the throw (`hand`), the rest go to the `bench`.
export function reveal(run) {
  const r = run.round;
  if (!r || !canRoll(run)) return false;
  const keep = r.hand.filter((_, i) => r.selected[i]);
  r.bench = r.hand.filter((_, i) => !r.selected[i]);
  // Landing order: the picked dice land on the table in a random (seeded) order, which matters for
  // position-based effects (Link chains, Echo). The order then stays fixed for the throw's re-rolls.
  if (B.shuffleLanding !== false) run.rng.shuffle(keep);
  r.hand = keep;
  r.selected = [];
  r.locked = r.hand.map(() => false);
  for (const d of handDice(run)) rollDie(d, run.rng);
  r.revealed = true;
  return true;
}

export const benchDice = run => (run.round.bench || []).map(uid => run.bag.find(d => d.uid === uid)).filter(Boolean);

export function toggleLock(run, i) {
  const r = run.round;
  if (r.status !== 'playing' || !r.revealed || i < 0 || i >= r.hand.length) return false;
  r.locked[i] = !r.locked[i];
  return true;
}

export const canReroll = run => run.round.status === 'playing' && run.round.revealed && run.round.rerollsLeft > 0 && run.round.locked.some(l => !l);

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
  if (r.status !== 'playing' || !r.revealed) return null;
  const res = scoreThrow(handDice(run), { throwsLeft: r.throwsLeft, gold: run.gold, facesOf }, run.rng);
  r.score += res.total;
  run.gold += res.gold;
  r.goldEarned += res.gold;
  r.broken.push(...res.broken);
  if (res.shattered.length) run.bag = run.bag.filter(d => !res.shattered.includes(d.uid));
  r.throwsLeft--;
  r.last = { total: res.total, points: res.points, mult: res.mult, lines: res.lines, gold: res.gold, shattered: res.shattered.length, pts: res.pts, chains: res.chains };
  run.stats.throws++;
  run.stats.bestThrow = Math.max(run.stats.bestThrow, res.total);
  run.stats.totalScore += res.total;
  if (r.score >= r.target) r.status = 'won';
  else if (r.throwsLeft <= 0 || run.bag.length === 0) r.status = 'lost';
  else drawThrow(run);
  return res;
}
