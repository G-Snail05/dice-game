// node tools/sync-pack-styleA.mjs [asset-pack dir] -> copy what the game ships from Ælfstan's raw pack
// (asset-pack/, kept out of git) into assets/pack-styleA/: the pack's README + manifests, and only the
// sprite files the game's keys reference (requiredKeys + counterArtKeys), with their _hc twins and button
// states. Then run tools/build-manifest-styleA.mjs to regenerate assets/manifest.json.
import fs from 'node:fs';
import { requiredKeys, counterArtKeys } from '../js/art.js';
const ROOT = new URL('..', import.meta.url).pathname, SRC = (process.argv[2] || ROOT + 'asset-pack').replace(/\/?$/, '/'), DST = ROOT + 'assets/pack-styleA/';
for (const f of ['README.md', 'manifest.json', 'builder-manifest.styleA.json']) fs.copyFileSync(SRC + f, DST + f);
const B = JSON.parse(fs.readFileSync(DST + 'builder-manifest.styleA.json', 'utf8')).assets;
const files = new Set(), missingKeys = [];
const hc = p => p.replace(/\.png$/, '_hc.png');
const collect = e => {
  if (!e) return;
  if (typeof e === 'string') e = { src: e };
  for (const p of [e.src, ...Object.values(e.srcset || {})]) { files.add(p); files.add(hc(p)); }
  if (e.hc) collect(e.hc);
  for (const st of Object.values(e.states || {})) collect(st);
  // Button skins: the converter derives _pressed/_disabled from _normal, so ship those too.
  if (/_normal\.png$/.test(e.src)) for (const s of ['pressed', 'disabled']) collect({ src: e.src.replace('_normal.png', `_${s}.png`), srcset: Object.fromEntries(Object.entries(e.srcset || {}).map(([k, v]) => [k, v.replace('_normal.png', `_${s}.png`)])) });
};
const keys = [...requiredKeys(), ...counterArtKeys()];
for (const k of keys) { if (!B[k]) missingKeys.push(k); collect(B[k]); }
for (const b of ['settings', 'reroll', 'pause', 'info']) if (!B[`ui_btn_${b}`]) collect(B[`ui_btn_${b}_normal`]);
let copied = 0, same = 0;
for (const p of files) {
  const from = SRC + p.replace(/^pack-styleA\//, ''), to = ROOT + 'assets/' + p;
  if (!fs.existsSync(from)) continue; // optional _hc twin / state not in the pack
  if (fs.existsSync(to) && fs.readFileSync(from).equals(fs.readFileSync(to))) { same++; continue; }
  fs.mkdirSync(to.slice(0, to.lastIndexOf('/')), { recursive: true });
  fs.copyFileSync(from, to); copied++;
}
console.log(`synced from ${SRC}: ${copied} files copied/updated, ${same} unchanged; keys missing from the pack: ${missingKeys.join(', ') || 'none'}`);
