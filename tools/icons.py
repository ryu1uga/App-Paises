"""Icono, splash y adaptive-icon: un globo estilizado con anillo orbital."""
import math
from PIL import Image, ImageDraw, ImageFilter

BG = (5, 6, 15)


def globe(size, r_frac=0.34, with_bg=True, glow=True):
    S = size * 3
    img = Image.new('RGBA', (S, S), (*BG, 255) if with_bg else (0, 0, 0, 0))
    cx = cy = S / 2
    R = S * r_frac

    if glow:
        g = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        dg = ImageDraw.Draw(g)
        for i, (rr, a) in enumerate([(1.75, 26), (1.45, 38), (1.2, 58)]):
            dg.ellipse([cx - R * rr, cy - R * rr, cx + R * rr, cy + R * rr], fill=(56, 189, 248, a))
        g = g.filter(ImageFilter.GaussianBlur(S * 0.05))
        img = Image.alpha_composite(img, g)

    # esfera con degradado
    sphere = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ps = sphere.load()
    for y in range(int(cy - R) - 2, int(cy + R) + 2):
        for x in range(int(cx - R) - 2, int(cx + R) + 2):
            dx, dy = (x - cx) / R, (y - cy) / R
            d = math.hypot(dx, dy)
            if d > 1.02:
                continue
            # iluminación desde arriba-izquierda
            lz = math.sqrt(max(0.0, 1 - min(1.0, d * d)))
            lam = max(0.0, (-dx * 0.55 - dy * 0.6 + lz * 0.75))
            t = min(1.0, max(0.0, (dy + 1) / 2))
            c0 = (45, 212, 191)
            c1 = (129, 140, 248)
            base = [c0[i] + (c1[i] - c0[i]) * t for i in range(3)]
            k = 0.28 + 0.95 * lam
            col = tuple(min(255, int(base[i] * k)) for i in range(3))
            a = 255 if d < 0.985 else int(255 * (1.02 - d) / 0.035)
            ps[x, y] = (*col, max(0, min(255, a)))
    img = Image.alpha_composite(img, sphere)

    # meridianos / paralelos
    lines = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dl = ImageDraw.Draw(lines)
    lw = max(2, int(S * 0.006))
    for k in (0.32, 0.66, 1.0):
        dl.ellipse([cx - R * k, cy - R, cx + R * k, cy + R], outline=(230, 255, 255, 105), width=lw)
    for f in (-0.55, 0.0, 0.55):
        yy = cy + R * f
        hw = R * math.sqrt(max(0.0, 1 - f * f))
        hh = R * 0.13 * math.sqrt(max(0.05, 1 - f * f))
        dl.ellipse([cx - hw, yy - hh, cx + hw, yy + hh], outline=(230, 255, 255, 90), width=lw)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    lines.putalpha(Image.composite(lines.getchannel('A'), Image.new('L', (S, S), 0), mask))
    img = Image.alpha_composite(img, lines)

    # anillo orbital inclinado
    ring = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ring)
    rr = R * 1.42
    dr.ellipse([cx - rr, cy - rr * 0.36, cx + rr, cy + rr * 0.36],
               outline=(250, 204, 21, 235), width=max(3, int(S * 0.011)))
    ring = ring.rotate(-24, resample=Image.BICUBIC, center=(cx, cy))
    # el anillo pasa por detrás en la mitad superior
    occ = Image.new('L', (S, S), 255)
    ImageDraw.Draw(occ).pieslice([cx - R, cy - R, cx + R, cy + R], 180, 360, fill=0)
    ring.putalpha(Image.composite(ring.getchannel('A'), ring.getchannel('A').point(lambda v: 0), occ))
    img = Image.alpha_composite(img, ring)

    # brillo especular
    hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([cx - R * 0.55, cy - R * 0.72, cx - R * 0.02, cy - R * 0.24],
                               fill=(255, 255, 255, 60))
    img = Image.alpha_composite(img, hl.filter(ImageFilter.GaussianBlur(S * 0.02)))

    return img.resize((size, size), Image.LANCZOS)


globe(1024).convert('RGB').save('icon.png', optimize=True)
globe(1024, r_frac=0.26, with_bg=False).save('adaptive-icon.png', optimize=True)
globe(1024, r_frac=0.30).convert('RGB').save('splash.png', optimize=True)
globe(512).convert('RGB').resize((256, 256)).save('icon_prev.png')
print('iconos ok')
