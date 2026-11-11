import { NextResponse } from 'next/server';
import { BLR_BBOX, haversine } from '@/lib/geo';
import { normalizeName, searchStops } from '@/lib/network';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import type { SuggestItem, SuggestResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NOMINATIM_BASE = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const PHOTON_BASE = process.env.PHOTON_BASE_URL || 'https://photon.komoot.io';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; items: SuggestItem[] }>();
let geocoderDownUntil = 0;

// Nominatim result type
type NominatimResult = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  class?: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    state_district?: string;
    state?: string;
    country?: string;
  };
  importance?: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    locality?: string;
    countrycode?: string;
  };
};

const prettyType: Record<string, string> = {
  cafe: 'Cafe',
  restaurant: 'Restaurant',
  fast_food: 'Restaurant',
  food_court: 'Food court',
  hospital: 'Hospital',
  clinic: 'Clinic',
  pharmacy: 'Pharmacy',
  school: 'School',
  college: 'College',
  university: 'University',
  mall: 'Mall',
  marketplace: 'Market',
  supermarket: 'Supermarket',
  hotel: 'Hotel',
  bus_station: 'Bus station',
  railway: 'Railway station',
  subway_entrance: 'Metro entrance',
  park: 'Park',
  garden: 'Park',
  temple: 'Temple',
  mosque: 'Mosque',
  church: 'Church',
  place_of_worship: 'Place of worship',
  neighbourhood: 'Neighbourhood',
  suburb: 'Area',
  residential: 'Area',
  office: 'Office',
  shop: 'Shop',
  cinema: 'Cinema',
  theatre: 'Theatre',
  stadium: 'Stadium',
  gym: 'Gym',
  bank: 'Bank',
  atm: 'ATM',
  fuel: 'Petrol station',
  post_office: 'Post office',
  library: 'Library',
};

/** Build a clean subtitle for a Nominatim result. */
function subtitleFromNominatim(result: NominatimResult): string {
  const type = result.type ? prettyType[result.type] : undefined;
  const addr = result.address ?? {};
  const parts: string[] = [];
  if (type) parts.push(type);
  const area = addr.suburb || addr.neighbourhood || addr.city_district;
  if (area) parts.push(area);
  if (!parts.length) {
    // Fall back to the first meaningful piece of display_name after the name itself
    const display = result.display_name ?? '';
    const after = display.includes(',') ? display.substring(display.indexOf(',') + 1).trim() : '';
    const chunk = after.split(',')[0]?.trim();
    if (chunk && chunk !== 'Bengaluru' && chunk !== 'Karnataka') parts.push(chunk);
  }
  if (!parts.length) parts.push('Place');
  return parts.join(' · ');
}

function placeFromNominatim(result: NominatimResult, bias?: { lat: number; lon: number }): SuggestItem | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < BLR_BBOX.minLat || lat > BLR_BBOX.maxLat || lon < BLR_BBOX.minLon || lon > BLR_BBOX.maxLon) return null;

  // Prefer the name field; fall back to the first segment of display_name
  const name =
    result.name ||
    (result.display_name ? result.display_name.split(',')[0].trim() : null);
  if (!name) return null;

  const subtitle = subtitleFromNominatim(result);
  const distance = bias ? haversine(bias, { lat, lon }) : null;
  return {
    id: `nominatim:${result.osm_type ?? 'place'}:${result.osm_id ?? result.place_id ?? `${lat},${lon}`}`,
    name,
    subtitle,
    kind: 'place',
    source: 'geocoder',
    distanceMeters: distance === null ? undefined : Math.round(distance),
    location: { lat, lon },
  };
}

function placeFromPhoton(feature: PhotonFeature, bias?: { lat: number; lon: number }): SuggestItem | null {
  const coords = feature.geometry?.coordinates;
  const props = feature.properties;
  if (!coords || !props) return null;
  const [lon, lat] = coords;
  if (lat < BLR_BBOX.minLat || lat > BLR_BBOX.maxLat || lon < BLR_BBOX.minLon || lon > BLR_BBOX.maxLon) return null;
  const name = props.name || props.street;
  if (!name) return null;
  const parts = [props.street, props.district, props.locality, props.city]
    .filter((part): part is string => Boolean(part) && normalizeName(part as string) !== normalizeName(name))
    .filter((part, index, all) => all.findIndex((item) => normalizeName(item) === normalizeName(part)) === index);
  const type = props.osm_value ? prettyType[props.osm_value] : undefined;
  const subtitle = [type, ...parts].filter(Boolean).join(' · ') || 'Place';
  const distance = bias ? haversine(bias, { lat, lon }) : null;
  return {
    id: `photon:${props.osm_type ?? 'place'}:${props.osm_id ?? `${lat},${lon}`}`,
    name,
    subtitle,
    kind: 'place',
    source: 'geocoder',
    distanceMeters: distance === null ? undefined : Math.round(distance),
    location: { lat, lon },
  };
}

