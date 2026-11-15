import { B, totalRounds } from '../balance.js';
import { handDice, preview, canReroll } from '../round.js';
import { trayDie, staticDie } from './dieView.js';
import { btn, coin, esc, fmtMult } from './dom.js';
import { dieName, specialOf } from '../dice.js';

export function breakdown(res, { title, animate = false } = {}) {
  const lines = res.lines.map((l, k) => `<li class="l-${l.layer}${l.idle ? ' idle' : ''}" style="${animate ? `animation-delay:${k * 140}ms` : ''}"><b>${esc(l.who)}</b> ${esc(l.text)}</li>`).join('');
  const goldLine = res.gold ? ` <span class="gold">+$${res.gold}</span>` : '';
  return `<div class="breakdown">
    <div class="bd-head">${esc(title)}</div>
    <ol>${lines}</ol>
    <div class="bd-total"><span class="pts">${res.points}${res.pending ? '+?' : ''}</span> × <span class="mul">${fmtMult(res.mult)}</span> = <strong>${res.total}${res.pending ? '+' : ''}</strong>${goldLine}</div>
  </div>`;
}

export function hud(run) {
  const r = run.round;
  const pct = Math.min(100, Math.round((r.score / r.target) * 100));
  return `<header class="hud">
    <div class="hud-row"><span class="rlabel">${esc(r.label)}</span>${coin(run.gold)}</div>
    <div class="hud-row big"><span>Score <b>${r.score}</b></span><span>Target <b>${r.target}</b></span></div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${r.target}" aria-valuenow="${r.score}"><i style="width:${pct}%"></i></div>
    <div class="hud-row counters"><span>Throws left <b>${r.throwsLeft}</b>/${B.throws}</span><span>Re-rolls <b>${r.rerollsLeft}</b>/${B.rerolls}</span></div>
  </header>`;
}

export function bagView(run) {
  const counts = new Map();
  for (const d of run.bag) { const k = dieName(d); counts.set(k, { d, n: (counts.get(k)?.n || 0) + 1 }); }
  return `<details class="bag"><summary>Your bag (${run.bag.length} dice)</summary><ul class="baglist">${[...counts.values()].map(({ d, n }) => {
    const s = specialOf(d);
    return `<li>${staticDie(d)}<span><b>${esc(dieName(d))}</b> ×${n}${s ? `<br><small>${esc(s.desc)}</small>` : ''}</span></li>`;
  }).join('')}</ul></details>`;
}

export function roundView(run, { justScored }) {
  const r = run.round, dice = handDice(run);
  const pv = preview(run);
  return `<section class="screen round">
    ${hud(run)}
    ${r.last ? `<div class="last ${justScored ? 'pop' : ''}">${breakdown(r.last, { title: `Last throw: +${r.last.total}${r.last.shattered ? ' · a Glass die shattered!' : ''}`, animate: justScored })}</div>` : ''}
    <div class="tray" role="group" aria-label="Your dice">${dice.map((d, i) => trayDie(d, i, { locked: r.locked[i] })).join('')}</div>
    <p class="hint">${r.rerollsLeft ? 'Tap dice to lock them, then re-roll the rest.' : 'No re-rolls left this round. Score this throw.'}</p>
    ${breakdown(pv, { title: 'This throw would score' })}
    <div class="actions">
      ${btn('reroll', `Re-roll (${r.rerollsLeft})`, { icon: 'ui_btn_roll', disabled: !canReroll(run) })}
      ${btn('score', `Score throw`, { icon: 'ui_btn_score', cls: 'primary' })}
    </div>
    ${bagView(run)}
    <p class="seedline">Seed ${esc(run.seed)}${run.endless ? ' · endless' : ` · ${totalRounds()} rounds`} · ${btn('quit', 'Menu', { cls: 'link' })}</p>
  </section>`;
}
