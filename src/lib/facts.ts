import { getNetwork, searchStops } from './network';
import { planRoute } from './routing';
import type { DataSource, Itinerary, Place, SuggestItem, TransitLeg } from './types';

/*
  Everything the marketing surfaces say about the network is read from the processed
  GTFS index here. Nothing is typed in by hand, so the page cannot drift from the data.
*/

export type MetroLine = { id: string; name: string; colour: string };

export type NetworkFacts = {
  lines: MetroLine[];
  metroStations: number;
  busStops: number;
  sources: { metro: DataSource; bus: DataSource };
  generatedAt: string;
};

export type ExamplePlan = {
  from: string;
  to: string;
  href: string;
  minutes: number;
  transfers: number;
  rides: { name: string; colour: string; textColour: string; stops: number; mode: 'metro' | 'bus' }[];
};

export function networkFacts(): NetworkFacts {
  const net = getNetwork();
  const lines = new Map<string, MetroLine>();
  for (const pattern of net.patterns) {
    if (pattern.mode !== 'metro' || lines.has(pattern.routeId) || !pattern.colour) continue;
    lines.set(pattern.routeId, { id: pattern.routeId, name: pattern.routeNumber, colour: pattern.colour });
  }
  return {
    lines: [...lines.values()].sort((a, b) => a.name.localeCompare(b.name)),
    metroStations: net.meta.metro.stops,
    busStops: net.meta.bus.stops,
    sources: net.sources,
    generatedAt: net.generatedAt,
  };
}

function asPlace(item: SuggestItem): Place {
  return { id: item.id, name: item.name, subtitle: item.subtitle, kind: item.kind, location: item.location };
}

function metroStation(query: string): Place | null {
  const hit = searchStops(query).find((item) => item.mode === 'metro');
  return hit ? asPlace(hit) : null;
}

/* One real metro plan for the landing page. Returns null rather than inventing one. */
export function examplePlan(fromQuery = 'Indiranagar', toQuery = 'Majestic'): ExamplePlan | null {
  try {
    const from = metroStation(fromQuery);
    const to = metroStation(toQuery);
    if (!from || !to) return null;
    const itinerary: Itinerary | undefined = planRoute(from, to, 'metro').itineraries[0];
    if (!itinerary) return null;
    const rides = itinerary.legs
      .filter((leg): leg is TransitLeg => leg.type !== 'walk')
      .map((leg) => ({
        name: leg.line.name,
        colour: leg.line.colour,
        textColour: leg.line.textColour,
        stops: leg.stops.length - 1,
        mode: leg.type,
      }));
    if (!rides.length) return null;
    const params = new URLSearchParams({
      from: `${from.location.lat.toFixed(5)},${from.location.lon.toFixed(5)}`,
      to: `${to.location.lat.toFixed(5)},${to.location.lon.toFixed(5)}`,
      fn: from.name,
      tn: to.name,
      mode: 'metro',
    });
    return {
      from: from.name,
      to: to.name,
      href: `/plan?${params.toString()}`,
      minutes: itinerary.totalMinutes,
      transfers: itinerary.transfers,
      rides,
    };
  } catch {
    return null;
  }
}
