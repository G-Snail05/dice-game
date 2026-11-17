import { roundInfo } from '../balance.js';
import { sellValue, canSell } from '../shop.js';
import { specialOf, dieName, facesOf } from '../dice.js';
import { SPECIALS_BY_ID } from '../specials.js';
import { staticDie, specialDesc } from './dieView.js';
import { iconBar } from './roundView.js';
import { btn, coin, esc } from './dom.js';

function offerCard(run, o, i) {
  const fake = { shape: o.shape, special: o.special };
  const s = o.special ? SPECIALS_BY_ID[o.special] : null;
  const f = facesOf(fake);
  const desc = s ? `${specialDesc(fake)}${s.set ? ` (${s.set === 'casino' ? 'Casino' : 'Odds & Evens'} set)` : ''}` : `Faces ${f[0]}–${f[f.length - 1]} (average ${((f[0] + f[f.length - 1]) / 2).toFixed(1)}).`;
  return `<li class="offer ${o.sold ? 'sold' : ''} ${s ? 'l-' + s.layer : ''}">
    ${staticDie(fake, { disabled: !o.sold && run.gold < o.price })}
    <div class="otext"><b>${esc(dieName(fake))}</b>${s ? ` <small class="rar r-${s.rarity}">${s.rarity}</small>` : ''}<br><small>${esc(desc)}</small></div>
    ${o.sold ? '<span class="soldtag">Sold</span>' : btn('buy', `Buy for $${o.price}`, { icon: 'ui_btn_buy', disabled: run.gold < o.price, data: `data-i="${i}"`, cls: 'buy', caption: `$${o.price}` })}
  </li>`;
}

export function shopView(run) {
  const e = run.earnings, next = roundInfo(run.roundNo + 1);
  const sellable = canSell(run);
  return `<section class="screen shop">
    <header class="hud"><div class="hud-row"><span class="rlabel">Shop</span>${coin(run.gold)}</div></header>
    ${e ? `<div class="earn"><b>Round cleared!</b> Reward $${e.reward}${e.unused ? ` · unused throws $${e.unused}` : ''}${e.interest ? ` · interest $${e.interest}` : ''}${e.dieGold ? ` · (Gold dice paid $${e.dieGold} during the round)` : ''} = <span class="gold">+$${e.total}</span></div>` : ''}
    <ul class="offers">${run.shop.offers.map((o, i) => offerCard(run, o, i)).join('')}</ul>
    <div class="actions">${btn('shopReroll', `Reroll shop for $${run.shop.rerollCost}`, { icon: 'ui_btn_shop_reroll', disabled: run.gold < run.shop.rerollCost, caption: `Reroll shop · $${run.shop.rerollCost}` })}</div>
    <details class="bag sell"><summary>Sell dice (${run.bag.length} in bag)</summary>
      ${sellable ? '' : '<p class="hint">Your bag is at the minimum size.</p>'}
      <ul class="baglist">${run.bag.map(d => `<li>${staticDie(d)}<span><b>${esc(dieName(d))}</b>${specialOf(d) ? `<br><small>${esc(specialDesc(d))}</small>` : ''}</span>${btn('sell', `Sell ${esc(dieName(d))} for $${sellValue(d)}`, { icon: 'ui_btn_sell', disabled: !sellable, data: `data-uid="${d.uid}"`, cls: 'small', caption: `$${sellValue(d)}` })}</li>`).join('')}</ul>
    </details>
    <div class="actions">${btn('next', `Next: ${esc(next.label)}, target ${next.target}`, { icon: 'ui_btn_next', cls: 'primary wide', caption: `${esc(next.label)} · target ${next.target}` })}</div>
    ${iconBar()}
  </section>`;
}
