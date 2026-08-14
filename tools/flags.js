/**
 * Empaqueta las 195 banderas dentro de la app.
 *
 * Copia y optimiza los PNG de `svg-country-flags` a assets/flags y genera
 * src/data/flags.ts con un mapa estático de `require()`, que es lo que Metro
 * necesita para incluirlas en el bundle (no admite rutas dinámicas).
 *
 * Cada bandera conserva su proporción real —Nepal no es rectangular, Suiza y el
 * Vaticano son cuadradas—, así que el componente las encaja con `contain`.
 *
 * Requiere Pillow y el paquete de banderas:
 *   pip install pillow
 *   npm i -D --no-save svg-country-flags
 *
 * Uso:  node tools/flags.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'flags');

// Resolvemos el paquete estén donde estén las dependencias, en vez de asumir una
// ruta fija: así no hace falta enlazar node_modules dentro de tools/.
let SRC;
try {
  SRC = path.join(path.dirname(require.resolve('svg-country-flags/package.json')), 'png250px');
} catch {
  console.error('Falta el paquete de banderas. Instálalo con:\n  npm i -D --no-save svg-country-flags');
  process.exit(1);
}

const countries = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'data', 'countries.json'), 'utf8')
);

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

// La optimización (redimensionar + paleta adaptativa) se hace con Pillow: las
// banderas son gráficos planos y bajan de ~4 KB a ~1,5 KB sin pérdida visible.
const script = `
import sys, os
from PIL import Image

src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
codes = sys.argv[4].split(',')
total, transparent = 0, []

for code in codes:
    im = Image.open(os.path.join(src, code.lower() + '.png')).convert('RGBA')
    h = max(1, round(im.height * width / im.width))
    im = im.resize((width, h), Image.LANCZOS)

    # Casi todas las banderas son rectángulos opacos; Nepal no lo es. Medimos la
    # proporción de píxeles realmente transparentes: mirar solo el mínimo daría
    # falsos positivos por el antialiasing del borde al redimensionar.
    alpha = im.getchannel('A')
    see_through = sum(alpha.histogram()[:128])
    has_alpha = see_through > 0.01 * im.width * im.height

    if has_alpha:
        transparent.append(code)
        # FASTOCTREE es el único cuantizador que admite alfa.
        im = im.quantize(colors=128, method=Image.FASTOCTREE, dither=Image.NONE)
    else:
        # Sin alfa podemos usar MEDIANCUT, que da mejor paleta y menos peso.
        im = im.convert('RGB').quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE)

    dest = os.path.join(out, code.lower() + '.png')
    im.save(dest, optimize=True)
    total += os.path.getsize(dest)

print(total)
print(','.join(transparent))
`;

const codes = countries.map((c) => c.code).join(',');
const [totalLine, transparentLine] = execFileSync('python3', [
  '-c',
  script,
  SRC,
  OUT,
  '240',
  codes,
])
  .toString()
  .trim()
  .split('\n');
const totalBytes = Number(totalLine);

const entries = countries
  .map((c) => `  ${c.id}: require('../../assets/flags/${c.code.toLowerCase()}.png'),`)
  .join('\n');

const ts = `/**
 * Banderas empaquetadas en la app: sin red, sin depender de emojis (que Android
 * no dibuja) y sin latencia.
 *
 * Metro solo resuelve \`require()\` con rutas literales, así que este mapa se
 * genera con tools/flags.js. Cada bandera mantiene su proporción real.
 */

export const FLAGS: Record<string, number> = {
${entries}
};

/** Imagen de la bandera de un país por su código alfa-3. */
export function flagSource(id: string): number | undefined {
  return FLAGS[id];
}
`;

fs.writeFileSync(path.join(ROOT, 'src', 'data', 'flags.ts'), ts);

console.log(`banderas empaquetadas: ${countries.length}`);
console.log(`peso total: ${(totalBytes / 1024).toFixed(0)} KB (media ${(totalBytes / countries.length / 1024).toFixed(1)} KB)`);
console.log(`con transparencia: ${transparentLine || 'ninguna'}`);
