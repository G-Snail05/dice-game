// Scores one throw and returns a step-by-step breakdown for the player.
// Order (from the brief): face values -> each special left to right. Points (blue) and mult (red)
// accumulate separately; total = floor(points x mult). Gold (money) is its own layer.
import { EFFECTS } from './specials.js';
import { specialOf, facesOf } from './dice.js';

export function scoreThrow(dice, env = {}, rng = null) {
  env = { throwsLeft: 1, gold: 0, facesOf, ...env };
  const pts = dice.map(d => d.face);
  const lines = [];
  // Pre-pass: value changers (e.g. Echo), left to right.
  dice.forEach((die, i) => {
    const s = specialOf(die), E = s && EFFECTS[s.effect.type];
    if (!E || !E.value) return;
    const r = E.value({ die, i, dice, pts, p: s.effect, env, rng });
    if (r) { pts[i] = r.value; lines.push({ layer: 'rule', who: s.name, text: r.note }); }
  });
  let points = pts.reduce((a, b) => a + b, 0), mult = 1, gold = 0, pending = false;
  lines.push({ layer: 'points', who: 'Faces', text: `${pts.join(' + ')} = ${points}`, points, mult });
  const broken = [], shattered = [];
  dice.forEach((die, i) => {
    const s = specialOf(die), E = s && EFFECTS[s.effect.type];
    if (!E || !E.score) return;
    const r = E.score({ die, i, dice, pts, p: s.effect, env, rng });
    if (!r) return;
    if (r.addPoints) points += r.addPoints;
    if (r.addMult) mult += r.addMult;
    if (r.xMult) mult *= r.xMult;
    if (r.gold) gold += r.gold;
    if (r.pending) pending = true;
    if (r.breakForRound) broken.push(die.uid);
    if (r.shatter) shattered.push(die.uid);
    lines.push({ layer: r.layer, who: s.name, text: r.note, points, mult: round2(mult), idle: !!r.idle });
  });
  mult = round2(mult);
  const total = Math.floor(points * mult);
  return { total, points, mult, gold, lines, broken, shattered, pending, pts };
}

const round2 = x => Math.round(x * 100) / 100;
