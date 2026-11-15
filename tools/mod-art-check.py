# python3 tools/mod-art-check.py [pack dir] [render dir] -> pixel-compares tools/mod-art-check.mjs renders with the
# expected composite from the pack's native layers: die face at (2,8) under mod_<mod>_<shape> (42x42); on pointed
# tops (d4 d8 d10 d20) the badge zone is rebuilt from fx_ring_<shape>_<layer> and mod_badge_<mod> drawn 2px higher.
import sys, json
from PIL import Image
PACK = sys.argv[1] if len(sys.argv) > 1 else 'asset-pack'; R = sys.argv[2] if len(sys.argv) > 2 else '/tmp/mod-art-check'
pm = json.load(open(f'{PACK}/manifest.json'))['assets']; pm = pm if isinstance(pm, list) else list(pm.values())
bm = json.load(open(f'{PACK}/builder-manifest.styleA.json'))['assets']
LAYER = {e['mod']: e['layer'] for e in pm if e.get('category') == 'shape_mods' and e.get('mod')}
SH = {'d4': 4, 'd6': 6, 'd8': 8, 'd10': 10, 'd12': 12, 'd20': 20}; POINTED = {'d4', 'd8', 'd10', 'd20'}
def nat(key, hc):
    src = bm[key]['src'].split('/')[-1].replace('.png', '')
    return Image.open(f'{PACK}/native/{src}{"_hc" if hc else ""}.png').convert('RGBA')
bad = []; n = 0
for m, layer in LAYER.items():
    pill = Image.open(f'{PACK}/native/mod_badge_{m}.png').getbbox()[0]
    for sh, top in SH.items():
        for hc in (False, True):
            exp = Image.new('RGBA', (42, 44), (0, 255, 0, 255))
            exp.alpha_composite(nat(f'die_{sh}_face{top + (3 if m == "overcharged" else 0)}', hc), (2, 10))
            ov = nat(f'mod_{m}_{sh}', hc)
            if sh in POINTED:
                ov = ov.copy(); ring = nat(f'fx_ring_{sh}_{layer}', hc)
                for y in range(12):
                    for x in range(12 + pill, 42): ov.putpixel((x, y), ring.getpixel((x, y)) if y >= 10 else (0, 0, 0, 0))
                exp.alpha_composite(ov, (0, 2)); exp.alpha_composite(nat(f'mod_badge_{m}', hc), (13, 0))
            else: exp.alpha_composite(ov, (0, 2))
            exp = exp.resize((84, 88), Image.NEAREST).convert('RGB')
            got = Image.open(f'{R}/{m}_{sh}{"_hc" if hc else ""}.png').convert('RGB')
            ea, ga = exp.tobytes(), got.tobytes(); d = sum(1 for i in range(0, len(ea), 3) if ea[i:i + 3] != ga[i:i + 3]); n += 1
            if d: bad.append((m, sh, 'hc' if hc else '', d)); exp.save(f'{R}/expected_{m}_{sh}{"_hc" if hc else ""}.png')
print(f'{n} renders compared, {len(bad)} differ' + (f': {bad[:12]}' if bad else ' (pixel-identical)'))
sys.exit(1 if bad else 0)
