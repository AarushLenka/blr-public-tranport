import { istClock, nearestShapeIndex, nowIstSeconds, walkMeters } from './geo';
import { BUS_COLOUR, WALK_COLOUR, getNetwork, nearbyStops, normalizeName, stopById } from './network';
import type {
  DataSource,
  Itinerary,
  Leg,
  LineInfo,
  Mode,
  Network,
  NetworkPattern,
  NetworkStop,
  Place,
  RouteResponse,
  TransitLeg,
  WalkLeg,
} from './types';

const INF = Number.POSITIVE_INFINITY;
const MAX_ROUNDS = 4;
const ACCESS_RADIUS = { metro: 1600, bus: 800 } as const;
// Metro-only is still a door-to-door plan: if the nearest station is outside a
// comfortable walk, include it rather than returning no route at all.
const METRO_ONLY_ACCESS_RADIUS = 12_000;
const MAX_ACCESS_STOPS = 14;
const MAX_METRO_ACCESS_STOPS = 24;
const TRANSFER_WALK_RADIUS = 400;
const UNKNOWN_WAIT_MINUTES = 8;
const TRANSFER_BUFFER_MINUTES = 3;

type AccessStop = { index: number; stop: NetworkStop; meters: number; minutes: number };

type Label = {
  round: number;
  kind: 'access' | 'ride' | 'walk';
  pattern?: number;
  boardIdx?: number;
  alightIdx?: number;
  fromStop?: number;
};

type SearchResult = {
  arrival: Float64Array;
  labels: (Label | null)[][];
  rounds: number;
  access: AccessStop[];
};

const toPlace = (stop: NetworkStop, mode: 'metro' | 'bus'): Place => ({
  id: stop.id,
  name: stop.name,
  kind: mode === 'metro' ? 'metro_station' : 'bus_stop',
  location: { lat: stop.lat, lon: stop.lon },
});

function accessStops(place: Place, mode: Mode): AccessStop[] {
  const maxRadius =
    mode === 'metro' ? METRO_ONLY_ACCESS_RADIUS : mode === 'bus' ? 1600 : ACCESS_RADIUS.metro;
  const maxStops = mode === 'metro' ? MAX_METRO_ACCESS_STOPS : MAX_ACCESS_STOPS;
  const exact = stopById(place.id);
  const results: AccessStop[] = [];
  const seenStops = new Set<number>();
  const seenNames = new Set<string>();

  const add = (index: number, stop: NetworkStop, meters: number) => {
    if (seenStops.has(index)) return;
    const nameKey = `${stop.mode}:${normalizeName(stop.name)}`;
    if (seenNames.has(nameKey)) return;
    seenStops.add(index);
    seenNames.add(nameKey);
    results.push({
      index,
      stop,
      meters,
      minutes: meters === 0 ? 0 : Math.max(1, Math.round(meters / 80)),
    });
  };

  if (exact && (mode === 'best' || exact.stop.mode === mode)) {
    add(exact.index, exact.stop, 0);
  }

  const candidates = nearbyStops(place.location.lat, place.location.lon, maxRadius);
  for (const candidate of candidates) {
    if (mode !== 'best' && candidate.stop.mode !== mode) continue;
    if (mode === 'best') {
      const radius = candidate.stop.mode === 'metro' ? ACCESS_RADIUS.metro : ACCESS_RADIUS.bus;
      if (candidate.meters > radius) continue;
    }
    add(candidate.index, candidate.stop, Math.round(candidate.meters * 1.25));
    if (results.length >= maxStops) break;
  }
  return results;
}

function allowed(mode: Mode, patternMode: 'metro' | 'bus'): boolean {
  return mode === 'best' || mode === patternMode;
}

function waitFor(pattern: NetworkPattern, round: number): { minutes: number; known: boolean } {
  const known = pattern.headwayMin != null;
  const half = known ? Math.min(Math.max((pattern.headwayMin as number) / 2, 2), 30) : UNKNOWN_WAIT_MINUTES;
  const buffer = round > 1 ? TRANSFER_BUFFER_MINUTES : 0;
  return { minutes: half + buffer, known };
}

