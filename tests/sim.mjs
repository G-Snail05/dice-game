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
const { buy, sell, rerollShop, sellValue } = await import('../js/shop.js');
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
{ const r = scoreThrow([D(2), D(3, 'glass', 'd8', 7)], {}, makeRng(5)); eq([r.total, r.broken], [15, [7]], 'glass x3 and breaks for round'); }
{ const p = scoreThrow([D(5), D(2, 'twin')]); ok(p.pending && p.total === 7, 'twin preview pending');
  const r = scoreThrow([D(5), D(2, 'twin')], {}, makeRng(9)); ok(r.total >= 8 && r.total <= 13, 'twin adds a d6 reroll ' + r.total); }
{ const r = scoreThrow([D(2), D(2, 'ruby'), D(2, 'matching')]); eq([r.points, r.mult, r.total], [6, 3, 18], 'mult stacking left to right'); }
ok(scoreThrow([D(1), D(2)]).lines.length >= 1, 'breakdown has lines');
eq(facesOf({ shape: 'coin', special: 'coin' }), [0, 10], 'coin faces');
eq(facesOf({ shape: 'd6', special: 'overcharged' }), [4, 5, 6, 7, 8, 9], 'overcharged faces');

{ const r = scoreThrow([D(6), D(2, 'echo'), D(3, 'ruby')]); eq(r.lines.filter(l => l.i != null).map(l => [l.who, l.i]), [['Echo', 1], ['Ruby', 2]], 'breakdown lines carry the die index for the animation');
  eq(r.pts, [6, 6, 3], 'pts after value changers'); }