/** Primary geocoder: Nominatim — much better Indian place/locality coverage. */
async function nominatimPlaces(
  query: string,
  bias?: { lat: number; lon: number },
): Promise<{ items: SuggestItem[]; ok: boolean }> {
  if (Date.now() < geocoderDownUntil) return { items: [], ok: false };
  const key = `nom:${query}|${bias ? `${bias.lat.toFixed(3)},${bias.lon.toFixed(3)}` : 'blr'}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return { items: cached.items, ok: true };

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '10',
    addressdetails: '1',
    // Restrict to Bangalore's bounding box
    viewbox: `${BLR_BBOX.minLon},${BLR_BBOX.maxLat},${BLR_BBOX.maxLon},${BLR_BBOX.minLat}`,
    bounded: '1',
    countrycodes: 'in',
  });
  if (bias) {
    // lat/lon hint for ordering (not supported as a query param but we sort ourselves)
    params.set('lat', String(bias.lat));
    params.set('lon', String(bias.lon));
  }

  try {
    const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
      signal: AbortSignal.timeout(2000),
      headers: {
        'User-Agent': 'blr-transit-planner (open data demo; contact: opensource@example.com)',
        'Accept-Language': 'en',
      },
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const data = (await response.json()) as NominatimResult[];
    const items = data
      .map((result) => placeFromNominatim(result, bias))
      .filter((item): item is SuggestItem => item !== null);

    // Sort by distance when a bias is available; otherwise keep Nominatim's importance ordering
    if (bias) {
      items.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    }

    if (cache.size > 400) cache.clear();
    cache.set(key, { at: Date.now(), items });
    return { items, ok: true };
  } catch {
    // Don't mark whole geocoder down on first Nominatim failure — try Photon below
    return { items: [], ok: false };
  }
}

/** Fallback geocoder: Photon (komoot). Used when Nominatim returns nothing or fails. */
async function photonPlaces(
  query: string,
  bias?: { lat: number; lon: number },
): Promise<{ items: SuggestItem[]; ok: boolean }> {
  if (Date.now() < geocoderDownUntil) return { items: [], ok: false };
  const key = `pho:${query}|${bias ? `${bias.lat.toFixed(3)},${bias.lon.toFixed(3)}` : 'blr'}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return { items: cached.items, ok: true };

  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lang: 'en',
    bbox: `${BLR_BBOX.minLon},${BLR_BBOX.minLat},${BLR_BBOX.maxLon},${BLR_BBOX.maxLat}`,
  });
  if (bias) {
    params.set('lat', String(bias.lat));
    params.set('lon', String(bias.lon));
    params.set('zoom', '13');
  }

  try {
    const response = await fetch(`${PHOTON_BASE}/api/?${params.toString()}`, {
      signal: AbortSignal.timeout(1400),
      headers: { 'User-Agent': 'blr-transit-planner (open data demo)' },
    });
    if (!response.ok) throw new Error(`Photon ${response.status}`);
    const data = (await response.json()) as { features?: PhotonFeature[] };
    const items = (data.features ?? [])
      .map((feature) => placeFromPhoton(feature, bias))
      .filter((item): item is SuggestItem => item !== null);
    if (cache.size > 400) cache.clear();
    cache.set(key, { at: Date.now(), items });
    return { items, ok: true };
  } catch {
    geocoderDownUntil = Date.now() + 60_000;
    return { items: [], ok: false };
  }
}

function samePlace(a: SuggestItem, b: SuggestItem): boolean {
  const sameName = normalizeName(a.name) === normalizeName(b.name);
  const close = Math.abs(a.location.lat - b.location.lat) < 0.002 && Math.abs(a.location.lon - b.location.lon) < 0.002;
  return sameName && close;
}

export async function GET(request: Request) {
  const limit = rateLimit(`suggest:${clientKey(request)}`, 240, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { items: [], geocoder: 'unavailable' } satisfies SuggestResponse,
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter), 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  const latParam = url.searchParams.get('lat');
  const lonParam = url.searchParams.get('lon');
  const rawLat = latParam === null ? Number.NaN : Number(latParam);
  const rawLon = lonParam === null ? Number.NaN : Number(lonParam);
  const bias =
    latParam !== null && lonParam !== null && Number.isFinite(rawLat) && Number.isFinite(rawLon)
      ? { lat: rawLat, lon: rawLon }
      : undefined;
  if (query.length < 2) {
    return NextResponse.json({ items: [], geocoder: 'ok' } satisfies SuggestResponse);
  }

  const locals = searchStops(query, bias?.lat, bias?.lon, 8);

  // Run Nominatim and Photon concurrently; merge results preferring Nominatim
  const [nominatim, photon] = await Promise.all([
    nominatimPlaces(query, bias),
    photonPlaces(query, bias),
  ]);

  const geocoderOk = nominatim.ok || photon.ok;
  const items: SuggestItem[] = [...locals];

  // Merge geocoder results: Nominatim first (better Indian coverage), then Photon for anything it missed
  const geocoderItems: SuggestItem[] = [...nominatim.items];
  for (const place of photon.items) {
    if (!geocoderItems.some((item) => samePlace(item, place))) {
      geocoderItems.push(place);
    }
  }

  for (const place of geocoderItems) {
    if (items.length >= 12) break;
    if (!items.some((item) => samePlace(item, place))) items.push(place);
  }

  return NextResponse.json(
    { items, geocoder: geocoderOk ? 'ok' : 'unavailable' } satisfies SuggestResponse,
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
