// Round screen, layout 2: slim HUD bar (points / target / throws + re-rolls), a felt TABLE where rolled
// dice land, and the HAND at the bottom in two rows. Before the roll the hand holds the 7 drawn dice
// (5 in the top row, the rest below) and the player picks 5 to roll. After the roll, die i of the throw
// owns column i in the top hand row and on the table (hold = straight down), and the unpicked dice sit
// dimmed in the bottom row, out of play for this throw.
import { totalRounds } from '../balance.js';
import { handDice, benchDice, preview, canReroll, canRoll, rollNeed, selectedCount } from '../round.js';
import { B } from '../balance.js';
import { artHTML } from '../art.js';
import { dieArt, badge, cssDie, staticDie, blankArt, specialDesc } from './dieView.js';
import { btn, coin, esc, fmtMult } from './dom.js';
import { dieName, specialOf, faceLabel } from '../dice.js';

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

// A drawn die before the roll: shows its shape and special badge so the pick is meaningful.
function pickBtn(run, d, i) {
  const r = run.round, s = specialOf(d), on = !!(r.selected && r.selected[i]);
  const full = !on && selectedCount(run) >= rollNeed(run);
  const label = `${dieName(d)}${on ? ', picked' : ''}. Tap to ${on ? 'put it back' : 'pick it for this roll'}.`;
  return `<button class="die pick ${on ? 'picked' : ''} ${full ? 'full' : ''} ${s ? 'special l-' + s.layer : ''}" data-act="pick" data-i="${i}" data-uid="${d.uid}" aria-pressed="${on}" aria-label="${esc(label)}${s ? ' ' + esc(specialDesc(d)) : ''}">
    ${blankArt(d)}${badge(d)}<span class="shapetag">${esc(s ? s.tag || s.name : d.shape)}</span>${on ? '<span class="pickmark" aria-hidden="true">✓</span>' : ''}</button>`;
}

// An unpicked die after the roll: dimmed, not interactive, not scored.
function benchBtn(d) {
  const s = specialOf(d);
  return `<span class="die benched ${s ? 'special l-' + s.layer : ''}" data-uid="${d.uid}" aria-label="${esc(dieName(d))}, sitting out this throw">
    ${blankArt(d)}${badge(d)}<span class="shapetag">${esc(s ? s.tag || s.name : d.shape)}</span></span>`;
}

// Parity Coin matches in the current throw: die index -> {side, add} (two coins on the same side stack).
export function parityMarks(res) {
  const m = new Map();
  for (const l of res.lines) if (l.parity && !l.idle) for (const j of l.matches) { const o = m.get(j) || { side: l.parity, add: 0 }; o.add += l.addMult / l.matches.length; m.set(j, o); }
  return m;
}

function dieBtn(run, d, i, where, marks = null) {
  const r = run.round, s = specialOf(d), held = r.revealed && r.locked[i];
  const mark = marks && marks.get(i);
  const face = r.revealed ? dieArt(d, d.face, d.tag, { parity: mark || null }) : blankArt(d, `${dieName(d)}, not rolled yet`);
  const label = r.revealed ? `${dieName(d)} showing ${faceLabel(d)}${held ? ', held' : ''}. Tap to ${held ? 'return it to the table' : 'hold it'}.` : `${dieName(d)}, in your hand`;
  return `<button class="die ${held ? 'locked' : ''} ${s ? 'special l-' + s.layer : ''}${mark ? ` pmatch pm-${mark.side}` : ''} at-${where}" data-act="lock" data-i="${i}" data-uid="${d.uid}" ${r.revealed ? '' : 'disabled'} aria-pressed="${held}" aria-label="${esc(label)}${mark ? ` Parity Coin: +${mark.add} mult (${mark.side}).` : ''}${s ? ' ' + esc(specialDesc(d)) : ''}">
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
    return `<li>${staticDie(d)}<span><b>${esc(dieName(d))}</b> ×${n}${s ? `<br><small>${esc(specialDesc(d))}</small>` : ''}</span></li>`;
  }).join('')}</ul></details>`;
}

