// node tests/sim.mjs  -> unit checks + seeded run simulations. Exit 1 on failure.
import fs from 'node:fs';
import { setBalance, roundInfo, totalRounds } from '../js/balance.js';
const ROOT = new URL('..', import.meta.url).pathname;
const BAL = JSON.parse(fs.readFileSync(ROOT + 'data/balance.json', 'utf8'));
setBalance(BAL);
const { makeRng, hashSeed } = await import('../js/rng.js');
const { SPECIALS, validateSpecials } = await import('../js/specials.js');
const { scoreThrow } = await import('../js/scoring.js');
const { newRun, serialize, deserialize, settleRound, continueEndless, nextRound } = await import('../js/run.js');
const { toggleLock, reroll, scoreCurrent, handDice, preview, reveal } = await import('../js/round.js');
const { buy, sell, rerollShop } = await import('../js/shop.js');
const { faceKey, facesOf, SHAPE_ORDER } = await import('../js/dice.js');
const { requiredKeys } = await import('../js/art.js');
const { sensible, randomBot, playRun } = await import('./bots.mjs');

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL:', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const D = (face, special = null, shape = 'd6', uid = Math.random()) => ({ uid, shape, special, face });

// --- RNG
{ const a = makeRng(hashSeed('x')), b = makeRng(hashSeed('x')); eq([a.next(), a.int(6)], [b.next(), b.int(6)], 'rng deterministic');
  const r = makeRng(1), c = Array(6).fill(0); for (let i = 0; i < 60000; i++) c[r.int(6)]++; ok(c.every(n => n > 9000 && n < 11000), 'rng roughly uniform ' + c); }

// --- Specials data
eq(validateSpecials(), [], 'specials reference known effects');
ok(SPECIALS.length >= 10, 'about 10 specials');

// --- Scoring
eq(scoreThrow([D(1), D(2), D(3), D(4), D(5)]).total, 15, 'plain sum');
eq(scoreThrow([D(2), D(2), D(3), D(4), D(5, 'ruby')]).total, 24, 'ruby x1.5 (16*1.5)');
eq(scoreThrow([D(4), D(4, 'matching'), D(1)]).total, 18, 'matching x2 when pair');
eq(scoreThrow([D(4), D(5, 'matching'), D(1)]).total, 10, 'matching idle without pair');
eq(scoreThrow([D(2), D(4), D(1), D(3, 'ember')]).mult, 5, 'ember +2 mult per other even (2 evens)');
eq(scoreThrow([D(2), D(4), D(1), D(3, 'ember')]).total, 50, 'ember total = 10 x 5');
eq(scoreThrow([D(1), D(3), D(4, 'ember')]).mult, 1, 'ember ignores itself and odd dice');
eq(scoreThrow([D(3), D(3, 'lastcall')], { throwsLeft: 1 }).total, 18, 'last call x3 on final throw');
eq(scoreThrow([D(3), D(3, 'lastcall')], { throwsLeft: 2 }).total, 6, 'last call idle earlier');
eq(scoreThrow([D(6), D(1, 'echo')]).total, 12, 'echo copies left die');
eq(scoreThrow([D(1, 'echo'), D(6)]).total, 7, 'echo leftmost keeps own face');
eq(scoreThrow([D(6), D(6, 'gold'), D(2)]).gold, 2, 'gold die pays $1 per six');
{ const r = scoreThrow([D(2), D(3, 'glass', 'd8', 7)], {}, makeRng(5)); eq([r.total, r.broken], [15, [7]], 'glass x3 and breaks for round'); }
{ const p = scoreThrow([D(5), D(2, 'twin')]); ok(p.pending && p.total === 7, 'twin preview pending');
  const r = scoreThrow([D(5), D(2, 'twin')], {}, makeRng(9)); ok(r.total >= 8 && r.total <= 13, 'twin adds a d6 reroll ' + r.total); }
{ const r = scoreThrow([D(2), D(2, 'ruby'), D(2, 'matching')]); eq([r.points, r.mult, r.total], [6, 3, 18], 'mult stacking left to right'); }
ok(scoreThrow([D(1), D(2)]).lines.length >= 1, 'breakdown has lines');
eq(facesOf({ shape: 'coin', special: 'coin' }), [0, 10], 'coin faces');
eq(facesOf({ shape: 'd6', special: 'overcharged' }), [4, 5, 6, 7, 8, 9], 'overcharged faces');

