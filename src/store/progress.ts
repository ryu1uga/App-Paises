import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { byId, TOTAL_COUNTRIES } from '@/data/countries';
import {
  GAME_MODES,
  hasStar,
  isMastered,
  starsForCountry,
  totalsForCountry,
  type CountryStat,
  type GameMode,
  type StatsMap,
} from '@/lib/mastery';

export type { CountryStat, GameMode, StatsMap };
export {
  GAME_MODES,
  hasStar,
  isMastered,
  starState,
  starsForCountry,
  totalsForCountry,
  type CountryModeStats,
  type StarState,
} from '@/lib/mastery';

/** Estrellas de un modo: una por país. */
export const STARS_PER_MODE = TOTAL_COUNTRIES;
/** Colección completa: 195 países × 4 modos. */
export const TOTAL_STARS = TOTAL_COUNTRIES * GAME_MODES.length;

export type RunResult = {
  mode: GameMode;
  region: string | null;
  correct: number;
  total: number;
  /** Marcador de la partida (velocidad + racha). No es progreso permanente. */
  points: number;
  /** Estrellas nuevas conseguidas en la ronda. */
  stars: number;
  /** Estrellas que además pasaron a dominadas. */
  mastered: number;
  bestStreak: number;
  /** ms */
  duration: number;
  at: number;
};

/** Lo que cambió al registrar una respuesta, para poder celebrarlo. */
export type AnswerGain = { newStar: boolean; newMastered: boolean };

type State = {
  streak: number;
  bestStreak: number;
  /** YYYY-MM-DD del último día jugado */
  lastPlayed: string | null;
  stats: StatsMap;
  history: RunResult[];
  hydrated: boolean;

  registerAnswer: (countryId: string, mode: GameMode, correct: boolean) => AnswerGain;
  finishRun: (result: Omit<RunResult, 'at'>) => { rank: string; rankUp: boolean; stars: number };
  touchStreak: () => void;
  reset: () => void;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a: string, b: string) => {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime();
  return Math.round(ms / 86_400_000);
};

/* ------------------------------------------------------------------ */
/* Rangos                                                              */
/* ------------------------------------------------------------------ */

/**
 * Los rangos ya no cuelgan de una curva de XP inventada: se reparten a lo largo
 * de las 780 estrellas, así que cada uno significa una porción concreta del
 * mundo aprendida.
 */
export const RANK_TITLES = [
  'Turista',
  'Mochilero',
  'Explorador',
  'Navegante',
  'Cartógrafo',
  'Geógrafo',
  'Trotamundos',
  'Maestro del Atlas',
  'Leyenda global',
];

const STARS_PER_RANK = TOTAL_STARS / RANK_TITLES.length;

export function rankForStars(stars: number): {
  title: string;
  index: number;
  /** Estrellas a las que empieza el rango siguiente, o `null` en el último. */
  next: number | null;
  /** Cuántas faltan para el siguiente. */
  remaining: number;
  /** Avance dentro del rango actual, 0..1. */
  ratio: number;
} {
  const safe = Math.max(0, Math.min(TOTAL_STARS, stars));
  const index = Math.min(RANK_TITLES.length - 1, Math.floor(safe / STARS_PER_RANK));
  const start = Math.ceil(index * STARS_PER_RANK);
  const isLast = index === RANK_TITLES.length - 1;
  const next = isLast ? null : Math.ceil((index + 1) * STARS_PER_RANK);
  return {
    title: RANK_TITLES[index],
    index,
    next,
    remaining: next === null ? 0 : Math.max(0, next - safe),
    ratio: isLast ? 1 : (safe - start) / Math.max(1, (next as number) - start),
  };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useProgress = create<State>()(
  persist(
    (set, get) => ({
      streak: 0,
      bestStreak: 0,
      lastPlayed: null,
      stats: {},
      history: [],
      hydrated: false,

      /**
       * Anota una respuesta y devuelve lo que ha cambiado. El store es el único
       * sitio que ve el antes y el después, así que es también el único que
       * puede decir si esta respuesta ganó una estrella.
       */
      registerAnswer: (countryId, mode, correct) => {
        const entry = get().stats[countryId] ?? {};
        const prev = entry[mode];
        const next: CountryStat = {
          seen: (prev?.seen ?? 0) + 1,
          correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
          lastCorrect: correct ? Date.now() : (prev?.lastCorrect ?? null),
        };

        set((s) => ({
          stats: { ...s.stats, [countryId]: { ...s.stats[countryId], [mode]: next } },
        }));

        return {
          newStar: !hasStar(prev) && hasStar(next),
          newMastered: !isMastered(prev) && isMastered(next),
        };
      },

      touchStreak: () =>
        set((s) => {
          const today = todayKey();
          if (s.lastPlayed === today) return s;
          const gap = s.lastPlayed ? daysBetween(s.lastPlayed, today) : Infinity;
          const streak = gap === 1 ? s.streak + 1 : 1;
          return {
            lastPlayed: today,
            streak,
            bestStreak: Math.max(s.bestStreak, streak),
          };
        }),

      finishRun: (result) => {
        get().touchStreak();
        set((s) => ({ history: [{ ...result, at: Date.now() }, ...s.history].slice(0, 60) }));

        // Las estrellas ya se anotaron respuesta a respuesta, así que el "antes"
        // se reconstruye restando las que dio esta ronda.
        const after = countStars(get().stats);
        const rank = rankForStars(after);
        return {
          rank: rank.title,
          rankUp: rank.title !== rankForStars(after - result.stars).title,
          stars: result.stars,
        };
      },

      reset: () => set({ streak: 0, bestStreak: 0, lastPlayed: null, stats: {}, history: [] }),
    }),
    {
      // v1 guardaba XP y niveles con un `stats` sin modo, incompatible con las
      // estrellas por modo. Se abandona a propósito en vez de migrarse: cualquier
      // reparto de aquellos aciertos entre los cuatro modos sería inventado.
      name: 'atlas-quest-progress-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ streak, bestStreak, lastPlayed, stats, history }) => ({
        streak,
        bestStreak,
        lastPlayed,
        stats,
        history,
      }),
      onRehydrateStorage: () => (state) => {
        useProgress.setState({ hydrated: true });
        void state;
      },
    }
  )
);

