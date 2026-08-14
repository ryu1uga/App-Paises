import { Country, countries, countriesOf } from '@/data/countries';
import { reviewWeight, type StatsMap } from './mastery';

export type GameMode = 'flags' | 'capitals' | 'locate' | 'flagsReverse';

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
   * Historial del jugador. Si se pasa, las preguntas se sortean con repetición
   * espaciada; si no, el reparto es el de siempre por tramos de dificultad.
   */
  stats?: StatsMap;
};

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
 * Elige los países de la ronda.
 *
 * Con historial aplica repetición espaciada: insiste en lo que fallas, saca lo
 * que aún no has visto y deja descansar lo dominado. Sin historial reparte por
 * tramos de dificultad. En ambos casos la ronda se ordena de fácil a difícil,
 * para que empiece amable y suba.
 */
function pickTargets(pool: Country[], length: number, stats?: StatsMap): Country[] {
  const size = Math.min(length, pool.length);
  let chosen: Country[];

  if (stats) {
    const now = Date.now();
    const weights = pool.map((c) => reviewWeight(c.difficulty, stats[c.id], now));
    chosen = weightedSample(pool, weights, size);
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
  const targets = pickTargets(pool, config.length, config.stats);

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

/** Puntos base por acierto, con bonus por velocidad y racha. */
export function scoreAnswer(opts: {
  correct: boolean;
  msElapsed: number;
  streak: number;
  difficulty: 1 | 2 | 3;
}): number {
  if (!opts.correct) return 0;
  const base = 60 + opts.difficulty * 20;
  const speed = Math.max(0, 1 - opts.msElapsed / 10000);
  const speedBonus = Math.round(base * 0.5 * speed);
  const streakBonus = Math.min(5, opts.streak) * 10;
  return base + speedBonus + streakBonus;
}
