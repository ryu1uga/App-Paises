import { byId, countries } from '@/data/countries';
import { decodeCountryGrid, GRID_HEIGHT, GRID_WIDTH } from '@/globe/countryGrid';
import { countryAt, countryNear } from '@/lib/locate';

describe('rejilla de fronteras', () => {
  it('decodifica al tamaño esperado', () => {
    expect(decodeCountryGrid()).toHaveLength(GRID_WIDTH * GRID_HEIGHT);
  });

  it('cubre una porción de tierra plausible', () => {
    const grid = decodeCountryGrid();
    let land = 0;
    for (const v of grid) if (v !== 0) land++;
    const ratio = land / grid.length;
    // Los 195 estados soberanos ocupan alrededor de un 23 % del planeta.
    expect(ratio).toBeGreaterThan(0.18);
    expect(ratio).toBeLessThan(0.3);
  });

  it('solo contiene índices de países existentes', () => {
    const grid = decodeCountryGrid();
    const max = countries.length;
    for (let i = 0; i < grid.length; i += 997) {
      expect(grid[i]).toBeLessThanOrEqual(max);
    }
  });
});

describe('countryAt', () => {
  const cases: [string, number, number, string][] = [
    ['Lima', -12.05, -77.04, 'PER'],
    ['Cusco', -13.53, -71.97, 'PER'],
    ['Madrid', 40.42, -3.7, 'ESP'],
    ['Lisboa', 38.72, -9.14, 'PRT'],
    ['París', 48.86, 2.35, 'FRA'],
    ['Berlín', 52.52, 13.4, 'DEU'],
    ['Tokio', 35.68, 139.69, 'JPN'],
    ['Pekín', 39.9, 116.41, 'CHN'],
    ['El Cairo', 30.04, 31.24, 'EGY'],
    ['Nairobi', -1.29, 36.82, 'KEN'],
    ['Canberra', -35.28, 149.13, 'AUS'],
    ['Brasilia', -15.79, -47.88, 'BRA'],
    ['Ciudad de México', 19.43, -99.13, 'MEX'],
    ['Ottawa', 45.42, -75.7, 'CAN'],
    ['Moscú', 55.75, 37.62, 'RUS'],
    ['Nueva Delhi', 28.61, 77.21, 'IND'],
    ['Wellington', -41.29, 174.78, 'NZL'],
  ];

  it.each(cases)('%s cae en el país correcto', (_n, lat, lng, id) => {
    expect(countryNear({ lat, lng })?.id).toBe(id);
  });

  it('resuelve bien el cruce del antimeridiano', () => {
    // Chukotka está al este de 180°: si la longitud no se normaliza, falla.
    expect(countryNear({ lat: 64.73, lng: 177.51 })?.id).toBe('RUS');
    expect(countryNear({ lat: 64.73, lng: -179.9 })?.id).toBe('RUS');
  });

  it('devuelve null en mar abierto', () => {
    expect(countryAt({ lat: 30, lng: -40 })).toBeNull();
    expect(countryAt({ lat: -40, lng: -120 })).toBeNull();
    expect(countryNear({ lat: 0, lng: -150 })).toBeNull();
  });

  it('no confunde territorios ajenos con países del dataset', () => {
    // Groenlandia no es un estado soberano de la lista.
    expect(countryAt({ lat: 72, lng: -40 })).toBeNull();
  });

  it('tolera longitudes fuera de rango', () => {
    expect(countryNear({ lat: 40.42, lng: -3.7 + 360 })?.id).toBe('ESP');
    expect(countryNear({ lat: 40.42, lng: -3.7 - 360 })?.id).toBe('ESP');
  });

  it('encuentra el país al tocar cerca de la costa', () => {
    // countryNear busca en espiral; countryAt exacto puede caer en el mar.
    const costa = { lat: -12.2, lng: -77.2 };
    expect(countryNear(costa)?.id).toBe('PER');
  });
});

describe('centroides del dataset', () => {
  it('la mayoría cae dentro de su propio país', () => {
    // No puede ser el 100 %: el centroide de Indonesia o Croacia cae en el mar.
    const dentro = countries.filter((c) => countryNear(c, 4)?.id === c.id).length;
    expect(dentro / countries.length).toBeGreaterThan(0.8);
  });

  it('ningún centroide apunta a un país inexistente', () => {
    for (const c of countries) {
      const hit = countryNear(c, 2);
      if (hit) expect(byId[hit.id]).toBeDefined();
    }
  });
});