export function tallyHTML(run) {
  const r = run.round;
  if (!r.revealed) return `<p class="hint">Pick ${rollNeed(run)} dice from your hand, then roll them onto the table.</p>`;
  return breakdown(preview(run), { title: 'This throw' });
}

export function roundView(run, opts = {}) {
  const r = run.round, dice = handDice(run), cols = B.rollCount;
  const marks = r.revealed && dice.some(d => d.special === 'paritycoin') ? parityMarks(preview(run)) : null;
  const tableCols = r.revealed ? dice.map((d, i) => ({ d, i, hand: inHand(run, i, opts) })) : [];
  while (tableCols.length < cols) tableCols.push({ empty: true });
  // Hand rows: top row = `cols` slots, bottom row = the rest (bench).
  let top, bottom;
  if (r.revealed) {
    top = tableCols.map(c => (!c.empty && c.hand ? dieBtn(run, c.d, c.i, 'hand', marks) : '<span class="ghost"></span>'));
    bottom = benchDice(run).map(benchBtn);
  } else {
    const picks = dice.map((d, i) => pickBtn(run, d, i));
    top = picks.slice(0, cols); bottom = picks.slice(cols);
    while (top.length < cols) top.push('<span class="ghost"></span>');
  }
  const benchN = Math.max(0, B.handDraw - B.rollCount);
  while (bottom.length < benchN) bottom.push('<span class="ghost small"></span>');
  const n = selectedCount(run), need = rollNeed(run);
  const label = r.revealed
    ? `Tap a die to hold it here; re-roll the rest.${bottom.some(b => b.includes('benched')) ? ' Dimmed dice sit out this throw.' : ''}`
    : `<span class="pickcount ${n === need ? 'done' : ''}" aria-live="polite">${n}/${need} selected</span> · pick ${need} of ${dice.length} to roll`;
  return `<section class="screen round r2">
    ${bar(run)}
    <div class="table">
      <div class="tcorner tl"><span class="rlabel">${esc(r.label)}</span>${coin(run.gold)}</div>
      <div class="tcorner tr">${iconBar(true)}</div>
      <div class="slots tslots" role="group" aria-label="Table">${tableCols.map(c => `<div class="slot">${c.empty || c.hand ? '<span class="ghost"></span>' : dieBtn(run, c.d, c.i, 'table', marks)}</div>`).join('')}</div>
      <div class="tally" aria-live="polite">${tallyHTML(run)}</div>
      <div class="tfoot">${bagView(run)}<span class="seed">Seed ${esc(run.seed)}${run.demo ? ` · demo ${esc(run.demo)}` : ""}${run.endless ? ' · endless' : ` · ${totalRounds()} rounds`}${r.last ? ` · last throw +${r.last.total}` : ''}</span></div>
    </div>
    <div class="hand ${r.revealed ? 'rolled' : 'picking'}">
      <div class="handlabel"><b>Hand</b> <small>${label}</small></div>
      <div class="slots hslots" role="group" aria-label="Hand">${top.map(h => `<div class="slot">${h}</div>`).join('')}</div>
      <div class="slots hslots bench" role="group" aria-label="${r.revealed ? 'Sitting out' : 'Hand, second row'}">${bottom.map(h => `<div class="slot">${h}</div>`).join('')}</div>
      <div class="actions">${r.revealed
        ? btn('reroll', `Re-roll (${r.rerollsLeft} left)`, { icon: 'ui_btn_reroll', disabled: !canReroll(run), caption: `${r.rerollsLeft} re-roll${r.rerollsLeft === 1 ? '' : 's'} left` }) + btn('score', 'Score throw', { icon: 'ui_btn_score', cls: 'primary', caption: `${r.throwsLeft} throw${r.throwsLeft === 1 ? '' : 's'} left` })
        : btn('roll', canRoll(run) ? `Roll ${need} dice` : `Pick ${need - n} more`, { icon: 'ui_btn_roll', cls: 'primary', disabled: !canRoll(run), caption: canRoll(run) ? `Roll ${need} dice` : `Pick ${need - n} more` })}</div>
    </div>
  </section>`;
}
