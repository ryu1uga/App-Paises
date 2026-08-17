import {
  GAME_MODES,
  hasStar,
  splitDeck,
  starState,
  starsForCountry,
  type StatsMap,
} from '@/lib/mastery';
import {
  RANK_TITLES,
  TOTAL_STARS,
  countStars,
  rankForStars,
  selectAccuracy,
  selectComplete,
  selectModeProgress,
  selectRegionProgress,
  selectWeakest,
  starsIn,
  useProgress,
} from '@/store/progress';

const reset = () => useProgress.getState().reset();

beforeEach(reset);

const stat = (seen: number, correct: number, lastCorrect: number | null = null) => ({
  seen,
  correct,
  lastCorrect,
});

describe('estrellas', () => {
  it('se gana con el primer acierto y no se pierde al fallar después', () => {
    expect(hasStar(undefined)).toBe(false);
    expect(hasStar(stat(1, 0))).toBe(false);
    expect(hasStar(stat(1, 1))).toBe(true);
    expect(hasStar(stat(9, 1))).toBe(true);
  });

  it('se rellena solo al dominar el país', () => {
    expect(starState(undefined)).toBe('none');
    expect(starState(stat(2, 0))).toBe('none');
    expect(starState(stat(2, 1))).toBe('earned');
    expect(starState(stat(3, 3))).toBe('mastered');
    // 3 aciertos pero 60 % de precisión: sigue siendo solo ganada.
    expect(starState(stat(5, 3))).toBe('earned');
  });

  it('cuenta hasta cuatro por país, una por modo', () => {
    const stats: StatsMap = { PER: { flags: stat(1, 1), capitals: stat(2, 0) } };
    expect(starsForCountry(stats, 'PER')).toBe(1);
    expect(starsForCountry(stats, 'ESP')).toBe(0);

    const todas: StatsMap = { PER: Object.fromEntries(GAME_MODES.map((m) => [m, stat(1, 1)])) };
    expect(starsForCountry(todas, 'PER')).toBe(GAME_MODES.length);
  });

  it('el progreso de un modo no contamina a los demás', () => {
    useProgress.getState().registerAnswer('PER', 'flags', true);

    const stats = useProgress.getState().stats;
    expect(starsIn(stats, 'flags')).toBe(1);
    expect(starsIn(stats, 'capitals')).toBe(0);
    expect(starsIn(stats, 'locate')).toBe(0);
  });
});

describe('el mazo', () => {
  const ids = ['A', 'B', 'C', 'D'];

  it('reparte en no visto / pendiente / con estrella', () => {
    const stats: StatsMap = {
      B: { flags: stat(1, 0) }, // visto y fallado
      C: { flags: stat(1, 1) }, // con estrella
      D: { capitals: stat(3, 3) }, // otro modo: para flags sigue siendo nuevo
    };
    const deck = splitDeck(ids, stats, 'flags');
    expect(deck.fresh).toEqual(['A', 'D']);
    expect(deck.review).toEqual(['B']);
    expect(deck.known).toEqual(['C']);
  });

  it('las tres pilas son disjuntas y cubren todo el pool', () => {
    const stats: StatsMap = { B: { flags: stat(2, 0) }, C: { flags: stat(2, 2) } };
    const { fresh, review, known } = splitDeck(ids, stats, 'flags');
    expect([...fresh, ...review, ...known].sort()).toEqual([...ids].sort());
    expect(new Set([...fresh, ...review, ...known]).size).toBe(ids.length);
  });
});

