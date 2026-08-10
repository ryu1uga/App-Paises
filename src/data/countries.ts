import raw from './countries.json';

export type Country = {
  /** Código ISO 3166-1 alfa-3 (identificador estable) */
  id: string;
  /** Código ISO 3166-1 alfa-2 (para banderas) */
  code: string;
  nameEs: string;
  nameEn: string;
  officialEs: string;
  capital: string;
  capitalEn: string;
  lat: number;
  lng: number;
  region: string;
  subregion: string;
  flag: string;
  population: number;
  /** km² */
  area: number;
  landlocked: boolean;
  /** ids alfa-3 de países vecinos */
  borders: string[];
  languages: string[];
  currency: string;
  demonym: string;
  /** 1 = fácil, 2 = medio, 3 = difícil */
  difficulty: 1 | 2 | 3;
  dish: string | null;
  symbol: string | null;
  lifeExpectancy: number | null;
  independence: number | null;
  avgTemp: number | null;
};

export const countries: Country[] = raw as Country[];

export const byId: Record<string, Country> = Object.fromEntries(
  countries.map((c) => [c.id, c])
);

export const regions: string[] = [...new Set(countries.map((c) => c.region))].sort((a, b) =>
  a.localeCompare(b, 'es')
);

export const subregions: string[] = [...new Set(countries.map((c) => c.subregion))].sort((a, b) =>
  a.localeCompare(b, 'es')
);

export function countriesOf(region: string | null): Country[] {
  if (!region || region === 'Todos') return countries;
  return countries.filter((c) => c.region === region);
}

export function getCountry(id: string | undefined): Country | undefined {
  return id ? byId[id] : undefined;
}

/** URL de la bandera en alta calidad (flagcdn usa códigos alfa-2 en minúsculas). */
export function flagUrl(code: string, width: 80 | 160 | 320 | 640 = 320): string {
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}

/** Normaliza texto para comparaciones tolerantes (sin tildes, minúsculas). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n);
}

export function formatArea(km2: number): string {
  if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(2)} M km²`;
  return `${formatNumber(km2)} km²`;
}

export function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} mil M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} mil`;
  return formatNumber(n);
}

export const TOTAL_COUNTRIES = countries.length;
