"""Empaqueta la geografía en un string base64 que viaja dentro del bundle JS.

Cada píxel guarda 0 = océano, 1 = tierra, 2 = frontera. Se comprime con RLE
(valor + longitud en varint), que es ideal porque los mapas tienen tiradas
enormes de océano.
"""
import base64
from PIL import Image

for W, H in [(512, 256), (1024, 512), (1536, 768)]:
    land = Image.open('mask_land.png').convert('L').resize((W, H), Image.LANCZOS)
    border = Image.open('mask_borders.png').convert('L').resize((W, H), Image.LANCZOS)
    lp, bp = land.load(), border.load()

    vals = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if lp[x, y] > 118:
                vals[y * W + x] = 2 if bp[x, y] > 70 else 1
    out = bytearray()

    def varint(n):
        while n >= 0x80:
            out.append((n & 0x7F) | 0x80)
            n >>= 7
        out.append(n)

    i = 0
    n = len(vals)
    while i < n:
        v = vals[i]
        j = i + 1
        while j < n and vals[j] == v:
            j += 1
        out.append(v)
        varint(j - i)
        i = j

    b64 = base64.b64encode(bytes(out)).decode()
    land_pct = sum(1 for v in vals if v) / len(vals) * 100
    print(f'{W}x{H}: RLE {len(out)/1024:6.1f} KB -> base64 {len(b64)/1024:6.1f} KB  (tierra {land_pct:.1f}%)')
    if (W, H) == (1024, 512):
        open('earthmask.b64', 'w').write(b64)
