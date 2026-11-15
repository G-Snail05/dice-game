// node tests/sim.mjs  -> unit checks + seeded run simulations. Exit 1 on failure.
import fs from 'node:fs';
import { setBalance, roundInfo, totalRounds } from '../js/balance.js';
const ROOT = new URL('..', import.meta.url).pathname;
const BAL = JSON.parse(fs.readFileSync(ROOT + 'data/balance.json', 'utf8'));
setBalance(BAL);
const { makeRng, hashSeed } = await import('../js/rng.js');
const { SPECIALS, validateSpecials } = await import('../js/specials.js');
const { scoreThrow, chains } = await import('../js/scoring.js');
const { newRun, serialize, deserialize, settleRound, continueEndless, nextRound } = await import('../js/run.js');
const { toggleLock, reroll, scoreCurrent, handDice, preview, reveal, toggleSelect, selectIndices, canRoll, rollNeed, benchDice, selectedCount } = await import('../js/round.js');
const rollFirst = run => { if (!run.round.revealed) { selectIndices(run, run.round.hand.map((_, i) => i).slice(0, rollNeed(run))); reveal(run); } };
const scoreNow = run => { rollFirst(run); return scoreCurrent(run); };
const { buy, sell, rerollShop } = await import('../js/shop.js');
const { faceKey, facesOf, SHAPE_ORDER, makeDie } = await import('../js/dice.js');
const makeTestDie = (run, special) => makeDie(run, null, special, 0);
const { requiredKeys, counterArtKeys } = await import('../js/art.js');
const { rollDie, isCounter, counterBits } = await import('../js/dice.js');
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

// --- Binary counters
const C = (bits, special, uid = Math.random()) => { const [n, link] = special === 'link4' ? [4, 1] : special === 'link8' ? [8, 1] : special === 'counter8' ? [8, 0] : [4, 0];
  const b = bits.split('').map(Number); if (b.length !== n) throw new Error('bad test counter'); return { uid, shape: n === 4 ? 'bin4' : 'bin8', special, bits: b, face: parseInt(bits, 2) }; };
{ const rng = makeRng(42), seen4 = new Set(), seen8 = new Set();
  const d4 = { shape: 'bin4', special: 'counter4' }, d8 = { shape: 'bin8', special: 'counter8' };
  let okBits = true;
  for (let i = 0; i < 4000; i++) { seen4.add(rollDie(d4, rng)); seen8.add(rollDie(d8, rng)); if (d4.bits.length !== 4 || d8.bits.length !== 8 || parseInt(d8.bits.join(''), 2) !== d8.face) okBits = false; }
  ok(okBits, 'counter bits match their face and bit count');
  eq([Math.min(...seen4), Math.max(...seen4), seen4.size], [0, 15, 16], '4-bit counter rolls every value 0-15');
  eq([Math.min(...seen8), Math.max(...seen8), seen8.size], [0, 255, 256], '8-bit counter rolls every value 0-255');
  ok(isCounter(d4) && !isCounter(D(3)), 'isCounter');
  eq(facesOf(d4).length, 16, '4-bit counter has 16 faces'); }
eq(scoreThrow([C('1111', 'counter4'), D(3)]).total, 18, '4-bit counter scores its raw value (15 + 3)');
eq(scoreThrow([C('11111111', 'counter8')]).total, 255, '8-bit counter scores raw 255');
eq(scoreThrow([C('0000', 'counter4'), D(2)]).total, 2, 'a counter can score 0');
// chain concatenation order: leftmost = most significant
{ const r = scoreThrow([C('1010', 'counter4'), C('0011', 'link4')]);
  eq([r.chains.length, r.chains[0].binary, r.chains[0].value, r.total], [1, '10100011', 0b10100011, 163], 'link concatenates left (MSB) to right');
  eq(r.pts, [0, 163], 'chain value sits on the Link counter, members score 0'); }
