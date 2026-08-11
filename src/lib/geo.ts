import * as THREE from 'three';

export const EARTH_RADIUS_KM = 6371;

/**
 * Convierte lat/lng a un punto en la superficie de una esfera de radio `r`.
 * El mapeado coincide con el de una textura equirectangular sobre THREE.SphereGeometry,
 * cuya costura (u = 0) queda en lng = -180.
 */
export function latLngToVector3(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** Inversa de `latLngToVector3`. */
export function vector3ToLatLng(v: THREE.Vector3): { lat: number; lng: number } {
  const n = v.clone().normalize();
  const lat = 90 - (Math.acos(n.y) * 180) / Math.PI;
  let lng = ((Math.atan2(n.z, -n.x) * 180) / Math.PI) - 180;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return { lat, lng };
}

/** Rotación de cámara/globo necesaria para dejar un punto mirando al frente. */
export function latLngToRotation(lat: number, lng: number): { x: number; y: number } {
  return {
    x: THREE.MathUtils.degToRad(lat),
    y: -THREE.MathUtils.degToRad(lng + 90),
  };
}

/** Distancia sobre el gran círculo, en kilómetros. */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatDistance(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  if (km < 1000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)} mil km`;
}

/**
 * Encuadre para un grupo de puntos sobre la esfera: devuelve el centro y el zoom
 * mínimo que los deja a todos dentro del casquete visible.
 *
 * A distancia `z` del centro de una esfera de radio 1, se ve un casquete de
 * semiángulo `acos(1/z)`; despejando obtenemos el zoom necesario.
 */
export function frameFor(
  points: { lat: number; lng: number }[],
  opts: { margin?: number; min?: number; max?: number } = {}
): { lat: number; lng: number; zoom: number } {
  const { margin = 0.38, min = 2.3, max = 5.2 } = opts;
  if (points.length === 0) return { lat: 0, lng: 0, zoom: 3.2 };

  const vectors = points.map((p) => latLngToVector3(p.lat, p.lng, 1));
  const center = vectors
    .reduce((acc, v) => acc.add(v), new THREE.Vector3())
    .divideScalar(points.length);

  // Si los puntos están repartidos por todo el globo el promedio tiende a cero;
  // en ese caso nos quedamos con el primero como referencia.
  if (center.lengthSq() < 1e-6) center.copy(vectors[0]);
  center.normalize();

  let maxAngle = 0;
  for (const v of vectors) maxAngle = Math.max(maxAngle, center.angleTo(v));

  const half = Math.min(maxAngle + margin, 1.45);
  const zoom = Math.min(max, Math.max(min, 1 / Math.cos(half)));

  return { ...vector3ToLatLng(center), zoom };
}

/** Rumbo aproximado de a → b, en texto ("noreste", "sur"…). */
export function bearingLabel(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  const deg = (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
  const names = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  return names[Math.round(deg / 45) % 8];
}