function runRaptor(net: Network, access: AccessStop[], mode: Mode): SearchResult {
  const n = net.stops.length;
  const arrival = new Float64Array(n).fill(INF);
  const labels: (Label | null)[][] = [new Array<Label | null>(n).fill(null)];

  for (const a of access) {
    if (a.minutes < arrival[a.index]) {
      arrival[a.index] = a.minutes;
      labels[0][a.index] = { round: 0, kind: 'access' };
    }
  }

  const patterns = net.patterns;
  let rounds = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const prev = arrival.slice();
    const next = arrival.slice();
    const roundLabels = new Array<Label | null>(n).fill(null);
    let improved = false;

    for (let pi = 0; pi < patterns.length; pi++) {
      const pattern = patterns[pi];
      if (!allowed(mode, pattern.mode)) continue;
      const stops = pattern.stops;
      const wait = waitFor(pattern, round).minutes;
      let boardIdx = -1;
      let readyTime = INF;
      for (let i = 0; i < stops.length; i++) {
        const a = prev[stops[i]];
        if (a === INF) continue;
        const ready = a + wait;
        if (ready < readyTime) {
          readyTime = ready;
          boardIdx = i;
        }
      }
      if (boardIdx < 0) continue;
      // GTFS stop offsets are seconds; the search works in minutes.
      const base = readyTime - pattern.offsets[boardIdx] / 60;
      for (let i = boardIdx + 1; i < stops.length; i++) {
        const stopIndex = stops[i];
        const t = base + pattern.offsets[i] / 60;
        if (t < next[stopIndex] - 0.01) {
          next[stopIndex] = t;
          roundLabels[stopIndex] = { round, kind: 'ride', pattern: pi, boardIdx, alightIdx: i };
          improved = true;
        }
      }
    }

    // One walking relaxation per round: interchanges and nearby stop changes.
    const touched = new Set<number>();
    for (let i = 0; i < n; i++) if (roundLabels[i]) touched.add(i);
    for (const stopIndex of touched) {
      const stop = net.stops[stopIndex];
      for (const candidate of nearbyStops(stop.lat, stop.lon, TRANSFER_WALK_RADIUS)) {
        if (candidate.index === stopIndex) continue;
        const meters = Math.round(candidate.meters * 1.25);
        const minutes = Math.max(1, Math.round(meters / 80));
        if (next[stopIndex] + minutes < next[candidate.index] - 0.01) {
          next[candidate.index] = next[stopIndex] + minutes;
          roundLabels[candidate.index] = { round, kind: 'walk', fromStop: stopIndex };
          improved = true;
        }
      }
    }

    arrival.set(next);
    labels.push(roundLabels);
    rounds = round;
    if (!improved) break;
  }

  return { arrival, labels, rounds, access };
}

function pickTextColour(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '#faf5eb';
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? '#1d1a15' : '#faf5eb';
}

function lineInfo(pattern: NetworkPattern): LineInfo {
  const colour = pattern.mode === 'metro' ? pattern.colour ?? '#484036' : BUS_COLOUR;
  return {
    name: pattern.mode === 'metro' ? `${pattern.routeNumber} Line` : pattern.routeNumber,
    routeNumber: pattern.routeNumber,
    colour,
    textColour: pattern.mode === 'metro' ? pattern.textColour || pickTextColour(colour) : pickTextColour(BUS_COLOUR),
    headsign: pattern.headsign,
    longName: pattern.routeName,
  };
}

function walkLeg(from: Place, to: Place, meters: number): WalkLeg {
  return {
    type: 'walk',
    from,
    to,
    meters,
    minutes: Math.max(1, Math.round(meters / 80)),
    geometry: [
      [from.location.lon, from.location.lat],
      [to.location.lon, to.location.lat],
    ],
    approximate: true,
  };
}

function transitLeg(net: Network, pattern: NetworkPattern, boardIdx: number, alightIdx: number, round: number): TransitLeg {
  const board = toPlace(net.stops[pattern.stops[boardIdx]], pattern.mode);
  const alight = toPlace(net.stops[pattern.stops[alightIdx]], pattern.mode);
  const stops = pattern.stops.slice(boardIdx, alightIdx + 1).map((index) => toPlace(net.stops[index], pattern.mode));
  let geometry: [number, number][] = stops.map((s) => [s.location.lon, s.location.lat] as [number, number]);
  let approximateGeometry = true;
  if (pattern.mode === 'metro' && pattern.shapeId && net.shapes[pattern.shapeId]) {
    const shape = net.shapes[pattern.shapeId];
    const boardAt = nearestShapeIndex(shape, board.location);
    const alightAt = nearestShapeIndex(shape, alight.location);
    if (boardAt !== alightAt) {
      geometry = boardAt < alightAt ? shape.slice(boardAt, alightAt + 1) : shape.slice(alightAt, boardAt + 1).reverse();
      approximateGeometry = false;
    }
  }
  const wait = waitFor(pattern, round);
  return {
    type: pattern.mode,
    line: lineInfo(pattern),
    board,
    alight,
    stops,
    minutes: Math.max(1, Math.round((pattern.offsets[alightIdx] - pattern.offsets[boardIdx]) / 60)),
    waitMinutes: Math.round(wait.minutes),
    waitKnown: wait.known,
    geometry,
    approximateGeometry,
  };
}