eq(scoreThrow([C('0011', 'link4'), C('1010', 'counter4')]).chains, [], 'link only absorbs to its LEFT');
eq(scoreThrow([C('0001', 'counter4'), C('0010', 'counter4'), C('0011', 'link4')]).total, 0b000100100011, 'three-counter chain = 12-bit number');
// a regular die breaks the chain
{ const r = scoreThrow([C('0101', 'counter4'), D(3), C('0001', 'link4')]); eq([r.chains.length, r.total], [0, 9], 'regular die between breaks the chain (5+3+1)'); }
{ const r = scoreThrow([C('1111', 'counter4'), D(2), C('0001', 'counter4'), C('0001', 'link4')]); eq([r.chains[0].members, r.total], [[2, 3], 15 + 2 + 17], 'chain stops at the regular die, counter beyond scores alone'); }
// 12-bit cap
{ const r = scoreThrow([C('1111', 'counter4'), C('1111', 'counter4'), C('1111', 'counter4'), C('1111', 'link4')]);
  eq([r.chains[0].members, r.chains[0].bits, r.chains[0].value, r.total], [[1, 2, 3], 12, 4095, 4095 + 15], '12-bit cap: 4+4+4, the fourth counter scores alone'); }
eq(scoreThrow([C('11111111', 'counter8'), C('11111111', 'link8')]).chains, [], '8+8 exceeds the cap: no chain');
eq(scoreThrow([C('11111111', 'counter8'), C('11111111', 'link8')]).total, 510, '8+8: both score alone');
{ const r = scoreThrow([C('11111111', 'counter8'), C('1111', 'link4')]); eq([r.chains[0].bits, r.total], [12, 4095], '8+4 = 12-bit max 4095'); }
{ const r = scoreThrow([C('11111111', 'counter8'), C('0001', 'counter4'), C('0001', 'link4')]); eq([r.chains[0].members, r.total], [[1, 2], 255 + 17], 'walk stops at the counter that would pass 12 bits'); }
eq(chains([C('0001', 'link4')]).length, 0, 'a lone Link counter is not a chain');
eq(scoreThrow([D(4), C('0101', 'link4')]).total, 9, 'a Link next to a regular die scores alone');
// multiple Link counters: right to left, claimed counters cannot be reused
{ const r = scoreThrow([C('0001', 'link4'), C('0010', 'link4')]); eq([r.chains.length, r.chains[0].members, r.total], [1, [0, 1], 0b00010010], 'Link + Link: right one absorbs the left one'); }
{ const r = scoreThrow([C('0001', 'counter4'), C('0010', 'link4'), C('0011', 'counter4'), C('0100', 'link4')]);
  eq([r.chains.length, r.chains[0].members, r.total], [1, [1, 2, 3], 1 + 0b001000110100], 'rightmost Link claims first; the swallowed Link does not chain again'); }
{ const r = scoreThrow([C('0001', 'counter4'), C('0010', 'link4'), D(1), C('0011', 'counter4'), C('0100', 'link4')]);
  eq([r.chains.map(c => c.members), r.total], [[[0, 1], [3, 4]], 0b00010010 + 1 + 0b00110100], 'two separate chains either side of a regular die'); }
{ const r = scoreThrow([C('11111111', 'counter8'), C('1111', 'link4'), C('1111', 'link4')]);
  eq([r.chains.map(c => c.members), r.total], [[[1, 2]], 255 + 255], 'second Link stops at the 12-bit cap and the 8-bit scores alone'); }
{ const r = scoreThrow([C('0001', 'counter4'), C('0001', 'link4'), D(2, 'ruby')]); eq(r.total, Math.floor((17 + 2) * 1.5), 'chain total is multiplied by mult specials'); }
// landing order: shuffled, deterministic per seed, a permutation of the picks, fixed through re-rolls
{ const land = seed => { const run = newRun(seed); const r = run.round; selectIndices(run, [0, 1, 2, 3, 4]); const picked = r.hand.slice(0, 5); reveal(run); return { picked, hand: [...r.hand], run }; };
  const a = land('shuffle-1'), b = land('shuffle-1');
  eq(a.hand, b.hand, 'same seed, same landing order');
  eq([...a.hand].sort((x, y) => x - y), [...a.picked].sort((x, y) => x - y), 'landing order is a permutation of the picked dice');
  let moved = 0; for (let i = 0; i < 40; i++) { const x = land('shuffle-' + i); if (JSON.stringify(x.hand) !== JSON.stringify(x.picked)) moved++; }
  ok(moved >= 30, `landing order is shuffled (${moved}/40 seeds differ from pick order)`);
  const order = [...a.run.round.hand]; reroll(a.run); eq(a.run.round.hand, order, 're-rolls keep the landing order'); }
