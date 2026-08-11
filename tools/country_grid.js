/**
 * Rasteriza las fronteras de los 195 países a una rejilla equirectangular:
 * para cada píxel, qué país lo ocupa. Es lo que permite que el modo "ubicar"
 * acierte si el marcador cae dentro del país, en vez de puntuar por distancia.
 *
 * Salida: src/globe/countryGrid.ts (rejilla comprimida con RLE + base64).
 *
 * Uso:  node tools/country_grid.js [ancho]
 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const d3 = require('d3-geo');
const topojson = require('topojson-client');
const worldCountries = require('world-countries');

const W = Number(process.argv[2]) || 1024;
const H = W / 2;

const topo = require('world-atlas/countries-50m.json');
const mine = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'countries.json'), 'utf8')
);

// ccn3 (código numérico que usa world-atlas) -> cca3 (el id de nuestro dataset)
const ccn3ToCca3 = new Map();
for (const c of worldCountries) if (c.ccn3) ccn3ToCca3.set(c.ccn3, c.cca3);

// índice 1..N por país; 0 = sin país (océano o territorio no soberano)
const order = mine.map((c) => c.id);
const indexOf = new Map(order.map((id, i) => [id, i + 1]));

const projection = d3.geoEquirectangular()
  .scale(W / (2 * Math.PI))
  .translate([W / 2, H / 2]);

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const path2d = d3.geoPath(projection, ctx);

const grid = new Uint8Array(W * H);
const seen = new Set();

for (const geometry of topo.objects.countries.geometries) {
  const cca3 = ccn3ToCca3.get(String(geometry.id).padStart(3, '0'));
  const index = cca3 && indexOf.get(cca3);
  if (!index) continue; // territorio que no está entre los 195 soberanos

  const feature = topojson.feature(topo, geometry);

  ctx.clearRect(0, 0, W, H);
  ctx.beginPath();
  path2d(feature);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Solo leemos la caja que ocupa el país; para los que cruzan el antimeridiano
  // d3 devuelve una caja que abarca todo el mapa, lo cual también es correcto.
  let [[x0, y0], [x1, y1]] = path2d.bounds(feature);
  x0 = Math.max(0, Math.floor(x0) - 1);
  y0 = Math.max(0, Math.floor(y0) - 1);
  x1 = Math.min(W, Math.ceil(x1) + 1);
  y1 = Math.min(H, Math.ceil(y1) + 1);
  if (x1 <= x0 || y1 <= y0) continue;

  const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const bw = x1 - x0;
  let painted = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      // canal alfa: > 110 evita quedarnos con el antialias muy tenue del borde
      if (data[((y - y0) * bw + (x - x0)) * 4 + 3] > 110) {
        grid[y * W + x] = index;
        painted++;
      }
    }
  }
  if (painted > 0) seen.add(cca3);
}

/* ---- rellena huecos: tierra sin país asignada al vecino más frecuente ---- */
const landMask = (() => {
  const { Image } = require('@napi-rs/canvas');
  void Image;
  return null;
})();
void landMask;

for (let pass = 0; pass < 2; pass++) {
  const copy = Uint8Array.from(grid);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      if (copy[y * W + x] !== 0) continue;
      const counts = new Map();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = (x + dx + W) % W;
          const v = copy[(y + dy) * W + xx];
          if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      }
      // solo rellenamos si el vecindario es mayoritariamente ese país,
      // para no invadir el océano
      let best = 0;
      let bestN = 0;
      for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
      if (bestN >= 5) grid[y * W + x] = best;
    }
  }
}

/* ---- compresión RLE + base64 ---- */
const out = [];
const varint = (n) => {
  while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n >>= 7; }
  out.push(n);
};

let i = 0;
while (i < grid.length) {
  const v = grid[i];
  let j = i + 1;
  while (j < grid.length && grid[j] === v) j++;
  out.push(v);
  varint(j - i);
  i = j;
}

const b64 = Buffer.from(Uint8Array.from(out)).toString('base64');
const missing = order.filter((id) => !seen.has(id));
const covered = grid.reduce((a, v) => a + (v ? 1 : 0), 0);

