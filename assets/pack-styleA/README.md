# Dice game asset pack: style A (16-bit pixel)

This is the full pack in the style G picked (A, 16-bit pixel). It was built by extending `style-samples/style_a.py` and `pix.py`, so it uses the same 32×32 dice grid, 1px `#1a1030` outlines, three-tone shading and palette. It follows the art and mobile notes in `docs/research-brief.md` §4 and §6.

- **574 sprites**, each exported 4 times (`native/`, `1x/`, `2x/`, `3x/`), giving 2,296 PNGs.
- `manifest.json` lists every sprite: its files, native and CSS size, category, layer and effect colour, anchors, value areas and the Builder's key.
- `builder-manifest.styleA.json` is a drop-in for the game's `assets/manifest.json` format. It covers **all 85 keys** that `js/art.js → requiredKeys()` asks for.
- Contact sheets are in `sheets/`: `sheet_dice`, `sheet_specials`, `sheet_ui`, `sheet_fx`, `sheet_backgrounds`, `sheet_high_contrast` and `sheet_overview` (two phone mock-ups).

## Scales: one pixel grid everywhere
| folder | scale | use |
|---|---|---|
| `native/` | 1 native px | source / editing |
| `1x/` | native ×2 | **CSS px size**, DPR 1 (a die is 64×64 CSS px, and a button is 128×48) |
| `2x/` | native ×4 | DPR 2 phones |
| `3x/` | native ×6 | DPR 3 phones (`bg_*_full` = **1080×1920**) |