// counters in a run: shop offers them, bought counters roll bits, save/load keeps the bits
{ let seen = 0; for (let i = 0; i < 200; i++) { const run = newRun('ctr-shop-' + i); run.round.score = 999; scoreNow(run); settleRound(run); for (let k = 0; k < 3; k++) { if (run.shop.offers.some(o => /counter|link/.test(o.special || ''))) seen++; run.gold = 99; rerollShop(run); } }
  ok(seen > 20 && seen < 400, `shop offers counters sometimes (${seen} of 600 shops)`); }
{ const run = newRun('ctr-run'); run.bag.push(makeTestDie(run, 'link4'), makeTestDie(run, 'counter8'));
  const ids = run.bag.slice(-2).map(d => d.uid); run.round.hand = [...ids, ...run.round.hand.slice(0, 5)]; run.round.selected = run.round.hand.map(() => false);
  selectIndices(run, [0, 1, 2, 3, 4]); reveal(run);
  const ctr = handDice(run).filter(isCounter); eq(ctr.length, 2, 'picked counters land on the table');
  ok(ctr.every(d => d.bits && d.bits.length === (d.shape === 'bin8' ? 8 : 4) && parseInt(d.bits.join(''), 2) === d.face), 'rolled counters carry their bits');
  const copy = deserialize(serialize(run)); eq(copy.bag.find(d => d.uid === ctr[0].uid).bits, ctr[0].bits, 'save/load keeps counter bits');
  eq(preview(run).total, scoreCurrent(run).total, 'preview matches score with counters'); }
eq(SPECIALS.filter(s => s.counter).map(s => [s.id, s.rarity, s.price]), Object.entries(BAL.counters.dice).map(([k, v]) => [k, v.rarity, v.price]), 'counter rarity/price come from balance.json');
{ const ck = counterArtKeys(); ok(ck.length >= 10 && ck.every(k => !requiredKeys().includes(k)), 'counter art keys are listed separately (CSS fallback until the pack has them)');
  const doc = fs.readFileSync(ROOT + 'ASSETS.md', 'utf8'); eq(ck.filter(k => !doc.includes(k)), [], 'ASSETS.md lists the counter art keys'); }

// --- Draw 7, pick 5, roll
{ const run = newRun('pick'); const r = run.round;
  eq([r.hand.length, r.revealed, selectedCount(run), rollNeed(run)], [BAL.handDraw, false, 0, BAL.rollCount], 'draws handDraw face-down, nothing selected, need rollCount');
  ok(handDice(run).every(d => d.face === null), 'drawn dice have no face before the roll');
  ok(!canRoll(run) && !reveal(run), 'cannot roll before picking');
  ok(scoreCurrent(run) === null && !reroll(run) && !toggleLock(run, 0), 'cannot score, re-roll or hold before rolling');
  for (let i = 0; i < BAL.rollCount; i++) ok(toggleSelect(run, i), 'select ' + i);
  ok(!toggleSelect(run, BAL.rollCount), 'cannot select more than rollCount');
  ok(toggleSelect(run, 0) && toggleSelect(run, BAL.handDraw - 1), 'swap a selection');
  const picked = r.hand.filter((_, i) => r.selected[i]), others = r.hand.filter((_, i) => !r.selected[i]);
  ok(canRoll(run) && reveal(run), 'roll with exactly rollCount picked');
  eq([[...r.hand].sort((a, b) => a - b), r.bench], [[...picked].sort((a, b) => a - b), others], 'picked dice are the throw (landing order shuffled), the rest are benched');
  eq([handDice(run).length, benchDice(run).length], [BAL.rollCount, BAL.handDraw - BAL.rollCount], '5 on the table, 2 benched');
  ok(handDice(run).every(d => d.face >= 1) && benchDice(run).every(d => d.face === null), 'only rolled dice get faces');
  const res = scoreCurrent(run); eq(res.pts.length, BAL.rollCount, 'only the rolled dice are scored');
  eq([r.hand.length, r.bench.length, r.revealed], [BAL.handDraw, 0, false], 'next throw redraws a full 7 from the bag'); }
{ const run = newRun('short'); run.bag = run.bag.slice(0, 4); run.round.broken = []; scoreNow(run); // force a short hand
  const r = run.round; ok(r.hand.length === 4 && rollNeed(run) === 4, 'short bag: need = dice in hand');
  ok(selectIndices(run, [0, 1, 2, 3]) && reveal(run), 'can roll a short hand'); }

