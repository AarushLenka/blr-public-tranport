import type { Bbox, LatLon } from './types';

export const BLR_BBOX: Bbox = { minLat: 12.7, minLon: 77.3, maxLat: 13.3, maxLon: 77.9 };

export const BLR_CENTER: LatLon = { lat: 12.9716, lon: 77.5946 };

const EARTH_RADIUS_M = 6371000;
const WALK_SPEED_M_PER_MIN = 80; // 4.8 km/h
const DETOUR_FACTOR = 1.25;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversine(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Straight-line distance with a documented detour factor, used for walking legs. */
export function walkMeters(a: LatLon, b: LatLon): number {
  return Math.round(haversine(a, b) * DETOUR_FACTOR);
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_SPEED_M_PER_MIN));
}

export function inBbox(point: LatLon, bbox: Bbox = BLR_BBOX): boolean {
  return point.lat >= bbox.minLat && point.lat <= bbox.maxLat && point.lon >= bbox.minLon && point.lon <= bbox.maxLon;
}

export function nearestShapeIndex(shape: [number, number][], point: LatLon): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const dLat = shape[i][1] - point.lat;
    const dLon = shape[i][0] - point.lon;
    const d = dLat * dLat + dLon * dLon;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** IST clock time from seconds after midnight. */
export function istClock(seconds: number): string {
  const wrapped = ((seconds % 86400) + 86400) % 86400;
  const h = Math.floor(wrapped / 3600);
  const m = Math.floor((wrapped % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function nowIstSeconds(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
