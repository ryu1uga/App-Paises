import { Asset } from 'expo-asset';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';

/**
 * three.js espera un `HTMLCanvasElement`. En React Native no existe, así que le
 * pasamos un objeto mínimo con lo que realmente consulta el renderer.
 */
export function makeFakeCanvas(gl: ExpoWebGLRenderingContext) {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
    getBoundingClientRect: () => ({ x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height }),
  } as unknown as HTMLCanvasElement;
}

export function createRenderer(gl: ExpoWebGLRenderingContext): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas: makeFakeCanvas(gl),
    context: gl as unknown as WebGL2RenderingContext,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/**
 * Carga una textura desde un `require('...png')`.
 *
 * Truco conocido de expo-gl: marcamos la textura como `isDataTexture` para que
 * three llame a `texImage2D(..., data)` pasando el Asset tal cual; el módulo
 * nativo de expo-gl detecta el `localUri` y sube el bitmap sin pasar por JS.
 */
export async function loadTextureAsync(moduleId: number): Promise<THREE.Texture> {
  const asset = Asset.fromModule(moduleId);
  if (!asset.downloaded) await asset.downloadAsync();

  const texture = new THREE.Texture();
  // Forma específica de expo-gl, no del DOM.
  texture.image = {
    data: asset,
    width: asset.width ?? 1,
    height: asset.height ?? 1,
    localUri: asset.localUri ?? asset.uri,
  };
  // @ts-expect-error: flag interna de three
  texture.isDataTexture = true;
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Las texturas son potencia de dos (2048×1024), así que los mipmaps son válidos
  // y evitan el aliasing al alejar el globo.
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/** Campo de estrellas procedural (posiciones + tamaños + tonos). */
export function createStarfield(count = 900, radius = 40): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // distribución uniforme sobre la esfera
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = radius * (0.75 + Math.random() * 0.45);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);

    const t = Math.random();
    color.setHSL(t < 0.75 ? 0.58 : 0.08 + Math.random() * 0.08, 0.35 + t * 0.35, 0.72 + Math.random() * 0.25);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = Math.random() < 0.06 ? 3.2 : 0.7 + Math.random() * 1.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;
      void main() {
        vColor = color;
        vTwinkle = 0.65 + 0.35 * sin(uTime * 1.7 + position.x * 3.1 + position.y * 1.7);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (260.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, a * a * vTwinkle);
      }
    `,
  });
  material.vertexColors = true;

  return new THREE.Points(geometry, material);
}

/**
 * Halo atmosférico: una esfera algo mayor renderizada por dentro con Fresnel.
 */
export function createAtmosphere(radius: number, color = '#38BDF8', power = 2.6): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float fres = pow(1.0 - abs(dot(vNormal, vView)), uPower);
        gl_FragColor = vec4(uColor, fres * uIntensity);
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
}

/** Anillo plano orientado hacia la cámara, usado como pulso del marcador. */
export function createPulseRing(color = '#FBBF24'): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.045, 0.055, 48);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/** Arco geodésico entre dos puntos de la esfera (para conectar respuesta y objetivo). */
export function createArc(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color = '#FBBF24',
  lift = 0.35
): THREE.Line {
  const points: THREE.Vector3[] = [];
  const steps = 64;
  const angle = from.angleTo(to);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = new THREE.Vector3().copy(from).lerp(to, t).normalize();
    const bulge = 1 + Math.sin(Math.PI * t) * lift * Math.min(1, angle / Math.PI);
    points.push(p.multiplyScalar(from.length() * bulge));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.95,
  });
  return new THREE.Line(geometry, material);
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}
