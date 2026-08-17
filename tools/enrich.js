/**
 * Enriquece src/data/countries.json.
 *
 * Fuentes (todas con fecha de corte declarada):
 *   - population      Banco Mundial SP.POP.TOTL, año 2025   -> data/wb-population.txt
 *   - lifeExpectancy  Banco Mundial SP.DYN.LE00.IN, año 2024 -> data/wb-life-expectancy.txt
 *   - avgTemp         normales climáticas OMM 1991-2020       -> data/temps-1991-2020.txt
 *   - currency        ISO 4217 traducida al español          -> data/es-currencies.js
 *   - demonym         gentilicios en español                 -> data/es-demonyms.js
 *   - languages       traducción de nombres de idioma        -> data/es-languages.js
 *   - correcciones    ortografía, capitales, fronteras       -> data/es-overrides.js
 *   - dish            country-json + data/es-dishes.js (59 que faltaban)
 *   - independence /
 *     founded         data/es-founding.js (separa independencia de fundación)
 *
 * NOTA: el paquete `country-json` ya NO se usa para población, esperanza de
 * vida, independencia ni temperatura. Sus datos eran de 2018 (población) y de
 * los años 90 (esperanza de vida), sin fecha de corte declarada. Solo queda
 * como fuente de `dish`, completado a mano donde faltaba.
 *
 * El campo `symbol` se eliminó: 162 de 195 registros estaban vacíos y no se
 * consumía en ninguna pantalla.
 */
const fs = require('fs');
const path = require('path');
const all = require('world-countries');

const DATA = path.join(__dirname, 'data');
const TARGET = path.join(__dirname, '..', 'src', 'data', 'countries.json');

const CURRENCIES = require(path.join(DATA, 'es-currencies.js'));
const DEMONYMS = require(path.join(DATA, 'es-demonyms.js'));
const LANG_EXTRA = require(path.join(DATA, 'es-languages.js'));
const OVERRIDES = require(path.join(DATA, 'es-overrides.js'));
const DISHES = require(path.join(DATA, 'es-dishes.js'));
const FOUNDING = require(path.join(DATA, 'es-founding.js'));

const list = JSON.parse(fs.readFileSync(TARGET, 'utf8'));

// --- Indicadores del Banco Mundial ------------------------------------------
function readIndicator(file) {
  const m = new Map();
  const raw = fs.readFileSync(path.join(DATA, file), 'utf8').trim();
  for (const line of raw.split('\n')) {
    const [id, value] = line.split('|');
    m.set(id, Number(value));
  }
  return m;
}
const POP = readIndicator('wb-population.txt');
const LIFE = readIndicator('wb-life-expectancy.txt');
const TEMP = readIndicator('temps-1991-2020.txt');

// --- country-json: solo los campos folclóricos, que no caducan --------------
const load = (f) => require('country-json/src/' + f);
const dishSrc = load('country-by-national-dish.json');

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function index(arr, key) {
  const m = new Map();
  for (const row of arr) m.set(norm(row.country), row[key]);
  return m;
}
const IDX = { dish: index(dishSrc, 'dish') };

// Alias para casar `nameEn` con las claves de country-json.
// OJO: 'Congo' a secas está deliberadamente ausente. Estaba en ambas entradas
// (COD y COG) y hacía que RD Congo heredara TODOS los datos de Congo-Brazzaville
// —incluida su población— porque ambas normalizaban a la misma clave 'congo'.
const ALIASES = {
  USA: ['United States', 'United States of America'],
  GBR: ['United Kingdom'],
  KOR: ['South Korea', 'Korea, South'],
  PRK: ['North Korea', 'Korea, North'],
  COD: ['Congo, Democratic Republic of the', 'Democratic Republic of the Congo'],
  COG: ['Republic of the Congo'],
  CZE: ['Czech Republic', 'Czechia'],
  MMR: ['Myanmar', 'Burma'],
  CIV: ["Cote d'Ivoire", 'Ivory Coast'],
  CPV: ['Cape Verde', 'Cabo Verde'],
  SWZ: ['Swaziland', 'Eswatini'],
  MKD: ['Macedonia', 'North Macedonia'],
  TLS: ['East Timor', 'Timor-Leste'],
  VAT: ['Vatican City', 'Holy See'],
  PSE: ['Palestine', 'Palestinian Territories'],
  SYR: ['Syria'], RUS: ['Russia'], IRN: ['Iran'], LAO: ['Laos'], VNM: ['Vietnam'],
  BOL: ['Bolivia'], TZA: ['Tanzania'], VEN: ['Venezuela'], BRN: ['Brunei'],
  MDA: ['Moldova'], STP: ['Sao Tome and Principe'], KNA: ['Saint Kitts and Nevis'],
  VCT: ['Saint Vincent and the Grenadines'], BIH: ['Bosnia and Herzegovina'],
  ARE: ['United Arab Emirates'], FJI: ['Fiji Islands'], TUR: ['Turkey', 'Türkiye'],
  CAF: ['Central African Republic'], DOM: ['Dominican Republic'],
};

