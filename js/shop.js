// Shop between rounds: dice for sale, a paid reroll of the offers, and selling dice for half.
import { B } from './balance.js';
import { makeDie, SHAPE_ORDER } from './dice.js';
import { SPECIALS, SPECIALS_BY_ID, MOD_SHAPES, modPrice } from './specials.js';

// Modifier dice cost their plain shape's price + mods.priceAdd ($2); other specials have their own price.
export function priceOf(shape, special) {
  if (special && SPECIALS_BY_ID[special].mod) return modPrice(shape);
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

// Exotic sets (Casino, Odds & Evens) work the same way, but share the counters' single roll per slot:
// x < counters.shopChance -> counter, then the next casino.shopChance -> Casino, then parity.shopChance ->
// Odds & Evens. One draw keeps the classic offers' odds (and old seeds' shops) unchanged when no exotic shows.
function rollSet(rng, set) {
  const pool = SPECIALS.filter(s => s.set === set).map(s => [s, (B.shop.rarityWeights[s.rarity] || 0) * (s.weight ?? 1)]).filter(e => e[1] > 0);
  if (!pool.length) return null;
  const s = rng.weighted(pool);
  return { shape: s.shape, special: s.id, price: s.price, sold: false };
}
export const exoticChances = () => [['counter', (B.counters && B.counters.shopChance) || 0], ['casino', (B.casino && B.casino.shopChance) || 0], ['parity', (B.parity && B.parity.shopChance) || 0]];
function rollExotic(rng) {
  const ch = exoticChances(), tot = ch.reduce((a, c) => a + c[1], 0);
  if (!tot) return null;
  let x = rng.next();
  for (const [set, p] of ch) { if (x < p) return set === 'counter' ? rollCounter(rng) : rollSet(rng, set); x -= p; }
  return null;
}

const classic = s => !s.counter && !s.set;
function rollOffer(run, forceSpecial = false) {
  const rng = run.rng;
  if (!forceSpecial) { const o = rollExotic(rng); if (o) return o; }
  if (forceSpecial || rng.next() < B.shop.specialChance) {
    const rarity = rng.weighted(Object.entries(B.shop.rarityWeights));
    let pool = SPECIALS.filter(s => s.rarity === rarity && classic(s));
    if (forceSpecial) pool = SPECIALS.filter(s => B.shop.firstShopPool.includes(s.id));
    const s = rng.pick(pool.length ? pool : SPECIALS.filter(classic));
    if (!s.mod) return { shape: s.shape, special: s.id, price: s.price, sold: false };
    // Modifier: roll the shape it comes on (mods.shapeWeights, else the plain-dice shapeWeights).
    const W = (B.mods && B.mods.shapeWeights) || B.shop.shapeWeights;
    const shape = rng.weighted(MOD_SHAPES.map(k => [k, W[k] || 0]));
    return { shape, special: s.id, price: priceOf(shape, s.id), sold: false };
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
