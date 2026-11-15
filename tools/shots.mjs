// Headless screenshots + smoke test. Needs playwright-core and a Chrome/Chromium binary:
//   CHROME=/opt/google/chrome/chrome node tools/shots.mjs http://127.0.0.1:8917/ /tmp/shots
// Uses window.DG (debug hook) only to fast-forward to the shop / win / lose screens.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/dice-shots';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errs = [], small = new Set();
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } } };
for (const [name, opt] of Object.entries(sizes)) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  const shot = async (n, full = true) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}-${n}.png`, fullPage: full }); console.log('shot', `${OUT}/${name}-${n}.png`); };
  const checkTaps = async n => { for (const s of await p.$$eval('button, summary, input', els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 30) || e.tagName, Math.round(r.width), Math.round(r.height)]; })))
    if (s[1] < 44 || s[2] < 44) small.add(`${name}/${n}: "${s[0]}" ${s[1]}x${s[2]}`); };
  const act = async (a, extra = '') => { await p.click(`[data-act="${a}"]${extra}`); };
  await p.goto(BASE); await p.waitForSelector('.title'); await shot('01-title'); await checkTaps('title');
  await act('new'); await p.waitForSelector('.round');
  // Showcase: give the drawn dice a few specials so badges and the breakdown are visible.
  await p.evaluate(() => { const r = DG.state.run, h = r.round.hand.map(u => r.bag.find(d => d.uid === u)); h[1].special = 'ruby'; h[3].special = 'matching'; h[3].face = h[2].face; h[4].special = 'echo'; DG.render(); });
  await act('lock', '[data-i="1"]'); await act('lock', '[data-i="3"]'); await shot('02-round'); await checkTaps('round');
  await act('reroll'); await p.evaluate(() => { DG.state.run.round.target = 999; }); await act('score'); await shot('03-round-after-score');
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); });
  await act('score'); await p.waitForSelector('.shop'); await p.evaluate(() => { DG.state.run.gold = 9; DG.render(); });
  await p.click('.sell summary'); await shot('04-shop'); await checkTaps('shop');
  await act('buy', '[data-i="0"]');
  const bagAfter = await p.evaluate(() => DG.state.run.bag.length); if (bagAfter !== 9) errs.push(`${name}: buy did not add a die (${bagAfter})`);
  // Jump to the final round and win it.
  await p.evaluate(() => { DG.state.run.roundNo = 7; DG.render(); }); await act('next'); await p.waitForSelector('.round');
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); }); await act('score');
  await p.waitForSelector('.win'); await shot('05-win'); await checkTaps('win');
  await act('endless'); await p.waitForSelector('.shop'); await act('next'); await p.waitForSelector('.round');
  const lbl = await p.textContent('.rlabel'); if (!/Endless 1/.test(lbl)) errs.push(`${name}: endless label ${lbl}`); await shot('06-endless-round');
  // Reload: the run resumes from localStorage.
  await p.reload(); await p.waitForSelector('[data-act="continue"]'); await act('continue'); await p.waitForSelector('.round');
  // Lose.
  await p.evaluate(() => { DG.state.run.round.target = 1e9; DG.render(); });
  for (let i = 0; i < 3; i++) await act('score');
  await p.waitForSelector('.lose'); await shot('07-lose'); await checkTaps('lose');
  await ctx.close();
}
await b.close();
console.log('small tap targets:', small.size ? [...small] : 'none');
console.log('console errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