// --- Balance / schedule
eq(totalRounds(), BAL.rounds, 'rounds from balance');
ok(Array.from({ length: 12 }, (_, i) => roundInfo(i + 1).target).every((t, i, a) => i === 0 || t > a[i - 1]), 'targets strictly rise incl. endless');
{ setBalance({ ...BAL, antes: BAL.antesExample }); eq(totalRounds(), 24, 'antes x blinds = 24'); eq([roundInfo(2).target, roundInfo(3).label], [60, 'Ante 1 · Boss'], 'antes targets/labels'); setBalance(BAL); }

// --- Round / run mechanics
{ const run = newRun('mech');
  eq([run.bag.length, run.bag.every(d => d.shape === 'd6' && !d.special), run.gold], [8, true, BAL.startGold], 'starting bag 8 plain d6, start gold');
  eq([run.round.hand.length, run.round.throwsLeft, run.round.rerollsLeft], [BAL.handDraw, BAL.throws, BAL.rerolls], 'hand/throws/rerolls');
  rollFirst(run); toggleLock(run, 0); const kept = handDice(run)[0].face;
  for (let i = 0; i < BAL.rerolls; i++) ok(reroll(run), 'reroll allowed');
  ok(!reroll(run), 'reroll pool exhausted'); eq(handDice(run)[0].face, kept, 'locked die kept its face');
  const pv = preview(run).total; const res = scoreCurrent(run); eq(res.total, pv, 'preview matches score (no rng specials)');
  // saving mid-run round-trips exactly
  const copy = deserialize(serialize(run)); scoreNow(run); scoreNow(copy); eq(serialize(copy), serialize(run), 'save/load resumes identically'); }

// --- Shop
{ const run = newRun('shop'); run.round.score = 999; scoreNow(run); settleRound(run);
  eq(run.phase, 'shop', 'won round goes to shop'); ok(run.shop.offers.length === BAL.shop.slots, 'shop slots');
  ok(!!run.shop.offers[0].special, 'first shop guarantees a special');
  run.gold = 50; const n = run.bag.length; ok(buy(run, 0), 'buy'); eq(run.bag.length, n + 1, 'bought die joins bag'); ok(!buy(run, 0), 'cannot buy sold slot');
  const g = run.gold; ok(rerollShop(run), 'reroll shop'); eq(run.gold, g - BAL.shop.rerollBase, 'reroll cost'); eq(run.shop.rerollCost, BAL.shop.rerollBase + BAL.shop.rerollStep, 'reroll cost steps');
  const g2 = run.gold; ok(sell(run, run.bag[0].uid), 'sell'); eq(run.gold, g2 + 1, 'plain d6 sells for $1');
  run.bag = run.bag.slice(0, BAL.shop.minBag); ok(!sell(run, run.bag[0].uid), 'cannot sell below min bag');
  ok(nextRound(run) && run.roundNo === 2 && run.phase === 'round', 'next round'); }

// --- Lose path
{ const run = newRun('lose'); run.round.target = 10 ** 9; for (let i = 0; i < BAL.throws; i++) scoreNow(run); settleRound(run); eq(run.phase, 'lose', 'missing target loses'); }

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
