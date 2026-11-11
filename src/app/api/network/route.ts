import { NextResponse } from 'next/server';
import { getNetwork } from '@/lib/network';

export const runtime = 'nodejs';

/**
 * Returns metro line geometries for the background map overlay.
 *
 * We group shapes by route number and merge them into one entry per route so
 * the client can render each line in its correct colour without overlapping
 * duplicate segments. Each route's representative shape is the longest one
 * (most points), which typically covers the full end-to-end corridor.
 */
export async function GET() {
  const net = getNetwork();

  // Collect all shapes per route number, keeping the longest per unique shapeId
  const routeShapes = new Map<
    string,
    { name: string; colour: string; shapes: { id: string; coords: [number, number][] }[] }
  >();

  for (const pattern of net.patterns) {
    if (pattern.mode !== 'metro' || !pattern.shapeId) continue;
    const shape = net.shapes[pattern.shapeId];
    if (!shape?.length) continue;

    let entry = routeShapes.get(pattern.routeNumber);
    if (!entry) {
      entry = { name: pattern.routeName, colour: pattern.colour ?? '#8c2877', shapes: [] };
      routeShapes.set(pattern.routeNumber, entry);
    }
    // Only add each shapeId once per route
    if (!entry.shapes.some((s) => s.id === pattern.shapeId)) {
      entry.shapes.push({ id: pattern.shapeId!, coords: shape });
    }
  }

  // For each route, pick the single longest shape as the representative corridor
  const lines: { routeNumber: string; name: string; colour: string; coordinates: [number, number][] }[] = [];
  for (const [routeNumber, entry] of routeShapes) {
    // Sort descending by number of points; use the longest = most complete corridor
    entry.shapes.sort((a, b) => b.coords.length - a.coords.length);
    const best = entry.shapes[0];
    lines.push({
      routeNumber,
      name: entry.name,
      colour: entry.colour,
      coordinates: best.coords,
    });
  }

  // Sort for deterministic output: Green, Pink, Purple, Yellow
  lines.sort((a, b) => a.routeNumber.localeCompare(b.routeNumber));

  return NextResponse.json(
    { lines, v: net.generatedAt },
    { headers: { 'Cache-Control': 'no-cache' } },
  );
}
