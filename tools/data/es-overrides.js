// Correcciones puntuales por país: ortografía y exónimos en español (RAE /
// Fundéu), nombres oficiales, capitales, fronteras y datos obsoletos.
// Cada entrada sobrescribe los campos indicados.
module.exports = {
  // --- Fronteras -----------------------------------------------------------
  // Sri Lanka es una isla: no tiene fronteras terrestres.
  LKA: { borders: [], independence: 1948 },

  // --- Exónimos y ortografía en `nameEs` -----------------------------------
  SLE: { nameEs: 'Sierra Leona' },
  IRN: { nameEs: 'Irán' },
  MLI: { nameEs: 'Malí' },
  DJI: { nameEs: 'Yibuti', officialEs: 'República de Yibuti' },
  GRD: { nameEs: 'Granada' },
  KGZ: { nameEs: 'Kirguistán', officialEs: 'República Kirguisa' },
  BWA: { nameEs: 'Botsuana', officialEs: 'República de Botsuana' },
  SWZ: {
    nameEs: 'Esuatini',
    officialEs: 'Reino de Esuatini',
    capital: 'Mbabane', // capital administrativa; Lobamba es la legislativa
    capitalEn: 'Mbabane',
  },

  // --- Gramática y coherencia en `officialEs` ------------------------------
  FRA: { officialEs: 'República Francesa' },
  NZL: { officialEs: 'Nueva Zelanda' },
  SLB: { officialEs: 'Islas Salomón' },
  KIR: { officialEs: 'República de Kiribati' },
  BHS: { officialEs: 'Mancomunidad de las Bahamas' },
  PER: { officialEs: 'República del Perú' },
  PRY: { officialEs: 'República del Paraguay' },
  TCD: { officialEs: 'República del Chad' },
  SDN: { officialEs: 'República del Sudán' },
  NER: { officialEs: 'República del Níger' },
  KEN: { officialEs: 'República de Kenia' },
  RWA: { officialEs: 'República de Ruanda' },
  BEN: { officialEs: 'República de Benín', capital: 'Porto-Novo', capitalEn: 'Porto-Novo' },
  GNB: { officialEs: 'República de Guinea-Bisáu' },
  SAU: { officialEs: 'Reino de Arabia Saudí' },
  QAT: { officialEs: 'Estado de Catar' },
  KAZ: { officialEs: 'República de Kazajistán' },
  MDA: { officialEs: 'República de Moldavia' },
  BLR: { officialEs: 'República de Bielorrusia' },
  IRQ: { officialEs: 'República de Irak' },
  CIV: { officialEs: 'República de Costa de Marfil' },
  MMR: { officialEs: 'República de la Unión de Myanmar' },
  BRN: { officialEs: 'Estado de Brunéi Darussalam', nameEs: 'Brunéi' },

  // --- Idiomas oficiales ---------------------------------------------------
  ARG: { languages: ['Español'] },              // el guaraní no es cooficial a nivel nacional
  CZE: { languages: ['Checo'] },                // el eslovaco no es oficial en Chequia
  AFG: { languages: ['Darí', 'Pastún'] },
  IRQ: { languages: ['Árabe', 'Kurdo'] },
  NOR: { languages: ['Noruego', 'Sami'] },
  MDA: { languages: ['Rumano'] },               // reforma constitucional de 2023

  // --- Fechas de independencia faltantes -----------------------------------
  TLS: { independence: 2002 },
  SRB: { independence: 1878 },                  // Tratado de Berlín

  // --- Esperanza de vida sin dato en el Banco Mundial ----------------------
  VAT: { lifeExpectancy: null },

  // --- Temperatura media faltante ------------------------------------------
  MNE: { avgTemp: 10.6 },                       // media anual, normales climáticas
};
