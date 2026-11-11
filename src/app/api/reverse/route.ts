import { NextResponse } from 'next/server';
import { nearbyStops } from '@/lib/network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHOTON_BASE = process.env.PHOTON_BASE_URL || 'https://photon.komoot.io';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'Coordinates required.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${PHOTON_BASE}/reverse?lat=${lat}&lon=${lon}&lang=en`, {
      signal: AbortSignal.timeout(1600),
      headers: { 'User-Agent': 'blr-transit-planner (open data demo)' },
    });
    if (!response.ok) throw new Error(`Photon ${response.status}`);
    const data = (await response.json()) as {
      features?: { properties?: { name?: string; street?: string; district?: string; locality?: string } }[];
    };
    const props = data.features?.[0]?.properties;
    const label = [props?.name, props?.street, props?.district, props?.locality].filter(Boolean).join(', ');
    if (label) return NextResponse.json({ label, source: 'photon' });
  } catch {
    // Fall through to the local stop name.
  }

  const nearest = nearbyStops(lat, lon, 250)[0];
  if (nearest) return NextResponse.json({ label: `Near ${nearest.stop.name}`, source: 'stops' });
  return NextResponse.json({ label: null, source: 'none' });
}
