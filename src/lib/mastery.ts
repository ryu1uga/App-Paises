/**
 * Tipos y reglas de dominio compartidos entre el generador de preguntas y el
 * store de progreso. Viven aparte para que `quiz.ts` pueda consultar el
 * historial sin depender del store (y sin crear una dependencia circular).
 */

/** Estadística acumulada de un país. */
export type CountryStat = {
  seen: number;
  correct: number;
  /** timestamp del último acierto */
  lastCorrect: number | null;
};

export type StatsMap = Record<string, CountryStat>;

/** Un país se considera "dominado" con 3 aciertos y ≥70 % de precisión. */
export function isMastered(stat?: CountryStat): boolean {
  if (!stat) return false;
  return stat.correct >= 3 && stat.correct / Math.max(1, stat.seen) >= 0.7;
}

export function accuracyOf(stat?: CountryStat): number {
  if (!stat || stat.seen === 0) return 0;
  return stat.correct / stat.seen;
}

const DAY_MS = 86_400_000;

/**
 * Peso de un país en el sorteo de preguntas. Cuanto mayor, más probable es que
 * salga. La idea es la de la repetición espaciada: insistir en lo que fallas,
 * descubrir lo que aún no has visto y dejar descansar lo que ya dominas.
 */
export function reviewWeight(
  difficulty: 1 | 2 | 3,
  stat: CountryStat | undefined,
  now = Date.now()
): number {
  // Los fáciles salen algo más para que una ronda no se vuelva hostil.
  let weight = difficulty === 1 ? 1.2 : difficulty === 2 ? 1 : 0.85;

  // Nunca visto: prioridad alta, es material nuevo.
  if (!stat || stat.seen === 0) return weight * 1.6;

  // Fallar mucho multiplica hasta por tres; acertar siempre lo reduce.
  weight *= 0.4 + (1 - accuracyOf(stat)) * 2.6;

  if (isMastered(stat)) weight *= 0.25;

  // Espaciado: si acertaste hace poco baja, y se recupera con los días.
  if (stat.lastCorrect) {
    const days = (now - stat.lastCorrect) / DAY_MS;
    weight *= Math.min(1, 0.25 + days / 3);
  }

  return Math.max(0.05, weight);
}
