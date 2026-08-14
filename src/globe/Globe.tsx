import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';

import { latLngToVector3, vector3ToLatLng } from '@/lib/geo';
import { getCloudTexture, getEarthTexture, getSpecularTexture } from './earthTexture';
import {
  createAtmosphere,
  createPinField,
  createPulseRing,
  createRenderer,
  createStarfield,
  disposeObject,
} from './glHelpers';

const R = 1; // radio del globo en unidades de escena
const MIN_ZOOM = 2.05;
const MAX_ZOOM = 5.6;

/** Color de los puntos seleccionables mientras no se destaquen. */
const DEFAULT_PIN_COLOR = '#FBBF24';
/** Diámetro del disco en unidades del globo (radio 1). */
const PIN_SIZE = 0.024;
/** Los destacados se dibujan algo mayores. */
const PIN_SIZE_HIGHLIGHT = 0.04;
/**
 * Radio de toque de un marcador, en radianes por unidad de zoom. Multiplicado
 * por el zoom actual mantiene constante el área de toque en pantalla.
 */
const PIN_TAP_ANGLE = 0.018;

/** Factor de supermuestreo para el antialiasing. 1 lo desactiva. */
const SUPERSAMPLING = 2;
/** Tope de píxeles del buffer intermedio, para no penalizar a móviles modestos. */
const MAX_SS_PIXELS = 5_000_000;

export type GlobeMarker = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  /** 'pin' clava un alfiler, 'pulse' añade además un anillo animado */
  kind?: 'pin' | 'pulse';
  label?: string;
  /** Permite tocarlo para elegirlo (dispara `onSelectMarker`). */
  selectable?: boolean;
};

export type GlobeHandle = {
  /** Anima el globo hasta dejar el punto centrado. */
  flyTo: (lat: number, lng: number, opts?: { zoom?: number; duration?: number }) => void;
  /** Lat/lng actualmente en el centro de la pantalla. */
  getCenter: () => { lat: number; lng: number };
  spin: (enabled: boolean) => void;
};

type Props = {
  style?: StyleProp<ViewStyle>;
  markers?: GlobeMarker[];
  /** Rotación automática cuando no se está tocando. */
  autoRotate?: boolean;
  /** Permite girar y hacer zoom. */
  interactive?: boolean;
  /** Punto de vista inicial. */
  initial?: { lat: number; lng: number; zoom?: number };
  /** Se dispara al tocar el globo (coordenada de la superficie). */
  onPickPoint?: (p: { lat: number; lng: number }) => void;
  /** Se dispara al tocar un marcador marcado como `selectable`. */
  onSelectMarker?: (id: string) => void;
  /**
   * Nube de puntos seleccionables (pensada para cientos de ellos: se dibuja
   * entera en una sola llamada). El color por defecto se puede sobreescribir
   * por id con `pinColors`.
   */
  pins?: { id: string; lat: number; lng: number }[];
  pinColors?: Record<string, string>;
  onSelectPin?: (id: string) => void;
  /** Muestra el retículo central (modo "ubicar" con puntería). */
  showReticle?: boolean;
  onReady?: () => void;
  /**
   * `full` = mapa en alta, nubes, especular y estrellas (pantallas donde el globo manda).
   * `lite` = solo el mapa, menos geometría y menos estrellas (globos decorativos).
   */
  quality?: 'full' | 'lite';
};

