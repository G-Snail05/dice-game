import { totalRounds } from '../balance.js';
import { btn, esc } from './dom.js';

const stats = run => `<dl class="stats">
  <div><dt>Rounds cleared</dt><dd>${run.stats.roundsWon}</dd></div>
  <div><dt>Best throw</dt><dd>${run.stats.bestThrow}</dd></div>
  <div><dt>Total scored</dt><dd>${run.stats.totalScore}</dd></div>
  <div><dt>Dice bought</dt><dd>${run.stats.bought}</dd></div>
  <div><dt>Seed</dt><dd>${esc(run.seed)}</dd></div></dl>`;

export function winView(run) {
  return `<section class="screen end win">
    <h1>Run won! 🎉</h1>
    <p class="lede">You beat all ${totalRounds()} rounds.</p>
    ${stats(run)}
    <div class="stack">${btn('endless', 'Keep going: endless mode', { icon: 'ui_btn_next', cls: 'primary', caption: 'Keep going: endless mode' })}${btn('new', 'New run', { icon: 'ui_btn_new_run' })}${btn('quit', 'Menu', { cls: 'link' })}</div>
  </section>`;
}

export function loseView(run) {
  const r = run.round;
  return `<section class="screen end lose">
    <h1>${run.endless ? 'Endless run over' : 'Run over'}</h1>
    <p class="lede">${esc(r.label)}: scored <b>${r.score}</b> of <b>${r.target}</b>.</p>
    ${stats(run)}
    <div class="stack">${btn('new', 'New run', { icon: 'ui_btn_new_run', cls: 'primary' })}${btn('quit', 'Menu', { cls: 'link' })}</div>
  </section>`;
}
