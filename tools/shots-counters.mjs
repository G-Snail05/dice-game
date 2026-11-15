// Binary counters: phone + desktop screenshots and a phone mp4 of a Link chain resolving.
// Needs playwright-core and Chrome; ffmpeg for mp4.
//   node tools/shots-counters.mjs http://127.0.0.1:8917/ /workspace/projects/dice-game/screenshots/counters [seed]
// The demo bag (?demo=counters) swaps three starting d6 for 4-bit, 4-bit and Link 4-bit counters. Seed 188987
// lands them as one 12-bit chain (1110 1010 1110 = 3758) whichever two d6 you pick with them.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/counters', SEED = process.argv[4] || '188987';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errs = [], notes = [];
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } } };

async function setup(p, name, extra = '') {
  p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && !/art: missing/.test(m.text()))) errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  await p.goto(`${BASE}?seed=${SEED}&demo=counters${extra}`); await p.waitForSelector('.r2'); await p.waitForLoadState('networkidle');
  await p.evaluate(() => { DG.state.run.round.target = 5000; DG.render(); });
}
const idle = p => p.waitForFunction(() => !DG.busy(), null, { timeout: 30000 });
const frozen = async (p, fn) => { await p.evaluate(() => document.getAnimations().forEach(a => a.pause())); await fn(); await p.evaluate(() => document.getAnimations().forEach(a => a.play())); };
// Pick the three counters plus the first two plain d6 in the hand.
const pickIdx = p => p.evaluate(() => { const r = DG.state.run, h = r.round.hand.map(u => r.bag.find(d => d.uid === u));
  const c = h.map((d, i) => (d.special ? i : -1)).filter(i => i >= 0), d6 = h.map((d, i) => (d.special ? -1 : i)).filter(i => i >= 0); return [...c, ...d6.slice(0, 2)]; });
const fits = async (p, name, when) => {
  const f = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  if (f.sh > f.ih || f.sw > f.iw) errs.push(`${name} ${when}: scrolls ${JSON.stringify(f)}`); else notes.push(`${name} ${when}: fits`);
};

