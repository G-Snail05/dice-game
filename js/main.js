import { setBalance } from './balance.js';
import { initArt, installArtFallbacks, setVariant, hasHighContrast, bgCSS, preload, fxKeys } from './art.js';
import { enqueue, busy, snapshotRects, setReduced, setSpeed } from './ui/anim.js';
import { rollIn, slide, deal, scoreSequence } from './ui/roundAnim.js';
import { randomSeed } from './rng.js';
import { newRun, settleRound, continueEndless, nextRound, serialize, deserialize } from './run.js';
import { toggleLock, toggleSelect, reroll, scoreCurrent, reveal, handDice, benchDice } from './round.js';
import { buy, rerollShop, sell } from './shop.js';
import { titleView, infoView } from './ui/title.js';
import { roundView } from './ui/roundView.js';
import { shopView } from './ui/shopView.js';
import { winView, loseView } from './ui/endView.js';
import { settingsView } from './ui/settingsView.js';

const SAVE_KEY = 'diceGame.save', BEST_KEY = 'diceGame.best', SETTINGS_KEY = 'diceGame.settings';
const app = document.getElementById('app');
const state = { run: null, screen: 'title', justScored: false, back: 'title', settings: { hc: false, reduceMotion: false } };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const loadSave = () => { const s = store.get(SAVE_KEY); try { return s ? deserialize(s) : null; } catch { return null; } };
const best = () => { try { return JSON.parse(store.get(BEST_KEY)); } catch { return null; } };

function persist() {
  const run = state.run;
  if (!run) return;
  if (run.phase === 'lose') store.set(SAVE_KEY, null); else store.set(SAVE_KEY, serialize(run));
  const b = best() || { wins: 0, round: 0, throw: 0 };
  b.round = Math.max(b.round, run.roundNo);
  b.throw = Math.max(b.throw, run.stats.bestThrow);
  store.set(BEST_KEY, JSON.stringify(b));
}
function recordWin() { const b = best() || { wins: 0, round: 0, throw: 0 }; b.wins++; store.set(BEST_KEY, JSON.stringify(b)); }

function applySettings() {
  const st = state.settings, hc = st.hc && hasHighContrast();
  setVariant(hc ? 'hc' : '');
  document.body.classList.toggle('hc', hc);
  document.body.classList.toggle('reduce-motion', !!st.reduceMotion);
  setReduced(st.reduceMotion);
}

function render(opts = {}) {
  const run = state.run;
  const screenName = state.screen === 'settings' || state.screen === 'info' ? state.screen : state.screen === 'title' || !run ? 'title' : run.phase;
  document.documentElement.style.setProperty('--table-bg', bgCSS(state.settings.hc && hasHighContrast() ? 'bg_hc_tile' : 'bg_table_tile'));
  document.documentElement.style.backgroundImage = bgCSS(state.settings.hc && hasHighContrast() ? 'bg_hc_tile' : screenName === 'shop' || screenName === 'round' ? 'bg_shop_tile' : 'bg_table_tile');
  if (state.screen === 'settings') { app.innerHTML = settingsView(state.settings); app.dataset.screen = 'settings'; return; }
  if (state.screen === 'info') { app.innerHTML = infoView(); app.dataset.screen = 'info'; return; }
  if (state.screen === 'title' || !run) app.innerHTML = titleView({ save: loadSave(), best: best() });
  else if (run.phase === 'round') app.innerHTML = roundView(run, opts);
  else if (run.phase === 'shop') app.innerHTML = shopView(run);
  else if (run.phase === 'win') app.innerHTML = winView(run);
  else app.innerHTML = loseView(run);
  app.dataset.screen = state.screen === 'title' || !run ? 'title' : run.phase;
  state.justScored = false;
}

function start(seed) { state.run = newRun(seed || randomSeed()); state.screen = 'run'; persist(); render(); window.scrollTo(0, 0); }

