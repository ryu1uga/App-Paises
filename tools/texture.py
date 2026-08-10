"""Genera las texturas del globo (equirectangulares) a partir de Natural Earth."""
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 2048, 1024

land_mask = Image.open('mask_land.png').convert('L').resize((W, H), Image.LANCZOS)
border_mask = Image.open('mask_borders.png').convert('L').resize((W, H), Image.LANCZOS)

coast = ImageChops.subtract(land_mask.filter(ImageFilter.MaxFilter(5)), land_mask)
coast = coast.filter(ImageFilter.GaussianBlur(1.4))


def vgrad(stops):
    """stops: [(t, (r,g,b)), ...] con t en 0..1 de norte a sur."""
    img = Image.new('RGB', (1, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                px[0, y] = tuple(int(c0[k] + (c1[k] - c0[k]) * u) for k in range(3))
                break
    return img.resize((W, H))


def latmask(fn):
    m = Image.new('L', (W, H), 0)
    p = m.load()
    for y in range(H):
        v = max(0, min(255, int(fn(90 - y / H * 180) * 255)))
        for x in range(W):
            p[x, y] = v
    return m


ocean = vgrad([(0.0, (5, 10, 28)), (0.32, (10, 26, 66)), (0.5, (14, 40, 92)),
               (0.68, (10, 26, 66)), (1.0, (5, 10, 28))])

land = vgrad([(0.0, (86, 224, 214)), (0.28, (52, 211, 153)), (0.5, (34, 197, 160)),
              (0.72, (56, 189, 248)), (1.0, (129, 140, 248))])

# franja cálida tropical (desiertos/sabana)
warm = latmask(lambda lat: math.exp(-((lat - 8) / 26.0) ** 2) * 0.62)
land = Image.composite(Image.blend(land, Image.new('RGB', (W, H), (250, 204, 21)), 0.5), land, warm)

# hielo polar, SOLO sobre tierra
ice = latmask(lambda lat: min(1.0, max(0.0, (lat - 62) / 12.0)) if lat > 0
              else min(1.0, max(0.0, (-58 - lat) / 8.0)))
land = Image.composite(Image.new('RGB', (W, H), (224, 242, 255)), land, ice)

img = Image.composite(land, ocean, land_mask)

# textura fina
ocean_noise = Image.effect_noise((W, H), 14).filter(ImageFilter.GaussianBlur(1.6)).convert('RGB')
img = Image.composite(Image.blend(img, ocean_noise, 0.09), img, ImageChops.invert(land_mask))
land_noise = Image.effect_noise((W, H), 24).filter(ImageFilter.GaussianBlur(0.7)).convert('RGB')
img = Image.composite(Image.blend(img, land_noise, 0.15), img, land_mask)

# fronteras: tinta oscura solo sobre tierra
bm = ImageChops.multiply(border_mask, land_mask).point(lambda v: int(v * 0.60))
img = Image.composite(Image.new('RGB', (W, H), (11, 26, 54)), img, bm)

# halo de costa
img = Image.composite(Image.new('RGB', (W, H), (198, 255, 252)), img, coast.point(lambda v: int(v * 0.85)))

# retícula muy tenue
grat = Image.new('L', (W, H), 0)
dg = ImageDraw.Draw(grat)
for lon in range(-180, 181, 30):
    dg.line([((lon + 180) / 360 * W, 0), ((lon + 180) / 360 * W, H)], fill=20, width=1)
for lat in range(-60, 61, 30):
    dg.line([(0, (90 - lat) / 180 * H), (W, (90 - lat) / 180 * H)], fill=20, width=1)
img = Image.composite(Image.new('RGB', (W, H), (150, 195, 255)), img, grat)

img.save('earth.png', optimize=True)
print('earth.png', img.size)

# máscara especular (océano brillante, tierra mate)
ImageChops.invert(land_mask).point(lambda v: int(v * 0.92)).save('earth-spec.png', optimize=True)

# nubes procedurales
CW, CH = W // 2, H // 2
acc = Image.new('L', (CW, CH), 0)
for sc, k in [(3, 0.46), (6, 0.27), (12, 0.16), (24, 0.11)]:
    n = Image.effect_noise((max(4, CW // sc), max(2, CH // sc)), 110).resize((CW, CH), Image.BICUBIC)
    acc = ImageChops.add(acc, n.point(lambda v, kk=k: int(v * kk)))
acc = acc.filter(ImageFilter.GaussianBlur(2.5)).point(lambda v: max(0, min(255, int((v - 118) * 4.0))))
pa = acc.load()
for y in range(CH):
    lat = 90 - y / CH * 180
    f = 1.0 - min(1.0, max(0.0, (abs(lat) - 55) / 35.0)) * 0.8
    for x in range(CW):
        pa[x, y] = int(pa[x, y] * f)
Image.merge('RGBA', (Image.new('L', (CW, CH), 255),) * 3 + (acc,)).save('earth-clouds.png', optimize=True)
print('earth-clouds.png', (CW, CH))

Image.open('earth.png').resize((900, 450)).save('prev.png')
