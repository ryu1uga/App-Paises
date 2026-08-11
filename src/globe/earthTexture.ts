import * as THREE from 'three';

import { BORDER, decodeEarthMask, MASK_HEIGHT, MASK_WIDTH, OCEAN } from './earthData';

/**
 * Construye las texturas del globo en memoria, a partir de la máscara geográfica
 * embebida en el bundle. No hay ficheros de imagen, ni descargas, ni dependencia
 * de la subida nativa de bitmaps de expo-gl: solo `THREE.DataTexture`, que es la
 * ruta estándar de WebGL y funciona en cualquier dispositivo.
 */

type RGB = [number, number, number];

/** Interpola una rampa de color definida por paradas en 0..1 (norte → sur). */
function ramp(stops: [number, RGB][], t: number): RGB {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const u = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return [
        c0[0] + (c1[0] - c0[0]) * u,
        c0[1] + (c1[1] - c0[1]) * u,
        c0[2] + (c1[2] - c0[2]) * u,
      ];
    }
  }
  return stops[stops.length - 1][1];
}

const OCEAN_RAMP: [number, RGB][] = [
  [0.0, [5, 10, 28]],
  [0.32, [10, 26, 66]],
  [0.5, [14, 40, 92]],
  [0.68, [10, 26, 66]],
  [1.0, [5, 10, 28]],
];

const LAND_RAMP: [number, RGB][] = [
  [0.0, [86, 224, 214]],
  [0.28, [52, 211, 153]],
  [0.5, [34, 197, 160]],
  [0.72, [56, 189, 248]],
  [1.0, [129, 140, 248]],
];

const WARM: RGB = [250, 204, 21];
const ICE: RGB = [224, 242, 255];
const INK: RGB = [11, 26, 54];
const COAST: RGB = [198, 255, 252];
const GRID: RGB = [150, 195, 255];

const mix = (a: RGB, b: RGB, k: number): RGB => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Ruido determinista barato, para que el mapa no se vea plano. */
function hashNoise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000 - 0.5;
}

/**
 * Cobertura suavizada de un rasgo binario, con un desenfoque de caja separable
 * de 3 taps. Convierte el borde "escalonado" de la máscara en un degradado de
 * 0 a 255, que es lo que permite dibujar costas y fronteras sin dientes de sierra.
 */
function coverage(mask: Uint8Array, test: (v: number) => boolean, passes = 1): Uint8Array {
  const W = MASK_WIDTH;
  const H = MASK_HEIGHT;
  let src = new Uint8Array(W * H);
  for (let i = 0; i < src.length; i++) src[i] = test(mask[i]) ? 255 : 0;

  const tmp = new Uint8Array(W * H);
  let out = new Uint8Array(W * H);

  for (let p = 0; p < passes; p++) {
    // horizontal (el mapa da la vuelta en longitud)
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const l = src[row + (x === 0 ? W - 1 : x - 1)];
        const r = src[row + (x === W - 1 ? 0 : x + 1)];
        tmp[row + x] = (l + src[row + x] + r) / 3;
      }
    }

    // vertical (los polos se repiten, no envuelven)
    for (let y = 0; y < H; y++) {
      const row = y * W;
      const up = y === 0 ? row : row - W;
      const dn = y === H - 1 ? row : row + W;
      for (let x = 0; x < W; x++) {
        out[row + x] = (tmp[up + x] + tmp[row + x] + tmp[dn + x]) / 3;
      }
    }

    if (p < passes - 1) {
      const swap = src;
      src = out;
      out = swap;
    }
  }

  return out;
}

let earthTexture: THREE.DataTexture | null = null;
let specTexture: THREE.DataTexture | null = null;
let cloudTexture: THREE.DataTexture | null = null;

/**
 * Mapa de color del planeta.
 *
 * Los datos se escriben de sur a norte porque `DataTexture` usa `flipY = false`,
 * y así la fila 0 del buffer cae en la base de la esfera.
 */
