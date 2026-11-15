import { artHTML } from '../art.js';
import { B, totalRounds } from '../balance.js';
import { btn, esc } from './dom.js';

export function titleView({ save, best }) {
  return `<section class="screen title">
    <div class="logo">${artHTML('ui_logo', { alt: '' })}</div>
    <h1>Dice game <small>working title</small></h1>
    <p class="lede">Throw dice, lock the good ones, beat the target. Spend your winnings on stranger dice. Survive ${totalRounds()} rounds.</p>
    <div class="stack">
      ${save ? btn('continue', `Continue run · round ${save.roundNo}`, { icon: 'ui_btn_next', cls: 'primary' }) : ''}
      ${btn('new', 'New run', { icon: 'ui_btn_new_run', cls: save ? '' : 'primary' })}
      <details class="seed"><summary>Seeded run</summary>
        <form data-form="seed"><label>Seed <input name="seed" maxlength="24" autocomplete="off" placeholder="e.g. FROG42"></label>${btn('seeded', 'Start seeded run')}</form>
      </details>
    </div>
    ${best ? `<p class="best">Best: ${best.wins} win${best.wins === 1 ? '' : 's'} · furthest round ${best.round} · best throw ${best.throw}</p>` : ''}
    <details class="how"><summary>How to play</summary>
      <ul>
        <li>Each round you get <b>${B.throws} throws</b>. A throw draws <b>${B.handSize} dice</b> from your bag and rolls them.</li>
        <li>Tap dice to <b>lock</b> them, then <b>Re-roll</b> the rest. You have <b>${B.rerolls} re-rolls</b> per round, shared across throws.</li>
        <li><b>Score</b> adds the faces (<span class="pts">points</span>), then special dice apply left to right (<span class="mul">mult</span>, <span class="gold">$</span>). Score = points × mult.</li>
        <li>Reach the target before your throws run out. Unused throws pay $1 each, plus $1 interest per $5 held (max $5).</li>
        <li>Buy dice in the shop, sell weak ones for half. Win after round ${totalRounds()}, then keep going in endless mode.</li>
      </ul>
    </details>
  </section>`;
}
