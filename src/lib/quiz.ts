import { Country, byId, countries, countriesOf } from '@/data/countries';
import { GAME_MODES, reviewWeight, splitDeck, type GameMode, type StatsMap } from './mastery';

// `GameMode` vive en `mastery.ts` para que ese módulo pueda indexar por modo sin
// depender de este. Se reexporta aquí porque es donde el resto de la app lo busca.
export type { GameMode };
export { GAME_MODES };

export type Question = {
  target: Country;
  /** Opciones múltiples (incluye el target). Vacío en el modo `locate`. */
  options: Country[];
};

export type QuizConfig = {
  mode: GameMode;
  region: string | null;
  length: number;
  /**
   * Historial del jugador. Si se pasa, la ronda se reparte entre el mazo, la
   * pila de repaso y lo ya sabido; si no, el reparto es por tramos de dificultad.
   */
  stats?: StatsMap;
};

/**
 * Hueco que el repaso puede robarle al mazo mientras aún queden países nuevos.
 * Es pequeño a propósito: mientras haya mazo, el mazo manda.
 */
const REVIEW_SHARE = 0.25;
/**
 * Tope del repaso una vez agotado el mazo. Sin él, un jugador con diez
 * pendientes vería esos mismos diez en cada ronda hasta sacarlos: correcto,
 * pero agotador.
 */
const REVIEW_CAP = 0.5;

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Elige distractores plausibles: primero de la misma subregión, luego de la misma
 * región y, si aún faltan, de cualquier parte. Así el quiz es exigente pero justo.
 */
function distractors(target: Country, pool: Country[], n: number): Country[] {
  const notTarget = pool.filter((c) => c.id !== target.id);
  const tiers = [
    notTarget.filter((c) => c.subregion === target.subregion),
    notTarget.filter((c) => c.region === target.region && c.subregion !== target.subregion),
    notTarget.filter((c) => c.region !== target.region),
  ];

  const out: Country[] = [];
  for (const tier of tiers) {
    if (out.length >= n) break;
    out.push(...sample(tier, n - out.length));
  }
  if (out.length < n) {
    const rest = countries.filter(
      (c) => c.id !== target.id && !out.some((o) => o.id === c.id)
    );
    out.push(...sample(rest, n - out.length));
  }
  return out.slice(0, n);
}

/**
 * Sorteo ponderado sin reemplazo: elige `n` elementos donde la probabilidad de
 * cada uno es proporcional a su peso.
 */
function weightedSample<T>(items: readonly T[], weights: number[], n: number): T[] {
  const pending = items.map((item, i) => ({ item, weight: Math.max(0, weights[i]) }));
  const out: T[] = [];

  while (out.length < n && pending.length > 0) {
    const total = pending.reduce((a, x) => a + x.weight, 0);
    if (total <= 0) {
      // Todos los pesos a cero: repartimos lo que quede al azar.
      out.push(...sample(pending.map((p) => p.item), n - out.length));
      break;
    }

    let ticket = Math.random() * total;
    let index = pending.length - 1;
    for (let i = 0; i < pending.length; i++) {
      ticket -= pending[i].weight;
      if (ticket <= 0) {
        index = i;
        break;
      }
    }

    out.push(pending[index].item);
    pending.splice(index, 1);
  }

  return out;
}

/**
 * Elige los países de la ronda a partir del mazo del modo.
 *
 * El mazo tiene prioridad absoluta: **mientras queden países sin preguntar en
 * este modo, no sale ninguno que ya tenga estrella**. Si aciertas siempre, no
 * verás una sola repetición hasta haber pasado por los 195.
 *
 * Lo único que se cuela antes de tiempo es el repaso —lo que fallaste—, y solo
 * en una cuarta parte de la ronda. Un mazo estrictamente estricto tardaría 16
 * rondas en devolverte un fallo, que es lo contrario de lo que sirve para
 * aprender. Cuando el mazo se agota, el repaso pasa a ser el grueso y los ya
 * sabidos rellenan lo que falte, ponderados por repetición espaciada.
 *
 * Las tres pilas son disjuntas y se sortean sin reemplazo, así que tampoco
 * puede repetirse nada dentro de una misma ronda.
 *
 * Sin historial (`stats`) el reparto es el clásico por tramos de dificultad.
 * En ambos casos la ronda se ordena de fácil a difícil, para empezar amable.
 */
