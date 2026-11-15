// Headless screenshots + smoke test. Needs playwright-core and a Chrome/Chromium binary:
//   CHROME=/opt/google/chrome/chrome node tools/shots.mjs http://127.0.0.1:8917/ /tmp/shots
// Uses window.DG (debug hook) only to fast-forward to the shop / win / lose screens.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/dice-shots';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errs = [], small = new Set();
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1280, height: 800 } }, phone3x: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, only: 'srcset' } };
const artReport = {};
for (const [name, { only, ...opt }] of Object.entries(sizes)) {
  const ctx = await b.newContext(opt), p = await ctx.newPage();
  // Art check: every visible sprite loaded from the style A pack at the density-matched folder.
  const checkArt = async n => {
    await p.waitForFunction(() => [...document.querySelectorAll('img.art')].every(e => e.complete), null, { timeout: 20000 }).catch(() => {});
    const r = await p.$$eval('img.art', els => els.filter(e => e.offsetParent).map(e => ({ key: e.dataset.key, src: e.currentSrc, ok: e.complete && e.naturalWidth > 0 })));
    const want = { 1: '/1x/', 2: '/2x/', 3: '/3x/' }[opt.deviceScaleFactor || 1];
    const bad = r.filter(x => !x.ok || !x.src.includes('pack-styleA') || !x.src.includes(want));
    artReport[`${name}/${n}`] = `${r.length} sprites, ${bad.length} not from pack-styleA${want}`;
    if (bad.length) errs.push(`${name}/${n}: art problems ${JSON.stringify(bad.slice(0, 5))}`);
    if (await p.$('.cssdie')) errs.push(`${name}/${n}: CSS fallback die visible`);
    const over = await p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.badge')).map(e => e.className || e.tagName).slice(0, 3));
    if (over.length) errs.push(`${name}/${n}: horizontal overflow ${JSON.stringify(over)}`);
  };
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name} pageerror: ${e.message}`));
  const shot = async (n, full = true) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}-${n}.png`, fullPage: full }); console.log('shot', `${OUT}/${name}-${n}.png`); };
  const checkTaps = async n => { for (const s of await p.$$eval('button, summary, input', els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 30) || e.tagName, Math.round(r.width), Math.round(r.height)]; })))
    if (s[1] < 44 || s[2] < 44) small.add(`${name}/${n}: "${s[0]}" ${s[1]}x${s[2]}`); };
  const act = async (a, extra = '') => { await p.click(`[data-act="${a}"]${extra}`); };
  await p.goto(BASE); await p.waitForSelector('.title'); await p.waitForLoadState('networkidle');
  if (only === 'srcset') { await act('new'); await p.waitForSelector('.round'); await p.waitForLoadState('networkidle'); await checkArt('round'); await ctx.close(); continue; }
  await shot('01-title'); await checkTaps('title'); await checkArt('title');
  await act('info'); await p.waitForSelector('.info'); await p.waitForLoadState('networkidle'); await checkArt('info'); await shot('01b-info'); await act('back'); await p.waitForSelector('.title');
  await act('new'); await p.waitForSelector('.round');
  // Showcase: give the drawn dice a few specials so badges and the breakdown are visible.
  await p.evaluate(() => { const r = DG.state.run, h = r.round.hand.map(u => r.bag.find(d => d.uid === u)); h[1].special = 'ruby'; h[3].special = 'matching'; h[3].face = h[2].face; h[4].special = 'echo'; DG.render(); });
  await act('lock', '[data-i="1"]'); await act('lock', '[data-i="3"]'); await p.waitForLoadState('networkidle'); await shot('02-round'); await checkTaps('round'); await checkArt('round');
  await act('reroll'); await p.evaluate(() => { DG.state.run.round.target = 999; }); await act('score'); await shot('03-round-after-score');
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); });
  await act('score'); await p.waitForSelector('.shop'); await p.evaluate(() => { DG.state.run.gold = 9; DG.render(); });
  await p.click('.sell summary'); await p.waitForLoadState('networkidle'); await shot('04-shop'); await checkTaps('shop'); await checkArt('shop');
  await act('buy', '[data-i="0"]');
  const bagAfter = await p.evaluate(() => DG.state.run.bag.length); if (bagAfter !== 9) errs.push(`${name}: buy did not add a die (${bagAfter})`);
  // Jump to the final round and win it.
  await p.evaluate(() => { DG.state.run.roundNo = 7; DG.render(); }); await act('next'); await p.waitForSelector('.round');
  await p.evaluate(() => { DG.state.run.round.score = DG.state.run.round.target - 1; DG.render(); }); await act('score');
  await p.waitForSelector('.win'); await shot('05-win'); await checkTaps('win'); await checkArt('win');
  await act('endless'); await p.waitForSelector('.shop'); await act('next'); await p.waitForSelector('.round');
  const lbl = await p.textContent('.rlabel'); if (!/Endless 1/.test(lbl)) errs.push(`${name}: endless label ${lbl}`); await shot('06-endless-round');
  // Reload: the run resumes from localStorage.
  await p.reload(); await p.waitForSelector('[data-act="continue"]'); await act('continue'); await p.waitForSelector('.round');
  // Lose.
  await p.evaluate(() => { DG.state.run.round.target = 1e9; DG.render(); });
  for (let i = 0; i < 3; i++) await act('score');
  await p.waitForSelector('.lose'); await shot('07-lose'); await checkTaps('lose');
  // Settings: high-contrast toggle persists and swaps to *_hc sprites.
  await act('quit'); await act('settings'); await p.waitForSelector('.settings');
  if (await p.$('[data-setting="hc"]')) {
    await p.click('label:has([data-setting="hc"])'); await shot('08-settings', false);
    await act('back'); await act('new'); await p.waitForSelector('.round'); await p.waitForLoadState('networkidle');
    await p.waitForTimeout(800);
    const hcBad = await p.$$eval('.die img.die-art', els => els.filter(e => !(e.currentSrc.includes('_hc.png') && e.naturalWidth > 0)).map(e => e.currentSrc || e.src));
    const nHc = await p.$$eval('.die img.die-art', els => els.length);
    if (!nHc || hcBad.length) errs.push(`${name}: high-contrast sprites not used ${JSON.stringify(hcBad.slice(0, 3))}`); await shot('09-round-high-contrast');
    const saved = await p.evaluate(() => localStorage.getItem('diceGame.settings')); if (!/"hc":true/.test(saved)) errs.push(`${name}: hc setting not saved`);
  } else errs.push(`${name}: no high-contrast toggle`);
  await ctx.close();
}
await b.close();
console.log('art:', artReport);
console.log('small tap targets:', small.size ? [...small] : 'none');
console.log('console errors:', errs.length ? errs : 'none');
process.exit(errs.length ? 1 : 0);