{ const r = scoreThrow([D(6), D(2, 'echo'), D(3, 'ruby')]); eq(r.lines.filter(l => l.i != null).map(l => [l.who, l.i]), [['Echo', 1], ['Ruby', 2]], 'breakdown lines carry the die index for the animation');
  eq(r.pts, [6, 6, 3], 'pts after value changers'); }

// --- Reveal (UI flag): faces fixed at draw time, reveal changes nothing else
{ const run = newRun('reveal'); const faces = handDice(run).map(d => d.face), st = run.rng.state;
  eq(run.round.revealed, false, 'new throw starts face-down in the hand'); ok(reveal(run), 'reveal'); ok(!reveal(run), 'reveal once');
  eq([handDice(run).map(d => d.face), run.rng.state], [faces, st], 'reveal does not reroll or touch the RNG');
  scoreCurrent(run); eq(run.round.revealed, false, 'next throw is face-down again'); }

// --- Balance / schedule
eq(totalRounds(), BAL.rounds, 'rounds from balance');
ok(Array.from({ length: 12 }, (_, i) => roundInfo(i + 1).target).every((t, i, a) => i === 0 || t > a[i - 1]), 'targets strictly rise incl. endless');
{ setBalance({ ...BAL, antes: BAL.antesExample }); eq(totalRounds(), 24, 'antes x blinds = 24'); eq([roundInfo(2).target, roundInfo(3).label], [60, 'Ante 1 · Boss'], 'antes targets/labels'); setBalance(BAL); }

// --- Round / run mechanics
{ const run = newRun('mech');
  eq([run.bag.length, run.bag.every(d => d.shape === 'd6' && !d.special), run.gold], [8, true, BAL.startGold], 'starting bag 8 plain d6, start gold');
  eq([run.round.hand.length, run.round.throwsLeft, run.round.rerollsLeft], [BAL.handSize, BAL.throws, BAL.rerolls], 'hand/throws/rerolls');
  toggleLock(run, 0); const kept = handDice(run)[0].face;
  for (let i = 0; i < BAL.rerolls; i++) ok(reroll(run), 'reroll allowed');
  ok(!reroll(run), 'reroll pool exhausted'); eq(handDice(run)[0].face, kept, 'locked die kept its face');
  const pv = preview(run).total; const res = scoreCurrent(run); eq(res.total, pv, 'preview matches score (no rng specials)');
  // saving mid-run round-trips exactly
  const copy = deserialize(serialize(run)); scoreCurrent(run); scoreCurrent(copy); eq(serialize(copy), serialize(run), 'save/load resumes identically'); }

// --- Shop
{ const run = newRun('shop'); run.round.score = 999; scoreCurrent(run); settleRound(run);
  eq(run.phase, 'shop', 'won round goes to shop'); ok(run.shop.offers.length === BAL.shop.slots, 'shop slots');
  ok(!!run.shop.offers[0].special, 'first shop guarantees a special');
  run.gold = 50; const n = run.bag.length; ok(buy(run, 0), 'buy'); eq(run.bag.length, n + 1, 'bought die joins bag'); ok(!buy(run, 0), 'cannot buy sold slot');
  const g = run.gold; ok(rerollShop(run), 'reroll shop'); eq(run.gold, g - BAL.shop.rerollBase, 'reroll cost'); eq(run.shop.rerollCost, BAL.shop.rerollBase + BAL.shop.rerollStep, 'reroll cost steps');
  const g2 = run.gold; ok(sell(run, run.bag[0].uid), 'sell'); eq(run.gold, g2 + 1, 'plain d6 sells for $1');
  run.bag = run.bag.slice(0, BAL.shop.minBag); ok(!sell(run, run.bag[0].uid), 'cannot sell below min bag');
  ok(nextRound(run) && run.roundNo === 2 && run.phase === 'round', 'next round'); }

// --- Lose path
{ const run = newRun('lose'); run.round.target = 10 ** 9; for (let i = 0; i < BAL.throws; i++) scoreCurrent(run); settleRound(run); eq(run.phase, 'lose', 'missing target loses'); }