/** Estado mutable que vive fuera de React para no re-renderizar en cada frame. */
type SceneRefs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  earth: THREE.Mesh;
  clouds: THREE.Mesh;
  pivot: THREE.Group;
  markerGroup: THREE.Group;
  /** Discos seleccionables sobre la superficie, e ids en el orden de sus instancias. */
  pinField: THREE.InstancedMesh | null;
  pinIds: string[];
  stars: THREE.Points;
  gl: ExpoWebGLRenderingContext;
  /** Buffer intermedio del supermuestreo, si está activo. */
  target: THREE.WebGLRenderTarget | null;
};

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(
  {
    style,
    markers = [],
    autoRotate = true,
    interactive = true,
    initial,
    onPickPoint,
    onSelectMarker,
    pins,
    pinColors,
    onSelectPin,
    showReticle = false,
    onReady,
    quality = 'full',
  },
  ref
) {
  const [loading, setLoading] = useState(true);
  const sceneRef = useRef<SceneRefs | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Tamaño del View en unidades lógicas (dp), necesario para el raycast del tap. */
  const layout = useRef({ width: 1, height: 1 });
  /** Evita tocar la escena si el componente se desmonta mientras cargan las texturas. */
  const disposed = useRef(false);
  /** Marcadores actuales, accesibles desde el gesto sin cerrar sobre props viejas. */
  const pinsRef = useRef<{ id: string; lat: number; lng: number }[]>([]);
  pinsRef.current = pins ?? [];

  // rotación objetivo (con amortiguación) y velocidad inercial
  const rot = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const zoom = useRef(3.1);
  const zoomTarget = useRef(3.1);
  const dragging = useRef(false);
  const spinning = useRef(autoRotate);
  const flight = useRef<{
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
    t: number;
    dur: number;
  } | null>(null);

  const markersKey = useMemo(
    () =>
      markers
        .map((m) => `${m.id}:${m.lat}:${m.lng}:${m.color}:${m.kind}:${m.selectable ? 1 : 0}`)
        .join('|'),
    [markers]
  );
  const pinsKey = useMemo(() => (pins ?? []).map((p) => p.id).join('|'), [pins]);
  const pinColorsKey = useMemo(
    () =>
      pinColors
        ? Object.keys(pinColors)
            .sort()
            .map((k) => `${k}:${pinColors[k]}`)
            .join('|')
        : '',
    [pinColors]
  );

  /* ---------------- construcción de la escena ---------------- */

  // Síncrono a propósito: sin `await`, no hay forma de que una promesa rechazada
  // deje el globo colgado en el spinner para siempre.
  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      // `safe` desactiva todo lo que puede fallar en drivers quisquillosos:
      // shaders propios (estrellas y atmósfera) y mapas secundarios. Si el
      // montaje completo revienta, se reintenta en este modo antes de rendirse.
      const build = (safe: boolean) => {
        const renderer = createRenderer(gl);
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
          38,
          gl.drawingBufferWidth / gl.drawingBufferHeight,
          0.1,
          200
        );
        camera.position.set(0, 0, zoom.current);

        // --- luces ---
        scene.add(new THREE.AmbientLight(0x8899ff, 0.55));
        const sun = new THREE.DirectionalLight(0xfff4e0, 2.1);
        sun.position.set(-3.2, 1.8, 2.4);
        scene.add(sun);
        const rim = new THREE.DirectionalLight(0x38bdf8, 0.9);
        rim.position.set(3, -1.5, -2.5);
        scene.add(rim);

        const lite = quality === 'lite' || safe;

        // --- estrellas ---
        const stars = safe
          ? new THREE.Points(
              new THREE.BufferGeometry(),
              new THREE.PointsMaterial({ size: 1, color: 0xffffff })
            )
          : createStarfield(lite ? 420 : 900, 46);
        scene.add(stars);

        // --- tierra ---
        // Las texturas se generan en memoria desde la máscara embebida y quedan
        // cacheadas, así que esto es instantáneo salvo la primera vez (~50 ms).
        const earthTex = getEarthTexture();
        if (!safe) earthTex.anisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;

        const earth = new THREE.Mesh(
          new THREE.SphereGeometry(R, lite ? 72 : 128, lite ? 48 : 96),
          new THREE.MeshPhongMaterial({
            map: earthTex,
            specularMap: lite ? null : getSpecularTexture(),
            specular: new THREE.Color(0x4b6cb7),
            shininess: 26,
            emissive: new THREE.Color(0x0a1230),
            emissiveIntensity: 0.75,
          })
        );

        // --- nubes (solo en calidad completa) ---
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(R * 1.012, 72, 48),
          new THREE.MeshPhongMaterial({
            alphaMap: lite ? null : getCloudTexture(),
            transparent: true,
            opacity: lite ? 0 : 0.34,
            color: 0xffffff,
            depthWrite: false,
          })
        );
        clouds.visible = !lite;

        // --- atmósfera (interior + halo exterior) ---
        const glow = safe ? null : createAtmosphere(R * 1.16, '#38BDF8', 3.0);
        const halo = safe ? null : createAtmosphere(R * 1.42, '#818CF8', 4.2);
        if (halo) (halo.material as THREE.ShaderMaterial).uniforms.uIntensity.value = 0.45;

        const markerGroup = new THREE.Group();
        const pinField = createPinField(Math.max(1, pins?.length ?? 0));

        // el pivot agrupa todo lo que rota con el planeta
        const pivot = new THREE.Group();
        pivot.add(earth, clouds, markerGroup, pinField);
        scene.add(pivot);
        if (glow) scene.add(glow);
        if (halo) scene.add(halo);

        if (initial) {
          const r = toRotation(initial.lat, initial.lng);
          rot.current = { ...r };
          target.current = { ...r };
          if (initial.zoom) {
            zoom.current = initial.zoom;
            zoomTarget.current = initial.zoom;
          }
        }

        sceneRef.current = {
          renderer,
          scene,
          camera,
          earth,
          clouds,
          pivot,
          markerGroup,
          pinField,
          pinIds: [],
          stars,
          gl,
          target: null,
        };

        /*
         * Antialiasing por supermuestreo.
         *
         * `GLView` solo acepta `msaaSamples` en iOS, y al renderer se le pasa un
         * contexto ya creado, así que su opción `antialias` no tiene efecto: el
         * borde del planeta saldría dentado. Renderamos entonces a una textura de
         * el doble de lado y la reducimos con filtrado bilineal, que al escalar
         * exactamente a la mitad promedia bloques de 2×2 — equivale a 4× de MSAA
         * y solo usa funciones básicas de WebGL.
         */
        const bufferW = gl.drawingBufferWidth;
        const bufferH = gl.drawingBufferHeight;
        let superSample: {
          target: THREE.WebGLRenderTarget;
          scene: THREE.Scene;
          camera: THREE.OrthographicCamera;
        } | null = null;

        if (!safe && SUPERSAMPLING > 1) {
          // Techo de píxeles para no ahogar a los móviles de gama media.
          const scale = Math.min(
            SUPERSAMPLING,
            Math.max(1, Math.sqrt(MAX_SS_PIXELS / (bufferW * bufferH)))
          );
          if (scale > 1.05) {
            const target = new THREE.WebGLRenderTarget(
              Math.floor(bufferW * scale),
              Math.floor(bufferH * scale),
              { depthBuffer: true, stencilBuffer: false }
            );
            target.texture.colorSpace = THREE.SRGBColorSpace;
            target.texture.minFilter = THREE.LinearFilter;
            target.texture.magFilter = THREE.LinearFilter;
            target.texture.generateMipmaps = false;

            const quadScene = new THREE.Scene();
            const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            quadScene.add(
              new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2),
                new THREE.MeshBasicMaterial({
                  map: target.texture,
                  transparent: true,
                  depthTest: false,
                  depthWrite: false,
                })
              )
            );
            superSample = { target, scene: quadScene, camera: quadCamera };
            if (sceneRef.current) sceneRef.current.target = target;
          }
        }

        syncMarkers();
        syncPins();
        setLoading(false);
        onReady?.();

        const clock = new THREE.Clock();

        const render = () => {
          rafRef.current = requestAnimationFrame(render);
          const dt = Math.min(0.05, clock.getDelta());
          const elapsed = clock.elapsedTime;

          // vuelo animado hacia un destino
          if (flight.current) {
            const f = flight.current;
            f.t = Math.min(1, f.t + dt / f.dur);
            const e = easeInOutCubic(f.t);
            target.current.x = f.from.x + (f.to.x - f.from.x) * e;
            target.current.y = f.from.y + (f.to.y - f.from.y) * e;
            zoomTarget.current = f.from.z + (f.to.z - f.from.z) * e;
            if (f.t >= 1) flight.current = null;
          } else if (spinning.current && !dragging.current) {
            target.current.y += dt * 0.085;
          }

          // inercia tras soltar el dedo
          if (!dragging.current && !flight.current) {
            target.current.x += vel.current.x * dt;
            target.current.y += vel.current.y * dt;
            vel.current.x *= 0.94;
            vel.current.y *= 0.94;
            if (Math.abs(vel.current.x) < 0.001) vel.current.x = 0;
            if (Math.abs(vel.current.y) < 0.001) vel.current.y = 0;
          }

          target.current.x = clamp(target.current.x, -1.35, 1.35);

          // amortiguación
          rot.current.x += (target.current.x - rot.current.x) * Math.min(1, dt * 9);
          rot.current.y += (target.current.y - rot.current.y) * Math.min(1, dt * 9);
          zoom.current += (zoomTarget.current - zoom.current) * Math.min(1, dt * 8);

          pivot.rotation.x = rot.current.x;
          pivot.rotation.y = rot.current.y;
          clouds.rotation.y += dt * 0.012;
          stars.rotation.y -= dt * 0.006;
          camera.position.set(0, 0, zoom.current);
          camera.lookAt(0, 0, 0);

          const starMat = stars.material as THREE.ShaderMaterial;
          if (starMat.uniforms?.uTime) starMat.uniforms.uTime.value = elapsed;

          // halos y anillos: tangentes a la superficie (mirando hacia afuera) + pulso
          markerGroup.children.forEach((child) => {
            const data = child.userData as { pulse?: boolean; billboard?: boolean };
            if (data.pulse) {
              const k = (elapsed * 0.8) % 1;
              child.scale.setScalar(1 + k * 2.2);
              const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
              mat.opacity = 0.85 * (1 - k);
            }
            if (data.billboard) child.lookAt(child.position.clone().multiplyScalar(3));
          });

          if (superSample) {
            renderer.setRenderTarget(superSample.target);
            renderer.clear();
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
            renderer.clear();
            renderer.render(superSample.scene, superSample.camera);
          } else {
            renderer.render(scene, camera);
          }
          gl.endFrameEXP();
        };
        render();
      };

      try {
        build(false);
      } catch (err) {
        console.error('[Globe] fallo el montaje completo, reintentando en modo seguro:', err);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        try {
          build(true);
          console.warn('[Globe] funcionando en modo seguro (sin shaders propios).');
        } catch (err2) {
          console.error('[Globe] tampoco funciona el modo seguro:', err2);
          setLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ---------------- marcadores ---------------- */

  const syncMarkers = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    disposeObject(s.markerGroup);
    s.markerGroup.clear();

    for (const m of markers) {
      const color = m.color ?? '#FBBF24';
      const pos = latLngToVector3(m.lat, m.lng, R * 1.008);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.022, 16, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })
      );
      dot.position.copy(pos);
      s.markerGroup.add(dot);

      // pequeño mástil para dar sensación de alfiler
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.09, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.75 })
      );
      stem.position.copy(latLngToVector3(m.lat, m.lng, R * 1.045));
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
      s.markerGroup.add(stem);

      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(0.05, 32),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      );
      halo.position.copy(latLngToVector3(m.lat, m.lng, R * 1.004));
      halo.userData = { billboard: true };
      s.markerGroup.add(halo);

      if (m.kind === 'pulse') {
        const ring = createPulseRing(color);
        ring.position.copy(latLngToVector3(m.lat, m.lng, R * 1.006));
        ring.userData = { pulse: true, billboard: true };
        s.markerGroup.add(ring);
      }

      // Zona de toque: una esfera invisible bastante más grande que el punto,
      // para que sea cómoda de pulsar con el dedo sin agrandar el marcador.
      if (m.selectable) {
        const hitArea = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 12, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        hitArea.position.copy(pos);
        hitArea.userData = { markerId: m.id };
        s.markerGroup.add(hitArea);
      }
    }
  }, [markers]);

  const syncPins = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;

    const list = pins ?? [];

    // Si crece el número de marcadores hay que rehacer la malla: la capacidad de
    // un InstancedMesh es fija.
    if (!s.pinField || s.pinField.instanceMatrix.count < list.length) {
      if (s.pinField) {
        s.pivot.remove(s.pinField);
        disposeObject(s.pinField);
      }
      s.pinField = createPinField(Math.max(1, list.length));
      s.pivot.add(s.pinField);
    }

    const mesh = s.pinField;
    const dummy = new THREE.Object3D();
    const outward = new THREE.Vector3(0, 0, 1);
    const tint = new THREE.Color();

    list.forEach((pin, i) => {
      const normal = latLngToVector3(pin.lat, pin.lng, 1).normalize();
      // El disco se apoya en la superficie: su normal sale del centro del globo.
      dummy.position.copy(normal).multiplyScalar(R * 1.006);
      dummy.quaternion.setFromUnitVectors(outward, normal);
      const highlighted = !!pinColors?.[pin.id];
      const scale = highlighted ? PIN_SIZE_HIGHLIGHT : PIN_SIZE;
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      tint.set(pinColors?.[pin.id] ?? DEFAULT_PIN_COLOR);
      mesh.setColorAt(i, tint);
    });

    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.visible = list.length > 0;
    s.pinIds = list.map((p) => p.id);
  }, [pins, pinColors]);

  React.useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

  React.useEffect(() => {
    syncPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, pinColorsKey]);

  React.useEffect(() => {
    spinning.current = autoRotate;
  }, [autoRotate]);

  React.useEffect(
    () => () => {
      disposed.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const s = sceneRef.current;
      if (s) {
        disposeObject(s.scene);
        s.target?.dispose();
        s.renderer.dispose();
      }
      sceneRef.current = null;
    },
    []
  );

  /* ---------------- API imperativa ---------------- */

  useImperativeHandle(
    ref,
    (): GlobeHandle => ({
      flyTo: (lat, lng, opts) => {
        const to = toRotation(lat, lng);
        // toma el camino corto en longitud
        const cur = target.current;
        let dy = to.y - cur.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        flight.current = {
          from: { x: cur.x, y: cur.y, z: zoomTarget.current },
          to: { x: to.x, y: cur.y + dy, z: opts?.zoom ?? zoomTarget.current },
          t: 0,
          dur: (opts?.duration ?? 1200) / 1000,
        };
        vel.current = { x: 0, y: 0 };
      },
      getCenter: () => fromRotation(rot.current.x, rot.current.y),
      spin: (enabled) => {
        spinning.current = enabled;
      },
    }),
    []
  );

  /* ---------------- gestos ---------------- */

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(interactive)
        .onBegin(() => {
          dragging.current = true;
          flight.current = null;
          vel.current = { x: 0, y: 0 };
        })
        .onChange((e) => {
          const k = 0.0055 * (zoom.current / 3.1);
          target.current.y += e.changeX * k;
          target.current.x += e.changeY * k;
          target.current.x = clamp(target.current.x, -1.35, 1.35);
        })
        .onFinalize((e) => {
          dragging.current = false;
          const k = 0.0022 * (zoom.current / 3.1);
          vel.current = {
            x: clamp((e.velocityY ?? 0) * k, -3, 3),
            y: clamp((e.velocityX ?? 0) * k, -3, 3),
          };
        })
        .runOnJS(true),
    [interactive]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(interactive)
        .onChange((e) => {
          zoomTarget.current = clamp(zoomTarget.current / (1 + (e.scaleChange - 1) * 0.9), MIN_ZOOM, MAX_ZOOM);
        })
        .runOnJS(true),
    [interactive]
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!!onPickPoint || !!onSelectMarker || !!onSelectPin)
        .maxDuration(260)
        .onEnd((e) => {
          const s = sceneRef.current;
          if (!s) return;
          const { width, height } = layout.current;
          const ndc = new THREE.Vector2((e.x / width) * 2 - 1, -(e.y / height) * 2 + 1);
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(ndc, s.camera);

          const earthHit = raycaster.intersectObject(s.earth, false)[0];

          if (onSelectPin && earthHit && s.pinField?.visible) {
            // Buscamos el marcador más cercano al punto tocado midiendo sobre la
            // esfera. Es más robusto que intersectar discos diminutos y, al ir
            // el umbral ligado al zoom, el área de toque es constante en pantalla.
            const local = s.earth.worldToLocal(earthHit.point.clone()).normalize();
            const limit = Math.cos(PIN_TAP_ANGLE * zoom.current);
            let bestId: string | null = null;
            let bestDot = limit;

            const list = pinsRef.current;
            for (let i = 0; i < list.length; i++) {
              const pin = list[i];
              const d = latLngToVector3(pin.lat, pin.lng, 1).normalize().dot(local);
              if (d > bestDot) {
                bestDot = d;
                bestId = pin.id;
              }
            }

            if (bestId) {
              onSelectPin(bestId);
              return;
            }
          }

          if (onSelectMarker) {
            const marker = raycaster
              .intersectObjects(s.markerGroup.children, false)
              .find((hit) => hit.object.userData?.markerId);
            // Solo cuenta si está delante del planeta: los del otro lado quedan
            // ocultos por la esfera y no deberían poder tocarse.
            if (marker && (!earthHit || marker.distance <= earthHit.distance + 0.02)) {
              onSelectMarker(marker.object.userData.markerId as string);
              return;
            }
          }

          if (onPickPoint && earthHit) {
            const local = s.earth.worldToLocal(earthHit.point.clone());
            onPickPoint(vector3ToLatLng(local));
          }
        })
        .runOnJS(true),
    [onPickPoint, onSelectMarker, onSelectPin]
  );

  const gesture = useMemo(
    () => Gesture.Simultaneous(Gesture.Exclusive(tap, pan), pinch),
    [tap, pan, pinch]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.container, style]}
        onLayout={(e) => {
          layout.current = {
            width: e.nativeEvent.layout.width || 1,
            height: e.nativeEvent.layout.height || 1,
          };
        }}
      >
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        {showReticle && (
          <View pointerEvents="none" style={styles.reticleWrap}>
            <View style={styles.reticleOuter} />
            <View style={styles.reticleInner} />
            <View style={[styles.tick, { top: -14 }]} />
            <View style={[styles.tick, { bottom: -14 }]} />
            <View style={[styles.tickH, { left: -14 }]} />
            <View style={[styles.tickH, { right: -14 }]} />
          </View>
        )}
        {loading && (
          <View pointerEvents="none" style={styles.loader}>
            <ActivityIndicator color="#2DD4BF" />
          </View>
        )}
      </View>
    </GestureDetector>
  );
});

/* ---------------- utilidades ---------------- */

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Rotación del pivot que deja (lat, lng) mirando a la cámara (+Z). */
function toRotation(lat: number, lng: number) {
  return { x: THREE.MathUtils.degToRad(lat), y: THREE.MathUtils.degToRad(-lng - 90) };
}

/** Inversa de `toRotation`. */
function fromRotation(x: number, y: number) {
  const lat = clamp(THREE.MathUtils.radToDeg(x), -90, 90);
  let lng = -THREE.MathUtils.radToDeg(y) - 90;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat, lng };
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleOuter: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.55)',
  },
  reticleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
  },
  tick: {
    position: 'absolute',
    width: 1.5,
    height: 12,
    backgroundColor: 'rgba(251,191,36,0.8)',
  },
  tickH: {
    position: 'absolute',
    height: 1.5,
    width: 12,
    backgroundColor: 'rgba(251,191,36,0.8)',
  },
});