const actions = {
  new: () => start(),
  seeded: () => start((app.querySelector('input[name=seed]').value || '').trim().toUpperCase() || randomSeed()),
  continue: () => { state.run = loadSave(); state.screen = state.run ? 'run' : 'title'; render(); },
  quit: () => { state.screen = 'title'; render(); },
  settings: () => { if (state.screen !== 'info') state.back = state.screen; state.screen = 'settings'; window.scrollTo(0, 0); },
  info: () => { if (state.screen !== 'settings') state.back = state.screen; state.screen = 'info'; window.scrollTo(0, 0); },
  back: () => { state.screen = state.back || 'title'; },
  // Round actions: the engine changes state immediately (and it is saved); the animation queue then
  // plays the transition over the DOM. Taps are ignored while a sequence runs.
  roll: () => animated(async () => {
    const before = rects(), run = state.run;
    if (!reveal(run)) return;
    commit();
    // Unpicked dice slide to the bench row while the picked ones fly onto the table (rollIn sets the phase last).
    await Promise.all([slide(app, before, benchDice(run).map(d => String(d.uid)), 300), rollIn(app, before, handDice(run))]);
  }),
  pick: el => { toggleSelect(state.run, +el.dataset.i); },
  lock: el => animated(async () => {
    const before = rects(), uid = el.dataset.uid;
    toggleLock(state.run, +el.dataset.i);
    commit();
    await slide(app, before, [uid]);
  }),
  reroll: () => animated(async () => {
    const run = state.run, rolled = handDice(run).filter((_, i) => !run.round.locked[i]);
    const before = rects();
    if (!reroll(run)) return;
    commit();
    await rollIn(app, before, rolled);
  }),
  score: () => animated(async () => {
    const run = state.run, r = run.round;
    // 1. Held dice slide up so the whole throw is on the table.
    const before = rects();
    render({ allOnTable: true });
    await slide(app, before, handDice(run).filter((_, i) => r.locked[i]).map(d => String(d.uid)));
    // 2. Engine scores (and moves on) right away.
    const dice = handDice(run).map(d => ({ ...d })), oldScore = r.score, target = r.target, phaseBefore = run.phase;
    scoreCurrent(run);
    settleRound(run);
    if (run.phase === 'win' && phaseBefore !== 'win') recordWin();
    persist();
    // 3. Play the sequence over the still-visible scored dice, then show the new state.
    await scoreSequence(app, { dice, last: r.last, oldScore, newScore: r.score, target });
    render();
    if (run.phase === 'round') await deal(app); else window.scrollTo(0, 0);
  }),
  buy: el => buy(state.run, +el.dataset.i),
  shopReroll: () => rerollShop(state.run),
  sell: el => sell(state.run, +el.dataset.uid),
  next: () => { nextRound(state.run); window.scrollTo(0, 0); },
  endless: () => continueEndless(state.run),
};

const ANIMATED = Symbol('animated');
const rects = () => snapshotRects(app, '.die[data-uid]', 'data-uid');
const commit = () => { persist(); render(); };
const animated = fn => { enqueue(fn); return ANIMATED; };

app.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  ev.preventDefault();
  if (busy()) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (fn(el) === ANIMATED) return;
  persist();
  render();
});
app.addEventListener('change', ev => {
  const el = ev.target.closest('[data-setting]');
  if (!el) return;
  state.settings[el.dataset.setting] = el.checked;
  store.set(SETTINGS_KEY, JSON.stringify(state.settings));
  applySettings();
  render();
});
app.addEventListener('submit', ev => { ev.preventDefault(); actions.seeded(); });

async function boot() {
  const [bal, man] = await Promise.all([fetch('data/balance.json').then(r => r.json()), fetch('assets/manifest.json').then(r => r.json())]);
  const fb = man.fallback ? await fetch(man.fallback).then(r => (r.ok ? r.json() : null)).catch(() => null) : null;
  setBalance(bal);
  initArt(man, fb);
  try { Object.assign(state.settings, JSON.parse(store.get(SETTINGS_KEY)) || {}); } catch { /* defaults */ }
  applySettings();
  installArtFallbacks(document);
  preload(fxKeys());
  const q = new URLSearchParams(location.search);
  if (q.has('seed')) start(q.get('seed')); else render();
  // Test/debug hook (used by the screenshot script); harmless in normal play.
  window.DG = { state, render, persist, busy, setSpeed };
}
boot().catch(err => { app.innerHTML = `<p class="loading">Could not load the game: ${String(err.message || err)}</p>`; console.error(err); });
