import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { byId, TOTAL_COUNTRIES } from '@/data/countries';
import { isMastered, type StatsMap } from '@/lib/mastery';
import type { GameMode } from '@/lib/quiz';

export type { CountryStat } from '@/lib/mastery';

export type RunResult = {
  mode: GameMode;
  region: string | null;
  correct: number;
  total: number;
  xp: number;
  bestStreak: number;
  /** ms */
  duration: number;
  at: number;
};

type State = {
  xp: number;
  streak: number;
  bestStreak: number;
  /** YYYY-MM-DD del último día jugado */
  lastPlayed: string | null;
  stats: StatsMap;
  history: RunResult[];
  hydrated: boolean;

  registerAnswer: (countryId: string, correct: boolean) => void;
  finishRun: (result: Omit<RunResult, 'at'>) => { leveledUp: boolean; newLevel: number };
  touchStreak: () => void;
  reset: () => void;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const daysBetween = (a: string, b: string) => {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime();
  return Math.round(ms / 86_400_000);
};

/** Curva de niveles: cada nivel cuesta un poco más que el anterior. */
export function levelFromXp(xp: number): number {
  return Math.floor((-1 + Math.sqrt(1 + (8 * xp) / 250)) / 2) + 1;
}

export function xpForLevel(level: number): number {
  const n = level - 1;
  return Math.round((250 * n * (n + 1)) / 2);
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return {
    level,
    current: xp - start,
    needed: end - start,
    ratio: Math.min(1, Math.max(0, (xp - start) / (end - start))),
  };
}

export const LEVEL_TITLES = [
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

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))];
}

export { isMastered } from '@/lib/mastery';

export const useProgress = create<State>()(
  persist(
    (set, get) => ({
      xp: 0,
      streak: 0,
      bestStreak: 0,
      lastPlayed: null,
      stats: {},
      history: [],
      hydrated: false,

      registerAnswer: (countryId, correct) =>
        set((s) => {
          const prev = s.stats[countryId] ?? { seen: 0, correct: 0, lastCorrect: null };
          return {
            stats: {
              ...s.stats,
              [countryId]: {
                seen: prev.seen + 1,
                correct: prev.correct + (correct ? 1 : 0),
                lastCorrect: correct ? Date.now() : prev.lastCorrect,
              },
            },
          };
        }),

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
        const before = levelFromXp(get().xp);
        get().touchStreak();
        set((s) => ({
          xp: s.xp + result.xp,
          history: [{ ...result, at: Date.now() }, ...s.history].slice(0, 60),
        }));
        const after = levelFromXp(get().xp);
        return { leveledUp: after > before, newLevel: after };
      },

      reset: () =>
        set({ xp: 0, streak: 0, bestStreak: 0, lastPlayed: null, stats: {}, history: [] }),
    }),
    {
      name: 'atlas-quest-progress-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ xp, streak, bestStreak, lastPlayed, stats, history }) => ({
        xp,
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

export function selectMastered(stats: StatsMap): string[] {
  return Object.entries(stats)
    .filter(([, st]) => isMastered(st))
    .map(([id]) => id);
}

export function selectAccuracy(stats: StatsMap): number {
  const vals = Object.values(stats);
  const seen = vals.reduce((a, s) => a + s.seen, 0);
  const correct = vals.reduce((a, s) => a + s.correct, 0);
  return seen === 0 ? 0 : correct / seen;
}

export function selectRegionProgress(
  stats: StatsMap
): { region: string; mastered: number; total: number; ratio: number }[] {
  const totals: Record<string, number> = {};
  const done: Record<string, number> = {};

  for (const c of Object.values(byId)) {
    totals[c.region] = (totals[c.region] ?? 0) + 1;
    if (isMastered(stats[c.id])) done[c.region] = (done[c.region] ?? 0) + 1;
  }

  return Object.keys(totals)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((region) => ({
      region,
      mastered: done[region] ?? 0,
      total: totals[region],
      ratio: (done[region] ?? 0) / totals[region],
    }));
}

/** Países más fallados, para el bloque "sigue practicando". */
export function selectWeakest(stats: StatsMap, n = 6): string[] {
  return Object.entries(stats)
    .filter(([, s]) => s.seen >= 2 && s.correct / s.seen < 0.6)
    .sort((a, b) => a[1].correct / a[1].seen - b[1].correct / b[1].seen)
    .slice(0, n)
    .map(([id]) => id);
}

export { TOTAL_COUNTRIES };
