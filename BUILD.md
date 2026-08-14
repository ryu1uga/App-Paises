# Guía de build — Atlas Quest

El objetivo por defecto es la **APK de preview**: una app autónoma, con el JavaScript
empaquetado dentro, que se instala y funciona sin servidor de desarrollo y sin cable.
Es la que le pasas a alguien para que la pruebe.

> La app **no funciona en Expo Go**: el globo usa `expo-gl`, un módulo nativo.

---

## Camino recomendado — EAS Build (en la nube)

No necesitas Android Studio ni JDK: compila en los servidores de Expo.

### 1. Preparar

```bash
cd App-Paises
npm install
npm install -g eas-cli
eas login                 # cuenta gratis en expo.dev
eas init                  # enlaza el proyecto y escribe extra.eas.projectId en app.json
```

`eas.json` ya viene configurado con el perfil `preview` (`buildType: "apk"`,
`distribution: "internal"`).

### 2. Compilar

```bash
npm run build:preview
# eas build --profile preview --platform android
```

La primera vez preguntará por el **keystore**: responde que sí, EAS lo genera y lo custodia.
Tarda ~10–20 min.

### 3. Instalar

Al terminar, la terminal muestra un enlace y un QR:

- **QR** → escanéalo con la cámara del Android, descarga e instala.
- **Enlace** → descarga el `.apk` y pásalo al teléfono como quieras.

Android pedirá permitir *"instalar apps de origen desconocido"*. Es normal en distribución interna.

También puedes ver todos tus builds en `https://expo.dev` → tu proyecto → **Builds**.

### 4. Siguientes versiones

Cada vez que quieras una APK nueva con tus cambios:

```bash
npm run build:preview
```

Y para instalarla directamente en un dispositivo conectado por USB:

```bash
eas build:run -p android --latest
```

---

## Variante — EAS Build local

Misma configuración, pero compilando en tu máquina (necesitas JDK 17 y Android SDK):

```bash
npm run build:preview:local
# eas build --profile preview --platform android --local
```

Deja el `.apk` en la raíz del proyecto. Útil si no quieres depender de la cola de la nube.

---

## Variante — Gradle puro, sin EAS

```bash
npx expo prebuild --clean          # genera android/
npm run apk:local                  # expo run:android --variant release
```

O solo el archivo, sin instalarlo:

```bash
cd android
./gradlew assembleRelease          # Linux/macOS
.\gradlew.bat assembleRelease      # Windows
```

APK resultante:

```
android/app/build/outputs/apk/release/app-release.apk
```

> Sin configurar keystore propio, Gradle firma con la clave de debug. Sirve para probar,
> pero no para publicar. Para firmar de verdad:
>
> ```bash
> keytool -genkeypair -v -storetype PKCS12 -keystore atlas-quest.keystore \
>   -alias atlas -keyalg RSA -keysize 2048 -validity 10000
> ```
>
> Mueve el fichero a `android/app/`, añade las credenciales en `android/gradle.properties`
> y referencia `signingConfigs.release` en `android/app/build.gradle`.

### Requisitos para compilar en local

| Herramienta | Versión |
|---|---|
| Node | 20 o superior |
| JDK | 17 (el de Android Studio sirve) |
| Android Studio | con **SDK Platform 35**, **Build-Tools** y **Platform-Tools** |

En Windows (PowerShell), variables permanentes:

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

Cierra y reabre la terminal, y comprueba con `adb devices`.

---

## Si además quieres desarrollar con recarga en caliente

La APK de preview lleva el JS congelado dentro: para ver cambios hay que recompilar.
Si vas a iterar sobre el código, compila **una vez** el development build y a partir de ahí
solo levantas Metro:

```bash
npm run build:dev      # eas build --profile development --platform android
npm start -- --dev-client
```

Instalas esa APK, abres la app, escaneas el QR de la terminal y ya recarga al guardar.
Solo hay que volver a compilarla si añades o cambias dependencias **nativas**.

---

## Comandos útiles

```bash
npm run build:preview   # APK autónoma (la de siempre)
npm run build:dev       # APK con dev client para iterar
npm start               # servidor de Metro
npm run typecheck       # TypeScript sin emitir
npm run doctor          # diagnóstico de dependencias
npx expo install --fix  # alinea versiones con el SDK
npx expo start -c       # limpia caché de Metro
eas build:list          # historial de builds
```