const LANG_ES = {
  Spanish: 'Español', English: 'Inglés', French: 'Francés', Portuguese: 'Portugués',
  Arabic: 'Árabe', German: 'Alemán', Italian: 'Italiano', Russian: 'Ruso',
  Chinese: 'Chino', Japanese: 'Japonés', Korean: 'Coreano', Dutch: 'Neerlandés',
  Swedish: 'Sueco', Norwegian: 'Noruego', Danish: 'Danés', Finnish: 'Finés',
  Greek: 'Griego', Turkish: 'Turco', Hebrew: 'Hebreo', Hindi: 'Hindi', Urdu: 'Urdu',
  Persian: 'Persa', Polish: 'Polaco', Czech: 'Checo', Slovak: 'Eslovaco',
  Hungarian: 'Húngaro', Romanian: 'Rumano', Bulgarian: 'Búlgaro', Serbian: 'Serbio',
  Croatian: 'Croata', Ukrainian: 'Ucraniano', Swahili: 'Suajili', Thai: 'Tailandés',
  Vietnamese: 'Vietnamita', Indonesian: 'Indonesio', Malay: 'Malayo',
  Bengali: 'Bengalí', Nepali: 'Nepalí', Amharic: 'Amárico', Somali: 'Somalí',
  Icelandic: 'Islandés', Irish: 'Irlandés', Catalan: 'Catalán', Latin: 'Latín',
  Albanian: 'Albanés', Armenian: 'Armenio', Georgian: 'Georgiano',
  Azerbaijani: 'Azerí', Kazakh: 'Kazajo', Uzbek: 'Uzbeko', Mongolian: 'Mongol',
  Burmese: 'Birmano', Khmer: 'Jemer', Lao: 'Lao', Sinhala: 'Cingalés', Tamil: 'Tamil',
  Estonian: 'Estonio', Latvian: 'Letón', Lithuanian: 'Lituano', Slovene: 'Esloveno',
  Macedonian: 'Macedonio', Bosnian: 'Bosnio', Belarusian: 'Bielorruso',
  Maltese: 'Maltés', Luxembourgish: 'Luxemburgués', Afrikaans: 'Afrikáans',
  Zulu: 'Zulú', Hausa: 'Hausa', Yoruba: 'Yoruba', Igbo: 'Igbo', Berber: 'Bereber',
  Pashto: 'Pastún', Kurdish: 'Kurdo', Tigrinya: 'Tigriña', Malagasy: 'Malgache',
  Filipino: 'Filipino', Tagalog: 'Tagalo', Samoan: 'Samoano', Fijian: 'Fiyiano',
  Tongan: 'Tongano', Maori: 'Maorí', Quechua: 'Quechua', Aymara: 'Aimara',
  Guarani: 'Guaraní', Dzongkha: 'Dzongkha',
  ...LANG_EXTRA,
};

const SUBREGION_ES = { 'North America': 'América del Norte' };

const bySrc = new Map(all.map((c) => [c.cca3, c]));
const missing = { pop: [], life: [], temp: [], currency: [], demonym: [], dish: [] };

