// node tools/mod-art-check.mjs [base url] [out dir] -> renders every modifier on every shape (normal + hc) with the
// game's own dieArt at 1x and writes one PNG per die (crop of the overlay box on a flat #00ff00 backdrop), plus a
// contact sheet. tools/mod-art-check.py compares them with the pack's native layers composed by the rules in
// ASSETS.md (pointed tops: badge 2px up), so clipping or a wrong layer shows up as a pixel diff.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8917/', OUT = process.argv[3] || '/tmp/mod-art-check';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
await p.goto(BASE); await p.waitForSelector('.title, .r2, body');
const MODS = ['ruby', 'ember', 'lastcall', 'matching', 'overcharged', 'gold', 'twin', 'echo', 'glass'], SHAPES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
for (const hc of ['', 'hc']) {
  await p.evaluate(async ({ MODS, SHAPES, hc }) => {
    const art = await import('/js/art.js'), dv = await import('/js/ui/dieView.js');
    art.setVariant(hc);
    document.body.innerHTML = `<style>body{background:#00ff00!important;margin:0} .chk{display:grid;grid-template-columns:repeat(6,100px);gap:0;padding:24px 8px} .cell{width:100px;height:100px;position:relative;background:#00ff00} .cell>.modwrap,.cell>img{position:absolute;left:12px;top:24px} .cell .die-art{width:64px;height:64px;display:block}</style>
      <div class="chk">${MODS.flatMap(m => Object.entries(SHAPES).map(([sh, n]) => `<div class="cell" data-id="${m}_${sh}">${dv.dieArt({ shape: sh, special: m, face: n + (m === 'overcharged' ? 3 : 0) })}</div>`)).join('')}</div>`;
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  }, { MODS, SHAPES, hc });
  await p.screenshot({ path: `${OUT}/sheet${hc ? '_hc' : ''}.png`, fullPage: true });
  for (const m of MODS) for (const sh of Object.keys(SHAPES)) {
    const box = await p.$eval(`.cell[data-id="${m}_${sh}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.x + 12 - 4, y: r.y + 24 - 20, width: 84, height: 88 }; });
    await p.screenshot({ path: `${OUT}/${m}_${sh}${hc ? '_hc' : ''}.png`, clip: box });
  }
  const broken = await p.$$eval('.chk img', im => im.filter(i => !i.naturalWidth).map(i => i.src));
  if (broken.length) errs.push(`broken images (${hc || 'normal'}): ${broken.join(', ')}`);
}
await b.close();
console.log(`wrote ${OUT}; errors: ${errs.length ? errs.join(' | ') : 'none'}`);
process.exit(errs.length ? 1 : 0);
