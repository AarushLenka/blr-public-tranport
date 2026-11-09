import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { BLR_BBOX, haversine } from './geo';
import type { Network, NetworkPattern, NetworkStop, SuggestItem } from './types';

// One consistent bus colour, chosen to stay clear of the real metro line colours
// (Green #009933, Purple #8C2877, Yellow #FFDF00) while remaining inside the
// warm earth palette. Verified by luminance distance in docs/DECISIONS.md.
export const BUS_COLOUR = '#a4512a';
export const WALK_COLOUR = '#666e72';

let cached: Network | null = null;
let cachedMtime = 0;

export function getNetwork(): Network {
  const file = path.join(process.cwd(), 'data', 'processed', 'network.json');
  const mtime = statSync(file).mtimeMs;
  if (cached && mtime === cachedMtime) return cached;
  cached = JSON.parse(readFileSync(file, 'utf8')) as Network;
  cachedMtime = mtime;
  return cached;
}

const CELL = 0.01;

type Grid = Map<string, number[]>;

let grid: Grid | null = null;

const cellKey = (lat: number, lon: number) => `${Math.floor(lat / CELL)}:${Math.floor(lon / CELL)}`;

export function getGrid(): Grid {
  if (grid) return grid;
  grid = new Map();
  const net = getNetwork();
  net.stops.forEach((stop, index) => {
    const key = cellKey(stop.lat, stop.lon);
    const bucket = grid!.get(key);
    if (bucket) bucket.push(index);
    else grid!.set(key, [index]);
  });
  return grid;
}

export type NearbyStop = { index: number; stop: NetworkStop; meters: number };

export function nearbyStops(lat: number, lon: number, radiusMeters: number): NearbyStop[] {
  const g = getGrid();
  const net = getNetwork();
  const latSpan = radiusMeters / 111320;
  const lonSpan = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const minLatCell = Math.floor((lat - latSpan) / CELL);
  const maxLatCell = Math.floor((lat + latSpan) / CELL);
  const minLonCell = Math.floor((lon - lonSpan) / CELL);
  const maxLonCell = Math.floor((lon + lonSpan) / CELL);
  const out: NearbyStop[] = [];
  for (let la = minLatCell; la <= maxLatCell; la++) {
    for (let lo = minLonCell; lo <= maxLonCell; lo++) {
      const bucket = g.get(`${la}:${lo}`);
      if (!bucket) continue;
      for (const index of bucket) {
        const stop = net.stops[index];
        const meters = haversine({ lat, lon }, { lat: stop.lat, lon: stop.lon });
        if (meters <= radiusMeters) out.push({ index, stop, meters });
      }
    }
  }
  return out.sort((a, b) => a.meters - b.meters);
}

export function stopById(id: string): { index: number; stop: NetworkStop } | null {
  const net = getNetwork();
  const index = net.stops.findIndex((s) => s.id === id);
  return index === -1 ? null : { index, stop: net.stops[index] };
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(metro|station|bus|stop|platform|gate|depot)\b/g, ' ')
    .replace(/[.,()/–—&+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalizeName(value).split(' ').filter(Boolean);
}

/** Bounded edit distance, used only after cheaper matches fail. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

function matchScore(rawName: string, query: string): number | null {
  const name = normalizeName(rawName);
  if (!name) return null;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  const nameTokens = name.split(' ');
  const queryTokens = query.split(' ').filter(Boolean);
  if (nameTokens.some((token) => token.startsWith(query))) return 1.5;
  if (queryTokens.length > 1 && queryTokens.every((token) => nameTokens.some((part) => part.startsWith(token)))) {
    return 1.8;
  }
  if (name.includes(query)) return 2.5;
  if (query.length >= 4) {
    const max = query.length >= 8 ? 2 : 1;
    const direct = editDistance(query, name, max);
    if (direct <= max) return 3.5 + direct / 10;
    let best = max + 1;
    for (const token of nameTokens) {
      if (Math.abs(token.length - query.length) > max) continue;
      best = Math.min(best, editDistance(query, token, max));
    }
    if (best <= max) return 4 + best / 10;
  }
  return null;
}

let metroLinesByStop: Map<number, string[]> | null = null;
let serviceByStop: Int32Array | null = null;

function serviceCountAt(index: number): number {
  if (!serviceByStop) {
    const net = getNetwork();
    serviceByStop = new Int32Array(net.stops.length);
    for (const pattern of net.patterns) {
      for (const stopIndex of pattern.stops) serviceByStop[stopIndex] += 1;
    }
  }
  return serviceByStop[index] ?? 0;
}

export function metroLinesAt(index: number): string[] {
  if (!metroLinesByStop) {
    const net = getNetwork();
    metroLinesByStop = new Map();
    for (const p of net.patterns) {
      if (p.mode !== 'metro') continue;
      for (const stopIndex of p.stops) {
        const set = metroLinesByStop.get(stopIndex);
        if (set) {
          if (!set.includes(p.routeNumber)) set.push(p.routeNumber);
        } else {
          metroLinesByStop.set(stopIndex, [p.routeNumber]);
        }
      }
    }
  }
  return metroLinesByStop.get(index) ?? [];
}

export function searchStops(query: string, lat?: number, lon?: number, limit = 10): SuggestItem[] {
  const net = getNetwork();
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const scored: { item: SuggestItem; score: number; key: string }[] = [];
  net.stops.forEach((stop, index) => {
    const base = matchScore(stop.name, q);
    if (base === null) return;
    const lines = stop.mode === 'metro' ? metroLinesAt(index) : [];
    const distance = lat !== undefined && lon !== undefined ? haversine({ lat, lon }, { lat: stop.lat, lon: stop.lon }) : null;
    let score = base;
    if (stop.mode === 'metro') score -= 0.9;
    // Within the same match tier, busy stops are the ones people usually mean.
    score -= Math.min(serviceCountAt(index) / 80, 0.75);
    if (distance !== null) score += Math.min(distance / 3500, 2.4);
    if (!lines.length && stop.mode === 'bus') score += 0.15;
    scored.push({
      score,
      key: `${stop.mode}:${normalizeName(stop.name)}`,
      item: {
        id: stop.id,
        name: stop.name,
        subtitle: lines.length ? lines.map((l) => `${l} Line`).join(' · ') : 'BMTC bus stop',
        kind: stop.mode === 'metro' ? 'metro_station' : 'bus_stop',
        mode: stop.mode,
        lines,
        source: 'stop',
        distanceMeters: distance === null ? undefined : Math.round(distance),
        matched: q,
        location: { lat: stop.lat, lon: stop.lon },
      },
    });
  });
  scored.sort((a, b) => a.score - b.score || a.item.name.length - b.item.name.length);
  const seen = new Set<string>();
  const out: SuggestItem[] = [];
  for (const entry of scored) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push(entry.item);
    if (out.length >= limit) break;
  }
  return out;
}

export function patternsForMode(mode: 'metro' | 'bus'): NetworkPattern[] {
  return getNetwork().patterns.filter((p) => p.mode === mode);
}

export function countNote(count: number): string {
  return count === 0 ? 'service area' : `${count.toLocaleString('en-IN')} stops`;
}

export { BLR_BBOX };
