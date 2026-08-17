import { countriesOf, regions } from '@/data/countries';
import { reviewWeight, type StatsMap } from '@/lib/mastery';
import { buildQuiz, scoreAnswer, type GameMode } from '@/lib/quiz';

const MULTIPLE_CHOICE: GameMode[] = ['flags', 'capitals', 'flagsReverse'];
const DAY = 86_400_000;

describe('buildQuiz', () => {
  it.each(MULTIPLE_CHOICE)('%s da 4 opciones con la correcta dentro', (mode) => {
    for (const q of buildQuiz({ mode, region: null, length: 20 })) {
      expect(q.options).toHaveLength(4);
      expect(q.options.map((o) => o.id)).toContain(q.target.id);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
    }
  });

  it('en ubicar no genera distractores: el globo muestra los 195', () => {
    for (const q of buildQuiz({ mode: 'locate', region: null, length: 20 })) {
      expect(q.options).toHaveLength(0);
    }
  });

  it('no repite países dentro de una ronda', () => {
    for (let i = 0; i < 40; i++) {
      const ids = buildQuiz({ mode: 'flags', region: null, length: 30 }).map((q) => q.target.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('respeta el filtro por continente', () => {
    for (const region of regions) {
      for (const q of buildQuiz({ mode: 'flags', region, length: 20 })) {
        expect(q.target.region).toBe(region);
        for (const o of q.options) expect(o.region).toBe(region);
      }
    }
  });

  it('se adapta a continentes con pocos países', () => {
    // Oceanía tiene menos de 30: la ronda debe acortarse, no fallar ni repetir.
    const pool = countriesOf('Oceanía');
    const quiz = buildQuiz({ mode: 'flags', region: 'Oceanía', length: 30 });
    expect(quiz.length).toBe(Math.min(30, pool.length));
    expect(new Set(quiz.map((q) => q.target.id)).size).toBe(quiz.length);
  });

  it('ordena la ronda de fácil a difícil', () => {
    for (const q of [buildQuiz({ mode: 'flags', region: null, length: 30 })]) {
      const tiers = q.map((x) => x.target.difficulty);
      expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
    }
  });

  it('no plantea capitales ambiguas', () => {
    // Si dos opciones compartieran capital la pregunta no tendría solución única.
    for (let i = 0; i < 200; i++) {
      for (const q of buildQuiz({ mode: 'capitals', region: null, length: 12 })) {
        const caps = q.options.map((o) => o.capital);
        expect(new Set(caps).size).toBe(caps.length);
      }
    }
  });
});

describe('repetición espaciada', () => {
  const stat = (seen: number, correct: number, lastCorrect: number | null = null) => ({
    seen,
    correct,
    lastCorrect,
  });

  it('prioriza lo nunca visto sobre lo dominado', () => {
    const nuevo = reviewWeight(2, undefined);
    const dominado = reviewWeight(2, stat(10, 10, Date.now()));
    expect(nuevo).toBeGreaterThan(dominado * 5);
  });

  it('insiste en lo que se falla', () => {
    const falla = reviewWeight(2, stat(10, 2));
    const acierta = reviewWeight(2, stat(10, 9));
    expect(falla).toBeGreaterThan(acierta);
  });

  it('deja descansar lo recién acertado y lo recupera con los días', () => {
    const now = Date.now();
    const recien = reviewWeight(2, stat(4, 2, now), now);
    const haceUnaSemana = reviewWeight(2, stat(4, 2, now - 7 * DAY), now);
    expect(haceUnaSemana).toBeGreaterThan(recien);
  });

  it('nunca da peso negativo o nulo', () => {
    for (const d of [1, 2, 3] as const) {
      for (const s of [undefined, stat(0, 0), stat(50, 50, Date.now()), stat(3, 0)]) {
        expect(reviewWeight(d, s)).toBeGreaterThan(0);
      }
    }
  });

  it('saca antes los países fallados que los dominados', () => {
    const pool = countriesOf(null);
    const fallados = pool.slice(0, 10).map((c) => c.id);
    const stats: StatsMap = {};
    // Todo dominado salvo diez que se fallan siempre.
    for (const c of pool) stats[c.id] = { flags: stat(10, 10, Date.now()) };
    for (const id of fallados) stats[id] = { flags: stat(10, 0, null) };

    let apariciones = 0;
    const rondas = 40;
    for (let i = 0; i < rondas; i++) {
      const ids = buildQuiz({ mode: 'flags', region: null, length: 12, stats }).map(
        (q) => q.target.id
      );
      apariciones += ids.filter((id) => fallados.includes(id)).length;
    }

    // Sin ponderar saldrían ~0,6 por ronda (10 de 195). Al no tener estrella caen
    // en la pila de repaso, que tiene reservada la mitad de la ronda.
    expect(apariciones / rondas).toBeGreaterThan(3);
  });

  it('sin historial mantiene el reparto por tramos', () => {
    const quiz = buildQuiz({ mode: 'flags', region: null, length: 20 });
    expect(quiz).toHaveLength(20);
  });
});

describe('el mazo', () => {
  /** Encadena rondas anotando cada respuesta como acierto. */
  const jugar = (rondas: number, length = 12, mode: GameMode = 'flags') => {
    const stats: StatsMap = {};
    const vistos: string[] = [];

    for (let r = 0; r < rondas; r++) {
      for (const q of buildQuiz({ mode, region: null, length, stats })) {
        vistos.push(q.target.id);
        const prev = stats[q.target.id]?.[mode];
        stats[q.target.id] = {
          ...stats[q.target.id],
          [mode]: {
            seen: (prev?.seen ?? 0) + 1,
            correct: (prev?.correct ?? 0) + 1,
            lastCorrect: Date.now(),
          },
        };
      }
    }
    return { stats, vistos };
  };

  it('acertando siempre, ningún país se repite antes de ver los 195', () => {
    // 16 rondas de 12 = 192 preguntas, aún por debajo de los 195 del mazo.
    const { vistos } = jugar(16);
    expect(vistos).toHaveLength(192);
    expect(new Set(vistos).size).toBe(192);
  });

  it('un país fallado vuelve pronto, sin esperar a dar la vuelta al mazo', () => {
    const fallado = countriesOf(null)[0].id;
    const stats: StatsMap = { [fallado]: { flags: stat(1, 0) } };

    let apariciones = 0;
    for (let i = 0; i < 40; i++) {
      const ids = buildQuiz({ mode: 'flags', region: null, length: 12, stats }).map(
        (q) => q.target.id
      );
      if (ids.includes(fallado)) apariciones++;
    }
    // Con un mazo estricto de 195 cartas tardaría ~16 rondas en reaparecer.
    expect(apariciones).toBeGreaterThan(20);
  });

  it('cada modo tiene su propio mazo', () => {
    const { stats } = jugar(4, 12, 'flags');
    const enCapitales = buildQuiz({ mode: 'capitals', region: null, length: 12, stats });
    // Lo jugado en banderas no gasta el mazo de capitales.
    expect(enCapitales).toHaveLength(12);
    expect(enCapitales.every((q) => (stats[q.target.id]?.capitals?.seen ?? 0) === 0)).toBe(true);
  });
});

describe('scoreAnswer', () => {
  it('no da puntos por fallar', () => {
    expect(scoreAnswer({ correct: false, msElapsed: 0, streak: 9, difficulty: 3 })).toBe(0);
  });

  it('premia la rapidez', () => {
    const rapido = scoreAnswer({ correct: true, msElapsed: 500, streak: 0, difficulty: 2 });
    const lento = scoreAnswer({ correct: true, msElapsed: 20000, streak: 0, difficulty: 2 });
    expect(rapido).toBeGreaterThan(lento);
  });

  it('premia la racha, con tope', () => {
    const sinRacha = scoreAnswer({ correct: true, msElapsed: 0, streak: 0, difficulty: 2 });
    const conRacha = scoreAnswer({ correct: true, msElapsed: 0, streak: 5, difficulty: 2 });
    const rachaEnorme = scoreAnswer({ correct: true, msElapsed: 0, streak: 99, difficulty: 2 });
    expect(conRacha).toBeGreaterThan(sinRacha);
    expect(rachaEnorme).toBe(conRacha);
  });

  it('paga más los países difíciles', () => {
    const facil = scoreAnswer({ correct: true, msElapsed: 0, streak: 0, difficulty: 1 });
    const dificil = scoreAnswer({ correct: true, msElapsed: 0, streak: 0, difficulty: 3 });
    expect(dificil).toBeGreaterThan(facil);
  });
});
