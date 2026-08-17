/**
 * Sistema de diseño de Atlas Quest.
 * Paleta "deep space": fondos casi negros con acentos luminosos y superficies de vidrio.
 */

export const palette = {
  void: '#05060F',
  abyss: '#0A0E1F',
  ink: '#11162B',
  slate: '#1B2138',

  mint: '#2DD4BF',
  aqua: '#38BDF8',
  iris: '#818CF8',
  violet: '#A78BFA',
  magenta: '#F472B6',
  amber: '#FBBF24',
  lime: '#A3E635',
  coral: '#FB7185',

  white: '#FFFFFF',
  fog: '#E2E8F0',
  mist: '#94A3B8',
  smoke: '#64748B',
} as const;

export const colors = {
  bg: palette.void,
  bgAlt: palette.abyss,
  surface: 'rgba(255,255,255,0.055)',
  surfaceStrong: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.20)',

  text: palette.white,
  textDim: palette.mist,
  textFaint: palette.smoke,

  primary: palette.mint,
  secondary: palette.aqua,
  accent: palette.violet,

  success: '#34D399',
  successBg: 'rgba(52,211,153,0.16)',
  danger: '#FB7185',
  dangerBg: 'rgba(251,113,133,0.16)',
  warning: palette.amber,
} as const;

/** Degradados listos para <LinearGradient colors={...} /> */
export const gradients = {
  app: ['#05060F', '#0A1024', '#050810'],
  aurora: ['#2DD4BF', '#38BDF8', '#818CF8'],
  sunset: ['#FBBF24', '#FB7185', '#A78BFA'],
  ocean: ['#0EA5E9', '#2DD4BF'],
  candy: ['#F472B6', '#A78BFA'],
  lime: ['#A3E635', '#2DD4BF'],
  ember: ['#FB7185', '#FBBF24'],
  glass: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)'],
  success: ['#34D399', '#2DD4BF'],
  danger: ['#FB7185', '#F472B6'],
} as const;

export type GradientName = keyof typeof gradients;

/** Color representativo por continente (usado en chips, mapas y estadísticas). */
export const regionColors: Record<string, string> = {
  'África': palette.amber,
  'América': palette.mint,
  'Asia': palette.magenta,
  'Europa': palette.aqua,
  'Oceanía': palette.lime,
  'Antártida': palette.fog,
};

export const regionGradients: Record<string, readonly string[]> = {
  'África': ['#FBBF24', '#FB7185'],
  'América': ['#2DD4BF', '#38BDF8'],
  'Asia': ['#F472B6', '#A78BFA'],
  'Europa': ['#38BDF8', '#818CF8'],
  'Oceanía': ['#A3E635', '#2DD4BF'],
  'Antártida': ['#E2E8F0', '#94A3B8'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
  pill: 999,
} as const;

export const font = {
  display: 'Outfit_700Bold',
  displayBlack: 'Outfit_800ExtraBold',
  displayMedium: 'Outfit_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/**
 * Escala tipográfica.
 *
 * Los dos tamaños grandes usan Outfit, que es una tipografía de titular con
 * ascendentes y descendentes muy largas. Sus interlineados van holgados a
 * propósito —1,25 veces el cuerpo, no 1,1— porque por debajo de eso Android
 * recorta lo que sobresale de la caja de línea: la cola de la «g» de «Elige» o
 * la tilde de «Cartógrafo» desaparecían. El resto de la escala usa Inter, que
 * es mucho más contenida y se apaña con menos.
 */
export const type = {
  hero: { fontFamily: font.displayBlack, fontSize: 40, lineHeight: 50, letterSpacing: -1 },
  h1: { fontFamily: font.display, fontSize: 30, lineHeight: 38, letterSpacing: -0.6 },
  h2: { fontFamily: font.display, fontSize: 23, lineHeight: 29, letterSpacing: -0.4 },
  h3: { fontFamily: font.displayMedium, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: font.bodySemi, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.bodySemi, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  mono: { fontFamily: font.bodyBold, fontSize: 15, lineHeight: 20 },
} as const;

export const shadow = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  }),
} as const;

export const timing = {
  fast: 160,
  base: 260,
  slow: 420,
} as const;
