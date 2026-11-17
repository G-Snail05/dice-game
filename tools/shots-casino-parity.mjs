// Casino d12/d20 + Odds & Evens: phone + desktop screenshots, a 360px phone jackpot fit check, and a phone mp4 of the JACKPOT.
//   node tools/shots-casino-parity.mjs http://127.0.0.1:8917/ /workspace/projects/dice-game/screenshots/casino-parity
// Needs playwright-core and Chrome; ffmpeg for the mp4.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/casino-parity';
fs.mkdirSync(OUT, { recursive: true });
const CASINO_SEED = '37', PARITY_SEED = '16';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errs = [], notes = [];
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } } };
const idle = p => p.waitForFunction(() => !DG.busy(), null, { timeout: 30000 });
const setSetting = (p, key, on) => p.evaluate(([key, on]) => { const app = document.getElementById('app') || document.body.firstElementChild;
  const el = Object.assign(document.createElement('input'), { type: 'checkbox', checked: on }); el.dataset.setting = key; el.hidden = true;
  app.append(el); el.dispatchEvent(new Event('change', { bubbles: true })); el.remove(); }, [key, on]);
const frozen = async (p, fn) => { await p.evaluate(() => document.getAnimations().forEach(a => a.pause())); await fn(); await p.evaluate(() => document.getAnimations().forEach(a => a.play())); };
// Pick the set's dice first, then the leftmost others (same rule as tools/casino-parity-stats.mjs SEEDS=1).
const pickIdx = (p, want) => p.evaluate(want => { const run = DG.state.run, h = run.round.hand.map(u => run.bag.find(d => d.uid === u));
  const idx = h.map((d, i) => i).filter(i => want.includes(h[i].special)); for (let i = 0; i < h.length && idx.length < 5; i++) if (!idx.includes(i)) idx.push(i); return idx.slice(0, 5); }, want);
const brokenImgs = p => p.$$eval('img.art', ims => ims.filter(i => i.complete && !i.naturalWidth).map(i => i.dataset.key));
const overlaps = (p, sel) => p.$$eval(sel, els => { const r = els.map(e => e.getBoundingClientRect()), out = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) out.push([i, j]); return out; });
async function startDemo(p, seed, demo, want, target = 99999) {
  await p.goto(`${BASE}?seed=${seed}&demo=${demo}`); await p.waitForSelector('.r2'); await p.waitForLoadState('networkidle');
  await p.evaluate(t => { DG.state.run.round.target = t; DG.render(); }, target);
  for (const i of await pickIdx(p, want)) await p.click(`.die[data-act="pick"][data-i="${i}"]`);
}

