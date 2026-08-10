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
import {
  createArc,
  createAtmosphere,
  createPulseRing,
  createRenderer,
  createStarfield,
  disposeObject,
  loadTextureAsync,
} from './glHelpers';

const EARTH = require('../../assets/textures/earth.png');
const CLOUDS = require('../../assets/textures/earth-clouds.png');
const SPEC = require('../../assets/textures/earth-spec.png');

const R = 1; // radio del globo en unidades de escena
const MIN_ZOOM = 2.05;
const MAX_ZOOM = 5.6;

export type GlobeMarker = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  /** 'pin' clava un alfiler, 'pulse' añade además un anillo animado */
  kind?: 'pin' | 'pulse';
  label?: string;
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
  /** Arco entre dos puntos (respuesta → objetivo). */
  arc?: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; color?: string } | null;
  /** Rotación automática cuando no se está tocando. */
  autoRotate?: boolean;
  /** Permite girar y hacer zoom. */
  interactive?: boolean;
  /** Punto de vista inicial. */
  initial?: { lat: number; lng: number; zoom?: number };
  /** Se dispara al tocar el globo (coordenada de la superficie). */
  onPickPoint?: (p: { lat: number; lng: number }) => void;
  /** Muestra el retículo central (modo "ubicar" con puntería). */
  showReticle?: boolean;
  onReady?: () => void;
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
  arcGroup: THREE.Group;
  stars: THREE.Points;
  gl: ExpoWebGLRenderingContext;
};

export const Globe = forwardRef<GlobeHandle, Props>(function Globe(
  {
    style,
    markers = [],
    arc = null,
    autoRotate = true,
    interactive = true,
    initial,
    onPickPoint,
    showReticle = false,
    onReady,
  },
  ref
) {
  const [loading, setLoading] = useState(true);
  const sceneRef = useRef<SceneRefs | null>(null);
  const rafRef = useRef<number | null>(null);
  /** Tamaño del View en unidades lógicas (dp), necesario para el raycast del tap. */
  const layout = useRef({ width: 1, height: 1 });

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
    () => markers.map((m) => `${m.id}:${m.lat}:${m.lng}:${m.color}:${m.kind}`).join('|'),
    [markers]
  );
  const arcKey = useMemo(
    () => (arc ? `${arc.from.lat},${arc.from.lng}>${arc.to.lat},${arc.to.lng}:${arc.color}` : ''),
    [arc]
  );

  /* ---------------- construcción de la escena ---------------- */

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
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

      // --- estrellas ---
      const stars = createStarfield(1000, 46);
      scene.add(stars);

      // --- texturas ---
      const [earthTex, cloudTex, specTex] = await Promise.all([
        loadTextureAsync(EARTH),
        loadTextureAsync(CLOUDS),
        loadTextureAsync(SPEC),
      ]);
      const maxAniso = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
      earthTex.anisotropy = maxAniso;

      // --- tierra ---
      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(R, 96, 64),
        new THREE.MeshPhongMaterial({
          map: earthTex,
          specularMap: specTex,
          specular: new THREE.Color(0x4b6cb7),
          shininess: 26,
          emissive: new THREE.Color(0x0a1230),
          emissiveIntensity: 0.75,
        })
      );

      // --- nubes ---
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.012, 64, 48),
        new THREE.MeshPhongMaterial({
          alphaMap: cloudTex,
          transparent: true,
          opacity: 0.34,
          color: 0xffffff,
          depthWrite: false,
        })
      );

      // --- atmósfera (interior + halo exterior) ---
      const glow = createAtmosphere(R * 1.16, '#38BDF8', 3.0);
      const halo = createAtmosphere(R * 1.42, '#818CF8', 4.2);
      (halo.material as THREE.ShaderMaterial).uniforms.uIntensity.value = 0.45;

      const markerGroup = new THREE.Group();
      const arcGroup = new THREE.Group();

      // el pivot agrupa todo lo que rota con el planeta
      const pivot = new THREE.Group();
      pivot.add(earth, clouds, markerGroup, arcGroup);
      scene.add(pivot, glow, halo);

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
        arcGroup,
        stars,
        gl,
      };

      syncMarkers();
      syncArc();
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

        (stars.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;

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

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      render();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ---------------- marcadores y arcos ---------------- */

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
    }
  }, [markers]);

  const syncArc = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    disposeObject(s.arcGroup);
    s.arcGroup.clear();
    if (!arc) return;
    const from = latLngToVector3(arc.from.lat, arc.from.lng, R * 1.01);
    const to = latLngToVector3(arc.to.lat, arc.to.lng, R * 1.01);
    s.arcGroup.add(createArc(from, to, arc.color ?? '#FBBF24'));
  }, [arc]);

  React.useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

  React.useEffect(() => {
    syncArc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arcKey]);

  React.useEffect(() => {
    spinning.current = autoRotate;
  }, [autoRotate]);

  React.useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const s = sceneRef.current;
      if (s) {
        disposeObject(s.scene);
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
        .enabled(!!onPickPoint)
        .maxDuration(260)
        .onEnd((e) => {
          const s = sceneRef.current;
          if (!s || !onPickPoint) return;
          const { width, height } = layout.current;
          const ndc = new THREE.Vector2((e.x / width) * 2 - 1, -(e.y / height) * 2 + 1);
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(ndc, s.camera);
          const hits = raycaster.intersectObject(s.earth, false);
          if (!hits.length) return;
          const local = s.earth.worldToLocal(hits[0].point.clone());
          onPickPoint(vector3ToLatLng(local));
        })
        .runOnJS(true),
    [onPickPoint]
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