Use `<img src="1x/x.png" srcset="2x/x.png 2x, 3x/x.png 3x">` (the Builder's manifest `srcset` form), or the pack loader with `layout:'folders'`, `dir:'pack-styleA/'`, `scales:[1,2,3]`. Set `image-rendering: pixelated` and only ever scale by whole numbers. At 1x, 1 native px is 2 CSS px for every asset, so the dice, UI and backgrounds all share one grid. Five dice fit across a 360 CSS px portrait screen (`ui_panel_tray` is 352 CSS px wide).

**Touch targets:** text buttons are 64×24 native, which is 128×48 CSS at 1x. Icon buttons (`pause`, `settings`, `info`) are 24×24 native, which is 48×48 CSS. Both meet 44×44 pt (Apple) and 48×48 dp (Android). Don't render them below 1x. A die at 1x is 64 CSS px, which also makes a good tap target.

## Naming
- `die_<shape>_<face>.png`: shapes are `d4 d6 d8 d10 d12 d20 coin`. Every face value is included:
  - d4 1–4
  - d6 **0** (blank, for the Sleeper) to 9. 1–6 are pips and 7–9 are bold numerals, for Overcharged.
  - d8 1–8, d10 1–10, d12 1–12, d20 1–20
  - coin 0 and 10
  - `die_d6_x2`, the Sleeper's red ×2 face
  - Per shape: `die_<shape>_blank`, `die_<shape>_roll_1` and `die_<shape>_roll_2` (tumble frames). Cycle blank → roll_1 → roll_2 at about 12 fps while rolling, then show the face.
  - Builder key mapping: `die_d6_face3` → `die_d6_3.png`. This is listed in `manifest.json` as `builder_key`.
- `special_<name>_icon.png`, `special_<name>_icon_disabled.png`, `special_<name>_overlay.png` and `special_<name>_badge.png`: there are 22 specials, named after the brief's dice (list below).
- `ui_btn_<name>_<normal|pressed|disabled>.png`: the names are roll, score, reroll, shop, shop_reroll, buy, sell, next, new_run, pause, settings and info.
- `ui_panel_<name>.png`: score, target, round, throws, shop, points, mult, coins, frame (9-slice) and tray. There are also `ui_card_shop_<common|uncommon|rare|selected|sold>`, `ui_price_tag(_disabled)`, `ui_coin`, `ui_coin_small`, `ui_round_pip_<done|current|todo|boss>`, `ui_icon_<lock|reroll|target|boss>` and `ui_logo`.
- `fx_*`:
  - `fx_ring_<shape>_<layer>`: layer rings
  - `fx_select_<shape>`, `fx_locked_<shape>` and `fx_disabled_<shape>`: states
  - `fx_pop_<layer>_1..4`: score particle burst
  - `fx_flame_<blue|red>_1..4`: target cleared
  - `fx_coin_spin_1..4` and `fx_glass_shatter_1..3`
- `ui_font_bold_<white|blue|red|gold|violet|grey|dark>` and `ui_font_text_white`: bitmap-font strips. Glyph x and width for each are in `manifest.json → glyphs`, and the height is 9.
- `bg_<table|shop|hc>_tile.png` (32×32, seamless) and `bg_<table|shop|hc>_full.png` (180×320 native).
- `*_hc.png`: the **high-contrast** variant of the same sprite (brief §6, "High-contrast mode").

## Overlay anchoring (special dice are overlays, not new sprites)
- Every **overlay-family sprite** (`special_*_overlay`, `fx_ring_*`, `fx_select_*`, `fx_locked_*`, `fx_disabled_*`) is **42×42 native, with the 32×32 die drawn at (2,8)**. Put the die at (x,y) and the overlay at (x−2, y−8), at the same scale. The extra room above is where the badge goes.
- Each `special_*_overlay` has a ring traced to its brief shape (Pebble = d4, Boulder = d12, Coin = coin, Glass = d8, the rest d6), with the badge at the top right.
- To put any special on **any** shape, stack `fx_ring_<shape>_<layer>` and `special_<name>_badge`. Place the badge at die origin + `anchor.offset_from_die_origin` from `manifest.json`. That offset is always (badge-x, −8).
- Disabled = grey + X (brief): `fx_disabled_<shape>` adds a grey wash and an X. Pair it with CSS `filter: grayscale(1)` on the die underneath.
- `fx_glass_shatter_*` is 48×48 with the d8 at (8,8).
- Stacking order: die → ring → badge → state (locked/disabled) → fx_pop.

## Colour jobs (brief §6: one job per colour)
| layer | colour | badge / icon shape | used by |
|---|---|---|---|
| points | blue `#2563c9` (ring `#7cc6ff`) | rounded square | pebble, boulder, coin, overcharged, twin |
| multiplier | red `#d22a36` (ring `#ff5a66`) | circle (as in the sample) | sleeper, ruby, ember, last_call, matching, ladder, glass |
| money | gold `#e09a1a` (ring `#ffd23a`) | octagon | gold, hoarder (and coin, price tag) |
| rule-bending | violet `#8a3ad0` (ring `#c27cff`) | hexagon | loaded, echo, booster, corner, splitter, countdown, mimic, cull_token |
| disabled | grey `#6a6a7e` + X | — | disabled dice, disabled buttons and icons |

Violet is my addition, for the brief's conditional/positional and bag dice and the game's `layer:'rule'`. Gold is used only for money: rarity on shop cards is shown by 1, 2 or 3 white diamonds, not by colour. Each layer also has its **own badge shape**, so colour is never the only cue (brief: "shape and an icon as well as colour"), which helps with red/green colour-blindness on the felt.
The multiplier ring was brightened from the sample's `#ff3b4a` to `#ff5a66` so that it reaches 3:1 against the green felt.

### The 22 specials (brief §4)
`pebble` (1, d4, "1-4"), `boulder` (2, d12), `coin` (3, "0/10"), `loaded` (4), `sleeper` (5, "x2"), `overcharged` (6, "4-9"), `ruby` (7, "x1.5"), `ember` (8, "+2"), `last_call` (9, "x3"), `matching` (10, "x2"), `ladder` (11, "x2"), `echo` (12), `twin` (13), `booster` (14), `corner` (15), `splitter` (16), `countdown` (17, "20"), `gold` (18), `glass` (19, d8, "x3"), `hoarder` (20), `mimic` (21), `cull_token` (22).
Game id/key mapping: ruby→`icon_mult_x1_5`, ember→`icon_ember`, last_call (id `lastcall`)→`icon_mult_x3`, matching→`icon_mult_x2`, overcharged→`icon_overcharged`, coin→`icon_coin_flip`, gold→`icon_gold`, twin→`icon_twin`, echo→`icon_echo`, glass→`icon_glass`.
Ember's badge shows "+2" (confirmed: +2 mult per other even die). Note `js/specials.js` still has `add: 0.5` until The Builder updates it.

## Palette (hex)
- **Outline:** `#1a1030`
- **Die body (ivory, 3-tone + highlight):** `#ffffff` `#f4f4f8` `#d6d6e6` `#b8b8d0` `#9a9ab8` `#74749a`
- **Ink:** `#26204a` `#4a3f80`
- **Points:** `#122c68` `#173a86` `#2563c9` `#3d8ef0` `#b4e4ff` ring `#7cc6ff`/`#1f4fa8`
- **Multiplier:** `#6a0c20` `#8e1428` `#d22a36` `#e8434a` `#ff8a80` ring `#ff5a66`/`#9a1428`
- **Gold:** `#7a4008` `#a85e12` `#e09a1a` `#ffd23a` `#fff6c0`, glyph `#4a2606`
- **Rule:** `#3a1266` `#5e2a9e` `#8a3ad0` `#a85cf0` `#dcb4ff` ring `#c27cff`
- **Grey:** `#2e2e3e` `#4a4a5e` `#6a6a7e` `#8a8a9e` `#b0b0c0`
- **Buttons:** green `#16672e` `#1f8a3e` `#3ac25a` `#8ef08a`; blue `#2459bc` `#3d8ef0`; slate `#5a5a7e` `#74749a` `#b8b8d0` `#f4f4f8`
- **Panels:** `#3a2e66` `#221a3e` `#120c24` `#0a0618` `#2e2452`
- **Felt (table):** `#1d4a37` `#225640` `#2b6a4e` `#357a5b` `#10301f` `#0a2216`
- **Shop (sample tile):** `#2b1f4a` `#35285c` `#4a3a7c` `#5c4a96` `#1c1434`
- **High contrast:** black `#000000` ink and outline, white `#ffffff` faces, and saturated layers: points `#0a5cff`, multiplier `#e00020`, gold `#ffb000`, rule `#9b30ff`. Rings are a solid 2px. The background is `bg_hc_*` (`#0c0c14`).

## Contrast (WCAG ratios)
| pair | ratio |
|---|---|
| die ink on die face | 13.8:1 |
| Sleeper red ×2 on die face | 4.6:1 |
| white glyph on blue / red / violet | 5.7 / 5.1 / 5.8:1 |
| dark glyph or price on gold | 5.6:1 |
| button text on green / blue / slate | 7.8 / 5.4 / 9.3:1 |
| white / blue / red / gold / violet digits on panel | 19.0 / 5.7 / 5.4 / 13.2 / 6.9:1 |
| rings on felt: blue / red / gold / violet | 5.5 / 3.3 / 7.0 / 3.7:1 (≥ 3:1 non-text) |
| high-contrast ink | 21:1 |

Disabled button text is deliberately low (2.7:1), since disabled controls are exempt.

## Juice cues supplied as frames (brief §6)
| cue | asset |
|---|---|
| 3. coloured number pops up | `ui_font_bold_<colour>` (outlined digits, + − x . $ /) |
| 5. particle burst in the matching colour | `fx_pop_<layer>_1..4` (24×24, about 30 fps) |
| 8. flames only when the target is cleared | `fx_flame_blue/red_1..4` (32×32, loop at about 10 fps, tile horizontally) |
| money gained | `fx_coin_spin_1..4` |
| Glass die | `fx_glass_shatter_1..3` |
| currently resolving | `fx_select_<shape>` |

Cues 1, 2 and 7 (lift, squash-and-stretch, bounce) are cheaper as CSS transforms on these sprites. Cues 4 and 9 (pitch, haptics) are audio and device work, not art. Keep CRT and scanline effects off by default.

## Panels and value areas
The panels have their label baked in and an empty value area. `manifest.json → value_area` is an inclusive native rect: multiply it by the scale and draw the number there with `ui_font_bold_*`. `ui_panel_frame` is a 9-slice: use `border-image-slice: 6` at native, which is 12 at 1x. Shop cards have a die window at (8,14) for a 32×32 die, and a name strip at `name_strip`.

## Regenerate
```
cd asset-pack
python3 tools/build.py            # all sprites, native + 1x/2x/3x, manifest.json
python3 tools/sheets.py           # contact sheets
python3 tools/builder_manifest.py # builder-manifest.styleA.json (+ checks coverage of the game's requiredKeys)
```
The scripts need Python 3 and Pillow, plus Nunito for the sheet labels only.
- `tools/pix.py` is the sample's canvas library, unchanged.
- `tools/fonts.py` holds the bitmap fonts and glyphs.
- `tools/core.py` holds the palette, helpers and registry.
- `tools/dice.py`, `tools/specials.py`, `tools/ui.py` and `tools/bg.py` draw the pieces.

To change a colour job, edit `LAYERS` in `core.py`. To move a special to another layer or shape, edit `SPECIALS` in `specials.py`.
