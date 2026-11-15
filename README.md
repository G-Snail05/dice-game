# Dice game (working title)

A browser dice roguelike prototype: build a bag of dice, throw, lock, re-roll, beat rising targets, spend winnings in a shop.
Plain HTML, CSS and JavaScript ES modules. No build step. Placeholder art (see [ASSETS.md](ASSETS.md)).

## Play locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000/
```

`?seed=FROG42` in the URL starts a seeded run. Runs auto-save to `localStorage` (`diceGame.save`); best results in `diceGame.best`.

## Rules (current prototype)

- Start: a bag of **8 plain d6**, $4.
- Each round: **3 throws**. A throw draws **7 dice** (`handDraw`) from the bag into your **hand** (two rows, shape and special badge visible). **Pick 5** (`rollCount`; fewer if the bag is short) and **Roll** throws those onto the **table**; the other 2 stay in the hand, dimmed, out of play and unscored for that throw. After scoring, every die (rolled or not) returns to the bag and the next throw draws a fresh 7. Tap a table die to hold it (it drops back to your hand and keeps its face); **2 re-rolls** per round, shared across throws, re-roll the dice left on the table.
- Score = (sum of faces + point bonuses) × multiplier, specials resolving left to right, shown step by step.
- Reach the target before your throws run out, or the run ends. **8 rounds** win the run; then optional **endless** mode (linear-ish target growth).
- Earnings: round reward + $1 per unused throw + $1 interest per $5 held (max $5).
- Shop: 3 offers (the first shop always has a useful special), reroll $3 (+$1 each), sell dice for half price (bag minimum 5).

All numbers live in [`data/balance.json`](data/balance.json). Setting `"antes"` to an object like `antesExample` switches to antes × blinds (e.g. 8 × Small/Big/Boss = 24 rounds).

## Special dice (10, from the research brief's 22 ideas)

| Die | Layer | Effect |
|---|---|---|
| Ruby | mult | ×1.5 to the throw |
| Ember | mult | +2 mult per other even die (uncommon, $8) |
| Last Call | mult | ×3 on the final throw of the round |
| Matching | mult | ×2 if another die shows the same face |
| Overcharged | points | faces 4–9 |
| Coin | points | 0 or 10 |
| Twin | points / re-roll | a copy of the highest die re-rolls and adds its face |
| Gold | money | +$1 per 6 in the throw |
| Echo | rule | scores the value of the die to its left |
| Glass | mult / rule | ×3, breaks for the round; 1 in 4 chance to shatter for good |

Plain d4, d8, d10, d12 and d20 are sold in the shop too. Effects are data in `js/specials.js`; new dice reuse effect types or add a small handler.

## Code layout

```
index.html, css/style.css
js/main.js        app wiring, saving, event handling
js/rng.js         seeded RNG (mulberry32; state is one integer, saved with the run)
js/balance.js     loads data/balance.json; round schedule (targets, rewards, antes, endless)
js/dice.js        dice shapes, faces, rolling
js/specials.js    special dice as data + effect handlers
js/scoring.js     scores a throw and returns the player-facing breakdown
js/round.js       draw, lock, re-roll, score
js/shop.js        offers, buy, reroll, sell
js/run.js         run loop: round -> shop -> ... -> win/lose, endless, save/load
js/art.js         all visuals via assets/manifest.json (srcset, pack folders, CSS fallback)
js/ui/*.js        screens (title, round, shop, win/lose, settings, info) as HTML templates
js/ui/anim.js     promise-based animation queue (transform/opacity only; reduced motion = instant)
js/ui/roundAnim.js roll tumble, hold slide, scoring sequence, total flying into the points bar
data/balance.json all tuning
assets/           manifest.json + placeholder SVGs
tests/sim.mjs     unit checks + seeded headless run simulations (node tests/sim.mjs)
tools/            placeholder generator, target tuner, headless screenshot script
```

## Tests and balance

```sh
node tests/sim.mjs            # SIM_N=1000 for more runs
node tools/tune.mjs [t1,t1..]  # grid-search target curves against the bots (G=1.3,1.36 sets growth values)
```

The sim plays seeded runs with a "sensible" bot (picks the 5 highest-value dice of the 7 drawn, Last Call only on the final throw; holds above-average dice, buys the best value die, sells weak ones) and a random bot (picks 5 at random).
Picking 5 of 7 made the sensible bot much stronger (73% wins on the old 40…205 curve), so targets were retuned to 40, 55, 75, 100, 135, 185, 255, 345 (round 1 × ~1.36 per round): the sensible bot wins about 40–44% of runs and the random bot never wins.
