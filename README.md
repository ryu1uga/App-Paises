# 🌍 Atlas Quest

App móvil en **React Native + Expo** para aprender los **195 países del mundo**: banderas, capitales y ubicación sobre un **globo terráqueo 3D** real, texturizado a partir de datos cartográficos de Natural Earth.

Seis modos de juego, 1170 estrellas que coleccionar y todo el contenido dentro de la app: sin red, sin cuentas y sin servidores.

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

Son **seis retos**, tres pares de ida y vuelta. Reconocer y recordar son habilidades
distintas: saber que esa bandera es la de Perú no implica poder evocar la bandera de Perú.

| Modo | Qué hace |
|---|---|
| **Banderas** | Muestra una bandera, eliges el país entre 4 opciones |
| **Bandera inversa** | Muestra el país, eliges su bandera en una rejilla de 4 |
| **Capitales** | Muestra el país, eliges su capital |
| **Capital inversa** | Muestra la capital, eliges de qué país lo es |
| **Ubicación** | Los 195 países aparecen como puntos y eliges el que te piden |
| **Ubicación inversa** | El globo señala un punto y dices qué país es |
| **Explorar** | Globo libre + buscador + ficha completa de cada país |

Cada modo se puede filtrar por continente y elegir 8, 12, 20 o 30 preguntas.

En los modos inversos el enunciado y la respuesta nunca son el mismo tipo de dato: si la
respuesta es una bandera, los botones no llevan texto, porque escribir el nombre al lado
convierte la pregunta en un ejercicio de lectura. `promptFor` y `optionLabel` devuelven
`null` en el lado que se pinta con imágenes, y hay tests que impiden que los dos lados
sean texto sobre el mismo dato.

### Estrellas

- **1170 estrellas**: 195 países × 6 modos. Cada una se gana con el **primer acierto** en
  ese modo y no se pierde nunca.
- La estrella se **rellena** al dominar ese país en ese modo: 3 aciertos con ≥70 % de
  precisión.
- **13 rangos**, uno cada 86 estrellas, de Turista a Gran Cartógrafo.
- **Racha diaria** que sube si juegas días consecutivos y se reinicia si fallas un día.
- Estadísticas por continente y bloque de "sigue practicando" con los países más fallados.

Los **puntos** de una ronda —con bonus por velocidad y racha— son el marcador de esa
partida y nada más. El progreso permanente son las estrellas, y como cada una se gana una
sola vez no se pueden farmear repitiendo el mismo país; por eso los puntos pueden ser
generosos sin desequilibrar nada.

El escalón de rango es una constante y no `1170 / 13`. Repartir el total entre los rangos
parece más limpio, pero ata cada corte al tamaño de la colección: al pasar de cuatro modos
a seis, todos los cortes habrían subido y quien estuviera justo por encima de uno habría
bajado de rango sin haber jugado. Con 86 fijas —por debajo de las 86,67 de la versión de
cuatro modos— ningún corte puede subir jamás. Hay un test que lo verifica recorriendo las
780 estrellas antiguas una a una.

Todo se guarda en el dispositivo con Zustand + AsyncStorage.

### El mazo y la repetición espaciada

Las rondas no se sortean al azar. Cada modo tiene su propio mazo, derivado del historial
(`src/lib/mastery.ts`), repartido en tres pilas: lo **nunca preguntado**, lo **fallado** y
lo que ya **tiene estrella**.

El mazo manda: mientras queden países sin preguntar en ese modo no sale ninguno que ya
tenga estrella, así que acertando siempre no verás una repetición hasta haber pasado por
los 195. Lo único que se cuela antes de tiempo es el repaso, y solo en una cuarta parte de
la ronda — un mazo estrictamente estricto tardaría 16 rondas en devolverte un fallo, que es
lo contrario de lo que sirve para aprender. Cuando el mazo se agota, el repaso pasa a
llevar el peso y los conocidos rellenan, ponderados por repetición espaciada: insiste en lo
que fallas —hasta el triple de probabilidad— y deja descansar lo dominado, que se recupera
con los días.