/* ------------------------------------------------------------------ */
/* Selectores derivados                                                */
/* ------------------------------------------------------------------ */

/** Estrellas ganadas en un modo (0..195). */
export function starsIn(stats: StatsMap, mode: GameMode): number {
  let n = 0;
  for (const entry of Object.values(stats)) if (hasStar(entry[mode])) n++;
  return n;
}

/** Estrellas rellenas (país dominado) en un modo. */
export function masteredIn(stats: StatsMap, mode: GameMode): number {
  let n = 0;
  for (const entry of Object.values(stats)) if (isMastered(entry[mode])) n++;
  return n;
}

/** Total de la colección (0..780). */
export function countStars(stats: StatsMap): number {
  return GAME_MODES.reduce((n, mode) => n + starsIn(stats, mode), 0);
}

export function countMastered(stats: StatsMap): number {
  return GAME_MODES.reduce((n, mode) => n + masteredIn(stats, mode), 0);
}

/** Una fila por modo, lista para pintar en inicio y perfil. */
export function selectModeProgress(
  stats: StatsMap
): { mode: GameMode; stars: number; mastered: number; total: number; ratio: number }[] {
  return GAME_MODES.map((mode) => {
    const stars = starsIn(stats, mode);
    return {
      mode,
      stars,
      mastered: masteredIn(stats, mode),
      total: STARS_PER_MODE,
      ratio: stars / STARS_PER_MODE,
    };
  });
}

/** Países con las cuatro estrellas: el mundo entero en los cuatro modos. */
export function selectComplete(stats: StatsMap): string[] {
  return Object.keys(stats).filter((id) => starsForCountry(stats, id) === GAME_MODES.length);
}

export function selectAccuracy(stats: StatsMap): number {
  let seen = 0;
  let correct = 0;
  for (const entry of Object.values(stats)) {
    const t = totalsForCountry(entry);
    seen += t.seen;
    correct += t.correct;
  }
  return seen === 0 ? 0 : correct / seen;
}

/** Avance por continente, contando estrellas sobre países × modos. */
export function selectRegionProgress(
  stats: StatsMap
): { region: string; stars: number; total: number; ratio: number }[] {
  const totals: Record<string, number> = {};
  const done: Record<string, number> = {};

  for (const c of Object.values(byId)) {
    totals[c.region] = (totals[c.region] ?? 0) + GAME_MODES.length;
    done[c.region] = (done[c.region] ?? 0) + starsForCountry(stats, c.id);
  }

  return Object.keys(totals)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((region) => ({
      region,
      stars: done[region] ?? 0,
      total: totals[region],
      ratio: (done[region] ?? 0) / totals[region],
    }));
}

/** Países más fallados sumando todos los modos, para "sigue practicando". */
export function selectWeakest(stats: StatsMap, n = 6): string[] {
  return Object.entries(stats)
    .map(([id, entry]) => ({ id, ...totalsForCountry(entry) }))
    .filter((s) => s.seen >= 2 && s.correct / s.seen < 0.6)
    .sort((a, b) => a.correct / a.seen - b.correct / b.seen)
    .slice(0, n)
    .map((s) => s.id);
}

export { TOTAL_COUNTRIES };