export function getEarthTexture(): THREE.DataTexture {
  if (earthTexture) return earthTexture;

  const mask = decodeEarthMask();
  const W = MASK_WIDTH;
  const H = MASK_HEIGHT;
  const data = new Uint8Array(W * H * 4);

  // `landCov` decide el color; `glowCov` está más difuminada y solo sirve para
  // que el halo de costa ocupe una banda visible en vez de un único píxel.
  const landCov = coverage(mask, (v) => v !== OCEAN);
  const glowCov = coverage(mask, (v) => v !== OCEAN, 2);
  const borderCov = coverage(mask, (v) => v === BORDER);

  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const lat = 90 - t * 180;

    // Todo lo que depende solo de la latitud se calcula una vez por fila.
    const oceanColor = ramp(OCEAN_RAMP, t);
    let landColor = ramp(LAND_RAMP, t);

    const warmK = Math.exp(-(((lat - 8) / 26) ** 2)) * 0.62;
    if (warmK > 0.002) landColor = mix(landColor, WARM, warmK * 0.5);

    const iceK =
      lat > 62
        ? Math.min(1, (lat - 62) / 12)
        : lat < -58
          ? Math.min(1, (-58 - lat) / 8)
          : 0;
    if (iceK > 0) landColor = mix(landColor, ICE, iceK);

    const gridLat = Math.abs(lat) <= 61 && Math.abs((lat + 90) % 30) < 0.2;
    const flipped = H - 1 - y; // fila de destino
    const row = y * W;

    for (let x = 0; x < W; x++) {
      const cov = landCov[row + x] / 255;

      // Transición suave océano → tierra: esto es lo que quita el borde dentado.
      let c = mix(oceanColor, landColor, smoothstep(0.14, 0.74, cov));

      // Halo de costa. El término nítido mantiene visibles islas de pocos píxeles;
      // el difuminado añade el resplandor ancho alrededor de los continentes.
      const sharp = 1 - Math.abs(cov * 2 - 1);
      const wide = 1 - Math.abs((glowCov[row + x] / 255) * 2 - 1);
      const edge = Math.max(sharp * 0.62, wide * wide * 0.5);
      if (edge > 0.02) c = mix(c, COAST, edge);

      // Grano fino, más marcado en tierra que en el agua.
      const n = hashNoise(x, y) * (6 + cov * 9);
      c = [c[0] + n, c[1] + n, c[2] + n];

      // Fronteras: tinta oscura, también con cobertura suavizada.
      const b = borderCov[row + x] / 255;
      if (b > 0.02) c = mix(c, INK, b * 0.6);

      // Retícula muy tenue cada 30°
      if (gridLat || Math.abs(((x / W) * 360) % 30) < 0.1) c = mix(c, GRID, 0.07);

      const i = (flipped * W + x) * 4;
      data[i] = c[0] < 0 ? 0 : c[0] > 255 ? 255 : c[0];
      data[i + 1] = c[1] < 0 ? 0 : c[1] > 255 ? 255 : c[1];
      data[i + 2] = c[2] < 0 ? 0 : c[2] > 255 ? 255 : c[2];
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;

  earthTexture = tex;
  return tex;
}

/** Máscara especular: el océano brilla, la tierra es mate. */
export function getSpecularTexture(): THREE.DataTexture {
  if (specTexture) return specTexture;

  const mask = decodeEarthMask();
  const W = MASK_WIDTH >> 1;
  const H = MASK_HEIGHT >> 1;
  const data = new Uint8Array(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const src = mask[y * 2 * MASK_WIDTH + x * 2];
      const v = src === OCEAN ? 235 : 18;
      const i = ((H - 1 - y) * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  specTexture = tex;
  return tex;
}

/** Ruido fractal suave usado como alfa de la capa de nubes. */
export function getCloudTexture(): THREE.DataTexture {
  if (cloudTexture) return cloudTexture;

  const W = 512;
  const H = 256;
  const data = new Uint8Array(W * H * 4);

  // valor-ruido con interpolación suave, sumado en cuatro octavas
  const lattice = (gx: number, gy: number, seed: number) => {
    let h = (gx * 1836311903) ^ (gy * 2971215073) ^ (seed * 433494437);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
  };

  const smooth = (t: number) => t * t * (3 - 2 * t);

  const noise = (x: number, y: number, freq: number, seed: number) => {
    const fx = (x / W) * freq;
    const fy = (y / H) * freq;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    // envolvemos en x para que no se vea la costura del meridiano 180
    const wrap = (n: number) => ((n % freq) + freq) % freq;
    const a = lattice(wrap(x0), y0, seed);
    const b = lattice(wrap(x0 + 1), y0, seed);
    const c = lattice(wrap(x0), y0 + 1, seed);
    const d = lattice(wrap(x0 + 1), y0 + 1, seed);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };

  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    // menos nubes hacia los polos
    const polar = 1 - Math.min(1, Math.max(0, (Math.abs(lat) - 55) / 35)) * 0.8;

    for (let x = 0; x < W; x++) {
      const n =
        noise(x, y, 6, 1) * 0.5 +
        noise(x, y, 12, 2) * 0.27 +
        noise(x, y, 24, 3) * 0.15 +
        noise(x, y, 48, 4) * 0.08;
      const a = Math.max(0, Math.min(1, (n - 0.5) * 3.4)) * polar;
      const i = ((H - 1 - y) * W + x) * 4;
      const v = Math.round(a * 255);
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  cloudTexture = tex;
  return tex;
}

/** Genera las tres texturas por adelantado (llamar al arrancar la app). */
export function warmUpGlobeTextures(): void {
  getEarthTexture();
  getSpecularTexture();
  getCloudTexture();
}