Sin historial, la primera partida reparte por tramos de dificultad.

La dificultad tampoco sale del tamaño del país, que era un mal proxy: se estima por
familiaridad, con sesgo hacia el público hispanohablante (`tools/difficulty.js`). Antes
Kazajistán era "fácil" por enorme e Irlanda "difícil" por pequeña.

---

## El globo 3D

Está construido a mano sobre `expo-gl` + `three.js`, sin depender de `expo-three`:

- **Textura sin ficheros**: la geografía viaja como una máscara de 2048×1024 (océano / tierra / frontera) comprimida con RLE y codificada en base64 **dentro del propio bundle** — 75 KB. Al arrancar se decodifica y se colorea en memoria hacia una `THREE.DataTexture`: océano en degradado, tierra teal→violeta, franja cálida tropical, hielo polar, fronteras y halo de costa. No hay imágenes que cargar, ni descargas, ni dependencia de la subida nativa de bitmaps de expo-gl. La máscara sale de Natural Earth (50 m) rasterizado con `d3-geo`, que recorta correctamente el antimeridiano (ver `tools/masks.js` y `tools/encode_mask.py`).
- **Costas suavizadas**: la máscara es binaria, así que al colorearla se calcula la *cobertura* de tierra con un desenfoque de caja separable. Eso convierte el borde escalonado en un degradado y permite dibujar litoral y fronteras sin dientes de sierra. Un segundo pase, más difuminado, genera el halo luminoso de la costa, combinado con el borde nítido para que no desaparezcan las islas de pocos píxeles.
- **Antialiasing por supermuestreo**: `GLView` solo acepta `msaaSamples` en iOS y al renderer se le pasa un contexto ya creado, así que su opción `antialias` no surte efecto. La escena se renderiza a una textura del doble de lado y se reduce con filtrado bilineal: al escalar exactamente a la mitad se promedian bloques de 2×2, equivalente a 4× de MSAA usando solo funciones básicas de WebGL. Hay un tope de píxeles para no penalizar a móviles modestos.
- **Atmósfera** con shader Fresnel (halo interior + exterior).
- **Nubes** procedurales en una esfera ligeramente mayor, con rotación independiente.
- **Estrellas** con shader propio y parpadeo.
- **Gestos**: arrastrar con inercia y amortiguación, pellizcar para zoom, tocar para elegir un punto (raycast real contra la esfera).
- **`flyTo(lat, lng)`** con interpolación por el camino corto en longitud.
- Marcadores tipo alfiler con halo y anillo pulsante.

La correspondencia lat/lng ↔ posición 3D ↔ rotación de cámara está verificada numéricamente sobre 2520 coordenadas (error < 1e-13°).

### Compatibilidad con expo-gl

three r163+ rechaza contextos de WebGL 1 comprobando
`context instanceof WebGLRenderingContext`. En un navegador `WebGL2RenderingContext` no
hereda de `WebGLRenderingContext`, así que la comprobación solo salta con WebGL 1 real;
pero expo-gl 57 sí hizo que herede —fiel a la letra de la especificación— y entonces un
contexto de WebGL 2 perfectamente válido daba positivo y el globo no arrancaba.
`createRenderer` oculta ese global mientras construye el renderer y lo restaura después,
solo cuando el contexto expone de verdad `createVertexArray` y `texStorage2D`. En un
dispositivo con WebGL 1 auténtico se deja que three falle, que es lo correcto.

### Modo ubicación

Los **195 países** están siempre en el globo como puntos idénticos, y tú buscas el que te
piden. Es un test de geografía, no de pulso.

- Cada marcador es un **disco apoyado en la superficie**, con su normal apuntando hacia
  afuera desde el centro del globo. Así, cerca del borde del planeta se escorzan de forma
  natural en vez de quedar cortados por la mitad, que es lo que ocurre con los sprites
  planos de `THREE.Points`: al tener un único valor de profundidad, la esfera recorta
  medio punto.
