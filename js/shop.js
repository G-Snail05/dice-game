// Shop between rounds: dice for sale, a paid reroll of the offers, and selling dice for half.
import { B } from './balance.js';
import { makeDie, SHAPE_ORDER } from './dice.js';
import { SPECIALS, SPECIALS_BY_ID } from './specials.js';

export function priceOf(shape, special) {
  if (special) return SPECIALS_BY_ID[special].price;
  return B.prices[shape];
}

// Binary counters have their own roll per slot (counters.shopChance), so adding them does not dilute the
// odds of the classic specials. Which counter: shop rarity weight x the counter's own weight.
function rollCounter(rng) {
  const pool = SPECIALS.filter(s => s.counter).map(s => [s, (B.shop.rarityWeights[s.rarity] || 0) * (s.weight ?? 1)]).filter(e => e[1] > 0);
  if (!pool.length) return null;
  const s = rng.weighted(pool);
  return { shape: s.shape, special: s.id, price: s.price, sold: false };
}

function rollOffer(run, forceSpecial = false) {
  const rng = run.rng;
  const C = B.counters;
  if (!forceSpecial && C && C.shopChance && rng.next() < C.shopChance) { const o = rollCounter(rng); if (o) return o; }
  if (forceSpecial || rng.next() < B.shop.specialChance) {
    const rarity = rng.weighted(Object.entries(B.shop.rarityWeights));
    let pool = SPECIALS.filter(s => s.rarity === rarity && !s.counter);
    if (forceSpecial) pool = SPECIALS.filter(s => B.shop.firstShopPool.includes(s.id));
    const s = rng.pick(pool.length ? pool : SPECIALS.filter(x => !x.counter));
    return { shape: s.shape, special: s.id, price: s.price, sold: false };
  }
  const shape = rng.weighted(SHAPE_ORDER.map(k => [k, B.shop.shapeWeights[k] || 0]));
  return { shape, special: null, price: B.prices[shape], sold: false };
}

export function openShop(run) {
  const first = run.stats.shops === 0;
  run.stats.shops++;
  run.shop = { offers: rollOffers(run, first && B.shop.guaranteeSpecialFirstShop), rerollCost: B.shop.rerollBase };
}

function rollOffers(run, guarantee) {
  const out = [];
  for (let i = 0; i < B.shop.slots; i++) out.push(rollOffer(run, guarantee && i === 0));
  return out;
}

export function buy(run, i) {
  const o = run.shop && run.shop.offers[i];
  if (!o || o.sold || run.gold < o.price) return false;
  run.gold -= o.price;
  o.sold = true;
  run.bag.push(makeDie(run, o.shape, o.special, o.price));
  run.stats.bought++;
  return true;
}

export function rerollShop(run) {
  if (!run.shop || run.gold < run.shop.rerollCost) return false;
  run.gold -= run.shop.rerollCost;
  run.shop.rerollCost += B.shop.rerollStep;
  run.shop.offers = rollOffers(run, false);
  return true;
}

export const sellValue = die => Math.floor((die.cost || B.prices[die.shape] || 0) * B.shop.sellFraction);
export const canSell = run => run.bag.length > B.shop.minBag;

export function sell(run, uid) {
  if (!canSell(run)) return false;
  const d = run.bag.find(x => x.uid === uid);
  if (!d) return false;
  run.gold += sellValue(d);
  run.bag = run.bag.filter(x => x.uid !== uid);
  return true;
}
