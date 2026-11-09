export type LatLon = { lat: number; lon: number };

export type PlaceKind = 'metro_station' | 'bus_stop' | 'place' | 'current_location' | 'map_pin' | 'stop';

export type Place = {
  id: string;
  name: string;
  subtitle?: string;
  kind: PlaceKind;
  location: LatLon;
};

export type Mode = 'best' | 'metro' | 'bus';

export type DataSource = {
  name: string;
  url: string;
  licence: string;
  feedVersion: string;
  retrievedAt: string;
};

export type NetworkStop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  mode: 'metro' | 'bus';
};

export type NetworkPattern = {
  id: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  colour: string | null;
  textColour: string | null;
  headsign: string;
  stops: number[];
  offsets: number[];
  headwayMin: number | null;
  firstDeparture: string;
  lastDeparture: string;
  tripCount: number;
  shapeId: string | null;
  mode: 'metro' | 'bus';
};

export type Network = {
  generatedAt: string;
  sources: { metro: DataSource; bus: DataSource };
  stops: NetworkStop[];
  patterns: NetworkPattern[];
  shapes: Record<string, [number, number][]>;
  meta: {
    metro: { stops: number; patterns: number; tripsUsed: number; serviceDate: string };
    bus: { stops: number; patterns: number; tripsUsed: number; serviceDate: string };
  };
};

export type LineInfo = {
  name: string;
  routeNumber: string;
  colour: string;
  textColour: string;
  headsign: string;
  longName: string;
};

export type WalkLeg = {
  type: 'walk';
  from: Place;
  to: Place;
  meters: number;
  minutes: number;
  geometry: [number, number][];
  approximate: boolean;
};

export type TransitLeg = {
  type: 'metro' | 'bus';
  line: LineInfo;
  board: Place;
  alight: Place;
  stops: Place[];
  minutes: number;
  waitMinutes: number;
  waitKnown: boolean;
  geometry: [number, number][];
  approximateGeometry: boolean;
};

export type Leg = WalkLeg | TransitLeg;

export type Itinerary = {
  id: string;
  label: 'Recommended' | 'Fastest' | 'Metro only' | 'Bus only' | 'Walk only' | 'Alternative';
  totalMinutes: number;
  walkMeters: number;
  transfers: number;
  legs: Leg[];
  warnings: string[];
};

export type RouteResponse = {
  itineraries: Itinerary[];
  meta: {
    metro: DataSource;
    bus: DataSource;
    generatedAt: string;
    counts: Network['meta'];
  };
  notFound?: { reason: string; suggestions: string[] };
};

export type SuggestItem = Place & {
  mode?: 'metro' | 'bus';
  lines?: string[];
  matched?: string;
  distanceMeters?: number;
  source?: 'stop' | 'geocoder';
};

export type SuggestResponse = {
  items: SuggestItem[];
  geocoder: 'ok' | 'unavailable';
};

export type Bbox = { minLat: number; minLon: number; maxLat: number; maxLon: number };