- Los 195 se dibujan con `InstancedMesh`: **una sola llamada de dibujo**, dos triángulos
  por marcador. El color va por instancia, así que resaltar el acierto no reconstruye nada.
- La selección no intersecta los discos —son diminutos— sino que busca el marcador más
  cercano al punto tocado midiendo sobre la esfera. El umbral va ligado al zoom, de modo
  que el área de toque es constante en pantalla: al acercarse se separan países vecinos
  que de lejos se solapan.
- **Responder son dos pasos**: tocar marca el punto en azul y confirmar lo evalúa. Así un
  toque involuntario al arrastrar el globo no cuesta la pregunta; se puede rectificar
  cuantas veces haga falta antes de confirmar.
- Entre pregunta y pregunta la cámara **no se mueve**: encuadrar el país sería revelarlo.
  Al fallar sí vuela hasta él para enseñarte dónde estaba.

### Ubicación inversa

El espejo del anterior: el globo resalta **un** punto y tú eliges su nombre entre cuatro.
Reutiliza el mismo campo de marcadores, así que no hizo falta tocar el renderer.

- La cámara **vuela a encuadrar el punto**, pero se queda lejos a propósito (zoom 2.9).
  Identificar una posición es un ejercicio de posición relativa —Uruguay se distingue de
  Paraguay por dónde cae respecto a Brasil y Argentina—, así que enseñar la región entera
  no es una concesión, es el ejercicio. Los otros 194 puntos siguen visibles.
- Solo se acerca (2.3) con los micro-Estados, donde a esa altura el punto resaltado y el de
  su vecino se solapan y la pregunta sería ilegible. El umbral es la distancia real al país
  más cercano, calculada a demanda y cacheada.
- Los distractores salen de la misma subregión, que aquí es justo lo que quieres: obligan a
  distinguir vecinos.
- El cronómetro se adelanta los 900 ms del vuelo, para no cobrar como lentitud lo que es
  una animación.

La rejilla de fronteras de 2048×1024 —52 KB, cada byte dice qué país ocupa ese píxel—
sirve a **Explorar**: al tocar el globo se sabe con exactitud qué país hay bajo el dedo,
en vez de aproximar por el centroide más cercano.

### Rendimiento

`onContextCreate` es **síncrono**: no hay ni un `await` entre crear el contexto GL y
arrancar el bucle de render, así que no existe la posibilidad de que una promesa
rechazada deje el globo colgado en el spinner. Las tres texturas (mapa, especular y
nubes) se construyen una sola vez —~60 ms en total— durante el splash y quedan
cacheadas a nivel de módulo, compartidas por todas las pantallas. Los globos
decorativos —inicio y ficha de país— usan `quality="lite"`: solo el mapa, menos
polígonos y menos estrellas.

---

## Datos

`src/data/countries.json` — 195 estados soberanos (193 miembros de la ONU + Vaticano + Palestina), generado offline. Por país:

nombre ES/EN, nombre oficial, capital **en español**, ISO alfa-2/alfa-3, lat/lng, continente y subcontinente, emoji de bandera, población, superficie, si es interior, países vecinos, idiomas en español, moneda, año de independencia, esperanza de vida, temperatura media, plato típico y un nivel de dificultad 1–3.

Las **195 banderas van empaquetadas** en `assets/flags` (465 KB en total, ~2,4 KB cada una):
sin red, sin latencia y sin depender de los emojis de bandera, que Android no dibuja.
Cada una conserva su proporción real —Nepal no es rectangular, Suiza y el Vaticano son
cuadradas— y el componente las encaja con `contain`. `tools/flags.js` las genera desde
`svg-country-flags`, reduce a 240 px y cuantiza a paleta.

### Regenerar datos y assets

Todo se genera desde la raíz del proyecto. Las dependencias van con `--no-save`: son de
construcción, no de la app.

