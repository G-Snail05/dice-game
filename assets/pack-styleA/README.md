# Dice game asset pack: style A (16-bit pixel)

This is the full pack in the style G picked (A, 16-bit pixel). It was built by extending `style-samples/style_a.py` and `pix.py`, so it uses the same 32×32 dice grid, 1px `#1a1030` outlines, three-tone shading and palette. It follows the art and mobile notes in `docs/research-brief.md` §4 and §6.

- **911 sprites**, each exported 4 times (`native/`, `1x/`, `2x/`, `3x/`), giving 3,644 PNGs. This includes the binary counters (see below).
- `manifest.json` lists every sprite: its files, native and CSS size, category, layer and effect colour, anchors, value areas and the Builder's key.
- `builder-manifest.styleA.json` is a drop-in for the game's `assets/manifest.json` format. It covers **all 146 keys** that `js/art.js → requiredKeys()` asks for, and every entry that has a high-contrast sprite carries an `hc` twin (used by `setVariant('hc')`).
- Contact sheets are in `sheets/`: `sheet_dice`, `sheet_specials`, `sheet_ui`, `sheet_fx`, `sheet_backgrounds`, `sheet_high_contrast`, `sheet_counters`, `sheet_shape_mods` and `sheet_overview` (two phone mock-ups).

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
  - **Overcharged +3 faces** above each normal top face: d4 5–7, d8 9–11, d10 11–13, d12 13–15, d20 21–23 (d6 7–9 were already there). Builder keys `die_<shape>_face<n>`.
  - `die_d6_x2`, the Sleeper's red ×2 face
  - Per shape: `die_<shape>_blank`, `die_<shape>_roll_1` and `die_<shape>_roll_2` (tumble frames). Cycle blank → roll_1 → roll_2 at about 12 fps while rolling, then show the face.
  - Builder key mapping: `die_d6_face3` → `die_d6_3.png`. This is listed in `manifest.json` as `builder_key`.
- `special_<name>_icon.png`, `special_<name>_icon_disabled.png`, `special_<name>_overlay.png` and `special_<name>_badge.png`: there are 22 specials, named after the brief's dice (list below).
- `ui_btn_<name>_<normal|pressed|disabled>.png`: the names are roll, score, reroll, shop, shop_reroll, buy, sell, next, new_run, **continue**, **endless**, pause, settings and info.
- `ui_btn_blank_<green|blue|slate|violet|icon>_<normal|pressed|disabled>.png`: **label-free** button skins (see Buttons below).
- `ui_panel_<name>.png`: score, target, round, throws, shop, points, mult, coins, frame (9-slice) and tray. There are also `ui_card_shop_<common|uncommon|rare|selected|sold>`, `ui_price_tag(_disabled)`, `ui_coin`, `ui_coin_small`, `ui_round_pip_<done|current|todo|boss>`, `ui_icon_<lock|reroll|target|boss>` and `ui_logo`.
- `fx_*`:
  - `fx_ring_<shape>_<layer>`: layer rings
  - `fx_select_<shape>`, `fx_locked_<shape>` and `fx_disabled_<shape>`: states
  - `fx_pop_<layer>_1..4`: score particle burst
  - `fx_flame_<blue|red>_1..4`: target cleared
  - `fx_coin_spin_1..4` and `fx_glass_shatter_1..3`
- `ui_font_bold_<white|blue|red|gold|violet|grey|dark>` and `ui_font_text_white`: bitmap-font strips. Glyph x and width for each are in `manifest.json → glyphs`, and the height is 9.
- `bg_<table|shop|hc>_tile.png` (32×32, seamless) and `bg_<table|shop|hc>_full.png` (180×320 native).
- `mod_<mod>_<shape>.png` and `mod_badge_<mod>.png`: modifiers on every die shape (see below).
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
- **Buttons:** green `#16672e` `#1f8a3e` `#3ac25a` `#8ef08a`; blue `#2459bc` `#3d8ef0`; slate `#5a5a7e` `#74749a` `#b8b8d0` `#f4f4f8`; violet `#3a1266` `#5e2a9e` `#8a3ad0` `#dcb4ff` (white text)
- **Panels:** `#3a2e66` `#221a3e` `#120c24` `#0a0618` `#2e2452`
- **Felt (table):** `#1d4a37` `#225640` `#2b6a4e` `#357a5b` `#10301f` `#0a2216`
- **Shop (sample tile):** `#2b1f4a` `#35285c` `#4a3a7c` `#5c4a96` `#1c1434`
- **High contrast:** black `#000000` ink and outline, white `#ffffff` faces, and saturated layers: points `#0a5cff`, multiplier `#e00020`, gold `#ffb000`, rule `#9b30ff`. Rings are a solid 2px. The background is `bg_hc_*` (`#0c0c14`); `bg_table_tile_hc` (`#04110b`) and `bg_shop_tile_hc` (`#0b0714`) are near-black twins that keep a faint felt/violet tint so the two screens stay recognisable. The HC coin is pure yellow `#ffe600` with black line work (16.6:1 on black).

