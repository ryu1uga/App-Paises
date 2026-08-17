// Separación de `independence` en dos campos.
//
//   independence : año en que el Estado dejó de depender de otra potencia.
//                  null para los Estados que nunca fueron colonia ni dependencia.
//   founded      : año de fundación, unificación o constitución del Estado actual.
//                  Se usa cuando no hay una independencia propiamente dicha.
//
// El dataset original guardaba ambas cosas en `independence`, lo que hacía que
// la ficha de China mostrara «Independencia: -1523».
//
// Solo se listan los países que cambian. Para el resto, el valor heredado ya era
// una independencia real y `founded` queda en null.

module.exports = {
  // --- Estados antiguos: fundación, no independencia ------------------------
  CHN: { independence: null, founded: -1523 }, // dinastía Shang
  JPN: { independence: null, founded: -660 },  // fundación legendaria por Jinmu
  ETH: { independence: null, founded: -1000 }, // reino de Dʿmt / Aksum
  DNK: { independence: null, founded: 800 },
  SWE: { independence: null, founded: 836 },
  FRA: { independence: null, founded: 843 },   // Tratado de Verdún
  SMR: { independence: null, founded: 885 },
  GBR: { independence: null, founded: 1066 },
  PRT: { independence: null, founded: 1143 },  // Tratado de Zamora
  AND: { independence: null, founded: 1278 },  // paréage
  THA: { independence: null, founded: 1350 },  // reino de Ayutthaya
  ESP: { independence: null, founded: 1492 },
  CHE: { independence: null, founded: 1499 },  // paz de Basilea
  IRN: { independence: null, founded: 1501 },  // dinastía safávida
  NPL: { independence: null, founded: 1768 },  // unificación de Prithvi Narayan Shah
  LIE: { independence: null, founded: 1806 },
  ITA: { independence: null, founded: 1861 },  // unificación
  CAN: { independence: null, founded: 1867 },  // Confederación
  DEU: { independence: null, founded: 1871 },  // unificación (el dataset decía 1955)
  AUS: { independence: null, founded: 1901 },  // Federación
  BTN: { independence: null, founded: 1907 },  // monarquía Wangchuck
  NZL: { independence: null, founded: 1907 },  // Dominio
  ZAF: { independence: null, founded: 1910 },  // Unión Sudafricana
  AUT: { independence: null, founded: 1918 },  // tras el Imperio austrohúngaro
  HUN: { independence: null, founded: 1918 },
  TUR: { independence: null, founded: 1923 },  // proclamación de la República
  VAT: { independence: null, founded: 1929 },  // Tratados de Letrán
  SAU: { independence: null, founded: 1932 },  // unificación del reino
  PRK: { independence: null, founded: 1948 },
  KOR: { independence: null, founded: 1948 },
  RUS: { independence: null, founded: 1991 },  // Federación de Rusia
  CZE: { independence: null, founded: 1993 },  // disolución de Checoslovaquia
  SVK: { independence: null, founded: 1993 },

  // La República de Yemen actual nace de la unificación de 1990; la
  // independencia de 1918 fue solo la del Yemen del Norte.
  YEM: { independence: null, founded: 1990 },

  // --- Fechas de independencia corregidas ----------------------------------
  SYR: { independence: 1946, founded: null },  // el dataset decía 1941
  LBN: { independence: 1943, founded: null },  // el dataset decía 1941

  // --- Sin independencia reconocida ----------------------------------------
  PSE: { independence: null, founded: 1988 },  // declaración de Argel
};
