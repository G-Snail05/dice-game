// Round screen, layout 2: slim HUD bar (points / target / throws + re-rolls), a felt TABLE where rolled
// dice land, and the HAND at the bottom (drawn dice face-down before the roll, held dice after).
// Die i always owns column i in both rows, so it moves straight up/down between hand and table.
import { totalRounds } from '../balance.js';
import { handDice, preview, canReroll } from '../round.js';
import { artHTML } from '../art.js';
import { dieArt, badge, cssDie, staticDie } from './dieView.js';
import { btn, coin, esc, fmtMult } from './dom.js';
import { dieName, specialOf } from '../dice.js';

export function breakdown(res, { title } = {}) {
  const lines = res.lines.map(l => `<li class="l-${l.layer}${l.idle ? ' idle' : ''}"><b>${esc(l.who)}</b> ${esc(l.text)}</li>`).join('');
  return `<div class="breakdown">${title ? `<div class="bd-head">${esc(title)}</div>` : ''}<ol>${lines}</ol>
    <div class="bd-total"><span class="pts">${res.points}${res.pending ? '+?' : ''}</span> × <span class="mul">${fmtMult(res.mult)}</span> = <strong>${res.total}${res.pending ? '+' : ''}</strong>${res.gold ? ` <span class="gold">+$${res.gold}</span>` : ''}</div></div>`;
}

export const inHand = (run, i, opts = {}) => !opts.allOnTable && (!run.round.revealed || run.round.locked[i]);

export function bar(run) {
  const r = run.round, p = Math.min(1, r.score / r.target);
  return `<header class="hudbar" aria-label="Round status">
    <div class="stat st-pts"><small>Points</small><b id="barPoints">${r.score}</b></div>
    <div class="stat st-tgt"><small>Target</small><b>${r.target}</b></div>
    <div class="stat st-rolls"><span><small>Throws</small><b>${r.throwsLeft}</b></span><span><small>Re-rolls</small><b>${r.rerollsLeft}</b></span></div>
    <i class="prog" aria-hidden="true"><i style="transform:scaleX(${p.toFixed(3)})"></i></i>
  </header>`;
}

function dieBtn(run, d, i, where) {
  const r = run.round, s = specialOf(d), held = r.revealed && r.locked[i];
  const face = r.revealed ? dieArt(d) : artHTML(`die_${d.shape}_blank`, { cls: 'die-art', alt: `${dieName(d)}, not rolled yet`, fallback: cssDie(d.shape, '?') });
  const label = r.revealed ? `${dieName(d)} showing ${d.face}${held ? ', held' : ''}. Tap to ${held ? 'return it to the table' : 'hold it'}.` : `${dieName(d)}, in your hand`;
  return `<button class="die ${held ? 'locked' : ''} ${s ? 'special l-' + s.layer : ''} at-${where}" data-act="lock" data-i="${i}" data-uid="${d.uid}" ${r.revealed ? '' : 'disabled'} aria-pressed="${held}" aria-label="${esc(label)}${s ? ' ' + esc(s.desc) : ''}">
    ${face}${badge(d)}${held ? `<span class="lockmark">${artHTML('icon_lock', { alt: '', fallback: '🔒' })} HELD</span>` : ''}</button>`;
}

export function iconBar(compact = false) {
  const o = c => (compact ? {} : { caption: c });
  return `<div class="iconbar ${compact ? 'compact' : ''}">${btn('quit', 'Pause and go to the menu (run is saved)', { icon: 'ui_btn_pause', ...o('Pause') })}${btn('info', 'How to play', { icon: 'ui_btn_info', ...o('Info') })}${btn('settings', 'Settings', { icon: 'ui_btn_settings', ...o('Settings') })}</div>`;
}

export function bagView(run) {
  const counts = new Map();
  for (const d of run.bag) { const k = dieName(d); counts.set(k, { d, n: (counts.get(k)?.n || 0) + 1 }); }
  return `<details class="bag"><summary>Bag (${run.bag.length})</summary><ul class="baglist">${[...counts.values()].map(({ d, n }) => {
    const s = specialOf(d);
    return `<li>${staticDie(d)}<span><b>${esc(dieName(d))}</b> ×${n}${s ? `<br><small>${esc(s.desc)}</small>` : ''}</span></li>`;
  }).join('')}</ul></details>`;
}

export function tallyHTML(run) {
  const r = run.round;
  if (!r.revealed) return `<p class="hint">Roll to throw your hand onto the table.</p>`;
  return breakdown(preview(run), { title: 'This throw' });
}

export function roundView(run, opts = {}) {
  const r = run.round, dice = handDice(run);
  const cols = dice.map((d, i) => ({ d, i, hand: inHand(run, i, opts) }));
  return `<section class="screen round r2">
    ${bar(run)}
    <div class="table">
      <div class="tcorner tl"><span class="rlabel">${esc(r.label)}</span>${coin(run.gold)}</div>
      <div class="tcorner tr">${iconBar(true)}</div>
      <div class="slots tslots" role="group" aria-label="Table">${cols.map(c => `<div class="slot">${c.hand ? '<span class="ghost"></span>' : dieBtn(run, c.d, c.i, 'table')}</div>`).join('')}</div>
      <div class="tally" aria-live="polite">${tallyHTML(run)}</div>
      <div class="tfoot">${bagView(run)}<span class="seed">Seed ${esc(run.seed)}${run.endless ? ' · endless' : ` · ${totalRounds()} rounds`}${r.last ? ` · last throw +${r.last.total}` : ''}</span></div>
    </div>
    <div class="hand">
      <div class="handlabel"><b>Hand</b> <small>${r.revealed ? 'Tap a die to hold it here; re-roll the rest.' : `${dice.length} dice drawn from your bag`}</small></div>
      <div class="slots hslots" role="group" aria-label="Hand">${cols.map(c => `<div class="slot">${c.hand ? dieBtn(run, c.d, c.i, 'hand') : '<span class="ghost"></span>'}</div>`).join('')}</div>
      <div class="actions">${r.revealed
        ? btn('reroll', `Re-roll (${r.rerollsLeft} left)`, { icon: 'ui_btn_reroll', disabled: !canReroll(run), caption: `${r.rerollsLeft} re-roll${r.rerollsLeft === 1 ? '' : 's'} left` }) + btn('score', 'Score throw', { icon: 'ui_btn_score', cls: 'primary', caption: `${r.throwsLeft} throw${r.throwsLeft === 1 ? '' : 's'} left` })
        : btn('roll', 'Roll', { icon: 'ui_btn_roll', cls: 'primary', caption: 'Throw your hand' })}</div>
    </div>
  </section>`;
}