## Contrast (WCAG ratios)
| pair | ratio |
|---|---|
| die ink on die face | 13.8:1 |
| Sleeper red ×2 on die face | 4.6:1 |
| white glyph on blue / red / violet | 5.7 / 5.1 / 5.8:1 |
| dark glyph or price on gold | 5.6:1 |
| button text on green / blue / slate / violet (white) | 7.8 / 5.4 / 9.3 / 5.8:1 |
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

## Modifiers on every die shape
For The Builder's `modArtKeys()` (`js/art.js`). Mods: `ruby`, `ember`, `lastcall`, `matching`, `overcharged`, `gold`, `twin`, `echo`, `glass`. Shapes: `d4 d6 d8 d10 d12 d20`. All 78 keys are listed in `builder-manifest.styleA.json → _newKeys_shapeMods`, and each one has an `_hc` twin.

| key | count | what |
|---|---|---|
| `mod_<mod>_<shape>` | 54 | 42×42 overlay, die drawn at (2,8): the usual overlay convention. A 2px ring (bright inner, dark outer) traced tightly to **that** shape's silhouette (triangle, square, diamond, kite, pentagon, icosahedron), in the mod's effect colour, plus the badge. |
| `mod_badge_<mod>` | 9 | 28×11 badge. Top-left = die top-left + **(11,−8)** on any shape (in the overlay canvas that is (13,0)). The pill is right-aligned in the 28×11 box, so narrower badges keep transparent space on the left. |
| `die_<shape>_face<n>` (Overcharged) | 15 | 32×32 faces above each top face, using the same numerals as the existing faces: single digits in the 7×10 face font (like d6 7–9), two digits in the bold 5×7 font. On the d8, two-digit numbers sit 2px lower, where the triangle is wider. |

**Badge text doesn't depend on shape:**
- ruby `x1.5`, ember `+2`, lastcall `x3`, matching `x2` and glass `x3`: red, circle family.
- overcharged **`+3`**: blue. The old d6-only `special_overcharged_*` sprites still say "4-9"; use `mod_*` for any shape.
- gold: glyph only, gold.
- twin: glyph only, blue.
- echo: glyph only, violet.

The badges are the existing special badges padded to the shared 28×11 box. Last Call is keyed `lastcall` (sprite names use the game id).

**The ring and the badge:**
- Ring pixels under the badge, and in a 1px gap around it, are removed, so the ring tucks behind the tab instead of running into it.
- On pointed tops (d4, d8, d10, d20), the badge sits over the top 1–2 rows of the apex, just as the fixed (11,−8) anchor implies. The widest badge (ruby `x1.5`) covers the tip on those shapes. The narrower ones sit just right of it.
- The numerals sit on the front face, well inside the ring.

Stacking: die → `mod_<mod>_<shape>` (or `fx_ring_<shape>_<layer>` + `mod_badge_<mod>`) → state → fx.

## Buttons
**Colour logic** (unchanged): green = go forward / primary (roll, buy, next, new run, **continue**); blue = score; slate = secondary (reroll, shop, shop reroll, sell, icon buttons); grey = disabled. **ENDLESS is violet**, the rule-bending colour: endless mode changes the run's rules, and on the win screen it sits next to the green NEW RUN, so the two choices look different. Violet buttons use white text (5.8:1).