```bash
npm i -D --no-save world-countries country-json world-atlas topojson-client \
                   d3-geo @napi-rs/canvas svg-country-flags
pip install pillow

node tools/gen.js && node tools/enrich.js      # dataset base
node tools/finalize.js src/data/countries.json # capitales y fronteras
node tools/difficulty.js                       # dificultad por familiaridad
node tools/country_grid.js 2048                # rejilla de fronteras
node tools/flags.js                            # banderas empaquetadas
node tools/masks.js && python3 tools/texture.py  # máscara del planeta
python3 tools/icons.py                         # icono y splash
```

---

## Tests

```bash
npm test
```

111 tests sobre la lógica pura, que es donde vive el riesgo: consistencia del dataset
(195 países, fronteras que existen, capitales en español, banderas completas), la
geometría del globo —ida y vuelta lat/lng ↔ esfera sobre 2520 coordenadas, y que la
rotación deje el punto frente a la cámara—, el mazo y la repetición espaciada, la rejilla
de fronteras, y las estrellas, rangos y rachas del store.

Unos cuantos son **guardias de regresión** de fallos que ya ocurrieron una vez y no se ven
sin un dispositivo delante: que ningún modo escriba en los botones el mismo dato que hay en
el enunciado, que ningún rango pueda bajar al añadir modos, y que la escala tipográfica no
apriete el interlineado por debajo de 1,2 —Android recorta lo que sobresalga de la caja de
línea, y a 1,1 desaparecía la cola de la «g» de «Elige».

## Navegación

La pantalla inicial es una **barra de tres pestañas**: retos, explorar y progreso. Antes
todo vivía en una sola pantalla que había que desplazar para llegar a los modos de juego.

Las tres viven en el grupo `app/(tabs)/`; al ir entre paréntesis no aparece en la ruta, así
que `/` sigue siendo la pestaña de retos. Las pantallas de partida se apilan por encima y
no llevan barra.

## Estructura

```
app/                    rutas de expo-router
  (tabs)/index.tsx      los seis retos
  (tabs)/explore.tsx    globo interactivo + buscador
  (tabs)/dashboard.tsx  estrellas, estadísticas, historial
  country/[id].tsx      ficha de país
  game/setup.tsx        configuración de la ronda
  game/play.tsx         los cuatro modos de opción múltiple
  game/locate.tsx       ubicar en el globo
  game/identify.tsx     identificar el punto resaltado
  game/results.tsx      resultados, estrellas ganadas, repaso
src/
  globe/                Globe.tsx, helpers de WebGL y datos embebidos del planeta
  components/           Screen, GlassCard, botones, medidores, confeti…
  data/                 dataset, banderas empaquetadas y utilidades de formato
  lib/                  geo.ts, quiz.ts, mastery.ts (mazo y repaso), locate.ts
  store/                progress.ts (persistente) y session.ts (ronda activa)
  theme/                paleta, tipografía, espaciado, degradados
tests/                  suite de jest sobre la lógica pura
tools/                  scripts de generación de datos y assets
```

Qué pantalla juega cada modo lo declara `MODE_META[mode].screen`, no un `if` repartido por
varios ficheros: añadir un séptimo modo no obliga a acordarse de tocar `setup` y `results`.

---

## Diseño

Tema oscuro tipo "deep space": fondo casi negro con auroras difuminadas, superficies de vidrio (blur real en iOS), acentos en turquesa/violeta/ámbar, tipografía Outfit para titulares e Inter para texto. Animaciones con Reanimated 4 (entradas escalonadas, muelles al pulsar, sacudida al fallar, confeti al terminar bien).

Los interlineados de la escala van holgados —1,25 veces el cuerpo en los titulares— porque
Outfit tiene ascendentes y descendentes muy largas y Android recorta lo que sobresalga de
la caja de línea. Es un detalle que solo se nota en español, con tildes y con la «g».

## Stack

Expo SDK 57 · React Native 0.86 · expo-router · three.js · expo-gl · Reanimated 4 · Gesture Handler · Zustand · react-native-svg · expo-image · TypeScript estricto
