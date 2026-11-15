// Layout 3 (draw 7, pick 5) screenshots + phone video. Needs playwright-core and Chrome; ffmpeg for mp4.
//   node tools/shots-layout3.mjs http://127.0.0.1:8917/ /workspace/projects/dice-game/screenshots/layout3
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/layout3';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errs = [], notes = [];
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } } };
const PICKS = [0, 1, 3, 5, 6]; // leaves plain d6s at 2 (top row) and 4 (bottom row)

async function setup(p, name) {
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  await p.goto(BASE + '?seed=LAYOUT3'); await p.waitForSelector('.r2'); await p.waitForLoadState('networkidle');
  // Showcase hand: Ruby (1), Matching (3), Gold (5), a d10 (6); the rest plain d6.
  await p.evaluate(() => { const r = DG.state.run, h = r.round.hand.map(u => r.bag.find(d => d.uid === u));
    h[1].special = 'ruby'; h[3].special = 'matching'; h[5].special = 'gold'; h[6].shape = 'd10'; r.round.target = 400; DG.render(); });
  await p.waitForLoadState('networkidle');
}
const idle = p => p.waitForFunction(() => !DG.busy(), null, { timeout: 20000 });
const pick = (p, i) => p.click(`.die[data-act="pick"][data-i="${i}"]`);
const frozen = async (p, fn) => { await p.evaluate(() => document.getAnimations().forEach(a => a.pause())); await fn(); await p.evaluate(() => document.getAnimations().forEach(a => a.play())); };
const fits = async (p, name, when) => {
  const f = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  if (f.sh > f.ih || f.sw > f.iw) errs.push(`${name} ${when}: scrolls ${JSON.stringify(f)}`); else notes.push(`${name} ${when}: fits ${f.iw}x${f.ih} (scroll ${f.sw}x${f.sh})`);
  const small = await p.$$eval('button:not([disabled])', els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.getAttribute('aria-label') || e.textContent.trim(), r.width, r.height]; }).filter(x => x[1] < 44 || x[2] < 44));
  if (small.length) errs.push(`${name} ${when}: small tap targets ${JSON.stringify(small)}`);
};
const rollDisabled = p => p.$eval('[data-act="roll"]', e => e.disabled);
const hand = p => p.evaluate(() => ({ hand: DG.state.run.round.hand.length, bench: (DG.state.run.round.bench || []).length, revealed: DG.state.run.round.revealed }));

