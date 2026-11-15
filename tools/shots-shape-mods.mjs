// Modifiers on every shape: phone + desktop screenshots of the shop with modified non-d6 dice and a throw with them.
//   node tools/shots-shape-mods.mjs http://127.0.0.1:8917/ /workspace/projects/dice-game/screenshots/shape-mods
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/shape-mods';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errs = [], notes = [];
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } } };
const idle = p => p.waitForFunction(() => !DG.busy(), null, { timeout: 30000 });
const frozen = async (p, fn) => { await p.evaluate(() => document.getAnimations().forEach(a => a.pause())); await fn(); await p.evaluate(() => document.getAnimations().forEach(a => a.play())); };
// Hand: Ruby d12, Gold d10, Overcharged d20, Glass d4, Ember d8 (picked), plus two plain d6.
const HAND = [['d12', 'ruby'], ['d10', 'gold'], ['d20', 'overcharged'], ['d4', 'glass'], ['d8', 'ember']];

for (const [name, opt] of Object.entries(sizes)) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/art: missing/.test(m.text()))) errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  const shot = async (n, full = false) => { await p.screenshot({ path: `${OUT}/${name}-${n}.png`, fullPage: full }); notes.push(`${name}-${n}.png`); };
  await p.goto(BASE + '?seed=SHAPEMODS'); await p.waitForSelector('.r2'); await p.waitForLoadState('networkidle');
  // Shop: clear round 1, then show three modified non-d6 offers and a bag with modified dice.
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); });
  for (const i of [0, 1, 2, 3, 4]) await p.click(`.die[data-act="pick"][data-i="${i}"]`);
  await p.click('[data-act="roll"]'); await idle(p); await p.click('[data-act="score"]'); await idle(p); await p.waitForSelector('.shop');
  await p.evaluate(() => { const run = DG.state.run, price = (sh, s) => run.shop.offers && (DG.priceOf ? DG.priceOf(sh, s) : 0);
    run.shop.offers = [['d20', 'glass'], ['d12', 'gold'], ['d4', 'overcharged']].map(([shape, special]) => ({ shape, special, price: ({ d4: 1, d6: 2, d8: 3, d10: 4, d12: 5, d20: 7 })[shape] + 2, sold: false }));
    run.gold = 15; DG.render(); });
  await p.waitForLoadState('networkidle');
  const offers = await p.$$eval('.offer .otext', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  notes.push(`${name} offers: ${offers.join(' | ')}`);
  if (!offers[1].includes('12 or more') || !offers[2].includes('4–7')) errs.push(`${name}: shape-specific desc missing`);
  await shot('01-shop-modified-shapes', true);
  // Buy the d12 Gold to show it in the bag list.
  await p.click('[data-act="buy"][data-i="1"]'); await p.waitForTimeout(150); await shot('02-shop-bought', true);
  await p.click('[data-act="next"]'); await p.waitForSelector('.r2');
  // Throw: put five modified dice of different shapes into the hand.
  await p.evaluate(hand => { const run = DG.state.run, h = run.round.hand.map(u => run.bag.find(d => d.uid === u));
    hand.forEach(([shape, special], i) => { h[i].shape = shape; h[i].special = special; h[i].cost = 0; });
    for (let i = hand.length; i < h.length; i++) { h[i].shape = 'd6'; h[i].special = null; }
    run.round.target = 2000; DG.render(); }, HAND);
  await p.waitForLoadState('networkidle'); await shot('03-hand-modified-shapes');
  for (const i of [0, 1, 2, 3, 4]) await p.click(`.die[data-act="pick"][data-i="${i}"]`);
  await p.click('[data-act="roll"]'); await idle(p); await p.waitForTimeout(200);
  const lines = await p.$$eval('.tally li', els => els.map(e => e.textContent.trim()));
  notes.push(`${name} throw: ${lines.join(' / ')}`);
  await shot('04-throw-modified-shapes');
  await p.evaluate(() => DG.setSpeed(2));
  await p.click('[data-act="score"]'); await p.waitForSelector('body[data-anim="score-pop"]'); await p.waitForTimeout(3600); await frozen(p, () => shot('05-scoring'));
  await p.evaluate(() => DG.setSpeed(1)); await idle(p);
  const last = await p.evaluate(() => DG.state.run.round.last); notes.push(`${name} scored ${last.total} (+$${last.gold})`);
  await p.click('[data-act="info"]'); await p.waitForSelector('.info'); await shot('06-info', true);
  await ctx.close();
}
await b.close();
console.log(notes.join('\n'));
console.log('errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
