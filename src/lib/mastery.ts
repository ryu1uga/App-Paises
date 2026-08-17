/**
 * Tipos y reglas de dominio compartidos entre el generador de preguntas y el
 * store de progreso. Viven aparte para que `quiz.ts` pueda consultar el
 * historial sin depender del store (y sin crear una dependencia circular).
 *
 * El progreso se lleva **por modo**: saberte la bandera de Perú no implica
 * saberte su capital, así que cada modo tiene su propio recuento y su propia
 * colección de estrellas.
 */

export type GameMode =
  | 'flags'
  | 'flagsReverse'
  | 'capitals'
  | 'capitalsReverse'
  | 'locate'
  | 'locateReverse';

/**
 * Orden canónico de los modos: el que se usa para contar y para pintar.
 *
 * Cada modo va seguido de su inverso. Reconocer y recordar son habilidades
 * distintas —ver la bandera de Perú y saber que es Perú no implica poder dibujar
 * mentalmente la bandera de Perú—, así que tenerlos juntos deja claro que son
 * dos caras del mismo material y no seis retos inconexos.
 */
export const GAME_MODES: GameMode[] = [
  'flags',
  'flagsReverse',
  'capitals',
  'capitalsReverse',
  'locate',
  'locateReverse',
];

/** Estadística acumulada de un país en un modo concreto. */
export type CountryStat = {
  seen: number;
  correct: number;
  /** timestamp del último acierto */
  lastCorrect: number | null;
};

/** Lo que sabe la app de un país: una entrada por modo jugado. */
export type CountryModeStats = Partial<Record<GameMode, CountryStat>>;

/** `stats[countryId][mode]` */
export type StatsMap = Record<string, CountryModeStats>;

export const EMPTY_STAT: CountryStat = { seen: 0, correct: 0, lastCorrect: null };

export function statOf(
  stats: StatsMap,
  countryId: string,
  mode: GameMode
): CountryStat | undefined {
  return stats[countryId]?.[mode];
}

/* ------------------------------------------------------------------ */
/* Estrellas                                                           */
/* ------------------------------------------------------------------ */

/**
 * Una estrella se gana con el **primer acierto** en ese modo, y no se pierde.
 *
 * Es deliberadamente barata: con 195 países × 6 modos hay 1170 estrellas, y
 * exigir dominio para cada una convertía la colección en ~585 rondas. Ganarla
 * marca "ya lo he sacado una vez"; rellenarla (`isMastered`) marca "me lo sé".
 */
export function hasStar(stat?: CountryStat): boolean {
  return !!stat && stat.correct >= 1;
}

/** Un país se considera "dominado" con 3 aciertos y ≥70 % de precisión. */
export function isMastered(stat?: CountryStat): boolean {
  if (!stat) return false;
  return stat.correct >= 3 && stat.correct / Math.max(1, stat.seen) >= 0.7;
}

/** Los tres estados en que se pinta una estrella. */
export type StarState = 'none' | 'earned' | 'mastered';

export function starState(stat?: CountryStat): StarState {
  if (isMastered(stat)) return 'mastered';
  if (hasStar(stat)) return 'earned';
  return 'none';
}

/** Cuántas de las 6 estrellas de un país están ganadas. */
export function starsForCountry(stats: StatsMap, countryId: string): number {
  const entry = stats[countryId];
  if (!entry) return 0;
  return GAME_MODES.reduce((n, mode) => n + (hasStar(entry[mode]) ? 1 : 0), 0);
}

export function accuracyOf(stat?: CountryStat): number {
  if (!stat || stat.seen === 0) return 0;
  return stat.correct / stat.seen;
}

/** Suma de todos los modos de un país, para las estadísticas globales. */
export function totalsForCountry(entry?: CountryModeStats): CountryStat {
  if (!entry) return { ...EMPTY_STAT };
  return GAME_MODES.reduce<CountryStat>(
    (acc, mode) => {
      const s = entry[mode];
      if (!s) return acc;
      return {
        seen: acc.seen + s.seen,
        correct: acc.correct + s.correct,
        lastCorrect: Math.max(acc.lastCorrect ?? 0, s.lastCorrect ?? 0) || null,
      };
    },
    { ...EMPTY_STAT }
  );
}

/* ------------------------------------------------------------------ */
/* El mazo                                                             */
/* ------------------------------------------------------------------ */

/**
 * Las tres pilas en que se reparte un modo.
 *
 * - `fresh`  — nunca preguntado en este modo. Es el mazo: sale sin repetirse
 *              hasta agotar los 195.
 * - `review` — ya preguntado pero aún sin estrella, o sea: fallado. Vuelve
 *              pronto, que es justo lo que un mazo estricto haría mal — con 195
 *              cartas un fallo no reaparecería hasta 16 rondas después.
 * - `known`  — con estrella. Sigue saliendo, pero solo para rellenar hueco y
 *              mantener el conocimiento fresco.
 *
 * No hace falta persistir nada de esto: las tres pilas se derivan de `stats`,
 * así que el mazo no puede desincronizarse del progreso.
 */
export type DeckPools = {
  fresh: string[];
  review: string[];
  known: string[];
};

export function splitDeck(ids: readonly string[], stats: StatsMap, mode: GameMode): DeckPools {
  const fresh: string[] = [];
  const review: string[] = [];
  const known: string[] = [];

  for (const id of ids) {
    const stat = stats[id]?.[mode];
    if (!stat || stat.seen === 0) fresh.push(id);
    else if (hasStar(stat)) known.push(id);
    else review.push(id);
  }

  return { fresh, review, known };
}

const DAY_MS = 86_400_000;

/**
 * Peso de un país dentro de las pilas de repaso y conocidos. Cuanto mayor, más
 * probable es que salga: insiste en lo que fallas y deja descansar lo dominado.
 *
 * No se aplica al mazo `fresh`; ahí lo único que manda es que nada se repita
 * hasta haber pasado por los 195.
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
