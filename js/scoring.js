// Scores one throw and returns a step-by-step breakdown for the player.
// Order (from the brief): face values -> each special left to right. Points (blue) and mult (red)
// accumulate separately; total = floor(points x mult). Gold (money) is its own layer.
import { EFFECTS } from './specials.js';
import { specialOf, facesOf, isCounter, isLink, bitsOf, counterBits, bitsToInt } from './dice.js';
import { B } from './balance.js';

export const maxChainBits = () => (B && B.counters && B.counters.maxChainBits) || 12;

// Link chains over the table order. Rules:
//  - Link counters are processed right to left. Each one that is not already part of a chain walks LEFT
//    from itself over the unbroken run of adjacent counters (plain or Link) that are not yet claimed,
//    adding each one only while the chain's total bits stay <= maxBits (12). The walk stops at the first
//    regular die, the first counter that would push it past the cap, or the left edge.
//  - Bits concatenate left to right (leftmost counter = most significant bits) into one number that is
//    scored in place of the members' own values (put on the Link counter; the other members score 0).
//  - A counter can belong to only one chain. A Link counter swallowed by a chain to its right does not
//    start a chain of its own. A Link counter with no counter it can take scores alone (no chain).
export function chains(dice, maxBits = maxChainBits()) {
  const claimed = new Set(), out = [];
  for (let h = dice.length - 1; h >= 0; h--) {
    const head = dice[h];
    if (!isCounter(head) || !isLink(head) || claimed.has(h)) continue;
    const members = [h];
    let bits = bitsOf(head);
    for (let j = h - 1; j >= 0; j--) {
      const d = dice[j];
      if (!isCounter(d) || claimed.has(j) || bits + bitsOf(d) > maxBits) break;
      members.unshift(j);
      bits += bitsOf(d);
    }
    if (members.length < 2) continue;
    members.forEach(j => claimed.add(j));
    const parts = members.map(j => counterBits(dice[j]).join(''));
    const all = parts.join('').split('').map(Number);
    out.push({ head: h, members, bits, parts, binary: parts.join(''), value: bitsToInt(all) });
  }
  return out.reverse(); // left to right
}

export function scoreThrow(dice, env = {}, rng = null) {
  env = { throwsLeft: 1, gold: 0, facesOf, ...env };
  const pts = dice.map(d => d.face);
  const lines = [];
  // Chain pass: Link counters fuse adjacent counters into one binary number (before any other effect).
  const ch = chains(dice);
  for (const c of ch) {
    c.members.forEach(j => { pts[j] = 0; });
    pts[c.head] = c.value;
    lines.push({ layer: 'rule', who: 'Link', text: `${c.parts.join(' ')} = ${c.value} (${c.bits}-bit chain)`, i: c.head, value: c.value, pre: true, chain: c });
  }
  // Pre-pass: value changers (e.g. Echo), left to right.
  dice.forEach((die, i) => {
    const s = specialOf(die), E = s && EFFECTS[s.effect.type];
    if (!E || !E.value) return;
    const r = E.value({ die, i, dice, pts, p: s.effect, env, rng });
    if (r) { pts[i] = r.value; lines.push({ layer: 'rule', who: s.name, text: r.note, i, value: r.value, pre: true }); }
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
    lines.push({ layer: r.layer, who: s.name, text: r.note, points, mult: round2(mult), idle: !!r.idle, i, addPoints: r.addPoints || 0, addMult: r.addMult || 0, xMult: r.xMult || 0, gold: r.gold || 0, shatter: !!r.shatter, ...(r.jackpot ? { jackpot: true } : {}), ...(r.parity ? { parity: r.parity, matches: r.matches } : {}) });
  });
  mult = round2(mult);
  const total = Math.floor(points * mult);
  return { total, points, mult, gold, lines, broken, shattered, pending, pts, chains: ch };
}

const round2 = x => Math.round(x * 100) / 100;
