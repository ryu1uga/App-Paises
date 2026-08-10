# 🌍 Atlas Quest

App móvil en **React Native + Expo** para aprender los **195 países del mundo**: banderas, capitales y ubicación sobre un **globo terráqueo 3D** real, texturizado a partir de datos cartográficos de Natural Earth.

---

## Puesta en marcha

```bash
npm install
npm install -g eas-cli && eas login && eas init
npm run build:preview   # APK autónoma en la nube, ~15 min → QR para instalar
```

El globo usa `expo-gl` (módulo nativo), así que **no funciona en Expo Go**.
La APK de preview lleva el JS dentro y funciona sola, sin servidor de desarrollo.
Para iterar con recarga en caliente hay un perfil `development`; todo está en
**[BUILD.md](./BUILD.md)**, junto con las variantes local y con Gradle puro.

---

## Modos de juego

| Modo | Qué hace |
|---|---|
| **Banderas** | Muestra una bandera, eliges el país entre 4 opciones |
| **Bandera inversa** | Muestra el país, eliges su bandera |
| **Capitales** | Muestra el país, eliges su capital |
| **Ubicación** | Giras el globo y tocas dónde está el país; puntúa por cercanía |
| **Explorar** | Globo libre + buscador + ficha completa de cada país |

Cada modo se puede filtrar por continente y elegir 8, 12, 20 o 30 preguntas.

### Progresión

- **XP** por acierto, con bonus por velocidad y por racha dentro de la ronda.
- **Niveles** con curva creciente y títulos (Turista → Leyenda global).
- **Racha diaria** que sube si juegas días consecutivos y se reinicia si fallas un día.
- **Países dominados**: 3 aciertos con ≥70 % de precisión.
- Estadísticas por continente y bloque de "sigue practicando" con los países más fallados.

Todo se guarda en el dispositivo con Zustand + AsyncStorage.

---

## El globo 3D

Está construido a mano sobre `expo-gl` + `three.js`, sin depender de `expo-three`:

- **Textura propia**: `tools/masks.js` rasteriza los polígonos de Natural Earth (50 m) con `d3-geo` — que recorta correctamente el antimeridiano — y `tools/texture.py` colorea el resultado (océano en degradado, tierra teal→violeta, franja cálida tropical, hielo polar, fronteras y halo de costa). Todo offline, sin depender de servidores de tiles.
- **Atmósfera** con shader Fresnel (halo interior + exterior).
- **Nubes** procedurales en una esfera ligeramente mayor, con rotación independiente.
- **Estrellas** con shader propio y parpadeo.
- **Gestos**: arrastrar con inercia y amortiguación, pellizcar para zoom, tocar para elegir un punto (raycast real contra la esfera).
- **`flyTo(lat, lng)`** con interpolación por el camino corto en longitud.
- Marcadores tipo alfiler con halo y anillo pulsante, y **arcos geodésicos** para unir tu respuesta con la ubicación correcta.

La correspondencia lat/lng ↔ posición 3D ↔ rotación de cámara está verificada numéricamente sobre 2520 coordenadas (error < 1e-13°).

### Rendimiento

El globo aparece en dos fases: primero monta con un mapa de 512×256 (20 KB) y ya gira,
y en segundo plano sube el de 2048×1024 más el especular y las nubes. Las texturas van en
JPEG (364 KB en total, frente a 1,85 MB en PNG) y se precargan al arrancar la app, en
paralelo con las fuentes. Los globos decorativos —inicio y ficha de país— usan
`quality="lite"`: solo el mapa, menos polígonos y menos estrellas.

---

## Datos

`src/data/countries.json` — 195 estados soberanos (193 miembros de la ONU + Vaticano + Palestina), generado offline. Por país:

nombre ES/EN, nombre oficial, capital **en español**, ISO alfa-2/alfa-3, lat/lng, continente y subcontinente, emoji de bandera, población, superficie, si es interior, países vecinos, idiomas en español, moneda, año de independencia, esperanza de vida, temperatura media, plato típico y un nivel de dificultad 1–3.

Las banderas se sirven en alta resolución desde flagcdn con caché en disco (`expo-image`), y caen al emoji si no hay red.

### Regenerar el dataset y las texturas

```bash
cd tools
npm i world-countries country-json world-atlas topojson-client d3-geo @napi-rs/canvas
node gen.js && node enrich.js          # dataset
node ../tools/finalize.js countries.json
node masks.js && python3 texture.py    # texturas del globo (necesita Pillow)
python3 icons.py                       # icono y splash
```

---

## Estructura

```
app/                    rutas de expo-router
  index.tsx             inicio: globo, progreso, modos
  explore.tsx           globo interactivo + buscador
  country/[id].tsx      ficha de país
  profile.tsx           nivel, estadísticas, historial
  game/setup.tsx        configuración de la ronda
  game/play.tsx         banderas / bandera inversa / capitales
  game/locate.tsx       ubicar en el globo
  game/results.tsx      resultados, subida de nivel, repaso
src/
  globe/                Globe.tsx + helpers de WebGL
  components/           Screen, GlassCard, botones, medidores, confeti…
  data/                 dataset y utilidades de formato
  lib/                  geo.ts (haversine, proyecciones) y quiz.ts
  store/                progress.ts (persistente) y session.ts (ronda activa)
  theme/                paleta, tipografía, espaciado, degradados
tools/                  scripts de generación de datos y assets
```

---

## Diseño

Tema oscuro tipo "deep space": fondo casi negro con auroras difuminadas, superficies de vidrio (blur real en iOS), acentos en turquesa/violeta/ámbar, tipografía Outfit para titulares e Inter para texto. Animaciones con Reanimated 4 (entradas escalonadas, muelles al pulsar, sacudida al fallar, confeti al terminar bien).

## Stack

Expo SDK 57 · React Native 0.86 · expo-router · three.js · expo-gl · Reanimated 4 · Gesture Handler · Zustand · react-native-svg · expo-image · TypeScript estricto
