/**
 * Builds the routing/search index from the downloaded GTFS feeds.
 *
 * Input  (data/raw): bmrcl/{stops,routes,trips,stop_times,shapes,calendar}.txt
 *                    bmtc/{stops,routes,trips,stop_times,calendar}.txt
 * Output (data/processed/network.json)
 *
 * The feeds are community GTFS published under ODbL; see docs/DATA_LOG.md.
 * Run: npm run data:build
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse';

const ROOT = new URL('../', import.meta.url);
const RAW = new URL('data/raw/', ROOT);
const OUT = new URL('data/processed/', ROOT);

// A representative weekday (the feeds' calendars cover this date).
const SERVICE_DATE = '20261113';

const csv = (path) =>
  createReadStream(new URL(path, RAW)).pipe(parse({ columns: true, bom: true, skip_empty_lines: true, relax_quotes: true }));

const seconds = (hhmmss) => {
  const [h, m, s] = hhmmss.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

const hhmm = (sec) => {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const round = (n, p = 5) => Number(n.toFixed(p));

async function activeServices(dir) {
  const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    new Date(`${SERVICE_DATE.slice(0, 4)}-${SERVICE_DATE.slice(4, 6)}-${SERVICE_DATE.slice(6)}T12:00:00Z`).getUTCDay()
  ];
  const active = new Set();
  for await (const row of csv(`${dir}/calendar.txt`)) {
    if (row[dow] === '1' && row.start_date <= SERVICE_DATE && row.end_date >= SERVICE_DATE) {
      active.add(row.service_id);
    }
  }
  try {
    const rows = await readFile(new URL(`${dir}/calendar_dates.txt`, RAW));
    const lines = rows.toString().trim().split(/\r?\n/).slice(1);
    for (const line of lines) {
      const [service_id, date, type] = line.split(',');
      if (date !== SERVICE_DATE) continue;
      if (type?.trim() === '1') active.add(service_id);
      if (type?.trim() === '2') active.delete(service_id);
    }
  } catch {
    // calendar_dates.txt is optional
  }
  return active;
}

async function buildAgency({ dir, label }) {
  const services = await activeServices(dir);

  const routes = new Map();
  for await (const r of csv(`${dir}/routes.txt`)) {
    routes.set(r.route_id, {
      id: r.route_id,
      number: (r.route_short_name || r.route_id).trim(),
      longName: (r.route_long_name || '').trim(),
      colour: r.route_color ? `#${r.route_color.replace('#', '')}` : null,
      textColour: r.route_text_color ? `#${r.route_text_color.replace('#', '')}` : null,
    });
  }

  // Metro platform stops are collapsed onto their parent station.
  const stops = [];
  const byId = new Map();
  const parentOf = new Map();
  const platformCoords = new Map();
  for await (const s of csv(`${dir}/stops.txt`)) {
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    parentOf.set(s.stop_id, s.parent_station || null);
    if (s.location_type === '2') continue; // entrances / exits
    if (s.location_type === '1') {
      byId.set(s.stop_id, stops.length);
      stops.push({ id: s.stop_id, name: (s.stop_name || '').trim(), lat: round(lat), lon: round(lon), mode: label });
    } else if (s.parent_station) {
      platformCoords.set(s.stop_id, { lat, lon });
    } else {
      // Bus stops and any station-level stop without a parent.
      byId.set(s.stop_id, stops.length);
      stops.push({ id: s.stop_id, name: (s.stop_name || '').trim(), lat: round(lat), lon: round(lon), mode: label });
    }
  }

  const resolveStop = (stopId) => {
    if (byId.has(stopId)) return stopId;
    const parent = parentOf.get(stopId);
    if (parent && byId.has(parent)) return parent;
    // Platform whose parent is itself a platform-level id: use the platform coordinates.
    const p = platformCoords.get(stopId);
    if (!p) return null;
    const id = `${label}_${stopId}`;
    byId.set(stopId, stops.length);
    stops.push({ id, name: stopId, lat: round(p.lat), lon: round(p.lon), mode: label });
    return id;
  };

  const tripInfo = new Map();
  for await (const t of csv(`${dir}/trips.txt`)) {
    if (!services.has(t.service_id)) continue;
    if (!routes.has(t.route_id)) continue;
    tripInfo.set(t.trip_id, {
      routeId: t.route_id,
      headsign: (t.trip_headsign || '').trim(),
      direction: t.direction_id || '0',
      shapeId: t.shape_id || null,
    });
  }

  const patterns = new Map();
  let currentTrip = null;
  let rows = 0;
  let droppedMissingStop = 0;

  const finalize = () => {
    if (!currentTrip || currentTrip.stops.length < 2) return;
    rows++;
    const seq = currentTrip.stops;
    const key = createHash('sha1')
      .update(`${currentTrip.routeId}|${currentTrip.direction}|${seq.join(',')}`)
      .digest('base64url');
    let pattern = patterns.get(key);
    if (!pattern) {
      pattern = {
        key,
        routeId: currentTrip.routeId,
        headsign: currentTrip.headsign,
        direction: currentTrip.direction,
        shapeId: currentTrip.shapeId,
        stops: seq,
        offsets: currentTrip.offsets.map((o) => o - currentTrip.offsets[0]),
        departures: [],
      };
      patterns.set(key, pattern);
    }
    pattern.departures.push(currentTrip.depart);
  };

  for await (const st of csv(`${dir}/stop_times.txt`)) {
    const info = tripInfo.get(st.trip_id);
    if (!info) continue;
    if (currentTrip && currentTrip.tripId !== st.trip_id) {
      finalize();
      currentTrip = null;
    }
    if (!currentTrip) {
      currentTrip = {
        tripId: st.trip_id,
        routeId: info.routeId,
        headsign: info.headsign,
        direction: info.direction,
        shapeId: info.shapeId,
        stops: [],
        offsets: [],
        depart: 0,
      };
    }
    const resolved = resolveStop(st.stop_id);
    if (!resolved) {
      droppedMissingStop++;
      continue;
    }
    const idx = byId.get(resolved);
    currentTrip.stops.push(idx);
    const t = seconds(st.departure_time || st.arrival_time);
    currentTrip.offsets.push(t);
    if (currentTrip.stops.length === 1) currentTrip.depart = t;
  }
  finalize();

  // Drop duplicate consecutive stops (common in feeds) and de-duplicate patterns.
  const unique = new Map();
  for (const p of patterns.values()) {
    if (p.stops.length < 2) continue;
    const dedup = [0];
    for (let i = 1; i < p.stops.length; i++) if (p.stops[i] !== p.stops[dedup.at(-1)]) dedup.push(i);
    if (dedup.length < 2) continue;
    p.stops = dedup.map((i) => p.stops[i]);
    p.offsets = dedup.map((i) => p.offsets[i]);
    const k = `${p.routeId}|${p.direction}|${p.stops.join(',')}`;
    const existing = unique.get(k);
    if (!existing) unique.set(k, p);
    else existing.departures.push(...p.departures);
  }

  const out = [];
  for (const p of unique.values()) {
    const route = routes.get(p.routeId);
    if (!route) continue;
    p.departures.sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < p.departures.length; i++) {
      const gap = (p.departures[i] - p.departures[i - 1]) / 60;
      if (gap >= 1) gaps.push(gap);
    }
    let headway;
    if (gaps.length >= 2) {
      gaps.sort((a, b) => a - b);
      headway = Math.round(gaps[Math.floor(gaps.length / 2)]);
    }
    out.push({
      id: p.key,
      routeId: route.id,
      routeNumber: route.number,
      routeName: route.longName,
      colour: route.colour,
      textColour: route.textColour,
      headsign: p.headsign || (route.longName.split('⇔').pop() || '').trim(),
      stops: p.stops,
      offsets: p.offsets,
      headwayMin: headway ?? null,
      firstDeparture: hhmm(p.departures[0]),
      lastDeparture: hhmm(p.departures.at(-1)),
      tripCount: p.departures.length,
      shapeId: p.shapeId,
      mode: label,
    });
  }

  return {
    label,
    stops,
    patterns: out,
    routeCount: routes.size,
    meta: {
      serviceDate: SERVICE_DATE,
      activeServices: services.size,
      tripsUsed: tripInfo.size,
      tripsWithSequence: rows,
      patterns: out.length,
      stops: stops.length,
      droppedMissingStop,
    },
  };
}

async function metroShapes() {
  const shapes = new Map();
  for await (const p of csv('bmrcl/shapes.txt')) {
    let arr = shapes.get(p.shape_id);
    if (!arr) shapes.set(p.shape_id, (arr = []));
    arr.push([round(Number(p.shape_pt_lon)), round(Number(p.shape_pt_lat))]);
  }
  return Object.fromEntries(shapes);
}

const metro = await buildAgency({ dir: 'bmrcl', label: 'metro' });
const bus = await buildAgency({ dir: 'bmtc', label: 'bus' });
const shapes = await metroShapes();

// Pattern stop indexes are agency-local; shift bus indexes into the combined stop list.
const busOffset = metro.stops.length;
for (const p of bus.patterns) p.stops = p.stops.map((i) => i + busOffset);

// Keep only shapes that a metro pattern actually references.
const usedShapes = new Set(metro.patterns.map((p) => p.shapeId).filter(Boolean));
const metroShapesUsed = Object.fromEntries(Object.entries(shapes).filter(([id]) => usedShapes.has(id)));

const network = {
  generatedAt: new Date().toISOString(),
  sources: {
    metro: {
      name: 'BMRCL Namma Metro (unofficial GTFS)',
      url: 'https://github.com/Vonter/bmrcl-gtfs',
      licence: 'ODbL-1.0',
      feedVersion: '20260817',
      retrievedAt: '2026-11-13',
    },
    bus: {
      name: 'BMTC Bengaluru (unofficial GTFS)',
      url: 'https://github.com/Vonter/bmtc-gtfs',
      licence: 'ODbL-1.0',
      feedVersion: '20261109',
      retrievedAt: '2026-11-13',
    },
  },
  stops: [...metro.stops, ...bus.stops],
  patterns: [...metro.patterns, ...bus.patterns],
  shapes: metroShapesUsed,
  meta: { metro: metro.meta, bus: bus.meta },
};

await mkdir(OUT, { recursive: true });
await writeFile(new URL('network.json', OUT), JSON.stringify(network));
await writeFile(new URL('meta.json', OUT), JSON.stringify(network.meta, null, 2));

console.log('metro', metro.meta);
console.log('bus', bus.meta);
console.log('metro patterns', metro.patterns.length, 'bus patterns', bus.patterns.length);
console.log('total stops', network.stops.length, 'shapes', Object.keys(metroShapesUsed).length);