/* ---- alcance de los países que no llegan a ocupar un píxel ----
 * Su superficie no sirve como medida: Maldivas son 300 km² repartidos en
 * 800 km de atolones. Guardamos la distancia real del centroide al punto más
 * lejano de su geometría, que es lo que hace justa la tolerancia. */
const centroidById = new Map(mine.map((c) => [c.id, { lat: c.lat, lng: c.lng }]));
const haversineKm = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
};

const reach = {};
for (const geometry of topo.objects.countries.geometries) {
  const cca3 = ccn3ToCca3.get(String(geometry.id).padStart(3, '0'));
  if (!cca3 || !missing.includes(cca3)) continue;

  const center = centroidById.get(cca3);
  let max = 0;
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      max = Math.max(max, haversineKm(center, { lng: coords[0], lat: coords[1] }));
    } else {
      for (const c of coords) walk(c);
    }
  };
  walk(topojson.feature(topo, geometry).geometry.coordinates);
  reach[cca3] = Math.round(max);
}
for (const id of missing) if (reach[id] == null) reach[id] = 0;

const lines = b64.match(/.{1,100}/g).map((l) => `  '${l}' +`);
lines[lines.length - 1] = lines[lines.length - 1].slice(0, -2);

const ts = `/**
 * Rejilla equirectangular de ${W}x${H}: qué país ocupa cada píxel.
 *
 * Permite responder "¿este punto cae dentro de las fronteras del país?" sin
 * llevar polígonos ni hacer point-in-polygon en tiempo real. Cada byte es el
 * índice del país dentro de \`countries.json\` (1..N); 0 significa océano o
 * territorio no soberano.
 *
 * Generada por tools/country_grid.js a partir de Natural Earth 50 m.
 * ${missing.length} países no aparecen por ser más pequeños que un píxel:
 * ${missing.join(', ') || 'ninguno'}.
 */

export const GRID_WIDTH = ${W};
export const GRID_HEIGHT = ${H};

/**
 * Países demasiado pequeños para ocupar un píxel, con la distancia en km de su
 * centroide al punto más lejano de su territorio. La superficie no sirve aquí:
 * Maldivas son 300 km² repartidos en cientos de kilómetros de atolones.
 */
export const TINY_COUNTRY_REACH_KM: Record<string, number> = ${JSON.stringify(reach, null, 2).replace(/\n/g, '\n')};

const PACKED =
${lines.join('\n')};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function fromBase64(input: string): Uint8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;

  let length = (input.length * 3) / 4;
  if (input[input.length - 1] === '=') length--;
  if (input[input.length - 2] === '=') length--;

  const bytes = new Uint8Array(length);
  let p = 0;
  for (let i = 0; i < input.length; i += 4) {
    const a = lookup[input.charCodeAt(i)];
    const b = lookup[input.charCodeAt(i + 1)];
    const c = lookup[input.charCodeAt(i + 2)];
    const d = lookup[input.charCodeAt(i + 3)];
    if (p < length) bytes[p++] = (a << 2) | (b >> 4);
    if (p < length) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < length) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

let cached: Uint8Array | null = null;

/** Rejilla de ${W}x${H} bytes con el índice de país de cada píxel. */
export function decodeCountryGrid(): Uint8Array {
  if (cached) return cached;

  const packed = fromBase64(PACKED);
  const out = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

  let i = 0;
  let o = 0;
  while (i < packed.length && o < out.length) {
    const value = packed[i++];
    let run = 0;
    let shift = 0;
    for (;;) {
      const byte = packed[i++];
      run |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    if (value !== 0) out.fill(value, o, o + run);
    o += run;
  }

  cached = out;
  return out;
}
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'globe', 'countryGrid.ts'), ts);

console.log(`rejilla ${W}x${H}`);
console.log(`RLE ${(out.length / 1024).toFixed(1)} KB -> base64 ${(b64.length / 1024).toFixed(1)} KB`);
console.log(`píxeles con país: ${((covered / grid.length) * 100).toFixed(1)} %`);
console.log(`países sin superficie a esta resolución (${missing.length}): ${missing.join(', ') || 'ninguno'}`);
