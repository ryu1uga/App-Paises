import * as THREE from 'three';

import { countries } from '@/data/countries';
import {
  bearingLabel,
  formatDistance,
  haversine,
  latLngToVector3,
  vector3ToLatLng,
} from '@/lib/geo';

/** Rotación del globo que deja (lat, lng) mirando a la cámara. Igual que Globe.tsx. */
const toRotation = (lat: number, lng: number) => ({
  x: THREE.MathUtils.degToRad(lat),
  y: THREE.MathUtils.degToRad(-lng - 90),
});

const GRID: [number, number][] = [];
for (let lat = -85; lat <= 85; lat += 5) {
  for (let lng = -180; lng < 180; lng += 5) GRID.push([lat, lng]);
}

describe('proyección lat/lng ↔ esfera', () => {
  it('va y vuelve sin perder precisión', () => {
    for (const [lat, lng] of GRID) {
      const back = vector3ToLatLng(latLngToVector3(lat, lng));
      const dLng = Math.abs(((back.lng - lng + 540) % 360) - 180);
      expect(Math.abs(back.lat - lat)).toBeLessThan(1e-9);
      expect(dLng).toBeLessThan(1e-9);
    }
  });

  it('coloca el punto frente a la cámara al aplicar la rotación', () => {
    // Es la relación de la que depende `flyTo`: si se rompe, el globo apunta mal.
    const front = new THREE.Vector3(0, 0, 1);
    for (const [lat, lng] of GRID) {
      const r = toRotation(lat, lng);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r.x, r.y, 0, 'XYZ'));
      const p = latLngToVector3(lat, lng).applyMatrix4(m);
      expect(p.distanceTo(front)).toBeLessThan(1e-9);
    }
  });

  it('devuelve vectores unitarios sobre la esfera', () => {
    for (const [lat, lng] of GRID.slice(0, 200)) {
      expect(latLngToVector3(lat, lng, 1).length()).toBeCloseTo(1, 9);
      expect(latLngToVector3(lat, lng, 2.5).length()).toBeCloseTo(2.5, 9);
    }
  });
});

describe('haversine', () => {
  const cases: [string, { lat: number; lng: number }, { lat: number; lng: number }, number][] = [
    ['Madrid → Lima', { lat: 40.42, lng: -3.7 }, { lat: -12.05, lng: -77.04 }, 9520],
    ['Tokio → Sídney', { lat: 35.68, lng: 139.69 }, { lat: -33.87, lng: 151.21 }, 7825],
    ['Londres → Nueva York', { lat: 51.51, lng: -0.13 }, { lat: 40.71, lng: -74.01 }, 5570],
  ];

  it.each(cases)('%s', (_name, a, b, expected) => {
    expect(haversine(a, b)).toBeCloseTo(expected, -2);
  });

  it('da cero entre un punto y sí mismo', () => {
    expect(haversine({ lat: 10, lng: 20 }, { lat: 10, lng: 20 })).toBe(0);
  });

  it('es simétrica', () => {
    for (const c of countries.slice(0, 40)) {
      const other = countries[100];
      expect(haversine(c, other)).toBeCloseTo(haversine(other, c), 9);
    }
  });

  it('nunca supera media vuelta al planeta', () => {
    const halfWay = Math.PI * 6371;
    for (const a of countries.slice(0, 30)) {
      for (const b of countries.slice(30, 60)) {
        expect(haversine(a, b)).toBeLessThanOrEqual(halfWay + 1);
      }
    }
  });
});

describe('rumbo y formato', () => {
  it('nombra la dirección correcta', () => {
    const origin = { lat: 0, lng: 0 };
    expect(bearingLabel(origin, { lat: 10, lng: 0 })).toBe('norte');
    expect(bearingLabel(origin, { lat: -10, lng: 0 })).toBe('sur');
    expect(bearingLabel(origin, { lat: 0, lng: 10 })).toBe('este');
    expect(bearingLabel(origin, { lat: 0, lng: -10 })).toBe('oeste');
  });

  it('formatea distancias de forma legible', () => {
    expect(formatDistance(3.14)).toBe('3.1 km');
    expect(formatDistance(250)).toBe('250 km');
    expect(formatDistance(9520)).toBe('9.5 mil km');
  });
});
