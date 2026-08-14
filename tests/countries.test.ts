import { byId, countries, normalize, regions, TOTAL_COUNTRIES } from '@/data/countries';
import { FLAGS } from '@/data/flags';

describe('dataset de países', () => {
  it('tiene los 195 estados soberanos', () => {
    expect(countries).toHaveLength(195);
    expect(TOTAL_COUNTRIES).toBe(195);
  });

  it('no repite identificadores', () => {
    expect(new Set(countries.map((c) => c.id)).size).toBe(countries.length);
    expect(new Set(countries.map((c) => c.code)).size).toBe(countries.length);
  });

  it('tiene los campos que la interfaz da por hechos', () => {
    for (const c of countries) {
      expect(c.nameEs.length).toBeGreaterThan(0);
      expect(c.capital.length).toBeGreaterThan(0);
      expect(c.capital).not.toBe('—');
      expect(c.region.length).toBeGreaterThan(0);
      expect(c.population).toBeGreaterThan(0);
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.id).toMatch(/^[A-Z]{3}$/);
    }
  });

  it('tiene coordenadas dentro de rango', () => {
    for (const c of countries) {
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lng).toBeGreaterThanOrEqual(-180);
      expect(c.lng).toBeLessThanOrEqual(180);
    }
  });

  it('solo declara fronteras con países del propio dataset', () => {
    for (const c of countries) {
      for (const border of c.borders) {
        expect(byId[border]).toBeDefined();
      }
    }
  });

  it('reparte la dificultad en tres tramos', () => {
    const tiers = [1, 2, 3].map((d) => countries.filter((c) => c.difficulty === d).length);
    expect(tiers.reduce((a, b) => a + b, 0)).toBe(195);
    for (const n of tiers) expect(n).toBeGreaterThan(30);
  });

  it('pone a los hispanohablantes en el tramo fácil', () => {
    // Es el público de la app: si Perú o Chile salieran como "difícil" la curva
    // de dificultad estaría midiendo otra cosa.
    for (const id of ['ESP', 'MEX', 'ARG', 'PER', 'COL', 'CHL', 'VEN', 'BOL']) {
      expect(byId[id].difficulty).toBe(1);
    }
  });

  it('usa capitales en español', () => {
    expect(byId.JPN.capital).toBe('Tokio');
    expect(byId.GBR.capital).toBe('Londres');
    expect(byId.EGY.capital).toBe('El Cairo');
    expect(byId.USA.capital).toBe('Washington D. C.');
    expect(byId.CHN.capital).toBe('Pekín');
  });

  it('agrupa en cinco continentes', () => {
    expect(regions).toEqual(['África', 'América', 'Asia', 'Europa', 'Oceanía']);
  });
});

describe('banderas empaquetadas', () => {
  it('tiene una por país', () => {
    expect(Object.keys(FLAGS)).toHaveLength(195);
    for (const c of countries) {
      expect(FLAGS[c.id]).toBeDefined();
    }
  });
});

describe('normalize', () => {
  it('ignora tildes, mayúsculas y signos', () => {
    expect(normalize('Perú')).toBe('peru');
    expect(normalize('ESPAÑA')).toBe('espana');
    expect(normalize('Côte d’Ivoire')).toBe('cotedivoire');
    expect(normalize('  Bosnia y Herzegovina ')).toBe('bosniayherzegovina');
  });
});
