const all = require('world-countries');
const fs = require('fs');

const CAP_ES = {
  Athens:'Atenas', Bern:'Berna', Brussels:'Bruselas', Bucharest:'Bucarest', Cairo:'El Cairo',
  Copenhagen:'Copenhague', Damascus:'Damasco', Djibouti:'Yibuti', Dublin:'Dublín', Havana:'La Habana',
  Jerusalem:'Jerusalén', Kyiv:'Kiev', Lisbon:'Lisboa', London:'Londres', Luxembourg:'Luxemburgo',
  'Mexico City':'Ciudad de México', Moscow:'Moscú', 'New Delhi':'Nueva Delhi', Prague:'Praga',
  Rome:'Roma', Seoul:'Seúl', Singapore:'Singapur', Stockholm:'Estocolmo', Tehran:'Teherán',
  Tokyo:'Tokio', Vienna:'Viena', Warsaw:'Varsovia', Beijing:'Pekín', Baghdad:'Bagdad',
  Belgrade:'Belgrado', Berlin:'Berlín', 'Brasília':'Brasilia', 'Panama City':'Ciudad de Panamá',
  'Guatemala City':'Ciudad de Guatemala', 'Kuwait City':'Ciudad de Kuwait', 'Vatican City':'Ciudad del Vaticano',
  Riyadh:'Riad', Sanaa:'Saná', "Sana'a":'Saná', Muscat:'Mascate', 'Abu Dhabi':'Abu Dabi', Amman:'Ammán',
  Baku:'Bakú', Yerevan:'Ereván', Tbilisi:'Tiflis', 'Nur-Sultan':'Astaná', Astana:'Astaná',
  Bishkek:'Biskek', Dushanbe:'Dusambé', Ashgabat:'Asjabad', Tashkent:'Taskent', Kathmandu:'Katmandú',
  Thimphu:'Timbu', Dhaka:'Daca', Naypyidaw:'Naipyidó', 'Nay Pyi Taw':'Naipyidó', Vientiane:'Vientián',
  'Phnom Penh':'Nom Pen', Hanoi:'Hanói', Jakarta:'Yakarta', Pyongyang:'Pionyang',
  Ulaanbaatar:'Ulán Bator', 'Sri Jayawardenepura Kotte':'Sri Jayawardenapura Kotte',
  'Addis Ababa':'Adís Abeba', Algiers:'Argel', Bissau:'Bisáu', Bujumbura:'Gitega', Gitega:'Gitega',
  Conakry:'Conakri', Juba:'Yuba', Khartoum:'Jartum', Kinshasa:'Kinsasa', Lilongwe:'Lilongüe',
  Mogadishu:'Mogadiscio', "N'Djamena":'Yamena', Nouakchott:'Nuakchot', Ouagadougou:'Uagadugú',
  'Porto-Novo':'Porto Novo', 'São Tomé':'Santo Tomé', Tripoli:'Trípoli', Tunis:'Túnez',
  'Yaoundé':'Yaundé', Yamoussoukro:'Yamusukro', Abuja:'Abuya', Accra:'Acra', Pretoria:'Pretoria',
  'Washington, D.C.':'Washington D. C.', Belmopan:'Belmopán', 'Port-au-Prince':'Puerto Príncipe',
  "St. George's":'Saint George', "St. John's":'Saint John', 'Port of Spain':'Puerto España',
  Reykjavik:'Reikiavik', 'Reykjavík':'Reikiavik', Vilnius:'Vilna', Tallinn:'Tallin',
  Chisinau:'Chisináu', 'Chișinău':'Chisináu', Ljubljana:'Liubliana', Skopje:'Skopie', Sofia:'Sofía',
  Valletta:'La Valeta', 'Andorra la Vella':'Andorra la Vieja', Monaco:'Mónaco', Paris:'París',
  Amsterdam:'Ámsterdam', "Nuku'alofa":'Nukualofa', Ramallah:'Ramala', Nicosia:'Nicosia',
  Bern_:'Berna', Rabat:'Rabat', Antananarivo:'Antananarivo', Kigali:'Kigali',
};

const REGION_ES = { Africa:'África', Americas:'América', Asia:'Asia', Europe:'Europa', Oceania:'Oceanía', Antarctic:'Antártida' };
const SUB_ES = {
  'Northern Africa':'África del Norte','Western Africa':'África Occidental','Middle Africa':'África Central',
  'Eastern Africa':'África Oriental','Southern Africa':'África Austral','Northern America':'América del Norte',
  'Central America':'América Central','Caribbean':'Caribe','South America':'América del Sur',
  'Central Asia':'Asia Central','Eastern Asia':'Asia Oriental','South-Eastern Asia':'Sudeste Asiático',
  'Southern Asia':'Asia del Sur','Western Asia':'Asia Occidental','Eastern Europe':'Europa del Este',
  'Northern Europe':'Europa del Norte','Southern Europe':'Europa del Sur','Western Europe':'Europa Occidental',
  'Southeast Europe':'Europa Sudoriental','Central Europe':'Europa Central','Australia and New Zealand':'Australia y Nueva Zelanda',
  'Melanesia':'Melanesia','Micronesia':'Micronesia','Polynesia':'Polinesia',
};

const picked = all.filter(c => c.unMember || c.cca3 === 'PSE');

const list = picked.map(c => {
  const capEn = (c.capital && c.capital[0]) || (c.cca3 === 'PSE' ? 'Ramallah' : '—');
  return {
    id: c.cca3,
    code: c.cca2,
    nameEs: c.translations.spa ? c.translations.spa.common : c.name.common,
    nameEn: c.name.common,
    officialEs: c.translations.spa ? c.translations.spa.official : c.name.official,
    capital: CAP_ES[capEn] || capEn,
    capitalEn: capEn,
    lat: c.latlng[0],
    lng: c.latlng[1],
    region: REGION_ES[c.region] || c.region,
    subregion: SUB_ES[c.subregion] || c.subregion || (REGION_ES[c.region] || c.region),
    flag: c.flag,
    population: c.population || 0,
    area: c.area || 0,
    landlocked: !!c.landlocked,
    borders: c.borders || [],
    languages: Object.values(c.languages || {}),
    currency: Object.values(c.currencies || {}).map(x => x.name).join(', ') || '—',
    demonym: (c.demonyms && c.demonyms.spa && c.demonyms.spa.m) || '',
  };
});

// population is missing in world-countries v4 -> pull from a static rank if absent
const byArea = [...list].sort((a, b) => b.area - a.area);
list.forEach(c => {
  const rank = byArea.indexOf(c);
  // difficulty 1 (easy) .. 3 (hard) using area rank as a rough proxy for salience
  c.difficulty = rank < 55 ? 1 : rank < 130 ? 2 : 3;
});

list.sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'));
fs.writeFileSync('countries.json', JSON.stringify(list, null, 0));
console.log('total', list.length);
console.log('regiones', [...new Set(list.map(c => c.region))].join(' | '));
console.log('sin capital:', list.filter(c => c.capital === '—').map(c => c.id).join(',') || 'ninguno');
console.log('muestra:', JSON.stringify(list.find(c => c.id === 'JPN')));