describe('rangos por estrellas', () => {
  it('empieza en el primero y termina en el último', () => {
    expect(rankForStars(0).title).toBe('Turista');
    expect(rankForStars(TOTAL_STARS).title).toBe('Gran Cartógrafo');
    expect(rankForStars(TOTAL_STARS).next).toBeNull();
  });

  it('cubre toda la colección con trece títulos', () => {
    expect(RANK_TITLES).toHaveLength(13);
    expect(rankForStars(TOTAL_STARS).index).toBe(RANK_TITLES.length - 1);
  });

  it('nadie baja de rango al añadir modos', () => {
    // Invariante de compatibilidad: con cuatro modos había nueve rangos sobre
    // 780 estrellas. Ningún jugador puede despertarse con un rango peor del que
    // tenía, así que cada corte nuevo debe quedar en o por debajo del viejo.
    const escalonViejo = 780 / 9;
    for (let stars = 0; stars <= 780; stars++) {
      const viejo = Math.min(8, Math.floor(stars / escalonViejo));
      expect(rankForStars(stars).index).toBeGreaterThanOrEqual(viejo);
    }
  });

  it('nunca retrocede al ganar estrellas', () => {
    let last = -1;
    for (let s = 0; s <= TOTAL_STARS; s++) {
      const index = rankForStars(s).index;
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });

  it('aguanta valores fuera de rango', () => {
    expect(rankForStars(-5).title).toBe('Turista');
    expect(rankForStars(TOTAL_STARS * 3).title).toBe('Gran Cartógrafo');
    expect(rankForStars(10).ratio).toBeGreaterThanOrEqual(0);
    expect(rankForStars(10).ratio).toBeLessThanOrEqual(1);
  });
});

describe('store de progreso', () => {
  it('acumula aciertos y fallos por país y modo', () => {
    const { registerAnswer } = useProgress.getState();
    registerAnswer('PER', 'flags', true);
    registerAnswer('PER', 'flags', false);
    registerAnswer('PER', 'flags', true);

    const s = useProgress.getState().stats.PER.flags!;
    expect(s.seen).toBe(3);
    expect(s.correct).toBe(2);
    expect(s.lastCorrect).not.toBeNull();
  });

  it('avisa de la estrella nueva una sola vez', () => {
    const { registerAnswer } = useProgress.getState();
    expect(registerAnswer('PER', 'flags', false).newStar).toBe(false);
    expect(registerAnswer('PER', 'flags', true).newStar).toBe(true);
    // Ya la tenía: acertar de nuevo no regala otra.
    expect(registerAnswer('PER', 'flags', true).newStar).toBe(false);
  });

  it('avisa del dominio al tercer acierto limpio', () => {
    const { registerAnswer } = useProgress.getState();
    expect(registerAnswer('ESP', 'capitals', true).newMastered).toBe(false);
    expect(registerAnswer('ESP', 'capitals', true).newMastered).toBe(false);
    expect(registerAnswer('ESP', 'capitals', true).newMastered).toBe(true);
    expect(registerAnswer('ESP', 'capitals', true).newMastered).toBe(false);
  });

  it('no mueve lastCorrect al fallar', () => {
    const { registerAnswer } = useProgress.getState();
    registerAnswer('ESP', 'flags', true);
    const first = useProgress.getState().stats.ESP.flags!.lastCorrect;
    registerAnswer('ESP', 'flags', false);
    expect(useProgress.getState().stats.ESP.flags!.lastCorrect).toBe(first);
  });

  it('cierra la ronda sin cambiar de rango por una estrella', () => {
    const { registerAnswer, finishRun } = useProgress.getState();
    registerAnswer('PER', 'flags', true);
    const res = finishRun({
      mode: 'flags',
      region: null,
      correct: 1,
      total: 1,
      points: 100,
      stars: 1,
      mastered: 0,
      bestStreak: 1,
      duration: 1000,
    });
    expect(res.stars).toBe(1);
    expect(res.rank).toBe('Turista');
    expect(res.rankUp).toBe(false);
  });

  it('arranca la racha en 1 el primer día', () => {
    useProgress.getState().touchStreak();
    expect(useProgress.getState().streak).toBe(1);
    // Repetir el mismo día no la sube.
    useProgress.getState().touchStreak();
    expect(useProgress.getState().streak).toBe(1);
  });

  it('guarda el historial más reciente primero y acotado', () => {
    for (let i = 0; i < 70; i++) {
      useProgress.getState().finishRun({
        mode: 'capitals',
        region: null,
        correct: i,
        total: 10,
        points: 1,
        stars: 0,
        mastered: 0,
        bestStreak: 0,
        duration: 1,
      });
    }
    const history = useProgress.getState().history;
    expect(history.length).toBeLessThanOrEqual(60);
    expect(history[0].correct).toBe(69);
  });
});

describe('selectores', () => {
  it('calcula la precisión sumando todos los modos', () => {
    expect(selectAccuracy({})).toBe(0);
    expect(
      selectAccuracy({
        PER: { flags: stat(4, 2), capitals: stat(2, 2) },
        ESP: { flags: stat(4, 4) },
      })
    ).toBeCloseTo(8 / 10);
  });

  it('cuenta la colección completa sobre los cuatro modos', () => {
    const full = Object.fromEntries(GAME_MODES.map((m) => [m, stat(1, 1)]));
    const stats: StatsMap = { PER: full, ESP: { flags: stat(1, 1) } };
    expect(countStars(stats)).toBe(GAME_MODES.length + 1);
    expect(selectComplete(stats)).toEqual(['PER']);
  });

  it('da una fila por modo con su total', () => {
    const rows = selectModeProgress({ PER: { flags: stat(3, 3) } });
    expect(rows).toHaveLength(GAME_MODES.length);
    const flags = rows.find((r) => r.mode === 'flags')!;
    expect(flags.stars).toBe(1);
    expect(flags.mastered).toBe(1);
    expect(rows.every((r) => r.ratio >= 0 && r.ratio <= 1)).toBe(true);
  });

  it('lista los países más flojos primero', () => {
    const weakest = selectWeakest({
      PER: { flags: stat(10, 1) },
      ESP: { flags: stat(5, 3), capitals: stat(5, 2) },
      JPN: { flags: stat(10, 9) },
      MEX: { flags: stat(1, 0) },
    });
    // JPN va bien y MEX se ha visto una sola vez: ninguno debe aparecer.
    expect(weakest).toEqual(['PER', 'ESP']);
  });

  it('desglosa el avance por continente en estrellas', () => {
    const rows = selectRegionProgress({ PER: { flags: stat(3, 3), locate: stat(1, 1) } });
    const america = rows.find((r) => r.region === 'América')!;
    expect(america.stars).toBe(2);
    // Cada país aporta cuatro estrellas al total del continente.
    expect(america.total).toBeGreaterThan(30 * GAME_MODES.length);
    expect(rows.every((r) => r.ratio >= 0 && r.ratio <= 1)).toBe(true);
  });
});