for (const c of list) {
  const src = bySrc.get(c.id);
  const keys = [c.nameEn, ...(ALIASES[c.id] || []), ...((src && src.altSpellings) || [])].map(norm);
  const get = (idx) => {
    for (const k of keys) if (idx.has(k) && idx.get(k) != null) return idx.get(k);
    return null;
  };

  if (POP.has(c.id)) c.population = POP.get(c.id);
  else missing.pop.push(c.id);

  if (LIFE.has(c.id)) c.lifeExpectancy = Math.round(LIFE.get(c.id) * 10) / 10;
  else missing.life.push(c.id);

  if (CURRENCIES[c.id]) c.currency = CURRENCIES[c.id];
  else missing.currency.push(c.id);

  if (DEMONYMS[c.id]) c.demonym = DEMONYMS[c.id];
  else missing.demonym.push(c.id);

  if (TEMP.has(c.id)) c.avgTemp = Math.round(TEMP.get(c.id) * 10) / 10;
  else missing.temp.push(c.id);

  // `dish`: country-json primero, tabla propia para los 59 que le faltaban.
  c.dish = get(IDX.dish) || (c.id in DISHES ? DISHES[c.id] : null);
  if (!c.dish) missing.dish.push(c.id);

  // `independence` solo guarda independencias reales; el resto va a `founded`.
  const f = FOUNDING[c.id];
  c.independence = f ? f.independence : c.independence;
  c.founded = f ? f.founded : null;
  c.languages = [...new Set(c.languages.map((l) => LANG_ES[l] || l))];
  if (SUBREGION_ES[c.subregion]) c.subregion = SUBREGION_ES[c.subregion];

  // Las correcciones manuales van al final: pisan cualquier fuente automática.
  const fix = OVERRIDES[c.id];
  if (fix) Object.assign(c, fix);
}

// --- Dificultad -------------------------------------------------------------
// Mezcla de notoriedad por población y por superficie. `FAMILIARES` fuerza el
// tramo fácil para los países que el público de la app (hispanohablante) conoce
// de sobra aunque no estén entre los mayores del mundo: sin este ajuste, Chile
// y Bolivia caen al tramo medio solo por su tamaño.
const FAMILIARES = new Set([
  'ESP', 'MEX', 'ARG', 'PER', 'COL', 'CHL', 'VEN', 'BOL',
  'ECU', 'URY', 'PRY', 'CUB', 'CRI', 'PAN', 'GTM', 'HND', 'NIC', 'SLV', 'DOM',
]);

const rank = (key) => {
  const sorted = [...list].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const m = new Map();
  sorted.forEach((c, i) => m.set(c.id, i));
  return m;
};
const rPop = rank('population');
const rArea = rank('area');
for (const c of list) {
  if (FAMILIARES.has(c.id)) {
    c.difficulty = 1;
    continue;
  }
  const score = (rPop.get(c.id) + rArea.get(c.id)) / 2;
  c.difficulty = score < 50 ? 1 : score < 120 ? 2 : 3;
}

// Orden de claves estable, para que el diff de countries.json sea legible.
const KEY_ORDER = [
  'id', 'code', 'nameEs', 'nameEn', 'officialEs', 'capital', 'capitalEn',
  'lat', 'lng', 'region', 'subregion', 'flag', 'population', 'area',
  'landlocked', 'borders', 'languages', 'currency', 'demonym', 'difficulty',
  'dish', 'lifeExpectancy', 'independence', 'founded', 'avgTemp',
];
list.sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'));
const ordered = list.map((c) => Object.fromEntries(KEY_ORDER.map((k) => [k, c[k]])));
fs.writeFileSync(TARGET, JSON.stringify(ordered));

console.log('total', list.length);
for (const [k, v] of Object.entries(missing)) {
  console.log('sin ' + k + ':', v.join(',') || 'ninguno');
}
console.log('dificultad 1/2/3:', [1, 2, 3].map((d) => list.filter((c) => c.difficulty === d).length).join('/'));
console.log('con plato típico:', list.filter((c) => c.dish).length, 'de', list.length);
console.log('con independencia:', list.filter((c) => c.independence).length, '| con fundación:', list.filter((c) => c.founded).length);
console.log('tamaño KB:', Math.round(fs.statSync(TARGET).size / 1024));
