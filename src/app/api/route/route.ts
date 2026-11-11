import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BLR_BBOX } from '@/lib/geo';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { planRoute } from '@/lib/routing';
import type { Place, RouteResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const placeSchema = z.object({
  id: z.string().max(200).optional(),
  name: z.string().min(1).max(160),
  subtitle: z.string().max(200).optional(),
  kind: z.enum(['metro_station', 'bus_stop', 'place', 'current_location', 'map_pin', 'stop']).optional(),
  location: z.object({
    lat: z.number().min(BLR_BBOX.minLat - 0.3).max(BLR_BBOX.maxLat + 0.3),
    lon: z.number().min(BLR_BBOX.minLon - 0.3).max(BLR_BBOX.maxLon + 0.3),
  }),
});

const requestSchema = z.object({
  from: placeSchema,
  to: placeSchema,
  mode: z.enum(['best', 'metro', 'bus']).default('best'),
});

const asPlace = (input: z.infer<typeof placeSchema>): Place => ({
  id: input.id ?? `${input.location.lat},${input.location.lon}`,
  name: input.name,
  subtitle: input.subtitle,
  kind: input.kind ?? 'place',
  location: input.location,
});

const CACHE_TTL = 60_000;
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; data: RouteResponse }>();

function cacheKey(from: Place, to: Place, mode: string): string {
  return [
    mode,
    from.location.lat.toFixed(5),
    from.location.lon.toFixed(5),
    from.name,
    to.location.lat.toFixed(5),
    to.location.lon.toFixed(5),
    to.name,
  ].join('|');
}

export async function POST(request: Request) {
  const limit = rateLimit(`route:${clientKey(request)}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many route requests. Wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter), 'Cache-Control': 'no-store' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the start and destination, then try again.' }, { status: 400 });
  }
  const { from, to, mode } = parsed.data;
  const origin = asPlace(from);
  const destination = asPlace(to);
  const distance =
    Math.abs(origin.location.lat - destination.location.lat) + Math.abs(origin.location.lon - destination.location.lon);
  if (distance < 0.0001) {
    return NextResponse.json(
      {
        itineraries: [],
        meta: null,
        notFound: { reason: 'The start and destination are the same point.', suggestions: ['Pick a different destination.'] },
      },
      { status: 200 },
    );
  }

  const key = cacheKey(origin, destination, mode);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'HIT' } });
  }

  const response = planRoute(origin, destination, mode);
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, { at: Date.now(), data: response });
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'MISS' } });
}