function findLabel(labels: (Label | null)[][], stopIndex: number, maxRound: number): Label | null {
  for (let r = Math.min(maxRound, labels.length - 1); r >= 0; r--) {
    const label = labels[r][stopIndex];
    if (label) return label;
  }
  return null;
}

function reconstruct(
  net: Network,
  search: SearchResult,
  destination: Place,
  egressStop: number,
  egressMeters: number,
  origin: Place,
): Leg[] {
  const legs: Leg[] = [];
  const destinationPlace: Place = destination;

  if (egressMeters > 5) {
    legs.push(walkLeg(toPlace(net.stops[egressStop], net.stops[egressStop].mode), destinationPlace, egressMeters));
  }

  let stopIndex = egressStop;
  let maxRound = search.rounds;
  let guard = 0;
  while (guard++ < 24) {
    const label = findLabel(search.labels, stopIndex, maxRound);
    if (!label) break;
    if (label.kind === 'access') {
      const entry = search.access.find((a) => a.index === stopIndex);
      if (entry && entry.meters > 5) {
        legs.push(walkLeg(origin, toPlace(entry.stop, entry.stop.mode), entry.meters));
      }
      break;
    }
    if (label.kind === 'walk' && label.fromStop != null) {
      const from = net.stops[label.fromStop];
      const to = net.stops[stopIndex];
      const meters = Math.round(
        walkMeters({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }),
      );
      if (meters > 5) legs.push(walkLeg(toPlace(from, from.mode), toPlace(to, to.mode), meters));
      stopIndex = label.fromStop;
      maxRound = label.round;
      continue;
    }
    if (label.kind === 'ride' && label.pattern != null && label.boardIdx != null && label.alightIdx != null) {
      const pattern = net.patterns[label.pattern];
      legs.push(transitLeg(net, pattern, label.boardIdx, label.alightIdx, label.round));
      stopIndex = pattern.stops[label.boardIdx];
      maxRound = label.round - 1;
      continue;
    }
    break;
  }
  return mergeWalks(legs.reverse());
}

function offerWalk(origin: Place, destination: Place): Itinerary | null {
  const meters = Math.round(walkMeters(origin.location, destination.location));
  if (meters > 3000) return null;
  const minutes = Math.max(1, Math.round(meters / 80));
  return {
    id: 'walk-only',
    label: 'Walk only',
    totalMinutes: minutes,
    walkMeters: meters,
    transfers: 0,
    legs: [walkLeg(origin, destination, meters)],
    warnings: ['No transit route was found for this trip.'],
  };
}

function signature(itinerary: Itinerary): string {
  const rides = itinerary.legs.filter((leg): leg is TransitLeg => leg.type !== 'walk');
  if (!rides.length) {
    return itinerary.legs
      .map((leg) => (leg.type === 'walk' ? `walk:${leg.to.name}:${Math.round(leg.meters / 50)}` : leg.type))
      .join('|');
  }
  return rides
    .map((leg) => `${leg.type}:${leg.line.routeNumber}:${leg.board.name}:${leg.alight.name}`)
    .join('|');
}

/** A walk transfer and an egress walk can meet at the same stop. Present them as one walk. */
function mergeWalks(legs: Leg[]): Leg[] {
  const merged: Leg[] = [];
  for (const leg of legs) {
    const previous = merged[merged.length - 1];
    if (leg.type === 'walk' && previous?.type === 'walk') {
      const meters = previous.meters + leg.meters;
      merged[merged.length - 1] = {
        type: 'walk',
        from: previous.from,
        to: leg.to,
        meters,
        minutes: Math.max(1, Math.round(meters / 80)),
        geometry: [...previous.geometry, ...leg.geometry.slice(1)],
        approximate: true,
      };
    } else {
      merged.push(leg);
    }
  }
  return merged;
}

