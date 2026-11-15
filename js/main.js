import { setBalance } from './balance.js';
import { initArt, installArtFallbacks } from './art.js';
import { randomSeed } from './rng.js';
import { newRun, settleRound, continueEndless, nextRound, serialize, deserialize } from './run.js';
import { toggleLock, reroll, scoreCurrent } from './round.js';
import { buy, rerollShop, sell } from './shop.js';
import { titleView } from './ui/title.js';
import { roundView } from './ui/roundView.js';
import { shopView } from './ui/shopView.js';
import { winView, loseView } from './ui/endView.js';

const SAVE_KEY = 'diceGame.save', BEST_KEY = 'diceGame.best';
const app = document.getElementById('app');
const state = { run: null, screen: 'title', justScored: false };

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

function render() {
  const run = state.run;
  if (state.screen === 'title' || !run) app.innerHTML = titleView({ save: loadSave(), best: best() });
  else if (run.phase === 'round') app.innerHTML = roundView(run, { justScored: state.justScored });
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
  lock: el => toggleLock(state.run, +el.dataset.i),
  reroll: () => reroll(state.run),
  score: () => {
    scoreCurrent(state.run);
    const before = state.run.phase;
    settleRound(state.run);
    state.justScored = true;
    if (state.run.phase === 'win' && before !== 'win') recordWin();
    if (state.run.phase !== 'round') window.scrollTo(0, 0);
  },
  buy: el => buy(state.run, +el.dataset.i),
  shopReroll: () => rerollShop(state.run),
  sell: el => sell(state.run, +el.dataset.uid),
  next: () => { nextRound(state.run); window.scrollTo(0, 0); },
  endless: () => continueEndless(state.run),
};

app.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  ev.preventDefault();
  const fn = actions[el.dataset.act];
  if (!fn) return;
  fn(el);
  app.classList.toggle('rolling', el.dataset.act === 'reroll' || el.dataset.act === 'score' || el.dataset.act === 'next');
  persist();
  render();
});
app.addEventListener('submit', ev => { ev.preventDefault(); actions.seeded(); });

async function boot() {
  const [bal, man] = await Promise.all([fetch('data/balance.json').then(r => r.json()), fetch('assets/manifest.json').then(r => r.json())]);
  setBalance(bal);
  initArt(man);
  installArtFallbacks(document);
  const q = new URLSearchParams(location.search);
  if (q.has('seed')) start(q.get('seed')); else render();
  // Test/debug hook (used by the screenshot script); harmless in normal play.
  window.DG = { state, render, persist };
}
boot().catch(err => { app.innerHTML = `<p class="loading">Could not load the game: ${String(err.message || err)}</p>`; console.error(err); });
