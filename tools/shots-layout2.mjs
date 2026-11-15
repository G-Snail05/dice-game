// Layout 2 screenshots + video. Needs playwright-core and Chrome; ffmpeg optional (mp4/gif).
//   node tools/shots-layout2.mjs http://127.0.0.1:8917/ /workspace/projects/dice-game/screenshots/layout2
// Mid-animation frames are captured by waiting on <body data-anim="roll|score-pop|score-fly">.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/layout2';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errs = [], notes = [];
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } } };

async function setup(p, name) {
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  await p.goto(BASE + '?seed=LAYOUT2'); await p.waitForSelector('.r2'); await p.waitForLoadState('networkidle');
  // Showcase: Ruby on die 1, Matching on die 3 (same face as die 2), Gold on die 4.
  await p.evaluate(() => { const r = DG.state.run, h = r.round.hand.map(u => r.bag.find(d => d.uid === u));
    h[1].special = 'ruby'; h[3].special = 'matching'; h[3].face = h[2].face; h[4].special = 'gold'; h[4].face = 6; r.round.target = 300; DG.render(); });
  await p.waitForLoadState('networkidle');
}
const idle = p => p.waitForFunction(() => !DG.busy(), null, { timeout: 20000 });
const click = (p, sel) => p.click(sel);
// Freeze every running Web Animation at its current point for a clean mid-animation frame, then resume.
const frozen = async (p, fn) => { await p.evaluate(() => document.getAnimations().forEach(a => a.pause())); await fn(); await p.evaluate(() => document.getAnimations().forEach(a => a.play())); };

for (const [name, opt] of Object.entries(sizes)) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  const shot = async (n, full = false) => { await p.screenshot({ path: `${OUT}/${name}-${n}.png`, fullPage: full }); notes.push(`${name}-${n}.png`); };
  await setup(p, name);
  const fit = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  if (fit.sh > fit.ih || fit.sw > fit.iw) errs.push(`${name}: round screen scrolls ${JSON.stringify(fit)}`);
  const small = await p.$$eval('button:not([disabled])', els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.getAttribute('aria-label') || e.textContent.trim(), r.width, r.height]; }).filter(x => x[1] < 44 || x[2] < 44));
  if (small.length) errs.push(`${name}: small tap targets ${JSON.stringify(small)}`);
  await shot('01-before-roll');
  await click(p, '[data-act="roll"]'); await p.waitForSelector('body[data-anim="roll"]'); await p.waitForTimeout(300); await frozen(p, () => shot('02-mid-roll'));
  await idle(p); await p.waitForTimeout(100); await shot('03-after-roll');
  for (const i of [1, 2, 3]) { await click(p, `.die[data-i="${i}"]`); await idle(p); }
  await p.waitForTimeout(100); await shot('04-held');
  await click(p, '[data-act="reroll"]'); await p.waitForSelector('body[data-anim="roll"]'); await p.waitForTimeout(250); await frozen(p, () => shot('05-mid-reroll')); await idle(p);
  const before = await p.textContent('#barPoints');
  await click(p, '[data-act="score"]'); await p.waitForSelector('body[data-anim="score-pop"]'); await p.waitForTimeout(1500); await frozen(p, () => shot('06-scoring'));
  await p.evaluate(() => DG.setSpeed(8)); // slow-mo so the flight can be caught mid-air
  await p.waitForSelector('body[data-anim="score-fly"]'); await p.waitForSelector('.flying'); await p.waitForTimeout(1500); await frozen(p, () => shot('07-total-flying'));
  await p.evaluate(() => DG.setSpeed(1));
  await idle(p); await p.waitForTimeout(150); await shot('08-after-score');
  const after = await p.textContent('#barPoints'), want = await p.evaluate(() => String(DG.state.run.round.score));
  if (after !== want || after === before) errs.push(`${name}: bar points ${before} -> ${after}, state ${want}`);
  // Clear the round to reach the shop.
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); });
  await click(p, '[data-act="roll"]'); await idle(p); await click(p, '[data-act="score"]'); await idle(p);
  await p.waitForSelector('.shop'); await p.waitForLoadState('networkidle'); await shot('09-shop', true);
  // Reduced motion: the whole roll + score resolves instantly.
  await click(p, '[data-act="next"]'); await p.waitForSelector('.r2');
  await p.evaluate(() => { DG.state.settings.reduceMotion = true; localStorage.setItem('diceGame.settings', JSON.stringify(DG.state.settings)); });
  await p.goto(BASE); await p.waitForSelector('[data-act="continue"]'); await click(p, '[data-act="continue"]'); await p.waitForSelector('.r2');
  const t0 = Date.now(); await click(p, '[data-act="roll"]'); await idle(p); await click(p, '[data-act="score"]'); await idle(p);
  const ms = Date.now() - t0; notes.push(`${name}: reduced-motion roll+score took ${ms} ms`); if (ms > 1500) errs.push(`${name}: reduced motion not instant (${ms} ms)`);
  await ctx.close();
}

// Video: phone-size roll + hold + re-roll + score.
{
  const ctx = await b.newContext({ ...sizes.phone, deviceScaleFactor: 1, recordVideo: { dir: OUT + '/_video', size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  await setup(p, 'video'); await p.waitForTimeout(600);
  await click(p, '[data-act="roll"]'); await idle(p); await p.waitForTimeout(400);
  for (const i of [1, 2, 3]) { await click(p, `.die[data-i="${i}"]`); await idle(p); await p.waitForTimeout(150); }
  await click(p, '[data-act="reroll"]'); await idle(p); await p.waitForTimeout(400);
  await click(p, '[data-act="score"]'); await idle(p); await p.waitForTimeout(900);
  const v = p.video(); await ctx.close();
  const webm = await v.path();
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${OUT}/phone-roll-and-score.mp4`]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'fps=15,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', `${OUT}/phone-roll-and-score.gif`]);
    notes.push('phone-roll-and-score.mp4', 'phone-roll-and-score.gif');
  } catch (e) { fs.copyFileSync(webm, `${OUT}/phone-roll-and-score.webm`); notes.push('phone-roll-and-score.webm (ffmpeg failed)'); }
  fs.rmSync(OUT + '/_video', { recursive: true, force: true });
}
await b.close();
console.log(notes.join('\n'));
console.log('errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