for (const [name, opt] of Object.entries(sizes)) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/art: missing/.test(m.text()))) errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  const shot = async (n, full = false) => { await p.screenshot({ path: `${OUT}/${name}-${n}.png`, fullPage: full }); notes.push(`${name}-${n}.png`); };
  // Shop: clear round 1 normally, then show the new items.
  await p.goto(BASE + '?seed=CASINOSHOP'); await p.waitForSelector('.r2'); await p.waitForLoadState('networkidle');
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); });
  for (const i of [0, 1, 2, 3, 4]) await p.click(`.die[data-act="pick"][data-i="${i}"]`);
  await p.click('[data-act="roll"]'); await idle(p); await p.click('[data-act="score"]'); await idle(p); await p.waitForSelector('.shop');
  const setOffers = (list, gold) => p.evaluate(([list, gold]) => { const run = DG.state.run; run.shop.offers = list.map(([shape, special, price]) => ({ shape, special, price, sold: false })); run.gold = gold; DG.render(); }, [list, gold]);
  const prices = await p.evaluate(async () => { const m = await import('./js/specials.js'); return Object.fromEntries(['casino12', 'casino20', 'odds', 'evens', 'paritycoin'].map(id => [id, m.SPECIALS_BY_ID[id].price])); });
  await setOffers([['d12', 'casino12', prices.casino12], ['d20', 'casino20', prices.casino20], ['d6', 'odds', prices.odds]], 20);
  await p.waitForLoadState('networkidle'); await shot('01-shop-casino-d12-d20-odds', true);
  await setOffers([['d6', 'evens', prices.evens], ['coin', 'paritycoin', prices.paritycoin], ['d12', 'casino12', prices.casino12]], 10);
  await p.waitForLoadState('networkidle'); await shot('02-shop-evens-paritycoin-unaffordable-casino', true);
  notes.push(`${name} offers: ${(await p.$$eval('.offer .otext', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | ')}`);
  await setSetting(p, 'hc', true); await p.waitForLoadState('networkidle'); await p.waitForTimeout(150); await shot('02b-shop-high-contrast', true); await setSetting(p, 'hc', false);
  const bi = await brokenImgs(p); if (bi.length) errs.push(`${name}: broken shop art ${bi}`);

  // Casino: hand, throw with a 777, breakdown, jackpot mid-animation, after.
  await startDemo(p, CASINO_SEED, 'casino', ['casino12', 'casino20']);
  await p.waitForLoadState('networkidle'); await shot('03-casino-hand-picked');
  await p.click('[data-act="roll"]'); await idle(p); await p.waitForTimeout(200);
  const ctags = await p.evaluate(() => DG.state.run.round.hand.map(u => DG.state.run.bag.find(d => d.uid === u)).filter(d => /casino/.test(d.special || '')).map(d => d.tag || '7'));
  notes.push(`${name} casino tags: ${ctags.join(', ')}`); if (!ctags.includes('slot777')) errs.push(`${name}: casino seed has no 777`);
  notes.push(`${name} casino breakdown: ${(await p.$$eval('.tally li', els => els.map(e => e.textContent.trim()))).join(' / ')}`);
  await shot('04-casino-throw-777-breakdown');
  await p.evaluate(() => DG.setSpeed(2));
  await p.click('[data-act="score"]'); await p.waitForSelector('body[data-anim="jackpot"]', { timeout: 20000 });
  await p.waitForTimeout(500); await frozen(p, () => shot('05-jackpot-burst'));
  await p.waitForSelector('.jp-rays[style*="opacity: 1"]', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(300);
  const jp = await p.$$eval('.jp', els => els.map(e => { const r = e.getBoundingClientRect(); return [e.className, Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)]; }));
  notes.push(`${name} jackpot layers: ${JSON.stringify(jp)}`);
  const vw = await p.evaluate(() => innerWidth); if (jp.some(([, l, r, t]) => l < 0 || r > vw || t < 0)) errs.push(`${name}: jackpot off screen ${JSON.stringify(jp)}`);
  await frozen(p, () => shot('06-jackpot-banner-rays'));
  await p.evaluate(() => DG.setSpeed(1)); await idle(p);
  const last = await p.evaluate(() => DG.state.run.round.last); notes.push(`${name} casino scored ${last.points} x ${last.mult} = ${last.total}`);
  if (await p.$('.jp')) errs.push(`${name}: jackpot layers left behind`);

  // Parity: throw with matches highlighted (tags), the pulse while scoring, high contrast.
  await startDemo(p, PARITY_SEED, 'parity', ['odds', 'evens', 'paritycoin']);
  await p.click('[data-act="roll"]'); await idle(p); await p.waitForTimeout(200);
  const tags = await p.$$eval('.r2 .partag', els => els.map(e => e.textContent.trim())); notes.push(`${name} parity tags: ${tags.join(', ')}`);
  if (!tags.length) errs.push(`${name}: no parity tags`);
  const ov = await overlaps(p, '.r2 .partag'); if (ov.length) errs.push(`${name}: parity tags overlap ${JSON.stringify(ov)}`);
  const ovb = await p.$$eval('.r2 .table .die', dies => { const out = []; dies.forEach((d, i) => { const t = d.querySelector('.partag'); if (!t) return; const r = t.getBoundingClientRect();
    dies.forEach((o, j) => { if (j === i) return; const q = o.getBoundingClientRect(); if (r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1) out.push([i, j]); }); }); return out; });
  if (ovb.length) errs.push(`${name}: parity tag over a neighbouring die ${JSON.stringify(ovb)}`);
  notes.push(`${name} parity breakdown: ${(await p.$$eval('.tally li', els => els.map(e => e.textContent.trim()))).join(' / ')}`);
  await shot('07-parity-throw-matches-tagged');
  await setSetting(p, 'hc', true); await p.waitForLoadState('networkidle'); await p.waitForTimeout(150);
  const hcSrc = await p.$$eval('.r2 .table .die-art, .r2 .partag-img', im => im.map(i => i.currentSrc).filter(s => /parity|odds|evens/.test(s)));
  if (!hcSrc.length || !hcSrc.every(s => /_hc\.png/.test(s))) errs.push(`${name}: hc parity sprites not used`);
  await shot('08-parity-high-contrast'); await setSetting(p, 'hc', false); await p.waitForTimeout(150);
  await p.evaluate(() => DG.setSpeed(3));
  await p.click('[data-act="score"]'); await p.waitForSelector('.pmpulse', { timeout: 20000 }); await p.waitForTimeout(250); await frozen(p, () => shot('09-parity-scoring-pulse'));
  await p.evaluate(() => DG.setSpeed(1)); await idle(p);
  const pl = await p.evaluate(() => DG.state.run.round.last); notes.push(`${name} parity scored ${pl.points} x ${pl.mult} = ${pl.total}`);
  await p.click('[data-act="info"]'); await p.waitForSelector('.info'); await p.waitForLoadState('networkidle'); await shot('10-info', true);
  const bi2 = await brokenImgs(p); if (bi2.length) errs.push(`${name}: broken art ${bi2}`);
  await ctx.close();
}

