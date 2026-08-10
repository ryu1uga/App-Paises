/**
 * Últimos retoques sobre countries.json:
 *  - elimina fronteras que apuntan a territorios no soberanos (no están en el dataset)
 *  - corrige capitales que la fuente escribe de otra forma
 *
 * Uso:  node tools/finalize.js src/data/countries.json
 */
const fs = require('fs');

const file = process.argv[2] || 'src/data/countries.json';
const list = JSON.parse(fs.readFileSync(file, 'utf8'));

const CAP_FIX = {
  USA: 'Washington D. C.',
  CHN: 'Pekín',
  MMR: 'Naipyidó',
  CIV: 'Yamusukro',
  BOL: 'Sucre',
};

const ids = new Set(list.map((c) => c.id));
let removed = 0;

for (const c of list) {
  if (CAP_FIX[c.id]) c.capital = CAP_FIX[c.id];
  const before = c.borders.length;
  c.borders = c.borders.filter((b) => ids.has(b));
  removed += before - c.borders.length;
}

fs.writeFileSync(file, JSON.stringify(list));
console.log(`fronteras a territorios no soberanos eliminadas: ${removed}`);
console.log(`países: ${list.length}`);