function buildFromSearch(
  net: Network,
  search: SearchResult,
  origin: Place,
  destination: Place,
  mode: Mode,
): Itinerary | null {
  let best: { stop: number; meters: number; minutes: number; total: number } | null = null;
  const egress = accessStops(destination, mode);
  for (const candidate of egress) {
    const arrive = search.arrival[candidate.index];
    if (!Number.isFinite(arrive)) continue;
    const total = arrive + candidate.minutes;
    if (!best || total < best.total) best = { stop: candidate.index, meters: candidate.meters, minutes: candidate.minutes, total };
  }
  if (!best) return null;

  const legs = reconstruct(net, search, destination, best.stop, best.meters, origin);
  if (!legs.length) return null;

  let transitCount = 0;
  let walkTotal = 0;
  const warnings = new Set<string>();
  let unknownWait = 0;
  let approximate = false;
  for (const leg of legs) {
    if (leg.type === 'walk') {
      walkTotal += leg.meters;
    } else {
      transitCount++;
      if (!leg.waitKnown) unknownWait++;
      if (leg.approximateGeometry) approximate = true;
    }
  }
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const firstWalk = firstLeg?.type === 'walk' ? firstLeg.meters : 0;
  const lastWalk = lastLeg?.type === 'walk' ? lastLeg.meters : 0;
  const accessWalk = Math.max(firstWalk, lastWalk);
  if (unknownWait > 0) warnings.add('Some services have no published frequency. The wait shown is an estimate.');
  if (approximate) warnings.add('Bus paths are drawn stop to stop, not along the road.');
  if (mode === 'metro' && accessWalk > 1800) {
    warnings.add(
      `The nearest metro station is ${(accessWalk / 1000).toFixed(1)} km from one end of this trip. The walk is included in the total.`,
    );
  }
  if (transitCount > 0) warnings.add('Times use scheduled frequencies, not live vehicle positions.');

  const minutes = Math.max(1, Math.ceil(best.total));
  return {
    id: legs
      .map((l) => (l.type === 'walk' ? `w${Math.round(l.meters)}` : `${l.type}${l.line.routeNumber}${l.board.id}${l.alight.id}`))
      .join('-'),
    label: mode === 'metro' ? 'Metro only' : mode === 'bus' ? 'Bus only' : 'Recommended',
    totalMinutes: minutes,
    walkMeters: walkTotal,
    transfers: Math.max(0, transitCount - 1),
    legs,
    warnings: [...warnings],
  };
}

function sources(net: Network): RouteResponse['meta'] {
  return {
    metro: net.sources.metro,
    bus: net.sources.bus,
    generatedAt: net.generatedAt,
    counts: net.meta,
  };
}

export function planRoute(origin: Place, destination: Place, mode: Mode): RouteResponse {
  const net = getNetwork();
  const meta = sources(net);
  const seen = new Set<string>();
  const candidates: Itinerary[] = [];

  const modes: Mode[] = mode === 'best' ? ['best', 'metro', 'bus'] : [mode];
  for (const current of modes) {
    const access = accessStops(origin, current);
    if (!access.length) continue;
    const search = runRaptor(net, access, current);
    const itinerary = buildFromSearch(net, search, origin, destination, current);
    if (!itinerary) continue;
    const key = signature(itinerary);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(itinerary);
  }

  candidates.sort((a, b) => a.totalMinutes - b.totalMinutes);
  const itineraries = candidates.slice(0, 3).map((itinerary, index) => {
    if (index === 0) return { ...itinerary, label: 'Recommended' as const };
    if (itinerary.label !== 'Recommended') return itinerary;
    const rides = itinerary.legs.filter((leg) => leg.type !== 'walk');
    const label = rides.every((leg) => leg.type === 'metro')
      ? ('Metro only' as const)
      : rides.every((leg) => leg.type === 'bus')
        ? ('Bus only' as const)
        : ('Alternative' as const);
    return { ...itinerary, label };
  });

  if (itineraries.length) {
    return { itineraries, meta };
  }

  const walk = offerWalk(origin, destination);
  if (walk) return { itineraries: [walk], meta };

  const near = nearbyStops(origin.location.lat, origin.location.lon, 2500);
  const outside = near.length === 0;
  return {
    itineraries: [],
    meta,
    notFound: {
      reason: outside
        ? 'No Namma Metro station or BMTC stop is within walking distance of the start point.'
        : 'No route was found between these points with the current mode.',
      suggestions: [
        'Try Bus mode if you are away from a metro line.',
        'Move the start or destination closer to a named stop.',
        'Check that both points are inside Bengaluru.',
      ],
    },
  };
}

export function clockFor(minutesFromNow: number): string {
  return istClock(nowIstSeconds() + Math.max(0, minutesFromNow) * 60);
}

export { WALK_COLOUR };