// --- Modifiers on every shape (d4–d20)
{ const { SPECIALS_BY_ID: SB, MOD_SHAPES, descOf } = await import('../js/specials.js');
  const { priceOf } = await import('../js/shop.js');
  const { modArtKeys, initArt } = await import('../js/art.js');
  const MODS = ['ruby', 'ember', 'lastcall', 'matching', 'overcharged', 'gold', 'twin', 'echo', 'glass'];
  const SHAPES_N = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
  eq(MODS.filter(m => !SB[m].mod), [], 'all nine d6 modifiers (and Glass) are shape-free modifiers');
  ok(!SB.coin.mod && !SB.counter4.mod && !SB.link4.mod, 'Coin and counters are not modifiers');
  eq(MOD_SHAPES, ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'], 'modifier shapes d4–d20');
  // 1. price = plain shape price + $2 for every modifier and shape
  eq(MODS.flatMap(m => MOD_SHAPES.map(sh => priceOf(sh, m) - BAL.prices[sh])).filter(x => x !== BAL.mods.priceAdd), [], 'every modifier on every shape costs plain + priceAdd');
  eq([BAL.mods.priceAdd, priceOf('d6', 'ruby'), priceOf('d20', 'ember'), priceOf('d8', 'glass'), priceOf('d4', 'gold')], [2, 4, 9, 5, 3], 'price examples (d6 Ruby $4, d20 Ember $9, d8 Glass $5, d4 Gold $3)');
  eq([priceOf('coin', 'coin'), priceOf('bin4', 'counter4')], [SB.coin.price, BAL.counters.dice.counter4.price], 'Coin and counters keep their own prices');
  // 2. Overcharged: +3 on every face, per shape
  eq(facesOf({ shape: 'd6', special: 'overcharged' }), [4, 5, 6, 7, 8, 9], 'overcharged d6 = 4–9');
  eq(facesOf({ shape: 'd20', special: 'overcharged' }), Array.from({ length: 20 }, (_, i) => i + 4), 'overcharged d20 = 4–23');
  eq(MOD_SHAPES.map(sh => { const f = facesOf({ shape: sh, special: 'overcharged' }); return [f.length, f[0], f[f.length - 1]]; }), [[4, 4, 7], [6, 4, 9], [8, 4, 11], [10, 4, 13], [12, 4, 15], [20, 4, 23]], 'overcharged faces per shape');
  { const rng = makeRng(3), d = { shape: 'd12', special: 'overcharged' }, seen = new Set(); for (let i = 0; i < 3000; i++) seen.add(rollDie(d, rng)); eq([Math.min(...seen), Math.max(...seen), seen.size], [4, 15, 12], 'overcharged d12 rolls 4–15'); }
  eq(descOf(SB.overcharged, 'd10'), 'Faces 4–13 instead of 1–10 (+3 on every face).', 'overcharged desc per shape');
  // 3. Gold: threshold = its own top face, payout by its shape, each Gold die pays independently
  eq(MOD_SHAPES.map(sh => BAL.mods.goldPayout[sh]), [1, 1, 2, 2, 3, 4], 'gold payout per shape from balance.json');
  eq(scoreThrow([D(6), D(6, 'gold'), D(2)]).gold, 2, 'd6 Gold: $1 per die showing 6+ (itself included)');
  eq(scoreThrow([D(4), D(3, 'gold', 'd4'), D(5), D(9, 'overcharged')]).gold, 3, 'd4 Gold: $1 per die showing 4+ (4, 5, 9)');
  eq(scoreThrow([D(9, null, 'd10'), D(10, null, 'd10'), D(4, 'gold', 'd10'), D(12, null, 'd12')]).gold, 4, 'd10 Gold: $2 per die showing 10+ (10, 12)');
  eq(scoreThrow([D(20, 'gold', 'd20'), D(19, null, 'd20'), D(6)]).gold, 4, 'd20 Gold: $4 per die showing 20+');
  eq(scoreThrow([D(12, 'gold', 'd12'), D(8, 'gold', 'd8'), D(11, null, 'd12')]).gold, 3 + 3 * 2, 'two Gold dice pay independently (d12 Gold: 12 -> $3; d8 Gold: 12, 8, 11 -> $6)');
  eq(scoreThrow([D(5, 'gold', 'd8'), D(7)]).gold, 0, 'd8 Gold idle when nothing shows 8+');
  eq(descOf(SB.gold, 'd12'), '+$3 for every die showing 12 or more, itself included (paid before interest).', 'gold desc per shape');
  // Glass and the other modifiers work on other shapes
  { const r = scoreThrow([D(2), D(15, 'glass', 'd20', 9)], {}, makeRng(5)); eq([r.mult, r.total, r.broken], [3, 51, [9]], 'Glass d20: x3 and breaks for the round'); }
  { const r = scoreThrow([D(4, null, 'd4'), D(9, 'ruby', 'd12')]); eq(r.total, Math.floor(13 * 1.5), 'Ruby d12 x1.5 on its own face'); }
  { const r = scoreThrow([D(8, null, 'd8'), D(8, 'matching', 'd10')]); eq(r.total, 32, 'Matching d10 x2 with a matching d8'); }
  { const r = scoreThrow([D(2), D(4, null, 'd8'), D(7, 'ember', 'd20')]); eq(r.mult, 5, 'Ember d20 +2 per other even'); }
  { const r = scoreThrow([D(10, null, 'd12'), D(1, 'echo', 'd4')]); eq(r.total, 20, 'Echo d4 copies a d12'); }
  { const r = scoreThrow([D(3, 'lastcall', 'd8')], { throwsLeft: 1 }); eq(r.total, 9, 'Last Call d8 x3 on the final throw'); }
  { const r = scoreThrow([D(20, null, 'd20'), D(1, 'twin', 'd4')], {}, makeRng(2)); ok(r.total >= 22 && r.total <= 41, 'Twin d4 re-rolls a copy of the highest (d20) ' + r.total); }
  // 4. Shop rolls modifiers on many shapes; save/load keeps shape + modifier
  { const seen = new Set(); let ctr = 0;
    for (let i = 0; i < 300; i++) { const run = newRun('modshop-' + i); run.round.score = 999; scoreNow(run); settleRound(run);
      for (let k = 0; k < 3; k++) { for (const o of run.shop.offers) { if (o.special && SB[o.special].mod) { seen.add(o.shape); if (o.price !== BAL.prices[o.shape] + BAL.mods.priceAdd) ctr = -1e9; } if (o.special && SB[o.special].counter) ctr++; } run.gold = 99; rerollShop(run); } }
    eq([...seen].sort(), [...MOD_SHAPES].sort(), 'shop offers modifiers on every shape d4–d20');
    ok(ctr > 0, 'shop modifier prices = plain + $2, and counters still roll separately'); }
  { const run = newRun('modsave'); run.round.score = 999; scoreNow(run); settleRound(run);
    run.shop.offers = [{ shape: 'd20', special: 'glass', price: priceOf('d20', 'glass'), sold: false }, { shape: 'd4', special: 'overcharged', price: priceOf('d4', 'overcharged'), sold: false }, { shape: 'd12', special: 'gold', price: priceOf('d12', 'gold'), sold: false }];
    run.gold = 99; ok(buy(run, 0) && buy(run, 1) && buy(run, 2), 'buy modified dice');
    const got = run.bag.slice(-3).map(d => [d.shape, d.special, d.cost]);
    eq(got, [['d20', 'glass', 9], ['d4', 'overcharged', 3], ['d12', 'gold', 7]], 'bought modifiers keep the offered shape and price');
    const copy = deserialize(serialize(run)); eq(copy.bag.slice(-3).map(d => [d.shape, d.special, d.cost]), got, 'save/load keeps shape + modifier');
    eq(sellValue(copy.bag[copy.bag.length - 1]), 3, 'a modified die sells for half its price');
    nextRound(copy); const r = copy.round; r.hand = copy.bag.slice(-3).map(d => d.uid).concat(r.hand.slice(0, 4)); selectIndices(copy, [0, 1, 2, 3, 4]); reveal(copy);
    const ds = handDice(copy).filter(d => d.special); ok(ds.length === 3 && ds.every(d => facesOf(d).includes(d.face)), 'loaded modified dice roll their own faces');
    eq(preview(copy).total, (() => { const c2 = deserialize(serialize(copy)); return preview(c2).total; })(), 'preview identical after save/load'); }
  // 5. Art hook: per-shape overlay -> generic badge -> icon badge
  { const { modArt, badge: badgeHTML } = await import('../js/ui/dieView.js');
    const die = { shape: 'd10', special: 'ruby', face: 3 };
    initArt({ assets: {} }); ok(modArt(die) === null && /icon_mult_x1_5|<i>R<\/i>/.test(badgeHTML(die)), 'no mod art: icon badge');
    initArt({ assets: { mod_badge_ruby: { src: 'b.png' } } }); ok(/modbadge/.test(modArt(die)) && badgeHTML(die) === '', 'generic mod_badge_<mod> replaces the icon badge');
    initArt({ assets: { mod_badge_ruby: { src: 'b.png' }, mod_ruby_d10: { src: 'o.png' } } }); ok(/modovl/.test(modArt(die)) && /o\.png/.test(modArt(die)), 'per-shape mod_<mod>_<shape> wins over the generic badge');
    // Pointed tops: per-shape sprite clipped out of the badge zone + layer ring strip + badge 2px up; flat tops: per-shape only.
    initArt({ assets: { mod_ruby_d10: { src: 'o.png' }, mod_badge_ruby: { src: 'b.png', pill_x: 0 }, fx_ring_d10_mult: { src: 'r.png' }, mod_ruby_d12: { src: 'o12.png' } } });
    const pt = modArt(die);
    ok(/o\.png/.test(pt) && /clip-path:polygon\(0 0,28\.5714% 0/.test(pt) && /modring[^>]*>/.test(pt) && /r\.png/.test(pt) && /modbadge nudge/.test(pt), 'pointed d10: per-shape sprite first, badge zone rebuilt from the ring, badge nudged up');
    ok(/polygon\(28\.5714% 23\.8095%,100% 23\.8095%,100% 28\.5714%,28\.5714% 28\.5714%\)/.test(pt), 'ring strip fills rows 10-11 under the nudged badge (row 9 stays a 1px gap)');
    const flat = modArt({ shape: 'd12', special: 'ruby', face: 2 }); ok(/o12\.png/.test(flat) && !/nudge|modring|clip-path/.test(flat), 'flat d12: per-shape sprite as drawn, no nudge');
    initArt({ assets: { mod_ruby_d10: { src: 'o.png' }, mod_badge_ruby: { src: 'b.png' } } }); ok(/o\.png/.test(modArt(die)) && !/nudge/.test(modArt(die)), 'pointed without ring/pill data: per-shape sprite unclipped');
    initArt({ assets: { mod_badge_ruby: { src: 'b.png' } } }); ok(/modbadge nudge/.test(modArt(die)) && !/nudge/.test(modArt({ shape: 'd6', special: 'ruby', face: 1 })), 'generic badge: nudged on pointed tops only');
    { const man = JSON.parse(fs.readFileSync(ROOT + 'assets/manifest.json', 'utf8')); initArt(man);
      const { modRingKeys } = await import('../js/art.js');
      const ship = [...modArtKeys(), ...modRingKeys()];
      eq(ship.filter(k => !man.assets[k] || !man.assets[k].hc), [], 'active manifest ships all 78 mod keys + pointed layer rings, each with an hc twin');
      eq(ship.flatMap(k => [man.assets[k].src, man.assets[k].hc.src]).filter(f => !fs.existsSync(ROOT + 'assets/' + f)), [], 'every shipped mod sprite file exists');
      eq(MODS.map(m => man.assets[`mod_badge_${m}`].pill_x), [0, 6, 6, 6, 6, 15, 15, 15, 6], 'badge pill offsets measured from the art');
      const oc6 = modArt({ shape: 'd6', special: 'overcharged', face: 9 });
      ok(/mod_overcharged_d6\.png/.test(oc6) && !/special_overcharged/.test(oc6) && badgeHTML({ shape: 'd6', special: 'overcharged', face: 9 }) === '', 'Overcharged d6 uses mod_overcharged_d6 (+3), not the old 4-9 sprites');
      ok(MODS.every(m => Object.keys(SHAPES_N).every(sh => new RegExp(`mod_${m}_${sh}\\.png`).test(modArt({ shape: sh, special: m, face: 1 })))), 'real manifest: per-shape sprite used for every mod on every shape'); }
    initArt({ assets: {} });
    const mk = modArtKeys(); eq(mk.length, 9 * 6 + 9 + 15, 'mod art keys: 54 per-shape overlays + 9 badges + 15 Overcharged faces');
    ok(mk.every(k => !requiredKeys().includes(k)), 'mod art keys stay optional (not in requiredKeys)');
    const doc = fs.readFileSync(ROOT + 'ASSETS.md', 'utf8'); ok(['mod_<mod>_<shape>', 'mod_badge_<mod>', 'die_d20_face23'].every(k => doc.includes(k)), 'ASSETS.md documents the mod art keys'); }
}

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
{ const ck = counterArtKeys(); ok(ck.length >= 10 && ck.every(k => !requiredKeys().includes(k)), 'counter art keys are listed separately from requiredKeys (CSS fallback without art)');
  const man = JSON.parse(fs.readFileSync(ROOT + 'assets/manifest.json', 'utf8'));
  eq(ck.filter(k => !man.assets[k]), [], 'active manifest covers every counter art key');
  const files = e => [e.src, ...Object.values(e.srcset || {}), ...(e.hc ? [e.hc.src, ...Object.values(e.hc.srcset || {})] : [])];
  eq(ck.flatMap(k => files(man.assets[k])).filter(f => !fs.existsSync(ROOT + man.base + f)), [], 'every counter sprite file exists in assets/');
  eq(ck.filter(k => !man.assets[k].hc), ['fx_link_glow_1', 'fx_link_glow_2', 'fx_link_glow_3'], 'counter keys have high-contrast twins (the pack has none for the glow)');
  eq([man.assets.die_bin4_body.bit_cells, man.assets.die_bin8_body.bit_cells.map(c => c[1])], [[[5, 11], [11, 11], [17, 11], [23, 11]], [5, 5, 5, 5, 14, 14, 14, 14]], 'bit_cells from the pack: 4-bit one row, 8-bit MSB nibble on top');
  const pngW = f => fs.readFileSync(ROOT + man.base + f).readUInt32BE(16), pngH = f => fs.readFileSync(ROOT + man.base + f).readUInt32BE(20);
  eq([pngW(man.assets.die_bin8_body.src), pngW(man.assets.led_bit_on.src), pngH(man.assets.led_bit_on.src), pngW(man.assets.counter_readout.src), pngW(man.assets.overlay_chain.src)], [64, 8, 14, 68, 84], 'counter sprite sizes at 1x (die 64, cell 8x14, readout 68, overlay 84)');
  const doc = fs.readFileSync(ROOT + 'ASSETS.md', 'utf8'); eq(ck.filter(k => !doc.includes(k)), [], 'ASSETS.md lists the counter art keys'); }

// --- Casino d12 / d20 and Odds & Evens
{ const { SPECIALS_BY_ID: SB, casinoFaceMult } = await import('../js/specials.js');
  const { faceArtKey, blankArtKey, rollArtKeys, faceLabel } = await import('../js/dice.js');
  const { exoticArtKeys, casinoArtKeys, parityArtKeys } = await import('../js/art.js');
  const { priceOf } = await import('../js/shop.js');
  const T = (face, special, shape, tag, uid = Math.random()) => ({ uid, shape, special, face, tag });
  const CZ = (tag, n = 12) => T(7, `casino${n}`, `d${n}`, tag);
  const PC = side => T(0, 'paritycoin', 'coin', side);
  // face sets
  const s12 = SB.casino12.sides('d12'), s20 = SB.casino20.sides('d20');
  eq([s12.length, s12.filter(x => !x.tag).length, s12.filter(x => x.tag).map(x => x.tag)], [12, 9, ['slot7', 'slot77', 'slot777']], 'casino d12: 9 plain 7s + 3 slot faces');
  eq([s20.length, s20.filter(x => !x.tag).length, s20.filter(x => x.tag).map(x => x.tag)], [20, 17, ['slot7', 'slot77', 'slot777']], 'casino d20: 17 plain 7s + 3 slot faces');
  ok([...s12, ...s20].every(x => x.v === 7), 'every casino face scores 7 points');
  eq(facesOf({ shape: 'd6', special: 'odds' }), [1, 3, 5, 7, 9, 11], 'odds d6 faces');
  eq(facesOf({ shape: 'd6', special: 'evens' }), [2, 4, 6, 8, 10, 12], 'evens d6 faces');
  eq(SB.paritycoin.sides().map(x => [x.v, x.tag]), [[0, 'odd'], [0, 'even']], 'parity coin: odd/even sides, 0 points');
  { const rng = makeRng(77), tags = {}, faces = new Set(), coin = {}, odd = new Set(), ev = new Set();
    const c = { shape: 'd12', special: 'casino12' }, pc = { shape: 'coin', special: 'paritycoin' }, o = { shape: 'd6', special: 'odds' }, e = { shape: 'd6', special: 'evens' };
    for (let i = 0; i < 6000; i++) { rollDie(c, rng); tags[c.tag || '7'] = (tags[c.tag || '7'] || 0) + 1; faces.add(c.face); rollDie(pc, rng); coin[pc.tag] = (coin[pc.tag] || 0) + 1; odd.add(rollDie(o, rng)); ev.add(rollDie(e, rng)); }
    eq([[...faces], Object.keys(tags).sort()], [[7], ['7', 'slot7', 'slot77', 'slot777']], 'casino rolls: always 7 points, every side shows up');
    ok(tags.slot777 > 400 && tags.slot777 < 600 && tags['7'] > 4300 && tags['7'] < 4700, `casino d12 slot faces 1/12 each, plain 9/12 (${JSON.stringify(tags)})`);
    ok(coin.odd > 2800 && coin.even > 2800, `parity coin is a fair flip (${JSON.stringify(coin)})`);
    eq([[...odd].sort((a, b) => a - b), [...ev].sort((a, b) => a - b)], [[1, 3, 5, 7, 9, 11], [2, 4, 6, 8, 10, 12]], 'odds/evens roll only their own faces'); }
  // casino mult (G: plain 7 = 7 points only; slot faces +7 / +14 / +21 mult, additive)
  { const r = scoreThrow([CZ(null), D(3)]); eq([r.points, r.mult, r.total], [10, 1, 10], 'plain casino 7: 7 points, no mult'); }
  { const r = scoreThrow([CZ('slot7'), D(3)]); eq([r.points, r.mult, r.total], [10, 8, 80], 'slot 7: +7 mult'); }
  { const r = scoreThrow([CZ('slot77', 20), D(3)]); eq([r.points, r.mult, r.total], [10, 15, 150], 'slot 77 (d20): +14 mult'); }
  { const r = scoreThrow([CZ('slot777'), D(3)]); const l = r.lines.find(x => x.who === 'Casino');
    eq([r.mult, r.total, l.jackpot, l.addMult], [22, 220, true, 21], 'slot 777: +21 mult and the JACKPOT flag'); }
  { const r = scoreThrow([CZ('slot777'), D(2, 'ruby')]); eq([r.mult, r.total], [33, 297], 'casino mult is additive, then later ×mult multiplies it (left to right)'); }
  { const r = scoreThrow([D(2, 'ruby'), CZ('slot777')]); eq([r.mult, r.total], [22.5, 202], 'order matters: ×1.5 first, then +21'); }
  { const r = scoreThrow([CZ('slot7'), CZ('slot777', 20)]); eq([r.points, r.mult, r.total], [14, 29, 406], 'two casino dice stack their mult'); }
  { const fm = BAL.casino.faceMult; BAL.casino.faceMult = { slot7: 1, slot77: 2, slot777: 3 }; BAL.casino.basePoints = 5;
    eq([casinoFaceMult('slot777'), SB.casino12.sides('d12')[0].v, scoreThrow([CZ('slot77')]).mult], [3, 5, 3], 'casino values come from balance.json');
    BAL.casino.faceMult = fm; BAL.casino.basePoints = 7; }
  // parity coin
  { const r = scoreThrow([PC('even'), D(2), D(3), D(4)]); const l = r.lines.find(x => x.parity);
    eq([r.points, r.mult, r.total, l.matches, l.parity], [9, 5, 45, [1, 3], 'even'], 'even coin: +2 mult per even die'); }
  { const r = scoreThrow([D(1), PC('odd'), D(3), D(4)]); eq([r.mult, r.lines.find(x => x.parity).matches], [5, [0, 2]], 'odd coin: +2 mult per odd die (either side of the coin)'); }
  { const r = scoreThrow([PC('odd'), D(2), D(4)]); eq([r.mult, r.total], [1, 6], 'no matching dice: no mult'); }
  { const r = scoreThrow([PC('even'), T(9, 'odds', 'd6'), T(12, 'evens', 'd6'), D(6, 'ruby')]); eq([r.points, r.mult, r.total], [27, 7.5, 202], 'even coin with Odds 9 / Evens 12 / Ruby 6: two even matches (1+4), then Ruby x1.5'); }
  { const r = scoreThrow([PC('even'), T(0, 'coin', 'coin'), T(10, 'coin', 'coin'), C('0110', 'counter4'), C('0000', 'counter4')]);
    eq(r.lines.find(x => x.parity).matches, [2, 3], 'zero counts as neither: Coin 0 and a 0 counter skipped; Coin 10 and counter 6 match'); }
  { const r = scoreThrow([PC('even'), C('0001', 'counter4'), C('0001', 'link4')]); eq([r.pts, r.lines.find(x => x.parity).matches, r.mult], [[0, 0, 17], [], 1], 'chains resolve first: an odd chain value (17) does not match even; members score 0'); }
  { const r = scoreThrow([D(5), T(1, 'echo', 'd6'), PC('odd')]); eq([r.pts, r.lines.find(x => x.parity).matches], [[5, 5, 0], [0, 1]], 'parity uses the scored value (Echo copy counts)'); }
  // multiple coins
  { const r = scoreThrow([PC('even'), D(2), PC('even'), D(4), D(5)]); const ls = r.lines.filter(x => x.parity);
    eq([ls.length, ls.map(l => l.matches), r.mult, r.total], [2, [[1, 3], [1, 3]], 9, 99], 'two even coins each apply (+2 x 2 each); coins never match each other'); }
  { const r = scoreThrow([PC('even'), D(2), PC('odd'), D(3), D(5)]); eq([r.lines.filter(x => x.parity).map(l => l.matches), r.mult], [[[1], [3, 4]], 7], 'an odd and an even coin each pay their own parity'); }
  // art keys
  eq([faceArtKey(CZ('slot777')), faceArtKey(CZ(null, 20)), blankArtKey(CZ(null)), faceArtKey(PC('even')), faceArtKey(T(11, 'odds', 'd6')), faceArtKey(T(12, 'evens', 'd6')), rollArtKeys(PC('odd')).length, faceLabel(CZ('slot77'))],
    ['die_casino_d12_slot777', 'die_casino_d20_7', 'die_casino_d12_blank', 'die_parity_coin_even', 'die_odds_d6_11', 'die_evens_d6_12', 8, '77'], 'face/blank/roll art keys for the new dice');
  { const xk = exoticArtKeys(); eq([casinoArtKeys().length, parityArtKeys().length], [41, 48], 'every Casino (41) and Odds & Evens (48) pack key is wired');
    ok(xk.every(k => !requiredKeys().includes(k)), 'exotic art keys kept apart from requiredKeys (CSS fallback without art)');
    const man = JSON.parse(fs.readFileSync(ROOT + 'assets/manifest.json', 'utf8'));
    eq(xk.filter(k => !man.assets[k]), [], 'active manifest covers every Casino / Odds & Evens key');
    eq(xk.filter(k => !man.assets[k].hc), [], 'every Casino / Odds & Evens key has its _hc twin');
    const files = e => [e.src, ...Object.values(e.srcset || {}), ...(e.hc ? [e.hc.src, ...Object.values(e.hc.srcset || {})] : [])];
    eq(xk.flatMap(k => files(man.assets[k])).filter(f => !fs.existsSync(ROOT + man.base + f)), [], 'every Casino / Odds & Evens sprite file ships in assets/');
    eq([man.assets.ui_parity_tag_odd_blank.textArea, man.assets.ui_parity_tag_even_blank.textArea], [[11, 2, 25, 8], [12, 2, 25, 8]], 'parity tag text areas from the pack');
    const doc = fs.readFileSync(ROOT + 'ASSETS.md', 'utf8'); eq(xk.filter(k => !doc.includes(k)), [], 'ASSETS.md lists the Casino / Odds & Evens keys'); }
  // shop: prices/rarity from balance.json, classic pool untouched, offered sometimes
  eq(['casino12', 'casino20'].map(id => [SB[id].rarity, SB[id].price, priceOf(SB[id].shape, id)]), Object.values(BAL.casino.dice).map(v => [v.rarity, v.price, v.price]), 'casino rarity/price come from balance.json');
  eq(['odds', 'evens', 'paritycoin'].map(id => [SB[id].rarity, SB[id].price]), Object.values(BAL.parity.dice).map(v => [v.rarity, v.price]), 'odds & evens rarity/price come from balance.json');
  { const seen = { casino: 0, parity: 0 }; for (let i = 0; i < 300; i++) { const run = newRun('cp-shop-' + i); run.round.score = 999; scoreNow(run); settleRound(run);
      for (let k = 0; k < 3; k++) { for (const o of run.shop.offers) { const sp = SB[o.special]; if (sp && sp.set) { seen[sp.set]++; if (o.price !== sp.price || o.shape !== sp.shape) seen.bad = 1; } } run.gold = 99; rerollShop(run); } }
    ok(seen.casino > 2 && seen.casino < seen.parity && !seen.bad, `shop offers Casino rarely, Odds & Evens more often, at balance prices (${JSON.stringify(seen)} in 900 shops)`); }
  { const { setBalance: sb } = await import('../js/balance.js'); sb({ ...BAL, casino: { ...BAL.casino, shopChance: 0 }, parity: { ...BAL.parity, shopChance: 0 } });
    let n = 0; for (let i = 0; i < 100; i++) { const run = newRun('cp-off-' + i); run.round.score = 999; scoreNow(run); settleRound(run); n += run.shop.offers.filter(o => SB[o.special] && SB[o.special].set).length; }
    sb(BAL); eq(n, 0, 'shopChance 0 switches a set off'); }
  // in a run: re-rolls, holds, the next draw, save/load, preview, determinism
  { const play = seed => { const run = newRun(seed, { demo: 'parity' }); const h = handDice(run), want = h.map((d, i) => i).filter(i => ['odds', 'evens', 'paritycoin'].includes(h[i].special));
      selectIndices(run, [...want, ...h.map((_, i) => i).filter(i => !want.includes(i))].slice(0, 5)); reveal(run); return run; };
    const a = play('pc-1'), b = play('pc-1');
    eq(handDice(a).map(d => [d.special, d.face, d.tag || null]), handDice(b).map(d => [d.special, d.face, d.tag || null]), 'same seed, same parity throw (faces and coin side)');
    const coinI = handDice(a).findIndex(d => d.special === 'paritycoin'); ok(coinI >= 0, 'parity coin lands on the table');
    const side = handDice(a)[coinI].tag; ok(side === 'odd' || side === 'even', 'rolled coin has a side');
    a.round.locked = a.round.locked.map((_, i) => i === coinI); reroll(a); reroll(a);
    eq(handDice(a)[coinI].tag, side, 'a held parity coin keeps its side through re-rolls');
    const copy = deserialize(serialize(a)); eq(copy.bag.find(d => d.special === 'paritycoin').tag, side, 'save/load keeps the coin side');
    a.round.target = 1e9; eq(preview(a).total, scoreCurrent(a).total, 'preview matches score with a parity coin');
    ok(a.round.hand.length && a.bag.filter(d => a.round.hand.includes(d.uid)).every(d => d.face === null && d.tag == null), 'the next draw clears faces and coin sides'); }
  { let flips = 0; for (let s = 0; s < 40; s++) { const run = newRun('pcf-' + s, { demo: 'parity' }); selectIndices(run, [0, 1, 2, 3, 4]); reveal(run);
      const c = handDice(run).find(d => d.special === 'paritycoin'); if (!c) continue; const t0 = c.tag; for (let k = 0; k < 2; k++) reroll(run); if (c.tag !== t0) flips++; }
    ok(flips > 0, `an unheld parity coin re-flips on a re-roll (${flips} of the sampled seeds changed side)`); }
  { const run = newRun('cz-1', { demo: 'casino' }), run2 = newRun('cz-1', { demo: 'casino' });
    for (const r of [run, run2]) { const h = handDice(r), cz = h.map((d, i) => i).filter(i => /casino/.test(h[i].special || '')); selectIndices(r, [...cz, ...h.map((_, i) => i).filter(i => !cz.includes(i))].slice(0, 5)); reveal(r); }
    eq(handDice(run).map(d => d.tag || d.face), handDice(run2).map(d => d.tag || d.face), 'same seed, same casino throw');
    const ci = handDice(run).findIndex(d => /casino/.test(d.special || '')); const t = handDice(run)[ci].tag;
    run.round.locked = run.round.locked.map((_, i) => i === ci); reroll(run); eq(handDice(run)[ci].tag, t, 'a held casino die keeps its slot face');
    eq(preview(run).total, scoreCurrent(run).total, 'preview matches score with casino dice'); }
  // demo seeds documented in the report
  { const pick = (seed, demo, want) => { const run = newRun(seed, { demo }); const h = handDice(run), idx = h.map((d, i) => i).filter(i => want.includes(h[i].special)); for (let i = 0; i < h.length && idx.length < 5; i++) if (!idx.includes(i)) idx.push(i); selectIndices(run, idx.slice(0, 5)); reveal(run); return run; };
    ok(handDice(pick('47', 'casino', ['casino12', 'casino20'])).filter(d => d.tag === 'slot777').length === 2, '?seed=47&demo=casino: both casino dice land on 777'); }
}

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
  eq(['icon_coin', 'icon_lock', 'ui_logo', 'bg_table_tile', 'bg_shop_tile', 'ui_btn_continue', 'ui_btn_endless'].filter(k => !man.assets[k].hc), [], 'new hc twins (coin, lock, logo, table/shop tiles) and continue/endless buttons have hc');
  eq(['ui_btn_continue', 'ui_btn_endless'].map(k => [man.assets[k].kind, Object.keys(man.assets[k].states).sort()]), [['button', ['disabled', 'pressed']], ['button', ['disabled', 'pressed']]], 'continue/endless are button skins with pressed/disabled');
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