// --- Art keys: active manifest (style A pack) and the placeholder fallback both cover every key; every file exists.
{ const keys = requiredKeys();
  const files = e => { if (!e) return []; const out = [e.src, ...Object.values(e.srcset || {})]; if (e.hc) out.push(...files(e.hc)); for (const st of Object.values(e.states || {})) out.push(...files(st)); return out; };
  for (const name of ['manifest.json', 'manifest.placeholder.json']) {
    const man = JSON.parse(fs.readFileSync(ROOT + 'assets/' + name, 'utf8'));
    eq(keys.filter(k => !man.assets[k]), [], `${name} covers every key (${keys.length})`);
    eq(keys.flatMap(k => files(man.assets[k])).filter(f => !fs.existsSync(ROOT + man.base + f)), [], `${name}: every referenced file exists`);
  }
  const man = JSON.parse(fs.readFileSync(ROOT + 'assets/manifest.json', 'utf8'));
  eq(man.fallback, 'assets/manifest.placeholder.json', 'active manifest names the placeholder fallback');
  ok(man.pixelated === true, 'pixel pack sets pixelated');
  const noSet = keys.filter(k => !(man.assets[k].srcset && man.assets[k].srcset['2x'] && man.assets[k].srcset['3x'])); eq(noSet, [], 'every key has 1x/2x/3x srcset');
  // 2x/3x files really are 2x/3x the 1x pixel size (PNG IHDR width).
  const pngW = f => fs.readFileSync(ROOT + man.base + f).readUInt32BE(16);
  const badScale = keys.filter(k => { const e = man.assets[k]; const w = pngW(e.src); return pngW(e.srcset['2x']) !== 2 * w || pngW(e.srcset['3x']) !== 3 * w; }); eq(badScale, [], '2x/3x sprites are exact multiples');
  ok(keys.filter(k => man.assets[k].hc).length >= 80, 'high-contrast twins present for most keys');
  eq(keys.filter(k => /^ui_btn_/.test(k) && man.assets[k].kind !== 'button'), [], 'ui_btn_* keys are button skins with states');
  const doc = fs.readFileSync(ROOT + 'ASSETS.md', 'utf8'); eq(keys.filter(k => !doc.includes(k)), [], 'ASSETS.md lists every key'); }

// --- Simulations
const N = +(process.env.SIM_N || 400);
function sim(mk, n, opts) { let wins = 0; const reach = Array(totalRounds() + 2).fill(0);
  for (let i = 0; i < n; i++) { const run = newRun('sim-' + i); const r = playRun(run, mk(i), opts); if (r.won) wins++; reach[Math.min(run.stats.roundsWon, totalRounds() + 1)]++; }
  return { wins, rate: wins / n, roundsWonHistogram: reach }; }
const S = sim(() => sensible, N), R = sim(i => randomBot(1000 + i), N);
console.log(`sensible bot: ${S.wins}/${N} wins (${(S.rate * 100).toFixed(1)}%) rounds-won histogram ${JSON.stringify(S.roundsWonHistogram)}`);
console.log(`random bot:   ${R.wins}/${N} wins (${(R.rate * 100).toFixed(1)}%) rounds-won histogram ${JSON.stringify(R.roundsWonHistogram)}`);
ok(S.rate >= 0.3 && S.rate <= 0.5, `sensible win rate in 30-50% (${S.rate})`);
ok(R.rate <= 0.03, `random bot rarely wins (${R.rate})`);
ok(S.wins > 0 && S.wins < N, 'runs can be both won and lost');
{ const a = newRun('det'), b = newRun('det'); playRun(a, sensible); playRun(b, sensible); eq(serialize(a), serialize(b), 'same seed, same run'); }
// Endless: a winning run can continue and eventually ends.
{ let found = false; for (let i = 0; i < N && !found; i++) { const run = newRun('sim-' + i); if (!playRun(run, sensible).won) continue; found = true;
    ok(continueEndless(run) && run.phase === 'shop', 'continue into endless'); sensible.shop(run); nextRound(run);
    ok(run.round.endless && run.round.target > roundInfo(totalRounds()).target, 'endless round has higher target');
    let g = 0; while (run.phase !== 'lose' && g++ < 200) { if (run.phase === 'round') { sensible.playThrow(run); settleRound(run); } else { sensible.shop(run); nextRound(run); } }
    ok(run.phase === 'lose', `endless eventually ends (reached round ${run.roundNo})`); console.log(`endless sample: seed sim-${i} lost at round ${run.roundNo} (${run.round.label})`); }
  ok(found, 'found a winning run for endless check'); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
