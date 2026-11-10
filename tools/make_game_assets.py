"""Turn the Exports/ art into trimmed WebPs + a manifest for the game.

Run from the Chappell Roan folder:  /usr/bin/python3 tools/make_game_assets.py

- Characters: the standing / punching / kicking frames share one 3000x3000 canvas, so they
  are all cropped with the same box (they stay lined up) and the manifest records where the
  standing pose's feet are (anchor) and how far each frame reaches past it.
- Loser Dude: Loser Dude_Parts.png is split into head+body, two arms and two legs, moved
  back together (gaps closed, measured against Loser Dude.png), with a pivot for each joint.
"""
from PIL import Image
import json, os

EX = 'Exports'
OUT = 'assets'
S = 0.25                 # export scale
os.makedirs(OUT, exist_ok=True)
man = {'scale': S, 'chars': {}, 'dude': {}}


def save(img, name, q=86):
    img.save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=6)
    print(name, img.size)


def sc(v):
    return round(v * S, 1)


# ---------- background ----------
bg = Image.open(f'{EX}/Background.jpg').convert('RGB')
save(bg, 'background', 80)

# ---------- characters ----------
CHARS = {
    'olivia':   {'stand': 'Standing Olivia.png', 'punch': 'Punching Olivia.png', 'kick': 'Kicking Olivia.png'},
    'chappell': {'stand': 'Standing Chappell.png', 'punch': 'Punching_Chappell.png', 'kick': 'Kicking Chappell.png'},
}
for cid, frames in CHARS.items():
    ims = {k: Image.open(f'{EX}/{f}').convert('RGBA') for k, f in frames.items()}
    boxes = {k: im.getbbox() for k, im in ims.items()}
    pad = 20
    u = (min(b[0] for b in boxes.values()) - pad, min(b[1] for b in boxes.values()) - pad,
         max(b[2] for b in boxes.values()) + pad, max(b[3] for b in boxes.values()) + pad)
    sb = boxes['stand']
    anchor_x = (sb[0] + sb[2]) / 2          # middle of the standing body
    ground_y = sb[3]                        # bottom of her shoes
    entry = {'anchor': [sc(anchor_x - u[0]), sc(ground_y - u[1])],
             'halfWidth': sc((sb[2] - sb[0]) / 2), 'height': sc(sb[3] - sb[1]), 'reach': {}}
    for k, im in ims.items():
        c = im.crop(u)
        c = c.resize((round(c.width * S), round(c.height * S)), Image.LANCZOS)
        save(c, f'{cid}-{k}')
        entry['reach'][k] = sc(boxes[k][2] - anchor_x)     # furthest point in front of her
    man['chars'][cid] = entry

# ---------- Loser Dude ----------
parts_img = Image.open(f'{EX}/Loser Dude_Parts.png').convert('RGBA')
# His upper body (head, shirt, arms, hands) stays one still piece cut from the whole image,
# so no sleeve seams show. Only the legs swing; they come from the parts sheet, where they
# are drawn complete. Legs as (crop box in the parts sheet, move that closes the gap, hip pivot),
# all in "assembled parts" coordinates, whose ground point is (1476, 2345).
LEGS = {
    'legL': ((912, 1612, 1388, 2584), (140, -237), (1338, 1400)),
    'legR': ((1532, 1680, 2008, 2644), (-202, -305), (1598, 1400)),
}
A_CX, A_GROUND = 1476, 2345
K = 0.95     # parts sheet -> whole image size (matched on pants width)
KY = K * 1.1 # legs a bit taller so their tops tuck up under the shirt hem
# Loser Dude.png faces left (walks in from the right); Loser Dude_Flipped.png faces right.
VERSIONS = {
    'faceLeft':  ('Loser Dude.png', 1466, 2600, False),           # pants centre x, shoe bottom y
    'faceRight': ('Loser Dude_Flipped.png', 1534, 2543, True),
}


def upper_body(im):
    """Whole dude minus his pants and shoes: keep everything down to the shirt hem in each
    column, and below that only the pink hands."""
    im = im.copy(); px = im.load()
    bb = im.getbbox()
    for x in range(bb[0], bb[2]):
        below_hem = False
        for y in range(bb[1], bb[3]):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if not below_hem and y > 1400 and r < 130:     # first dark pants pixel
                below_hem = True
            if below_hem and not (r > 200 and y < 2050):    # keep hands, drop pants + shoes
                px[x, y] = (r, g, b, 0)
    return im


for vid, (fname, cx, ground, mirror) in VERSIONS.items():
    whole = Image.open(f'{EX}/{fname}').convert('RGBA')
    up = upper_body(whole)
    ub = up.getbbox()
    piece = up.crop(ub)
    save(piece.resize((round(piece.width * S), round(piece.height * S)), Image.LANCZOS), f'dude-{vid}-upper')
    hip_y = ground - (A_GROUND - 1400) * KY
    entry = {'upper': {'pos': [sc(ub[0] - cx), sc(ub[1] - ground)], 'pivot': [0, sc(hip_y - ground)]}}
    for n, (bb, (dx, dy), piv) in LEGS.items():
        p = parts_img.crop(bb)
        p = p.resize((round(p.width * K), round(p.height * KY)), Image.LANCZOS)
        x0, y0 = bb[0] + dx, bb[1] + dy                  # assembled top-left
        w = bb[2] - bb[0]
        if mirror:
            p = p.transpose(Image.FLIP_LEFT_RIGHT)
            X0 = cx - (x0 + w - A_CX) * K
            PX = cx - (piv[0] - A_CX) * K
        else:
            X0 = cx + (x0 - A_CX) * K
            PX = cx + (piv[0] - A_CX) * K
        Y0 = ground + (y0 - A_GROUND) * KY
        PY = ground + (piv[1] - A_GROUND) * KY
        save(p.resize((round(p.width * S), round(p.height * S)), Image.LANCZOS), f'dude-{vid}-{n}')
        entry[n] = {'pos': [sc(X0 - cx), sc(Y0 - ground)], 'pivot': [sc(PX - cx), sc(PY - ground)]}
    entry['_height'] = sc(ground - ub[1])
    entry['_halfWidth'] = sc((ub[2] - ub[0]) / 2)
    man['dude'][vid] = entry

    # check image: assembled dude next to the original
    chk = Image.new('RGBA', whole.size, (60, 160, 90, 255))
    for n in ('legL', 'legR'):
        e = entry[n]; img = Image.open(f'{OUT}/dude-{vid}-{n}.webp').convert('RGBA')
        chk.alpha_composite(img.resize((round(img.width / S), round(img.height / S))),
                            (round(cx + e['pos'][0] / S), round(ground + e['pos'][1] / S)))
    chk.alpha_composite(up)
    g2 = Image.new('RGBA', whole.size, (60, 160, 90, 255)); g2.alpha_composite(whole)
    both = Image.new('RGB', (1200, 1100), (255, 255, 255))
    for i, c in enumerate((chk, g2)):
        c = c.crop((850, 380, 2150, 2650)); c.thumbnail((590, 1080)); both.paste(c.convert('RGB'), (i * 600, 0))
    os.makedirs('tools/checks', exist_ok=True)
    both.save(f'tools/checks/dude-{vid}.jpg')

with open(f'{OUT}/manifest.json', 'w') as f:
    json.dump(man, f, indent=1)
print(json.dumps(man, indent=1))