**Labelled sets:** `ui_btn_reroll` says **REROLL** (with the ↻ glyph; `ui_btn_roll` is the first ROLL of a throw, so don't map re-roll to it), `ui_btn_continue` (CONTINUE, green) and `ui_btn_endless` (ENDLESS, violet). Each has normal / pressed / disabled and `_hc` twins, in the same 5×7 bitmap lettering and 64×24 native size (128×48 CSS).

**Label-free sets** for game-drawn text: `ui_btn_blank_<green|blue|slate|violet>` (64×24) and `ui_btn_blank_icon` (24×24, 48×48 CSS), each normal / pressed / disabled + `_hc`. Same sizes, bevels and 44pt+ touch targets as the labelled buttons; the face is left empty.
- `manifest.json → text_area` is the clear inclusive native rect: `[4,4,59,18]` normal/disabled, `[4,6,59,20]` pressed (the pressed art sits 2 native px lower); icon size `[4,4,19,18]` / `[4,6,19,20]`. Multiply by the scale (×2 for CSS px at 1x) and centre the text in it.
- `text_colour` / `text_shadow` give the matching label colours: `#1a1030` with a 1px shadow (`#2a9a48` green, `#2a6fd6` blue, `#9a9ab8` slate), white with `#3a1266` on violet, `#2a2a3a` disabled. For a pixel look, draw with `ui_font_text_white` tinted, or a pixel font at 2× CSS px.
- Every game button key has an alias to its colour: `ui_btn_<roll|buy|next|new_run|continue>_blank` → green, `ui_btn_score_blank` → blue, `ui_btn_<reroll|shop|shop_reroll|sell>_blank` → slate, `ui_btn_endless_blank` → violet, `ui_btn_<pause|settings|info>_blank` → icon.
- In `builder-manifest.styleA.json` every `ui_btn_*` key now carries `kind: "button"` and `states.pressed/disabled` (with `hc`), and label-free ones carry `textArea`, so `buttonSkin()` works without the conversion step.

## Binary counters (4-bit / 8-bit) and the Chain modifier
A user idea, not in the brief: a small LCD number screen that rolls 1s and 0s. A counter scores its binary value as a decimal number.

**One die slot.** Both counters are **32×32 native** (64×64 CSS at 1x). That is the d6's outer size, bezel, outline, shading and baseline. Only the screen differs:
- **4-bit:** one row of 4 bits. The screen is native `[3,9,28,19]`, so it is short, with a deep ivory bezel above and below.
- **8-bit:** two rows of 4 bits. The **MSB nibble is on top** and the LSB nibble below. The screen is `[3,3,28,22]` and almost fills the face.

The two sizes are told apart by the screen shape and the number of rows. There is no text label, because a legible label doesn't fit on the 8-bit.

Each bit is a **4×7 seven-segment cell** (8×14 CSS px at 1x, 24×42 at 3x):
- Lit is `#7cc6ff` on the screen `#0e1630` (9.7:1). Lit is blue because a counter's value is points.
- Unlit segments are `#1f2d58` (1.3:1), so they read as "off" rather than as a digit.

**Bit cells** (`manifest.json → bit_cells`, native top-left corners, MSB first):
- 4-bit: (5,11) (11,11) (17,11) (23,11)
- 8-bit: (5,5) (11,5) (17,5) (23,5), then (5,14) (11,14) (17,14) (23,14)

To compose any value, draw `counter_<n>bit_body` (or `_blank`) and then `counter_bit_1` or `counter_bit_0` at each cell.

| sprite | notes |
|---|---|
| `counter_<n>bit_body` | housing with an empty screen |
| `counter_<n>bit_blank` | every segment unlit (face-down / unrolled) |
| `counter_<n>bit_roll_1..3` | scramble: half-lit random bits, then all on the middle bar, then half-lit again. Cycle at about 12 fps, then settle bit by bit, MSB first. |
| `counter_4bit_0000` … `_1111` | all 16 values |
| `counter_8bit_10100110`, `_00000000`, `_11111111` | 8-bit examples |
| `counter_bit_1`, `counter_bit_0`, `counter_bit_off` | 4×7 cells: lit 1, lit 0, nothing lit |
| `counter_bit_tumble_1`, `_2` | per-cell tumble frames: half-lit flicker, middle bar |
| `counter_seg_0..9` | decimal digits in the same LCD cell, for an on-screen decimal option |
| `counter_readout` | 34×14 decimal tag: "=" and **up to 4 digits** (a 12-bit chain reaches 4095) in `ui_font_bold_blue`, drawn inside `value_area`. Place it at x = counter_x − 1, y = counter_y − 12. At 34 wide it matches the 34 px slot pitch, so neighbouring tags just touch. For a chain, centre one tag over the run. |

**Chain modifier** (violet = rule-bending, hexagon badge). Overlays use the **same 42×42 canvas as the dice, with the counter at (2,8)**. One overlay serves both sizes.
| sprite | what |
|---|---|
| `special_chain_icon` (+`_disabled`, `_hc`) | 32×32 icon with two interlocked links |
| `special_chain_badge` | a chain and a "<" (links to the **left**), placed exactly like the dice badges |
| `special_chain_overlay` | violet ring, the badge top-right, and a **half-link stub on the left edge** of the lower bezel that butts up against the neighbouring counter |
| `fx_chain_link` / `_lit` | 16×8 two-link connector at x = right_counter_x − 9, y = counter_y + 23. It sits on the lower bezels across the 2 px gap and stays clear of both screens. Use `_lit` as a flash when the chain fires. |
| `fx_chain_bracket_l` / `_m` / `_r` | **Unused**: the game dropped the bracket in favour of the connector plus glow. Left in the pack (8×8 left cap, tiling middle, right cap) in case it comes back. |
| `fx_chain_glow_1..3` | 42×42 glow pulse on linked counters. Play 1-2-3-2 at about 10 fps. |
| `counter_4bit_chain_example`, `counter_8bit_chain_example` | pre-composited previews |

**States** (42×42, the same as the dice): `fx_select_counter`, `fx_locked_counter`, `fx_disabled_counter` (grey wash + X) and `fx_ring_counter_<layer>`. They are shared by both sizes because the silhouette is the same as a d6, so the `fx_*_d6` sprites work too.
**Icons:** `special_counter_4bit_icon` and `special_counter_8bit_icon` are blue rounded squares with a tiny "10" LCD and a 4BIT or 8BIT tab.
**High contrast:** every counter sprite has an `_hc` twin, with a black screen, white lit segments and near-black unlit ones (16.9:1).

**Builder keys** (also listed in `builder-manifest.styleA.json → _newKeys_counters`):
| pack key | also mapped from the game's `counterArtKeys()` |
|---|---|
| `counter_4bit_body`, `counter_8bit_body` | `die_bin4_body`, `die_bin8_body` |
| `counter_4bit_blank`, `counter_8bit_blank` | `die_bin4_blank`, `die_bin8_blank` |
| `counter_bit_1`, `counter_bit_0` | `led_bit_on`, `led_bit_off` |
| `counter_bit_tumble_1`, `_2` | `led_bit_tumble_1`, `led_bit_tumble_2` |
| `fx_chain_bracket_l/m/r` | (unused; the game no longer asks for `fx_link_bracket_*`) |
| `fx_chain_glow_1..3` | `fx_link_glow_1..3` |
| `icon_link`, `icon_counter4`, `icon_counter8` | (the game's own names) |
| `counter_4bit_roll_1..3`, `counter_8bit_roll_1..3`, `counter_bit_off`, `counter_readout`, `overlay_chain`, `fx_chain_link`, `fx_chain_link_lit` | (new) |

All 18 current `counterArtKeys()` are covered (the game has since dropped `fx_link_bracket_*` and asks for `overlay_chain`, `fx_chain_link(_lit)`, `counter_readout` and `counter_bit_tumble_*` by their pack names). Every other counter sprite is also listed under its own file name.

**CSS the game needs for this art** (`.ctr` / `.led` in `css/style.css`):
- `.ctr`: keep `aspect-ratio: 1`. Drop the CSS border, border-radius, box-shadow and padding, because the bezel is in the sprite. Use `background-size: 100% 100%` and `image-rendering: pixelated`.
- `.led`: lay the cells out at the `bit_cells` positions. That is a 4-column grid, 4/32 wide with a 2/32 gap, starting 5/32 from the left; rows at 11/32 (4-bit), or 5/32 and 14/32 (8-bit). Set `aspect-ratio: 4/7`, no border-radius, no glow, and `background-size: 100% 100%`. With the current round, cover-cropped LED style, the 4×7 digit would be cropped.
- The green/amber LED colours and the gold chain total should become blue, the points colour.

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
- `tools/dice.py`, `tools/specials.py`, `tools/ui.py`, `tools/bg.py` and `tools/counters.py` draw the pieces.

To change a colour job, edit `LAYERS` in `core.py`. To move a special to another layer or shape, edit `SPECIALS` in `specials.py`.