for (const [name, opt] of Object.entries(sizes)) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  const shot = async n => { await p.screenshot({ path: `${OUT}/${name}-${n}.png` }); notes.push(`${name}-${n}.png`); };
  await setup(p, name);
  if ((await p.$$('.hand .ctr.dark')).length !== 3) errs.push(`${name}: expected 3 unrolled counters in hand`);
  await fits(p, name, 'hand'); await shot('01-hand-counters');
  for (const i of await pickIdx(p)) await p.click(`.die[data-act="pick"][data-i="${i}"]`);
  await shot('02-picked');
  await p.click('[data-act="roll"]'); await p.waitForSelector('body[data-anim="roll"]'); await p.waitForTimeout(380); await frozen(p, () => shot('03-bits-tumbling'));
  await idle(p); await p.waitForTimeout(150);
  const ch = await p.evaluate(() => { const r = DG.state.run.round; return r.hand.map(u => DG.state.run.bag.find(d => d.uid === u)).map(d => d.special || d.shape); });
  notes.push(`${name}: landing order ${ch.join(', ')}`);
  if ((await p.$$('.tslots .ctr .led')).length !== 12) errs.push(`${name}: expected 12 LEDs on the table`);
  const tally = await p.textContent('.tally'); if (!/Link/.test(tally)) errs.push(`${name}: preview has no Link line`);
  await fits(p, name, 'after roll'); await shot('04-landed-chain-preview');
  await p.evaluate(() => DG.setSpeed(3)); // slow the chain down so the stills land mid-motion
  await p.click('[data-act="score"]'); await p.waitForSelector('.chaintag .tag b:not(:empty)', { timeout: 15000 }); await p.waitForTimeout(700);
  await frozen(p, () => shot('05-chain-bracket'));
  await p.waitForSelector('.chainfly', { timeout: 15000 }); await p.waitForTimeout(500); await frozen(p, () => shot('06-chain-flying'));
  await p.evaluate(() => DG.setSpeed(1));
  await p.waitForSelector('body[data-anim="score-fly"]', { timeout: 15000 }); await p.waitForTimeout(150); await frozen(p, () => shot('07-total-flying'));
  await idle(p); await p.waitForTimeout(150);
  const last = await p.evaluate(() => DG.state.run.round.last); notes.push(`${name}: scored ${last.total} (chain ${last.chains.map(c => c.binary + '=' + c.value).join(', ')})`);
  if (!last.chains.length) errs.push(`${name}: no chain scored`);
  if (await p.$('.chaintag, .chainlink, .ctrglow')) errs.push(`${name}: chain pieces left behind`);
  await shot('08-after-score');
  // 8-bit counter on the table: LEDs must be uncropped 4x7 cells at bit_cells, 2 rows of 4, MSB nibble on top.
  await p.evaluate(() => { const r = DG.state.run; r.round.score = 0; const h = r.round.hand.map(u => r.bag.find(d => d.uid === u)); const d = h.find(x => !x.special); d.shape = 'bin8'; d.special = 'counter8'; DG.render(); });
  for (const i of await pickIdx(p)) await p.click(`.die[data-act="pick"][data-i="${i}"]`);
  await p.click('[data-act="roll"]'); await idle(p);
  // Show 10100110 (166) so both rows light: MSB nibble 1010 on top, LSB nibble 0110 below.
  await p.evaluate(() => { const d = DG.state.run.bag.find(x => x.shape === 'bin8'); d.bits = [1, 0, 1, 0, 0, 1, 1, 0]; d.face = 166; DG.render(); });
  await p.waitForTimeout(150);
  const geo = await p.evaluate(() => {
    const c = [...document.querySelectorAll('.tslots .ctr.b8')][0]; if (!c) return null;
    const R = c.getBoundingClientRect(), d = DG.state.run.bag.find(x => x.shape === 'bin8');
    const leds = [...c.querySelectorAll('.led')].map(l => { const r = l.getBoundingClientRect(), cs = getComputedStyle(l); return { bit: +l.dataset.bit, on: l.classList.contains('on'), x: Math.round((r.left - R.left) / R.width * 32 * 10) / 10, y: Math.round((r.top - R.top) / R.height * 32 * 10) / 10, w: r.width, h: r.height, size: cs.backgroundSize, radius: cs.borderRadius, shadow: cs.boxShadow, img: cs.backgroundImage.slice(0, 40) }; });
    return { w: R.width, bits: d.bits, face: d.face, leds };
  });
  if (!geo) errs.push(`${name}: no 8-bit counter on the table`);
  else {
    const want = [[5, 5], [11, 5], [17, 5], [23, 5], [5, 14], [11, 14], [17, 14], [23, 14]];
    const bad = geo.leds.filter((l, j) => Math.abs(l.x - want[j][0]) > 0.3 || Math.abs(l.y - want[j][1]) > 0.3 || Math.abs(l.w / l.h - 4 / 7) > 0.02 || l.size !== '100% 100%' || l.radius !== '0px' || l.shadow !== 'none' || l.on !== !!geo.bits[l.bit]);
    if (bad.length || geo.leds.length !== 8) errs.push(`${name}: 8-bit LED layout wrong ${JSON.stringify(bad)}`);
    else notes.push(`${name}: 8-bit ${geo.bits.join('')}=${geo.face} cells ok (${geo.leds[0].w}x${geo.leds[0].h}px, rows y=5/14 native, MSB nibble on top, bg ${geo.leds[0].img}...)`);
  }
  await shot('12-eight-bit');
  await p.evaluate(() => DG.setSpeed(0.25)); await p.click('[data-act="score"]'); await idle(p); await p.evaluate(() => DG.setSpeed(1));
  // Shop with counters on offer.
  await p.evaluate(() => { const run = DG.state.run; run.round.score = run.round.target - 1; DG.render(); });
  for (const i of [0, 1, 2, 3, 4]) await p.click(`.die[data-act="pick"][data-i="${i}"]`);
  await p.click('[data-act="roll"]'); await idle(p); await p.click('[data-act="score"]'); await idle(p);
  await p.waitForSelector('.shop');
  await p.evaluate(() => { const s = DG.state.run.shop; s.offers = [{ shape: 'bin4', special: 'link4', price: 5, sold: false }, { shape: 'bin8', special: 'counter8', price: 10, sold: false }, { shape: 'bin4', special: 'counter4', price: 4, sold: false }]; DG.state.run.gold = 12; DG.render(); });
  await p.waitForLoadState('networkidle'); await p.screenshot({ path: `${OUT}/${name}-09-shop-counters.png`, fullPage: true }); notes.push(`${name}-09-shop-counters.png`);
  // Title (Continue = ui_btn_continue, needs the saved run) and win screen (endless = ui_btn_endless).
  await p.evaluate(() => { DG.state.screen = 'title'; DG.render(); }); await p.waitForSelector('[data-act="continue"]'); await p.waitForLoadState('networkidle');
  if (!(await p.$('[data-act="continue"] img[data-key="ui_btn_continue"]'))) errs.push(`${name}: Continue does not use ui_btn_continue`);
  await p.screenshot({ path: `${OUT}/${name}-13-title.png`, fullPage: true }); notes.push(`${name}-13-title.png`);
  await p.click('[data-act="continue"]'); await p.waitForSelector('.shop');
  await p.evaluate(() => { DG.state.run.phase = 'win'; DG.render(); }); await p.waitForSelector('[data-act="endless"]'); await p.waitForLoadState('networkidle');
  if (!(await p.$('[data-act="endless"] img[data-key="ui_btn_endless"]'))) errs.push(`${name}: endless button does not use ui_btn_endless`);
  await p.screenshot({ path: `${OUT}/${name}-14-win-endless.png`, fullPage: true }); notes.push(`${name}-14-win-endless.png`);
  await p.evaluate(() => { DG.state.run.phase = 'shop'; DG.render(); });
  await p.click('[data-act="info"]'); await p.waitForSelector('.info'); await p.screenshot({ path: `${OUT}/${name}-10-info-counters.png`, fullPage: true }); notes.push(`${name}-10-info-counters.png`);
  await ctx.close();
  // High contrast + reduced motion: chain resolves instantly.
  const c2 = await b.newContext(opt), p2 = await c2.newPage();
  await p2.goto(BASE); await p2.evaluate(() => localStorage.setItem('diceGame.settings', JSON.stringify({ hc: true, reduceMotion: true })));
  await setup(p2, name + '-hc');
  for (const i of await pickIdx(p2)) await p2.click(`.die[data-act="pick"][data-i="${i}"]`);
  const t0 = Date.now(); await p2.click('[data-act="roll"]'); await idle(p2);
  await p2.screenshot({ path: `${OUT}/${name}-11-high-contrast.png` }); notes.push(`${name}-11-high-contrast.png`);
  await p2.click('[data-act="score"]'); await idle(p2);
  const ms = Date.now() - t0; notes.push(`${name}: reduced-motion roll+chain score took ${ms} ms`); if (ms > 2000) errs.push(`${name}: reduced motion not instant (${ms} ms)`);
  if (await p2.$('.chaintag, .chainlink')) errs.push(`${name}: chain shown under reduced motion`);
  await p2.evaluate(() => { DG.state.screen = 'title'; DG.render(); }); await p2.waitForSelector('[data-act="continue"]'); await p2.waitForLoadState('networkidle');
  await p2.screenshot({ path: `${OUT}/${name}-15-title-hc.png`, fullPage: true }); notes.push(`${name}-15-title-hc.png`);
  await p2.click('[data-act="continue"]'); await p2.waitForSelector('.r2');
  await p2.evaluate(() => { DG.state.run.phase = 'win'; DG.render(); }); await p2.waitForSelector('[data-act="endless"]'); await p2.waitForLoadState('networkidle');
  await p2.screenshot({ path: `${OUT}/${name}-16-win-endless-hc.png`, fullPage: true }); notes.push(`${name}-16-win-endless-hc.png`);
  await c2.close();
}

// Video: phone, pick the counters, roll (bits tumble + lock in), score (chain bracket, readout flies into points).
{
  const ctx = await b.newContext({ ...sizes.phone, deviceScaleFactor: 1, recordVideo: { dir: OUT + '/_video', size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  await setup(p, 'video'); await p.waitForTimeout(700);
  for (const i of await pickIdx(p)) { await p.click(`.die[data-act="pick"][data-i="${i}"]`); await p.waitForTimeout(260); }
  await p.waitForTimeout(400);
  await p.click('[data-act="roll"]'); await idle(p); await p.waitForTimeout(900);
  await p.click('[data-act="score"]'); await idle(p); await p.waitForTimeout(1200);
  const v = p.video(); await ctx.close();
  const webm = await v.path();
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/phone-chain-resolve.mp4`]);
    notes.push('phone-chain-resolve.mp4');
  } catch (e) { fs.copyFileSync(webm, `${OUT}/phone-chain-resolve.webm`); notes.push('phone-chain-resolve.webm (ffmpeg failed)'); }
  fs.rmSync(OUT + '/_video', { recursive: true, force: true });
}
await b.close();
console.log(notes.join('\n'));
console.log('errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
