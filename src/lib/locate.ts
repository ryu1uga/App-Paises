import { byId, countries, type Country } from '@/data/countries';
import { decodeCountryGrid, GRID_HEIGHT, GRID_WIDTH } from '@/globe/countryGrid';

/**
 * Consulta "¿qué país hay en este punto?" sobre una rejilla equirectangular
 * embebida en el bundle, sin llevar polígonos ni hacer point-in-polygon en
 * tiempo real. La usa el modo Explorar para saber qué país tocaste en el globo.
 */

/** Orden de los países, que es el que usa la rejilla como índice (1..N). */
const order = countries.map((c) => c.id);

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
 * Igual que `countryAt`, pero mirando en espiral alrededor del punto. Sirve para
 * que un toque cerca de la costa —o sobre un país más pequeño que un píxel—
 * encuentre igualmente el país más plausible.
 */
export function countryNear(p: Point, radiusPx = 3): Country | null {
  const exact = countryAt(p);
  if (exact) return exact;

  const grid = decodeCountryGrid();
  const degX = 360 / GRID_WIDTH;
  const degY = 180 / GRID_HEIGHT;

  for (let r = 1; r <= radiusPx; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // solo el anillo
        const lat = p.lat - dy * degY;
        if (lat > 90 || lat < -90) continue;
        const v = grid[gridIndex(lat, p.lng + dx * degX)];
        if (v !== 0) return byId[order[v - 1]] ?? null;
      }
    }
  }
  return null;
}

/** Prepara la rejilla por adelantado (decodificarla cuesta unos pocos ms). */
export function warmUpCountryGrid(): void {
  decodeCountryGrid();
}
