/**
 * Recalcula el campo `difficulty` de countries.json.
 *
 * El criterio anterior era población × superficie, que es un mal proxy: dejaba
 * Kazajistán como "fácil" por ser enorme e Irlanda como "difícil" por ser
 * pequeña. Lo que hace fácil a un país no es su tamaño sino cuánto suena, y para
 * un público hispanohablante eso significa Latinoamérica y España por delante.
 *
 * La familiaridad se estima combinando:
 *   - población y superficie (siguen contando, pero menos)
 *   - cercanía cultural: hispanohablantes, resto de América, Europa occidental
 *   - relevancia global: países que cualquiera nombraría
 *
 * Uso:  node tools/difficulty.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'data', 'countries.json');
const list = JSON.parse(fs.readFileSync(file, 'utf8'));

/** Países que cualquier hispanohablante ubica sin pensar. */
const HISPANOHABLANTES = new Set([
  'ESP', 'MEX', 'ARG', 'COL', 'PER', 'CHL', 'VEN', 'ECU', 'BOL', 'PRY', 'URY',
  'CUB', 'DOM', 'GTM', 'HND', 'SLV', 'NIC', 'CRI', 'PAN', 'GNQ',
]);

/** Resto de América y vecinos culturales inmediatos. */
const AMERICA_CERCANA = new Set(['BRA', 'USA', 'CAN', 'HTI', 'JAM', 'BLZ', 'TTO', 'PRI']);

/** Potencias y destinos que aparecen a diario en medios y cultura popular. */
const RELEVANCIA_GLOBAL = new Set([
  'FRA', 'ITA', 'DEU', 'GBR', 'PRT', 'NLD', 'BEL', 'CHE', 'AUT', 'GRC', 'IRL',
  'SWE', 'NOR', 'DNK', 'FIN', 'POL', 'RUS', 'UKR', 'TUR', 'CHN', 'JPN', 'IND',
  'KOR', 'PRK', 'AUS', 'NZL', 'ZAF', 'EGY', 'MAR', 'NGA', 'KEN', 'ISR', 'SAU',
  'ARE', 'IRN', 'IRQ', 'THA', 'VNM', 'IDN', 'PHL', 'PAK', 'CUB', 'ISL',
]);

const rank = (key) => {
  const sorted = [...list].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const m = new Map();
  sorted.forEach((c, i) => m.set(c.id, i / (sorted.length - 1))); // 0 = el mayor
  return m;
};

const rPop = rank('population');
const rArea = rank('area');

for (const c of list) {
  // 0 = muy familiar, 1 = nada familiar
  let score = rPop.get(c.id) * 0.4 + rArea.get(c.id) * 0.2;

  if (HISPANOHABLANTES.has(c.id)) score -= 0.55;
  else if (AMERICA_CERCANA.has(c.id)) score -= 0.35;
  else if (RELEVANCIA_GLOBAL.has(c.id)) score -= 0.3;
  else if (c.region === 'Europa') score -= 0.1;

  // Los microestados son diminutos pero muchos son conocidos; que su tamaño no
  // los mande solo al tramo difícil.
  if (['VAT', 'MCO', 'SMR', 'AND', 'LIE', 'MLT', 'SGP', 'LUX'].includes(c.id)) score -= 0.15;

  c.familiarity = Math.round(Math.max(0, Math.min(1, score + 0.2)) * 1000) / 1000;
}

// Reparto en tres tramos del mismo tamaño que antes (≈50 / 72 / 73)
const byScore = [...list].sort((a, b) => a.familiarity - b.familiarity);
byScore.forEach((c, i) => {
  c.difficulty = i < 55 ? 1 : i < 125 ? 2 : 3;
});

for (const c of list) delete c.familiarity;

list.sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'));
fs.writeFileSync(file, JSON.stringify(list));

const tramo = (d) => list.filter((c) => c.difficulty === d);
console.log(`dificultad 1/2/3: ${[1, 2, 3].map((d) => tramo(d).length).join('/')}`);
for (const d of [1, 2, 3]) {
  const muestra = tramo(d).slice(0, 12).map((c) => c.nameEs).join(', ');
  console.log(`\ntramo ${d}: ${muestra}…`);
}
console.log('\nhispanohablantes fuera del tramo fácil:',
  [...HISPANOHABLANTES].filter((id) => list.find((c) => c.id === id)?.difficulty !== 1).join(', ') || 'ninguno');
