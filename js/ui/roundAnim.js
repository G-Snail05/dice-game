// Animation sequences for the round screen. Each takes the DOM *after* the engine has changed state
// (or, for scoring, the DOM still showing the scored dice) and only moves things around visually.
import { play, wait, frames, phase, reduced, countUp } from './anim.js';
import { setImg, artSrc } from '../art.js';
import { faceKey } from '../dice.js';
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
  if (img && artSrc(`die_${d.shape}_roll_1`)) {
    await wait(delay);
    const keys = [`die_${d.shape}_blank`, `die_${d.shape}_roll_1`, `die_${d.shape}_roll_2`];
    await frames(key => setImg(img, key), keys, 12, 2);
    setImg(img, faceKey(d.shape, d.face)) || (final && (img.src = final.src));
  }
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
  // Value changers (Echo) first.
  for (const l of last.lines.filter(x => x.pre)) {
    const el = byIndex(l.i);
    if (!el) continue;
    floatLabel(root, el, `=${l.value}`, 'rule'); bump(el); burst(el, 'fx_pop_rule_', 4);
    await wait(step);
  }
  let pts = 0;
  for (let i = 0; i < dice.length; i++) {
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
