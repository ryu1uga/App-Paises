import { isMastered } from '@/lib/mastery';
import {
  levelFromXp,
  levelProgress,
  levelTitle,
  selectAccuracy,
  selectRegionProgress,
  selectWeakest,
  useProgress,
  xpForLevel,
} from '@/store/progress';

const reset = () => useProgress.getState().reset();

beforeEach(reset);

describe('curva de niveles', () => {
  it('es coherente en ambos sentidos', () => {
    for (let level = 1; level <= 40; level++) {
      expect(levelFromXp(xpForLevel(level))).toBe(level);
    }
  });

  it('nunca retrocede al ganar XP', () => {
    let last = 1;
    for (let xp = 0; xp < 60_000; xp += 137) {
      const level = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
  });

  it('cada nivel cuesta más que el anterior', () => {
    for (let level = 1; level < 20; level++) {
      const actual = xpForLevel(level + 1) - xpForLevel(level);
      const siguiente = xpForLevel(level + 2) - xpForLevel(level + 1);
      expect(siguiente).toBeGreaterThan(actual);
    }
  });

  it('reporta el progreso dentro del nivel', () => {
    const p = levelProgress(xpForLevel(5));
    expect(p.level).toBe(5);
    expect(p.current).toBe(0);
    expect(p.ratio).toBe(0);
    expect(p.needed).toBeGreaterThan(0);
  });

  it('da un título para cualquier nivel', () => {
    for (const level of [1, 5, 12, 30, 99]) {
      expect(levelTitle(level).length).toBeGreaterThan(0);
    }
  });
});

describe('dominio de un país', () => {
  it('requiere constancia, no un golpe de suerte', () => {
    expect(isMastered(undefined)).toBe(false);
    expect(isMastered({ seen: 1, correct: 1, lastCorrect: 1 })).toBe(false);
    expect(isMastered({ seen: 3, correct: 3, lastCorrect: 1 })).toBe(true);
    expect(isMastered({ seen: 5, correct: 3, lastCorrect: 1 })).toBe(false);
    expect(isMastered({ seen: 4, correct: 3, lastCorrect: 1 })).toBe(true);
  });
});

describe('store de progreso', () => {
  it('acumula aciertos y fallos por país', () => {
    const { registerAnswer } = useProgress.getState();
    registerAnswer('PER', true);
    registerAnswer('PER', false);
    registerAnswer('PER', true);

    const stat = useProgress.getState().stats.PER;
    expect(stat.seen).toBe(3);
    expect(stat.correct).toBe(2);
    expect(stat.lastCorrect).not.toBeNull();
  });

  it('no mueve lastCorrect al fallar', () => {
    const { registerAnswer } = useProgress.getState();
    registerAnswer('ESP', true);
    const first = useProgress.getState().stats.ESP.lastCorrect;
    registerAnswer('ESP', false);
    expect(useProgress.getState().stats.ESP.lastCorrect).toBe(first);
  });

  it('suma XP y detecta la subida de nivel', () => {
    const run = {
      mode: 'flags' as const,
      region: null,
      correct: 10,
      total: 10,
      xp: 900,
      bestStreak: 10,
      duration: 1000,
    };
    const res = useProgress.getState().finishRun(run);
    expect(useProgress.getState().xp).toBe(900);
    expect(res.leveledUp).toBe(true);
    expect(res.newLevel).toBeGreaterThan(1);
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
        xp: 1,
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
  it('calcula la precisión global', () => {
    expect(selectAccuracy({})).toBe(0);
    expect(
      selectAccuracy({
        PER: { seen: 4, correct: 2, lastCorrect: 1 },
        ESP: { seen: 6, correct: 6, lastCorrect: 1 },
      })
    ).toBeCloseTo(8 / 10);
  });

  it('lista los países más flojos primero', () => {
    const weakest = selectWeakest({
      PER: { seen: 10, correct: 1, lastCorrect: null },
      ESP: { seen: 10, correct: 5, lastCorrect: 1 },
      JPN: { seen: 10, correct: 9, lastCorrect: 1 },
      MEX: { seen: 1, correct: 0, lastCorrect: null },
    });
    // JPN va bien y MEX se ha visto una sola vez: ninguno debe aparecer.
    expect(weakest).toEqual(['PER', 'ESP']);
  });

  it('desglosa el avance por continente', () => {
    const rows = selectRegionProgress({ PER: { seen: 3, correct: 3, lastCorrect: 1 } });
    const america = rows.find((r) => r.region === 'América');
    expect(america?.mastered).toBe(1);
    expect(america?.total).toBeGreaterThan(30);
    expect(rows.every((r) => r.ratio >= 0 && r.ratio <= 1)).toBe(true);
  });
});
