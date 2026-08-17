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

// ---------------------------------------------------------------------------
// Regresiones. Cada bloque de aquí abajo cubre un error real que llegó a
// producción porque `tools/enrich.js` tiraba de datasets sin fecha de corte.
// ---------------------------------------------------------------------------

describe('integridad del grafo de fronteras', () => {
  it('es simétrico: si A limita con B, B limita con A', () => {
    const rotas: string[] = [];
    for (const c of countries) {
      for (const b of c.borders) {
        if (!byId[b]?.borders.includes(c.id)) rotas.push(`${c.id}->${b}`);
      }
    }
    expect(rotas).toEqual([]);
  });

  it('no da fronteras terrestres a los países insulares', () => {
    // Sri Lanka llegó a declarar frontera con India.
    for (const id of ['LKA', 'JPN', 'ISL', 'CUB', 'MDG', 'NZL', 'AUS', 'PHL', 'JAM']) {
      expect(byId[id].borders).toEqual([]);
    }
  });

  it('marca como landlocked solo a países sin fronteras vacías', () => {
    for (const c of countries) {
      if (c.landlocked) expect(c.borders.length).toBeGreaterThan(0);
    }
  });
});

describe('población', () => {
  it('no repite el mismo valor en dos países', () => {
    // RD Congo heredaba la población de Congo-Brazzaville por un alias ambiguo.
    const vistos = new Map<number, string>();
    const dups: string[] = [];
    for (const c of countries) {
      const previo = vistos.get(c.population);
      if (previo) dups.push(`${previo}/${c.id}`);
      else vistos.set(c.population, c.id);
    }
    expect(dups).toEqual([]);
  });

  it('coloca a India por delante de China', () => {
    expect(byId.IND.population).toBeGreaterThan(byId.CHN.population);
  });

  it('da a los gigantes un orden de magnitud creíble', () => {
    expect(byId.COD.population).toBeGreaterThan(100_000_000);
    expect(byId.NGA.population).toBeGreaterThan(200_000_000);
    expect(byId.IND.population).toBeGreaterThan(1_400_000_000);
    expect(byId.VAT.population).toBeLessThan(10_000);
  });
});

describe('esperanza de vida', () => {
  it('está en un rango plausible para el siglo XXI', () => {
    // El dataset anterior era de los años 90: Zambia figuraba con 37,2 años.
    for (const c of countries) {
      if (c.lifeExpectancy === null) continue;
      expect(c.lifeExpectancy).toBeGreaterThanOrEqual(50);
      expect(c.lifeExpectancy).toBeLessThanOrEqual(90);
    }
  });

  it('solo la deja sin dato donde el Banco Mundial no publica', () => {
    const sinDato = countries.filter((c) => c.lifeExpectancy === null).map((c) => c.id);
    expect(sinDato).toEqual(['VAT']);
  });
});

describe('todo el texto visible está en español', () => {
  const EN = /\b(dollar|franc|peso|rupee|dinar|riyal|rial|pound|krona|krone|shilling|Creole|German|Sign Language|Norwegian|Persian|North America|Republic of|Islands)\b/;

  it('no deja monedas en inglés', () => {
    const malas = countries.filter((c) => EN.test(c.currency)).map((c) => `${c.id}:${c.currency}`);
    expect(malas).toEqual([]);
  });

  it('no deja idiomas en inglés', () => {
    const malos = countries
      .filter((c) => c.languages.some((l) => EN.test(l)))
      .map((c) => `${c.id}:${c.languages.join('/')}`);
    expect(malos).toEqual([]);
  });

  it('no deja subregiones en inglés', () => {
    const malas = countries.filter((c) => EN.test(c.subregion)).map((c) => c.subregion);
    expect(malas).toEqual([]);
  });

  it('escribe los exónimos como manda la RAE', () => {
    expect(byId.SLE.nameEs).toBe('Sierra Leona');
    expect(byId.IRN.nameEs).toBe('Irán');
    expect(byId.MLI.nameEs).toBe('Malí');
    expect(byId.DJI.nameEs).toBe('Yibuti');
    expect(byId.GRD.nameEs).toBe('Granada');
    expect(byId.BWA.nameEs).toBe('Botsuana');
    expect(byId.SWZ.nameEs).toBe('Esuatini');
  });

  it('empieza los nombres oficiales en mayúscula', () => {
    for (const c of countries) {
      expect(c.officialEs[0]).toBe(c.officialEs[0].toUpperCase());
    }
  });
});

describe('campos completos', () => {
  it('tiene gentilicio para los 195', () => {
    const vacios = countries.filter((c) => !c.demonym || c.demonym.length < 3).map((c) => c.id);
    expect(vacios).toEqual([]);
  });

  it('tiene moneda y temperatura media para los 195', () => {
    for (const c of countries) {
      expect(c.currency.length).toBeGreaterThan(2);
      expect(c.avgTemp).not.toBeNull();
    }
  });
});

describe('datos vigentes', () => {
  it('refleja las monedas actuales', () => {
    expect(byId.BGR.currency).toBe('Euro'); // adoptado el 1 de enero de 2026
    expect(byId.HRV.currency).toBe('Euro'); // adoptado en 2023
    expect(byId.CUB.currency).toBe('Peso cubano'); // el CUC se eliminó en 2021
    expect(byId.VEN.currency).toBe('Bolívar digital');
    expect(byId.ZWE.currency).toMatch(/^ZiG/); // desde abril de 2024
  });

  it('refleja los renombramientos y capitales recientes', () => {
    expect(byId.KAZ.capital).toBe('Astaná'); // 2022
    expect(byId.BDI.capital).toBe('Gitega'); // 2019
    expect(byId.TZA.capital).toBe('Dodoma');
    expect(byId.IDN.capital).toBe('Yakarta'); // confirmado por su Corte Constitucional en 2026
    expect(byId.SWZ.nameEn).toBe('Eswatini');
    expect(byId.MKD.nameEs).toBe('Macedonia del Norte');
    expect(byId.CZE.nameEs).toBe('Chequia');
    expect(byId.MDA.languages).toContain('Rumano'); // reforma constitucional de 2023
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