for (const [name, opt] of Object.entries(sizes)) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  const shot = async n => { await p.screenshot({ path: `${OUT}/${name}-${n}.png` }); notes.push(`${name}-${n}.png`); };
  await setup(p, name);
  if ((await p.$$('.hand .die[data-act="pick"]')).length !== 7) errs.push(`${name}: expected 7 dice in hand`);
  if (!(await rollDisabled(p))) errs.push(`${name}: roll enabled with 0 picked`);
  await fits(p, name, 'hand of 7'); await shot('01-hand-of-7');
  for (const i of PICKS.slice(0, 3)) await pick(p, i);
  if (!(await rollDisabled(p))) errs.push(`${name}: roll enabled with 3 picked`);
  if (!(await p.textContent('.pickcount')).includes('3/5')) errs.push(`${name}: counter not 3/5`);
  await shot('02-three-selected');
  for (const i of PICKS.slice(3)) await pick(p, i);
  await pick(p, 2); // a sixth pick must be refused
  if ((await p.$$('.die.picked')).length !== 5) errs.push(`${name}: sixth pick was accepted`);
  if (await rollDisabled(p)) errs.push(`${name}: roll disabled with 5 picked`);
  await fits(p, name, '5 selected'); await shot('03-five-selected');
  await p.click('[data-act="roll"]'); await p.waitForSelector('body[data-anim="roll"]'); await p.waitForTimeout(300); await frozen(p, () => shot('04-mid-roll'));
  await idle(p);
  // Showcase: make the Matching die match another rolled die so its effect fires.
  await p.evaluate(() => { const r = DG.state.run, h = r.round.hand.map(u => r.bag.find(d => d.uid === u)); const m = h.find(d => d.special === 'matching'); const o = h.find(d => !d.special && d !== m); if (m && o) m.face = Math.min(o.face, 6); DG.render(); });
  await p.waitForTimeout(150);
  const h = await hand(p); if (h.hand !== 5 || h.bench !== 2 || !h.revealed) errs.push(`${name}: after roll ${JSON.stringify(h)}`);
  if ((await p.$$('.tslots .die')).length !== 5 || (await p.$$('.bench .die.benched')).length !== 2) errs.push(`${name}: expected 5 on table and 2 benched`);
  await fits(p, name, 'after roll'); await shot('05-after-roll-2-left');
  await p.click('.die[data-act="lock"][data-i="0"]'); await idle(p); await p.waitForTimeout(100); await shot('06-one-held');
  await p.click('.die[data-act="lock"][data-i="0"]'); await idle(p);
  const before = await p.textContent('#barPoints');
  await p.click('[data-act="score"]'); await p.waitForSelector('body[data-anim="score-pop"]'); await p.waitForTimeout(1500); await frozen(p, () => shot('07-scoring'));
  const scored = await p.evaluate(() => DG.state.run.round.last?.pts?.length); if (scored !== 5) errs.push(`${name}: scored ${scored} dice, expected 5`);
  await p.evaluate(() => DG.setSpeed(8));
  await p.waitForSelector('.flying'); await p.waitForTimeout(1500); await frozen(p, () => shot('08-total-flying'));
  await p.evaluate(() => DG.setSpeed(1));
  await idle(p); await p.waitForTimeout(150);
  const after = await p.textContent('#barPoints'); if (after === before) errs.push(`${name}: bar points did not change`);
  const h2 = await hand(p); if (h2.hand !== 7 || h2.revealed) errs.push(`${name}: next throw ${JSON.stringify(h2)}`);
  await fits(p, name, 'next throw'); await shot('09-next-throw-7');
  // Clear the round to reach the shop.
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); });
  for (const i of [0, 1, 2, 3, 4]) await pick(p, i);
  await p.click('[data-act="roll"]'); await idle(p); await p.click('[data-act="score"]'); await idle(p);
  await p.waitForSelector('.shop'); await p.waitForLoadState('networkidle'); await p.screenshot({ path: `${OUT}/${name}-10-shop.png`, fullPage: true }); notes.push(`${name}-10-shop.png`);
  // Reduced motion: pick + roll + score resolves instantly.
  await p.click('[data-act="next"]'); await p.waitForSelector('.r2');
  await p.evaluate(() => { DG.state.settings.reduceMotion = true; localStorage.setItem('diceGame.settings', JSON.stringify(DG.state.settings)); });
  await p.goto(BASE); await p.waitForSelector('[data-act="continue"]'); await p.click('[data-act="continue"]'); await p.waitForSelector('.r2');
  const t0 = Date.now(); for (const i of [0, 1, 2, 3, 4]) await pick(p, i);
  await p.click('[data-act="roll"]'); await idle(p); await p.click('[data-act="score"]'); await idle(p);
  const ms = Date.now() - t0; notes.push(`${name}: reduced-motion pick+roll+score took ${ms} ms`); if (ms > 2000) errs.push(`${name}: reduced motion not instant (${ms} ms)`);
  await ctx.close();
}

// Video: phone-size pick 5 of 7, roll, hold, re-roll, score.
{
  const ctx = await b.newContext({ ...sizes.phone, deviceScaleFactor: 1, recordVideo: { dir: OUT + '/_video', size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  await setup(p, 'video'); await p.waitForTimeout(700);
  for (const i of PICKS) { await pick(p, i); await p.waitForTimeout(280); }
  await p.waitForTimeout(400);
  await p.click('[data-act="roll"]'); await idle(p); await p.waitForTimeout(500);
  for (const i of [1, 2]) { await p.click(`.die[data-act="lock"][data-i="${i}"]`); await idle(p); await p.waitForTimeout(200); }
  await p.click('[data-act="reroll"]'); await idle(p); await p.waitForTimeout(500);
  await p.click('[data-act="score"]'); await idle(p); await p.waitForTimeout(1000);
  const v = p.video(); await ctx.close();
  const webm = await v.path();
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/phone-select-roll-score.mp4`]);
    notes.push('phone-select-roll-score.mp4');
  } catch (e) { fs.copyFileSync(webm, `${OUT}/phone-select-roll-score.webm`); notes.push('phone-select-roll-score.webm (ffmpeg failed)'); }
  fs.rmSync(OUT + '/_video', { recursive: true, force: true });
}
await b.close();
console.log(notes.join('\n'));
console.log('errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