---

## Problemas frecuentes

**"Cannot find native module 'ExpoGL'"**
Estás en Expo Go. Instala la APK generada por EAS.

**El globo sale en negro**
La APK es anterior a la instalación de `expo-gl`. Recompila con `npm run build:preview`.

**`THREE.WebGLRenderer: WebGL 1 is not supported since r163`**
Falso positivo, ya resuelto en `src/globe/glHelpers.ts`. three comprueba
`context instanceof WebGLRenderingContext` para rechazar WebGL 1; en un navegador
`WebGL2RenderingContext` no hereda de `WebGLRenderingContext`, pero expo-gl 57 sí hizo
que herede, así que un contexto de WebGL 2 válido daba positivo. La solución oculta ese
global mientras se construye el renderer y lo restaura después, solo cuando el contexto
expone de verdad la API de WebGL 2.

**"Aplicación no instalada" al abrir el APK**
Ya tienes instalada otra versión firmada con distinta clave. Desinstala la anterior primero.

**`SDK location not found`** (solo builds locales)
Falta `ANDROID_HOME`, o crea `android/local.properties` con barras normales:
`sdk.dir=C:/Users/ITLAB/AppData/Local/Android/Sdk`
Ojo: ese fichero se borra en cada `expo prebuild --clean`, así que mejor deja la
variable de entorno puesta.

**`WARNING: A restricted method in java.lang.System has been called`**
Tu JDK es demasiado nuevo. Desde el 24, `System.load()` desde módulos sin nombre está
restringido y JNA —que usa CMake— lo necesita, así que `configureCMakeDebug` falla.
Apunta a un JDK 17 o 21, por ejemplo el que trae Android Studio:

```bash
setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
# reabre la terminal, y luego:
cd android && ./gradlew --stop && cd ..
```

El `--stop` es imprescindible: sin él Gradle reutiliza el daemon arrancado con el JDK viejo.

**Gradle se queda sin memoria**
En `android/gradle.properties`: `org.gradle.jvmargs=-Xmx4096m`

**Las banderas no cargan**
Vienen de `flagcdn.com`. Sin conexión se muestra el emoji de respaldo.

**Cambié dependencias y algo va raro**
`npx expo start -c`; si persiste, `npx expo prebuild --clean` y recompila.

**`npm error ERESOLVE` al instalar**
No uses `--legacy-peer-deps`: esconde el problema real. Borra `node_modules` y
`package-lock.json`, y ejecuta `npm install` limpio. Si sigue, `npx expo install --fix`
alinea las versiones con el SDK.

**`Cannot find module 'babel-preset-expo'` al empaquetar**
Debe estar en `devDependencies` del proyecto, no solo dentro de `expo/node_modules`.
Ya viene declarado; si desaparece, `npm i -D babel-preset-expo`.

**`expo doctor` avisa de "patch version mismatches"**
No es un problema del proyecto: Expo publica parches con frecuencia y ese check compara
siempre contra el último. Se realinea con un comando, que además actualiza el lockfile:

```bash
npx expo install --fix
```

Conviene ejecutarlo antes de cada build. Ojo con un detalle que despista: aunque
`package.json` use rangos `~`, el `package-lock.json` fija la versión exacta, así que un
`npm install` a secas no siempre trae el parche nuevo.

**`expo doctor` falla y aborta el build de EAS**
Cuando el fallo es de esquema o de peers —no de parches— sí detiene el build. Los dos
motivos habituales:

- *should NOT have additional property X* — el esquema de `app.json` cambió entre SDKs.
  En el 57 desaparecieron `newArchEnabled` y `android.edgeToEdgeEnabled`, porque la nueva
  arquitectura y edge-to-edge ya van siempre activas. Basta con borrar esos campos.
- *packages match versions required by installed Expo SDK* — alguna dependencia se ha
  desalineado. `npx expo install --check` lista las desviaciones y `--fix` las corrige.
  Ojo con `react-dom`: si no está fijado, npm lo sube por su cuenta y arrastra a `react`
  fuera de la versión que espera el SDK.

**`Missing peer dependency: expo-constants`**
`expo-router` lo necesita como dependencia directa aunque tu código no lo importe. Los
módulos nativos que son peer hay que declararlos en `package.json`, no vale con que
lleguen de forma transitiva.
