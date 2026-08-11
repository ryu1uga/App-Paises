import { Country, countries, countriesOf } from '@/data/countries';

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
 * Reparte las preguntas en una curva: empieza por países conocidos y sube
 * la dificultad hacia el final de la ronda.
 */
function pickTargets(pool: Country[], length: number): Country[] {
  const easy = pool.filter((c) => c.difficulty === 1);
  const mid = pool.filter((c) => c.difficulty === 2);
  const hard = pool.filter((c) => c.difficulty === 3);

  const nEasy = Math.round(length * 0.4);
  const nMid = Math.round(length * 0.35);
  const nHard = length - nEasy - nMid;

  const chosen = [
    ...sample(easy, Math.min(nEasy, easy.length)),
    ...sample(mid, Math.min(nMid, mid.length)),
    ...sample(hard, Math.min(nHard, hard.length)),
  ];

  // Si el continente elegido tiene pocos países, rellena con lo que haya.
  if (chosen.length < length) {
    const rest = pool.filter((c) => !chosen.some((x) => x.id === c.id));
    chosen.push(...sample(rest, Math.min(length - chosen.length, rest.length)));
  }

  return chosen.sort((a, b) => a.difficulty - b.difficulty).slice(0, length);
}

export function buildQuiz(config: QuizConfig): Question[] {
  const pool = countriesOf(config.region);
  const targets = pickTargets(pool, Math.min(config.length, pool.length));

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
