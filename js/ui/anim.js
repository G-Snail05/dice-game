// Small promise-based animation layer. Game logic never waits on it: the engine updates state first,
// then the UI plays a sequence over the DOM. Under reduced motion every helper resolves at once.
// Only transform and opacity are animated (Web Animations API), so it stays on the compositor.

let reducedFlag = false, speed = 1;
// Time scale for every animation (1 = normal; >1 slower). Hook for a future game-speed setting and for screenshot tests.
export function setSpeed(f) { speed = Math.max(0.1, +f || 1); }
export function setReduced(v) { reducedFlag = !!v; }
export const reduced = () => reducedFlag || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

export const wait = ms => (reduced() || ms <= 0 ? Promise.resolve() : new Promise(r => setTimeout(r, ms * speed)));

// el.animate wrapper that resolves when done (or immediately when motion is reduced).
export function play(el, keyframes, opts) {
  if (!el || reduced() || !el.animate) return Promise.resolve();
  const o = { fill: 'none', ...opts };
  if (o.duration) o.duration *= speed;
  if (o.delay) o.delay *= speed;
  const a = el.animate(keyframes, o);
  // Safety net: never let one stuck animation (seen in Chrome after pause/resume) hold the queue forever.
  const cap = new Promise(r => setTimeout(r, (o.duration || 0) + (o.delay || 0) + 1000));
  return Promise.race([a.finished.catch(() => {}), cap]);
}

// Swap an <img> through frame keys at `fps` (setter does the src swap), `loops` times.
export async function frames(set, keys, fps = 12, loops = 1) {
  if (reduced()) return;
  for (let l = 0; l < loops; l++) for (const k of keys) { set(k); await wait(1000 / fps); }
}

// Serial queue: one sequence at a time; `busy` lets the UI ignore taps meanwhile.
const q = { tail: Promise.resolve(), busy: 0 };
export const busy = () => q.busy > 0;
export function enqueue(fn) {
  q.busy++;
  const p = q.tail.then(fn).catch(err => console.error(err)).finally(() => { q.busy--; if (!q.busy) document.body.dataset.anim = ''; });
  q.tail = p;
  return p;
}
// Marks the current phase on <body data-anim> (used by screenshot tests to capture mid-animation frames).
export const phase = name => { document.body.dataset.anim = name; };

// FLIP: record element rects by key before a DOM change, then animate each from old to new position.
export function snapshotRects(root, sel, keyAttr) {
  const m = new Map();
  for (const el of root.querySelectorAll(sel)) m.set(el.getAttribute(keyAttr), el.getBoundingClientRect());
  return m;
}

export function countUp(el, from, to, ms = 450) {
  if (!el) return Promise.resolve();
  if (reduced() || from === to) { el.textContent = String(to); return Promise.resolve(); }
  return new Promise(res => {
    const t0 = performance.now();
    ms *= speed;
    const step = t => {
      const k = Math.min(1, (t - t0) / ms);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
