import { create } from 'zustand';

import type { Country } from '@/data/countries';
import type { GameMode } from '@/lib/quiz';

export type AnswerLog = {
  countryId: string;
  correct: boolean;
  /** Respuesta elegida (id de país) o coordenada en el modo "ubicar". */
  given?: string;
  distanceKm?: number;
  /** Marcador de la partida. El progreso permanente son las estrellas. */
  points: number;
  ms: number;
  /** Esta respuesta ganó la estrella del país en este modo. */
  newStar?: boolean;
  /** Y además lo dejó dominado (estrella rellena). */
  newMastered?: boolean;
};

type SessionState = {
  mode: GameMode;
  region: string | null;
  length: number;
  startedAt: number;
  answers: AnswerLog[];
  streak: number;
  bestStreak: number;

  configure: (cfg: { mode: GameMode; region: string | null; length: number }) => void;
  begin: () => void;
  push: (log: AnswerLog) => void;
  clear: () => void;

  score: () => number;
  correctCount: () => number;
};

export const useSession = create<SessionState>((set, get) => ({
  mode: 'flags',
  region: null,
  length: 12,
  startedAt: Date.now(),
  answers: [],
  streak: 0,
  bestStreak: 0,

  configure: (cfg) => set({ ...cfg }),

  begin: () => set({ startedAt: Date.now(), answers: [], streak: 0, bestStreak: 0 }),

  push: (log) =>
    set((s) => {
      const streak = log.correct ? s.streak + 1 : 0;
      return {
        answers: [...s.answers, log],
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      };
    }),

  clear: () => set({ answers: [], streak: 0, bestStreak: 0 }),

  score: () => get().answers.reduce((a, x) => a + x.points, 0),
  correctCount: () => get().answers.filter((a) => a.correct).length,
}));

/** Etiqueta de rendimiento según el porcentaje de aciertos. */
export function gradeFor(ratio: number): { title: string; sub: string; gradient: readonly string[] } {
  if (ratio === 1)
    return { title: '¡Perfecto!', sub: 'Ni un solo fallo. Impecable.', gradient: ['#FBBF24', '#FB7185'] };
  if (ratio >= 0.85)
    return { title: '¡Excelente!', sub: 'Dominas este continente.', gradient: ['#2DD4BF', '#38BDF8'] };
  if (ratio >= 0.65)
    return { title: '¡Muy bien!', sub: 'Vas por buen camino.', gradient: ['#38BDF8', '#818CF8'] };
  if (ratio >= 0.4)
    return { title: 'Vas mejorando', sub: 'Una ronda más y se nota.', gradient: ['#A78BFA', '#F472B6'] };
  return { title: 'A practicar', sub: 'El mundo es grande, empieza por tu continente.', gradient: ['#FB7185', '#FBBF24'] };
}

export function countryLabel(c: Country): string {
  return c.nameEs;
}
