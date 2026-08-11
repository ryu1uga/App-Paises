import { byId, countries, type Country } from '@/data/countries';
import {
  decodeCountryGrid,
  GRID_HEIGHT,
  GRID_WIDTH,
  TINY_COUNTRY_REACH_KM,
} from '@/globe/countryGrid';
import { haversine } from './geo';

/**
 * Resolución del modo "ubicar": en vez de puntuar por cercanía, se comprueba si
 * el marcador cae dentro de las fronteras del país.
 */

/** Orden de los países, que es el que usa la rejilla como índice (1..N). */
const order = countries.map((c) => c.id);

/** Píxeles de margen alrededor del toque. Perdona costas y fronteras finas. */
const TOLERANCE_PX = 2;

/** Grados de latitud/longitud por píxel de la rejilla. */
const DEG_PER_PX_X = 360 / GRID_WIDTH;
const DEG_PER_PX_Y = 180 / GRID_HEIGHT;

export type Point = { lat: number; lng: number };

function gridIndex(lat: number, lng: number): number {
  // normaliza la longitud a [-180, 180) para que el mapa dé la vuelta bien
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  const x = Math.min(GRID_WIDTH - 1, Math.max(0, Math.floor(((wrapped + 180) / 360) * GRID_WIDTH)));
  const y = Math.min(GRID_HEIGHT - 1, Math.max(0, Math.floor(((90 - lat) / 180) * GRID_HEIGHT)));
  return y * GRID_WIDTH + x;
}

/** País que ocupa ese punto, o `null` si es océano o territorio no soberano. */
export function countryAt(p: Point): Country | null {
  const grid = decodeCountryGrid();
  const v = grid[gridIndex(p.lat, p.lng)];
  return v === 0 ? null : (byId[order[v - 1]] ?? null);
}

/**
 * ¿Hay algún píxel del país objetivo a menos de `radius` píxeles del punto?
 *
 * Buscar en un pequeño vecindario evita castigar toques justo en la línea de
 * costa o en una frontera, donde el rasterizado no puede ser exacto.
 */
function nearPixel(p: Point, targetIndex: number, radius: number): boolean {
  const grid = decodeCountryGrid();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const lat = p.lat - dy * DEG_PER_PX_Y;
      const lng = p.lng + dx * DEG_PER_PX_X;
      if (lat > 90 || lat < -90) continue;
      if (grid[gridIndex(lat, lng)] === targetIndex) return true;
    }
  }
  return false;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Margen en kilómetros cuando el marcador no cae dentro del país.
 *
 * Para los que no llegan a ocupar un píxel de la rejilla usamos su alcance real
 * —la distancia del centroide a su punto más lejano—, porque la superficie
 * engaña: Maldivas son 300 km² repartidos en cientos de kilómetros de atolones.
 * Para el resto, un margen pequeño que perdona toques justo en la costa.
 */
function toleranceKm(country: Country): number {
  const reach = TINY_COUNTRY_REACH_KM[country.id];
  if (reach !== undefined) {
    // 0 significa que ni siquiera hay geometría disponible (Tuvalu)
    return clamp((reach || 200) + 45, 50, 600);
  }
  if (country.area >= 20_000) return 0;
  return clamp(Math.sqrt(Math.max(country.area, 1) / Math.PI) + 40, 45, 150);
}

export type LocateOutcome = {
  correct: boolean;
  /** País sobre el que cayó el marcador, si cayó en alguno. */
  hit: Country | null;
  distanceKm: number;
  /**
   * `inside`  el marcador cae dentro del país
   * `close`   país diminuto, pero el marcador estaba prácticamente encima
   * `miss`    fallo
   */
  reason: 'inside' | 'close' | 'miss';
};

export function evaluateLocate(point: Point, target: Country): LocateOutcome {
  const distanceKm = haversine(point, { lat: target.lat, lng: target.lng });
  const hit = countryAt(point);

  if (hit?.id === target.id) {
    return { correct: true, hit, distanceKm, reason: 'inside' };
  }

  const targetIndex = order.indexOf(target.id) + 1;
  if (targetIndex > 0 && nearPixel(point, targetIndex, TOLERANCE_PX)) {
    return { correct: true, hit: hit ?? target, distanceKm, reason: 'inside' };
  }

  const tolerance = toleranceKm(target);
  if (tolerance > 0 && distanceKm <= tolerance) {
    return { correct: true, hit, distanceKm, reason: 'close' };
  }

  return { correct: false, hit, distanceKm, reason: 'miss' };
}

/** Puntos de la respuesta: fijos por acertar, con bonus de rapidez y racha. */
export function locateScore(opts: { correct: boolean; msElapsed: number; streak: number; difficulty: 1 | 2 | 3 }): number {
  if (!opts.correct) return 0;
  const base = 70 + opts.difficulty * 25;
  const speed = Math.max(0, 1 - opts.msElapsed / 15000);
  return base + Math.round(base * 0.4 * speed) + Math.min(5, opts.streak) * 10;
}

/** Prepara la rejilla por adelantado (decodificarla cuesta unos pocos ms). */
export function warmUpCountryGrid(): void {
  decodeCountryGrid();
}
