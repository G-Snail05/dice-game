// Animation sequences for the round screen. Each takes the DOM *after* the engine has changed state
// (or, for scoring, the DOM still showing the scored dice) and only moves things around visually.
import { play, wait, frames, phase, reduced, countUp } from './anim.js';
import { setImg, artSrc } from '../art.js';
import { faceArtKey, rollArtKeys } from '../dice.js';
import { fmtMult } from './dom.js';

const dieEl = (root, uid) => root.querySelector(`.die[data-uid="${uid}"]`);
// Offset from rect a to rect b, centre to centre (so a size change can be animated with scale()).
const rel = (a, b) => ({ dx: b.left + b.width / 2 - a.left - a.width / 2, dy: b.top + b.height / 2 - a.top - a.height / 2 });

// Dice fly from where they were (hand slot) onto the table in an arc, tumbling through the pack's
// roll frames, then land on their face with a squash and bounce. `hop` = re-roll in place.
export async function rollIn(root, before, dice) {
  phase('roll');
  const tally = root.querySelector('.tally');
  if (tally && !reduced()) tally.style.opacity = '0';
  await Promise.all(dice.map((d, k) => tumble(root, before, d, k)));
  if (tally) { tally.style.opacity = ''; tally.classList.add('fade-in'); }
}

async function tumble(root, before, d, k) {
  const el = dieEl(root, d.uid);
  if (!el) return;
  const img = el.querySelector('img.die-art');
  const old = before.get(String(d.uid)), now = el.getBoundingClientRect();
  const { dx, dy } = old ? rel(now, old) : { dx: 0, dy: 0 };
  // Hand and table dice can differ in size (desktop: 64px hand, 128px table): scale from the old size too.
  const k0 = old && now.width ? old.width / now.width : 1, km = (k0 + 1) / 2;
  const lift = Math.max(70, Math.abs(dy) * 0.35);
  const delay = k * 70, dur = 560;
  const final = img && { src: img.src, srcset: img.getAttribute('srcset') };
  const spin = (k % 2 ? -1 : 1) * 360;
  const flight = play(el, [
    { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${k0})` },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - lift}px) rotate(${spin / 2}deg) scale(${km})`, offset: 0.45 },
    { transform: 'translate(0, 0) rotate(' + spin + 'deg)' },
  ], { duration: dur, delay, easing: 'cubic-bezier(.35,.1,.45,1)' });
  const keys = rollArtKeys(d);
  if (img && artSrc(keys[1])) {
    await wait(delay);
    // Parity Coin: the pack's 8-frame flip loop once at 15 fps; dice: blank -> roll_1 -> roll_2 twice at 12 fps.
    if (keys.length > 3) await frames(key => setImg(img, key), keys, 15, 1);
    else await frames(key => setImg(img, key), keys, 12, 2);
    setImg(img, faceArtKey(d)) || (final && (img.src = final.src));
  }
  const ctr = el.querySelector('.ctr');
  if (ctr) { await Promise.all([flight, ledRoll(ctr, delay, dur)]); return; }
  await flight;
  if (img) await play(img, [
    { transform: 'scale(1.28, .7)' }, { transform: 'scale(.9, 1.1) translateY(-6px)', offset: 0.45 },
    { transform: 'scale(1.05, .95)', offset: 0.75 }, { transform: 'none' },
  ], { duration: 260, easing: 'ease-out' });
}

