import { artHTML } from '../art.js';
import { B, totalRounds } from '../balance.js';
import { btn, esc } from './dom.js';
import { SPECIALS } from '../specials.js';
import { staticDie } from './dieView.js';

export function titleView({ save, best }) {
  return `<section class="screen title">
    <h1 class="logo">${artHTML('ui_logo', { alt: 'Dice game', fallback: 'Dice game' })}<small>working title</small></h1>
    <p class="lede">Throw dice, lock the good ones, beat the target. Spend your winnings on stranger dice. Survive ${totalRounds()} rounds.</p>
    <div class="stack">
      ${save ? btn('continue', `Continue run, round ${save.roundNo}`, { icon: 'ui_btn_continue', cls: 'primary', caption: `Continue run · round ${save.roundNo}` }) : ''}
      ${btn('new', 'New run', { icon: 'ui_btn_new_run', cls: save ? '' : 'primary' })}
      <div class="iconbar">${btn('info', 'How to play', { icon: 'ui_btn_info', caption: 'Info' })}${btn('settings', 'Settings', { icon: 'ui_btn_settings', caption: 'Settings' })}</div>
      <details class="seed"><summary>Seeded run</summary>
        <form data-form="seed"><label>Seed <input name="seed" maxlength="24" autocomplete="off" placeholder="e.g. FROG42"></label>${btn('seeded', 'Start seeded run')}</form>
      </details>
    </div>
    ${best ? `<p class="best">Best: ${best.wins} win${best.wins === 1 ? '' : 's'} · furthest round ${best.round} · best throw ${best.throw}</p>` : ''}
    <details class="how"><summary>How to play</summary>${howToPlay()}</details>
  </section>`;
}

export function howToPlay() {
  return `
      <ul>
        <li>Each round you get <b>${B.throws} throws</b>. A throw draws <b>${B.handDraw} dice</b> from your bag into your hand. <b>Pick ${B.rollCount}</b> (their shape and special badge are shown), then <b>Roll</b> them onto the table. The other ${B.handDraw - B.rollCount} sit out that throw and are not scored.</li>
        <li>Tap table dice to <b>hold</b> them, then <b>Re-roll</b> the rest. You have <b>${B.rerolls} re-rolls</b> per round, shared across throws.</li>
        <li><b>Score</b> adds the faces (<span class="pts">points</span>), then special dice apply left to right (<span class="mul">mult</span>, <span class="gold">$</span>). Score = points × mult.</li>
        <li>Reach the target before your throws run out. Unused throws pay $1 each, plus $1 interest per $5 held (max $5).</li>
        <li>After each throw every die goes back into the bag, and the next throw draws a fresh ${B.handDraw}.</li>
        <li>Buy dice in the shop, sell weak ones for half. Win after round ${totalRounds()}, then keep going in endless mode.</li>
      </ul>`;
}

// Info screen: rules plus every special die.
export function infoView() {
  return `<section class="screen info">
    <h1>How to play</h1>
    <div class="panel">${howToPlay()}</div>
    <h2>Special dice</h2>
    <ul class="baglist panel">${SPECIALS.map(s => `<li>${staticDie({ shape: s.shape, special: s.id })}<span><b>${esc(s.name)}</b> <small class="rar r-${s.rarity}">${s.rarity} · $${s.price}</small><br><small>${esc(s.desc)}</small></span></li>`).join('')}</ul>
    <div class="stack">${btn('back', 'Back', { cls: 'primary' })}</div>
  </section>`;
}