function pickTargets(
  pool: Country[],
  length: number,
  mode: GameMode,
  stats?: StatsMap
): Country[] {
  const size = Math.min(length, pool.length);
  let chosen: Country[];

  if (stats) {
    const now = Date.now();
    const deck = splitDeck(
      pool.map((c) => c.id),
      stats,
      mode
    );
    const toCountries = (ids: string[]) => ids.map((id) => byId[id]).filter(Boolean);
    const drawWeighted = (ids: string[], n: number) => {
      const items = toCountries(ids);
      return weightedSample(
        items,
        items.map((c) => reviewWeight(c.difficulty, stats[c.id]?.[mode], now)),
        n
      );
    };

    // Mientras haya mazo el repaso solo ocupa su cuarta parte; en cuanto se
    // agota pasa a llevar el peso de la ronda.
    const reviewRoom =
      deck.fresh.length > 0 ? Math.floor(size * REVIEW_SHARE) : Math.ceil(size * REVIEW_CAP);
    const nReview = Math.min(deck.review.length, reviewRoom);
    const nFresh = Math.min(deck.fresh.length, size - nReview);

    chosen = [
      ...sample(toCountries(deck.fresh), nFresh),
      ...drawWeighted(deck.review, nReview),
      ...drawWeighted(deck.known, size - nFresh - nReview),
    ];

    // Si alguna pila se quedó corta (regiones pequeñas, mazo casi agotado),
    // rellena con lo que quede sin repetir.
    if (chosen.length < size) {
      const taken = new Set(chosen.map((c) => c.id));
      chosen.push(...sample(pool.filter((c) => !taken.has(c.id)), size - chosen.length));
    }
  } else {
    const byTier = (d: 1 | 2 | 3) => pool.filter((c) => c.difficulty === d);
    const nEasy = Math.round(length * 0.4);
    const nMid = Math.round(length * 0.35);

    chosen = [
      ...sample(byTier(1), Math.min(nEasy, byTier(1).length)),
      ...sample(byTier(2), Math.min(nMid, byTier(2).length)),
      ...sample(byTier(3), Math.min(length - nEasy - nMid, byTier(3).length)),
    ];

    // Si el continente elegido tiene pocos países, rellena con lo que haya.
    if (chosen.length < size) {
      const rest = pool.filter((c) => !chosen.some((x) => x.id === c.id));
      chosen.push(...sample(rest, size - chosen.length));
    }
  }

  return chosen.slice(0, size).sort((a, b) => a.difficulty - b.difficulty);
}

export function buildQuiz(config: QuizConfig): Question[] {
  const pool = countriesOf(config.region);
  const targets = pickTargets(pool, config.length, config.mode, config.stats);

  return targets.map((target) => {
    // En "ubicar" el globo muestra los 195 países, así que no hay distractores.
    if (config.mode === 'locate') return { target, options: [] };
    return { target, options: shuffle([target, ...distractors(target, pool, 3)]) };
  });
}

export const MODE_META: Record<
  GameMode,
  { title: string; subtitle: string; icon: string; gradient: readonly string[]; route: string }
> = {
  flags: {
    title: 'Banderas',
    subtitle: '¿De qué país es esta bandera?',
    icon: 'flag',
    gradient: ['#F472B6', '#A78BFA'],
    route: '/game/flags',
  },
  flagsReverse: {
    title: 'Bandera inversa',
    subtitle: 'Encuentra la bandera del país',
    icon: 'grid',
    gradient: ['#FB7185', '#FBBF24'],
    route: '/game/flags?reverse=1',
  },
  capitals: {
    title: 'Capitales',
    subtitle: '¿Cuál es la capital?',
    icon: 'business',
    gradient: ['#38BDF8', '#818CF8'],
    route: '/game/capitals',
  },
  locate: {
    title: 'Ubicación',
    subtitle: 'Encuéntralo entre los 195 puntos',
    icon: 'navigate',
    gradient: ['#2DD4BF', '#38BDF8'],
    route: '/game/locate',
  },
};

/**
 * Cuánto tiempo tienes antes de perder todo el bonus de velocidad.
 *
 * Depende del modo porque el gesto no es comparable: en banderas eliges entre
 * cuatro botones que ya están en pantalla, mientras que en Ubicación hay que
 * girar el globo y buscar entre 195 puntos. Con una ventana única de 10 s el
 * modo más difícil era el que menos pagaba.
 */
const SPEED_WINDOW_MS: Record<GameMode, number> = {
  flags: 10_000,
  flagsReverse: 10_000,
  capitals: 12_000,
  locate: 30_000,
};

/**
 * Puntos de la ronda por acierto, con bonus por velocidad y racha.
 *
 * Los puntos son el marcador de la partida y nada más: el progreso permanente
 * son las estrellas, que no se pueden farmear porque cada una se gana una única
 * vez. Por eso aquí se puede ser generoso sin desequilibrar nada.
 */
export function scoreAnswer(opts: {
  correct: boolean;
  msElapsed: number;
  streak: number;
  difficulty: 1 | 2 | 3;
  mode?: GameMode;
}): number {
  if (!opts.correct) return 0;
  const base = 60 + opts.difficulty * 20;
  const window = SPEED_WINDOW_MS[opts.mode ?? 'flags'];
  const speed = Math.max(0, 1 - opts.msElapsed / window);
  const speedBonus = Math.round(base * 0.5 * speed);
  const streakBonus = Math.min(5, opts.streak) * 10;
  return base + speedBonus + streakBonus;
}