// 360px phone: the jackpot burst and banner must fit; parity tags must not overlap.
{
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), p = await ctx.newPage();
  await startDemo(p, CASINO_SEED, 'casino', ['casino12', 'casino20']); await p.click('[data-act="roll"]'); await idle(p);
  await p.evaluate(() => DG.setSpeed(2)); await p.click('[data-act="score"]'); await p.waitForSelector('body[data-anim="jackpot"]', { timeout: 20000 });
  await p.waitForSelector('.jp-rays[style*="opacity: 1"]', { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(250);
  const jp = await p.$$eval('.jp', els => els.map(e => { const r = e.getBoundingClientRect(); return [e.className, Math.round(r.left), Math.round(r.right), Math.round(r.width)]; }));
  notes.push(`phone360 jackpot layers: ${JSON.stringify(jp)}`); if (!jp.length || jp.some(([, l, r]) => l < 0 || r > 360)) errs.push(`phone360: jackpot does not fit ${JSON.stringify(jp)}`);
  await frozen(p, () => p.screenshot({ path: `${OUT}/phone360-06-jackpot-fit.png` })); notes.push('phone360-06-jackpot-fit.png');
  await p.evaluate(() => DG.setSpeed(1)); await idle(p);
  await startDemo(p, PARITY_SEED, 'parity', ['odds', 'evens', 'paritycoin']); await p.click('[data-act="roll"]'); await idle(p);
  const ov = await overlaps(p, '.r2 .partag'); if (ov.length) errs.push(`phone360: parity tags overlap ${JSON.stringify(ov)}`);
  await p.screenshot({ path: `${OUT}/phone360-07-parity-tags.png` }); notes.push('phone360-07-parity-tags.png');
  await ctx.close();
}

// Video: phone, roll the casino dice and score the 777 (burst, banner drop, rays, fade).
{
  const ctx = await b.newContext({ ...sizes.phone, deviceScaleFactor: 1, recordVideo: { dir: OUT + '/_video', size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  await startDemo(p, CASINO_SEED, 'casino', ['casino12', 'casino20']); await p.waitForTimeout(600);
  await p.click('[data-act="roll"]'); await idle(p); await p.waitForTimeout(800);
  await p.click('[data-act="score"]'); await idle(p); await p.waitForTimeout(800);
  const v = p.video(); await ctx.close();
  const webm = await v.path();
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/phone-jackpot.mp4`]);
    notes.push('phone-jackpot.mp4');
  } catch (e) { fs.copyFileSync(webm, `${OUT}/phone-jackpot.webm`); notes.push('phone-jackpot.webm (ffmpeg failed)'); }
  fs.rmSync(OUT + '/_video', { recursive: true, force: true });
}
await b.close();
console.log(notes.join('\n'));
console.log('errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
