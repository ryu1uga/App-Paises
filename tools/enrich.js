const fs = require('fs');
const all = require('world-countries');
const list = JSON.parse(fs.readFileSync('countries.json', 'utf8'));

const load = f => require('country-json/src/' + f);
const pop = load('country-by-population.json');
const dish = load('country-by-national-dish.json');
const symbol = load('country-by-national-symbol.json');
const life = load('country-by-life-expectancy.json');
const indep = load('country-by-independence-date.json');
const temp = load('country-by-yearly-average-temperature.json');

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function index(arr, key) {
  const m = new Map();
  for (const row of arr) m.set(norm(row.country), row[key]);
  return m;
}
const IDX = {
  pop: index(pop, 'population'),
  dish: index(dish, 'dish'),
  symbol: index(symbol, 'symbol'),
  life: index(life, 'expectancy'),
  indep: index(indep, 'independence'),
  temp: index(temp, 'temperature'),
};

const ALIASES = {
  USA: ['United States', 'United States of America'], GBR: ['United Kingdom'],
  KOR: ['South Korea', 'Korea, South'], PRK: ['North Korea', 'Korea, North'],
  COD: ['Congo, Democratic Republic of the', 'Democratic Republic of the Congo', 'Congo'],
  COG: ['Republic of the Congo', 'Congo'], CZE: ['Czech Republic', 'Czechia'],
  MMR: ['Myanmar', 'Burma'], CIV: ["Cote d'Ivoire", 'Ivory Coast'], CPV: ['Cape Verde', 'Cabo Verde'],
  SWZ: ['Swaziland', 'Eswatini'], MKD: ['Macedonia', 'North Macedonia'], TLS: ['East Timor', 'Timor-Leste'],
  VAT: ['Vatican City', 'Holy See'], PSE: ['Palestine', 'Palestinian Territories'],
  SYR: ['Syria'], RUS: ['Russia'], IRN: ['Iran'], LAO: ['Laos'], VNM: ['Vietnam'], BOL: ['Bolivia'],
  TZA: ['Tanzania'], VEN: ['Venezuela'], BRN: ['Brunei'], MDA: ['Moldova'], STP: ['Sao Tome and Principe'],
  KNA: ['Saint Kitts and Nevis'], VCT: ['Saint Vincent and the Grenadines'], BIH: ['Bosnia and Herzegovina'],
  ARE: ['United Arab Emirates'], FJI: ['Fiji Islands'], TUR: ['Turkey', 'Türkiye'], CAF: ['Central African Republic'], DOM: ['Dominican Republic'],
};

const LANG_ES = {
  Spanish:'Español', English:'Inglés', French:'Francés', Portuguese:'Portugués', Arabic:'Árabe',
  German:'Alemán', Italian:'Italiano', Russian:'Ruso', Chinese:'Chino', Japanese:'Japonés',
  Korean:'Coreano', Dutch:'Neerlandés', Swedish:'Sueco', Norwegian:'Noruego', Danish:'Danés',
  Finnish:'Finés', Greek:'Griego', Turkish:'Turco', Hebrew:'Hebreo', Hindi:'Hindi', Urdu:'Urdu',
  Persian:'Persa', Polish:'Polaco', Czech:'Checo', Slovak:'Eslovaco', Hungarian:'Húngaro',
  Romanian:'Rumano', Bulgarian:'Búlgaro', Serbian:'Serbio', Croatian:'Croata', Ukrainian:'Ucraniano',
  Swahili:'Suajili', Thai:'Tailandés', Vietnamese:'Vietnamita', Indonesian:'Indonesio',
  Malay:'Malayo', Bengali:'Bengalí', Nepali:'Nepalí', Amharic:'Amárico', Somali:'Somalí',
  Icelandic:'Islandés', Irish:'Irlandés', Catalan:'Catalán', Latin:'Latín', Albanian:'Albanés',
  Armenian:'Armenio', Georgian:'Georgiano', Azerbaijani:'Azerí', Kazakh:'Kazajo', Uzbek:'Uzbeko',
  Mongolian:'Mongol', Burmese:'Birmano', Khmer:'Jemer', Lao:'Lao', Sinhala:'Cingalés', Tamil:'Tamil',
  Estonian:'Estonio', Latvian:'Letón', Lithuanian:'Lituano', Slovene:'Esloveno', Macedonian:'Macedonio',
  Bosnian:'Bosnio', Belarusian:'Bielorruso', Maltese:'Maltés', Luxembourgish:'Luxemburgués',
  Afrikaans:'Afrikáans', Zulu:'Zulú', Hausa:'Hausa', Yoruba:'Yoruba', Igbo:'Igbo', Berber:'Bereber',
  Pashto:'Pastún', Kurdish:'Kurdo', Tigrinya:'Tigriña', Malagasy:'Malgache', Filipino:'Filipino',
  Tagalog:'Tagalo', Samoan:'Samoano', Fijian:'Fiyiano', Tongan:'Tongano', Maori:'Maorí',
  Quechua:'Quechua', Aymara:'Aimara', Guarani:'Guaraní', Haitian:'Criollo haitiano', Dzongkha:'Dzongkha',
};

const bySrc = new Map(all.map(c => [c.cca3, c]));
let missPop = [];

for (const c of list) {
  const src = bySrc.get(c.id);
  const keys = [c.nameEn, ...(ALIASES[c.id] || []), ...((src && src.altSpellings) || [])].map(norm);
  const get = idx => { for (const k of keys) if (idx.has(k) && idx.get(k) != null) return idx.get(k); return null; };

  c.population = Number(get(IDX.pop)) || 0;
  c.dish = get(IDX.dish) || null;
  c.symbol = get(IDX.symbol) || null;
  c.lifeExpectancy = get(IDX.life) ? Math.round(Number(get(IDX.life)) * 10) / 10 : null;
  c.independence = get(IDX.indep) || null;
  c.avgTemp = get(IDX.temp) != null ? Math.round(Number(get(IDX.temp)) * 10) / 10 : null;
  c.languages = c.languages.map(l => LANG_ES[l] || l);
  if (!c.population) missPop.push(c.id);
}

// Difficulty: blend of population + area salience (1 fácil, 2 medio, 3 difícil)
const rank = (key) => {
  const sorted = [...list].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const m = new Map(); sorted.forEach((c, i) => m.set(c.id, i)); return m;
};
const rPop = rank('population'), rArea = rank('area');
for (const c of list) {
  const score = (rPop.get(c.id) + rArea.get(c.id)) / 2;
  c.difficulty = score < 50 ? 1 : score < 120 ? 2 : 3;
}

list.sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'));
fs.writeFileSync('countries.json', JSON.stringify(list));

console.log('total', list.length);
console.log('sin población:', missPop.join(',') || 'ninguno');
console.log('dificultad 1/2/3:', [1,2,3].map(d => list.filter(c=>c.difficulty===d).length).join('/'));
console.log('con plato típico:', list.filter(c=>c.dish).length, '| con símbolo:', list.filter(c=>c.symbol).length);
console.log(JSON.stringify(list.find(c=>c.id==='PER')));
console.log('tamaño KB:', Math.round(fs.statSync('countries.json').size/1024));