// Plain slide from the old position to the new one (hold / un-hold).
export async function slide(root, before, uids, dur = 220) {
  phase('slide');
  await Promise.all(uids.map(uid => {
    const el = dieEl(root, uid), old = before.get(String(uid));
    if (!el || !old) return null;
    const now = el.getBoundingClientRect(), { dx, dy } = rel(now, old), k = now.width ? old.width / now.width : 1;
    if (!dx && !dy && k === 1) return null;
    return play(el, [{ transform: `translate(${dx}px, ${dy}px) scale(${k})` }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1.2)' });
  }));
}

// New hand dealt: drop in from below.
export function deal(root) {
  return Promise.all([...root.querySelectorAll('.hslots .die')].map((el, k) =>
    play(el, [{ transform: 'translateY(48px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: k * 50, easing: 'cubic-bezier(.2,.8,.3,1.2)', fill: 'backwards' })));
}

// Binary counter roll: while the counter is in the air every cell flickers through the pack's tumble
// frames (counter_bit_tumble_1/2; visual only, not the game RNG), then the bits lock in one by one, MSB
// first, and the decimal readout appears. The DOM already holds the final bits; we restore them at the end.
async function ledRoll(ctr, delay, dur) {
  if (reduced()) return;
  const leds = [...ctr.querySelectorAll('.led')], val = ctr.querySelector('.ctrval');
  const final = leds.map(l => l.className);
  const tumble = l => { l.className = `led ${Math.random() < 0.5 ? 't1' : 't2'}`; };
  ctr.classList.add('tumbling');
  try {
    const t0 = performance.now(), until = delay + dur * 0.8;
    // Bounded loop (wait() is a timer, so this ends even if the tab is throttled).
    for (let n = 0; n < 40 && performance.now() - t0 < until; n++) { leds.forEach(tumble); await wait(70); }
    const step = Math.max(35, Math.round(280 / leds.length));
    for (let j = 0; j < leds.length; j++) {
      leds[j].className = final[j];
      play(leds[j], [{ transform: 'translateY(-18%)' }, { transform: 'none' }], { duration: 120, easing: 'ease-out' });
      leds.slice(j + 1).forEach(tumble);
      await wait(step);
    }
  } finally {
    leds.forEach((l, j) => { l.className = final[j]; });
    ctr.classList.remove('tumbling');
  }
  if (val) await play(val, [{ transform: 'translateY(6px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' });
}

// Link chain: each linked counter pulses with the pack's glow (fx_link_glow 1-2-3-2), a two-link connector
// (fx_chain_link, flashing to _lit) bridges each pair of neighbours on their lower bezels, and one readout
// tag is centred over the run: the binary string types in (one group per counter), then the decimal.
// The readout then flies into the throw's points (the tally), which the total later carries to the bar.
async function chainSequence(root, els, chain, ptsEl, ptsBefore) {
  const live = els.filter(Boolean), ctrs = live.map(e => e.querySelector('.ctr') || e);
  if (!live.length || reduced()) { ptsEl.textContent = String(ptsBefore + chain.value); return; }
  phase('chain');
  const rs = ctrs.map(c => c.getBoundingClientRect()), k = rs[0].width / 32; // CSS px per native px
  const made = [];
  const add = el => { document.body.appendChild(el); made.push(el); return el; };
  // Glow on each member (falls back to a CSS ring when the pack has no glow frames).
  const glowArt = !!artSrc('fx_link_glow_1');
  const glows = ctrs.map(c => {
    c.classList.add('chained');
    if (!glowArt) return null;
    c.classList.add('glowart');
    const img = document.createElement('img'); img.className = 'ctrglow art px'; img.alt = ''; setImg(img, 'fx_link_glow_1'); c.appendChild(img); made.push(img); return img;
  }).filter(Boolean);
  live.forEach(e => e.classList.add('linked'));
  let pulsing = true;
  const pulse = (async () => { const seq = [1, 2, 3, 2]; for (let n = 0; pulsing && n < 80; n++) { glows.forEach(g => setImg(g, `fx_link_glow_${seq[n % 4]}`)); await wait(100); } })();
  // Connectors between neighbours: 16x8 native, centred on the gap, on the lower bezel (y + 23 native).
  const links = [];
  for (let j = 1; j < rs.length; j++) {
    const a = rs[j - 1], b = rs[j], w = 16 * k, h = 8 * k, cx = (a.right + b.left) / 2;
    const img = add(document.createElement('img'));
    img.className = 'chainlink art px'; img.alt = '';
    if (!setImg(img, 'fx_chain_link')) { img.remove(); continue; }
    Object.assign(img.style, { left: `${cx - w / 2}px`, top: `${b.top + 23 * k}px`, width: `${w}px`, height: `${h}px` });
    links.push(img);
  }
  // One readout over the run.
  const left = Math.min(...rs.map(r => r.left)), right = Math.max(...rs.map(r => r.right)), top = Math.min(...rs.map(r => r.top));
  const tag = add(document.createElement('div'));
  tag.className = 'chaintag';
  tag.innerHTML = `<span class="bin">${chain.parts.map(p => `<span class="grp">${p.split('').map(b => `<i class="b${b}">${b}</i>`).join('')}</span>`).join('')}</span><span class="tag" style="width:${34 * k}px;height:${14 * k}px"><b></b></span>`;
  tag.style.left = `${(left + right) / 2}px`;
  tag.style.top = `${top - 12 * k}px`;
  tag.style.transform = 'translate(-50%, calc(-100% + ' + (14 * k) + 'px))';
  try {
    await Promise.all(links.map((l, j) => play(l, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, delay: j * 90, easing: 'cubic-bezier(.2,.8,.3,1.4)' })));
    const bitsEls = [...tag.querySelectorAll('.bin i')], per = Math.max(25, Math.round(420 / bitsEls.length));
    for (const b of bitsEls) { b.classList.add('show'); await wait(per); }
    links.forEach(l => setImg(l, 'fx_chain_link_lit'));
    const dec = tag.querySelector('.tag b');
    dec.textContent = String(chain.value);
    await play(tag.querySelector('.tag'), [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'ease-out' });
    live.forEach(e => { bump(e, 1.1); burst(e, 'fx_pop_points_', 4); });
    await wait(450);
    // Fly the decimal into the tally's points.
    const a = dec.getBoundingClientRect(), b = ptsEl.getBoundingClientRect();
    const fly = add(document.createElement('div'));
    fly.className = 'flying chainfly';
    fly.textContent = `+${chain.value}`;
    Object.assign(fly.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    dec.style.opacity = '0';
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    play(tag, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
    await play(fly, [{ transform: 'none' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(1.15)`, offset: 0.4 }, { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0.9 }], { duration: 480, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' });
  } finally {
    pulsing = false;
    await pulse;
    made.forEach(el => el.remove());
    ctrs.forEach(c => c.classList.remove('chained', 'glowart'));
    live.forEach(e => e.classList.remove('linked'));
  }
  ptsEl.textContent = String(ptsBefore + chain.value);
  play(ptsEl, [{ transform: 'scale(1.5)' }, { transform: 'none' }], { duration: 220 });
}

function floatLabel(root, el, text, layer) {
  const t = document.createElement('span');
  t.className = `float l-${layer}`;
  t.textContent = text;
  el.appendChild(t);
  return play(t, [
    { transform: 'translate(-50%, 0) scale(.5)', opacity: 0 }, { transform: 'translate(-50%, -26px) scale(1.25)', opacity: 1, offset: 0.35 },
    { transform: 'translate(-50%, -34px) scale(1)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%, -44px) scale(1)', opacity: 0 },
  ], { duration: 700, easing: 'ease-out' }).then(() => t.remove());
}

async function burst(el, prefix, n, fps = 30, cls = 'fx') {
  if (reduced() || !artSrc(`${prefix}1`)) return;
  const img = document.createElement('img');
  img.className = `art px ${cls}`;
  img.alt = '';
  el.appendChild(img);
  await frames(k => setImg(img, k), Array.from({ length: n }, (_, j) => `${prefix}${j + 1}`), fps, 1);
  img.remove();
}

// Fixed-position sprite over the page (for effects bigger than the die). Returns the <img>.
function overlayImg(cls, made) {
  const img = document.createElement('img');
  img.className = `art px ${cls}`; img.alt = '';
  document.body.appendChild(img); made.push(img);
  return img;
}
const artRect = el => (el.querySelector('img.die-art, .cssdie, .ctr') || el).getBoundingClientRect();

// JACKPOT (Casino slot777), following the pack's suggested timing: fx_jackpot_01..12 once at 15 fps centred on the
// die (anchor (48,36)), the banner drops in over frames 03-06 (y -22, -8, +3, -1, 0 native px) with chasing bulbs
// (banner / banner_2 at ~6 fps), fx_jackpot_rays_1/2 loop behind it for ~1 s at 8 fps, then everything fades.
// Scale: 2 CSS px per native px on phones (burst 192x128, banner 192x52), up to 4 with the big desktop table dice,
// clamped so the burst always fits the viewport width (a 360 px phone fits the 2x burst with room to spare).
export async function jackpot(el) {
  if (!el || !artSrc('fx_jackpot_01')) return;
  phase('jackpot');
  const made = [];
  const r = artRect(el), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const k = Math.max(1, Math.min(4, Math.max(2, Math.round(r.width / 32)), Math.floor((window.innerWidth - 8) / 96)));
  const W = 96 * k, H = 64 * k, left = Math.max(4, Math.min(window.innerWidth - W - 4, cx - 48 * k)), top = Math.max(4, cy - 36 * k);
  const banner = overlayImg('jp jp-banner', made);
  const bTop = Math.max(4, top + (H - 26 * k) / 2 - 6 * k);
  Object.assign(banner.style, { left: `${left}px`, top: `${bTop}px`, width: `${W}px`, height: `${26 * k}px` });
  setImg(banner, 'fx_jackpot_banner');
  try {
    if (reduced()) { await new Promise(res => setTimeout(res, 900)); return; }
    const burst = overlayImg('jp jp-burst', made), rays = overlayImg('jp jp-rays', made);
    for (const im of [burst, rays]) Object.assign(im.style, { left: `${left}px`, top: `${top}px`, width: `${W}px`, height: `${H}px` });
    rays.style.opacity = '0'; banner.style.opacity = '0';
    let chasing = true;
    const chase = (async () => { for (let n = 0; chasing && n < 60; n++) { setImg(banner, n % 2 ? 'fx_jackpot_banner_2' : 'fx_jackpot_banner'); await wait(1000 / 6); } })();
    const f = 1000 / 15, ny = v => `translateY(${v * k}px)`;
    const drop = (async () => { await wait(2 * f); banner.style.opacity = '1';
      await play(banner, [{ transform: ny(-22) }, { transform: ny(-8) }, { transform: ny(3) }, { transform: ny(-1) }, { transform: ny(0) }], { duration: 4 * f, easing: 'linear' }); })();
    await frames(key => setImg(burst, key), Array.from({ length: 12 }, (_, i) => `fx_jackpot_${String(i + 1).padStart(2, '0')}`), 15, 1);
    await drop;
    burst.remove(); rays.style.opacity = '1';
    await frames(key => setImg(rays, key), ['fx_jackpot_rays_1', 'fx_jackpot_rays_2'], 8, 4);
    chasing = false; await chase;
    await Promise.all([banner, rays].map(im => play(im, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' })));
  } finally { made.forEach(m => m.remove()); }
}

// Parity Coin match: fx_parity_match_<side> pulse (42x42, die at 2,8) on each matched die, 12 fps 1-2-3-2 twice.
export async function parityPulse(els, side) {
  if (reduced() || !artSrc(`fx_parity_match_${side}_1`)) return;
  const made = [];
  try {
    const imgs = els.filter(Boolean).map(el => { const r = artRect(el), k = r.width / 32, im = overlayImg('pmpulse', made);
      Object.assign(im.style, { left: `${r.left - 2 * k}px`, top: `${r.top - 8 * k}px`, width: `${42 * k}px`, height: `${42 * k}px` }); return im; });
    await frames(n => imgs.forEach(im => setImg(im, `fx_parity_match_${side}_${n}`)), [1, 2, 3, 2, 1, 2, 3, 4], 12, 1);
  } finally { made.forEach(m => m.remove()); }
}

const bump = (el, s = 1.18) => play(el, [{ transform: 'none' }, { transform: `scale(${s}) translateY(-6px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });

// Scoring: each die pops its value in turn, specials flash their effect, a running points x mult
// tally builds, then the total flies into the points pile in the bar, which counts up.
export async function scoreSequence(root, { dice, last, oldScore, newScore, target }) {
  const tally = root.querySelector('.tally');
  const byIndex = i => dieEl(root, dice[i].uid);
  tally.innerHTML = `<div class="run"><span class="pts">0</span> <span class="x">×</span> <span class="mul">1</span></div><div class="ttotal" aria-live="polite"></div>`;
  const ptsEl = tally.querySelector('.pts'), mulEl = tally.querySelector('.mul'), totEl = tally.querySelector('.ttotal');
  phase('score-pop');
  const step = reduced() ? 0 : 230;
  // Link chains first: they decide what the linked counters score.
  let pts = 0;
  const inChain = new Set();
  for (const c of last.chains || []) {
    c.members.forEach(j => inChain.add(j));
    await chainSequence(root, c.members.map(byIndex), c, ptsEl, pts);
    pts += c.value;
  }
  // Value changers (Echo) next.
  for (const l of last.lines.filter(x => x.pre && !x.chain)) {
    const el = byIndex(l.i);
    if (!el) continue;
    floatLabel(root, el, `=${l.value}`, 'rule'); bump(el); burst(el, 'fx_pop_rule_', 4);
    await wait(step);
  }
  for (let i = 0; i < dice.length; i++) {
    if (inChain.has(i)) continue;
    const el = byIndex(i), v = last.pts[i];
    pts += v;
    if (el) { floatLabel(root, el, `+${v}`, 'points'); bump(el); burst(el, 'fx_pop_points_', 4); }
    ptsEl.textContent = String(pts);
    play(ptsEl, [{ transform: 'scale(1.35)' }, { transform: 'none' }], { duration: 160 });
    await wait(step);
  }
  for (const l of last.lines.filter(x => !x.pre && x.i != null && !x.idle)) {
    const el = byIndex(l.i);
    const text = l.xMult ? `×${fmtMult(l.xMult)}` : l.addMult ? `+${fmtMult(l.addMult)} mult` : l.addPoints ? `+${l.addPoints}` : l.gold ? `+$${l.gold}` : l.who;
    if (el) {
      el.classList.add('flash');
      floatLabel(root, el, text, l.layer); bump(el, 1.28);
      const b = el.querySelector('.badge');
      if (b) play(b, [{ transform: 'none' }, { transform: 'scale(1.8) rotate(-12deg)' }, { transform: 'none' }], { duration: 360 });
      burst(el, `fx_pop_${l.layer === 'rule' ? 'rule' : l.layer}_`, 4);
      if (l.gold) burst(el, 'fx_coin_spin_', 4, 12, 'fx coin');
      if (l.shatter) burst(el, 'fx_glass_shatter_', 3, 10, 'fx glass');
    }
    if (l.points != null) { ptsEl.textContent = String(l.points); }
    if (l.mult != null) { mulEl.textContent = fmtMult(l.mult); play(mulEl, [{ transform: 'scale(1.5)' }, { transform: 'none' }], { duration: 200 }); }
    if (l.parity && l.matches) {
      const ms = l.matches.map(byIndex);
      ms.forEach(m => m && floatLabel(root, m, `+${fmtMult(l.addMult / l.matches.length)}`, 'mult'));
      await parityPulse(ms, l.parity);
    }
    if (l.jackpot) await jackpot(el);
    await wait(step + 90);
    el && el.classList.remove('flash');
  }
  totEl.textContent = `= ${last.total}`;
  await play(totEl, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.35)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'ease-out' });
  const big = last.total >= target * 0.5 || last.mult >= 3;
  if (big && !reduced()) {
    const row = document.createElement('div');
    row.className = 'flames';
    const col = last.mult > 1 ? 'red' : 'blue';
    row.innerHTML = Array.from({ length: 4 }, () => '<img class="art px" alt="">').join('');
    tally.appendChild(row);
    const imgs = [...row.querySelectorAll('img')];
    await frames(k => imgs.forEach((im, j) => setImg(im, `fx_flame_${col}_${((+k.slice(-1) + j - 1) % 4) + 1}`)), [1, 2, 3, 4].map(n => `fx_flame_${col}_${n}`), 10, 2);
  } else await wait(250);
  // Fly the total into the points pile.
  phase('score-fly');
  const barPts = root.querySelector('#barPoints');
  if (barPts && !reduced()) {
    const a = totEl.getBoundingClientRect(), b = barPts.getBoundingClientRect();
    const fly = totEl.cloneNode(true);
    fly.classList.add('flying');
    Object.assign(fly.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.appendChild(fly);
    totEl.style.opacity = '0';
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    await play(fly, [{ transform: 'none' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.1)`, offset: 0.4 }, { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0.9 }], { duration: 520, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' });
    fly.remove();
    play(barPts, [{ transform: 'scale(1.6)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
  }
  const prog = root.querySelector('.hudbar .prog > i');
  if (prog) prog.style.transform = `scaleX(${Math.min(1, newScore / target).toFixed(3)})`;
  await countUp(barPts, oldScore, newScore, 500);
  await wait(260);
}
