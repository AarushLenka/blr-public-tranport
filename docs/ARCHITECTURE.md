# ARCHITECTURE.md

## 1. Recommended stack (free, open-source)
| Concern | Choice | Notes |
|---|---|---|
| App framework | **Next.js (App Router) + TypeScript (strict)** | SSR shell, API routes, easy free hosting (Vercel/Cloudflare/Netlify). Ask owner before choosing host. |
| Styling | Per `design.md` (Tailwind or CSS variables/tokens, whichever design.md implies) | Tokens in one file; no hardcoded colours in components. |
| Motion | **Framer Motion** (UI) + MapLibre paint/line-dash animation (map) | GSAP optional for sequenced hero/route-draw effects. |
| Map | **MapLibre GL JS** | Free basemap per `DATA_SOURCES.md` §2.4. |
| Autocomplete | Local index (**MiniSearch** or Fuse.js) + **Photon** | Merge and rank client-side or in an API route with caching. |
| Routing engine | **Custom RAPTOR (or CSA) on GTFS-derived index**, in TypeScript | Runs server-side (API route/worker). Alternative: self-hosted **OpenTripPlanner 2** — more powerful, needs a JVM host; **ask owner** before choosing. |
| Walking legs | OpenRouteService free tier **or** Valhalla/OSRM self-hosted | Cache; graceful fallback. |
| Data pipeline | Node/TS (or Python) scripts in `/scripts` | Output compact JSON/binary indexes to `/data/processed`. |
| Tests | Vitest (unit), Playwright (e2e + visual) | |
| Lint/format | ESLint + Prettier, `tsc --noEmit` in CI | |

Record the final stack and any deviation in `DECISIONS.md`. If you pick OpenTripPlanner, document hosting and cost, and get owner approval first.

## 2. High-level flow
```
Browser
  ├─ Autocomplete: local index (stations/stops) + /api/geocode (Photon proxy, cached)
  ├─ Geolocation (user-initiated) → /api/reverse (Photon reverse)
  └─ Search → /api/route?from&to&mode&t
                 ├─ snap origin/destination to candidate access stops (walk radius, real walking times)
                 ├─ RAPTOR over metro+bus timetable index (+ transfers)
                 ├─ rank by generalised cost (PRD §6), return top K distinct itineraries
                 └─ enrich legs with geometry (shapes / walking router)
Map renders legs (colour-coded); timeline renders steps.
```
Why a proxy for geocoding: hides keys, enforces caching/rate-limits, lets you set a proper User-Agent, and swaps providers without UI changes.

## 3. Routing engine requirements
- Multimodal: walk ↔ bus ↔ metro with transfer penalties and minimum transfer times from data (`transfers`) or computed from real walking distance.
- Time-dependent if `stop_times` exist; otherwise frequency-based with expected wait = ½ headway. If neither exists for a route, use route-level typical headway **only if present in data**; otherwise treat wait as unknown and flag it in the response (`waitKnown:false`).
- Access/egress: consider several candidate stops within a radius (config, default ≈ 1.2 km for metro, ≈ 600 m for bus) — choose by total journey cost, not nearest-first.
- Return up to 3–4 distinct itineraries (de-duplicate by route-sequence). Label: `fastest`, `fewest_transfers`, `least_walking`.
- Modes: `best` (all), `metro` (metro+walk), `bus` (bus+walk).
- Performance: index preloaded in memory (server) or loaded in a Web Worker; target < 800 ms p95 per query after warm-up. Cache results by (from,to,mode,time-bucket).
- Deterministic + unit-tested with fixtures built from **real** extracts (small slice of the real feed), not invented graphs.

## 4. API contract (TypeScript types — treat as stable)
```ts
type LatLon = { lat: number; lon: number };

type Place = {
  id: string;                    // stable id (stop id, station id, or photon osm id)
  kind: 'metro_station' | 'bus_stop' | 'place' | 'current_location' | 'map_pin';
  name: string;
  subtitle?: string;             // locality / "Purple Line · Green Line"
  location: LatLon;
  lines?: { name: string; colour: string }[];   // for stations
  source: string;                // dataset key from DATA_LOG
};

type Mode = 'best' | 'metro' | 'bus';

type RouteRequest = { from: Place | LatLon; to: Place | LatLon; mode: Mode; departAt?: string /* ISO, default now IST */ };

type WalkLeg  = { type: 'walk';  from: string; to: string; meters: number; minutes: number; geometry: [number, number][]; approximate: boolean };
type MetroLeg = {
  type: 'metro';
  line: { id: string; name: string; colour: string; textColour?: string };
  board: Place; alight: Place;
  headsign: string;                 // direction / terminus from data
  stops: Place[];                   // ordered, inclusive of board+alight
  minutes: number;
  geometry: [number, number][];
  headwayMinutes?: number;          // only if in data
  firstTrain?: string; lastTrain?: string;   // only if in data
};
type BusLeg = {
  type: 'bus';
  route: { id: string; number: string; headsign: string };
  board: Place; alight: Place;
  stops: Place[]; minutes: number;
  geometry: [number, number][]; approximateGeometry: boolean;
  headwayMinutes?: number; nextDepartures?: string[];  // only if in data
};
type TransferNote = { at: string; walkMeters: number; minutes: number; kind: 'interchange' | 'stop_to_stop' };

type Itinerary = {
  id: string;
  label: 'fastest' | 'fewest_transfers' | 'least_walking' | 'recommended';
  totalMinutes: number; walkMeters: number; transfers: number;
  departAt: string; arriveAt: string;
  legs: (WalkLeg | MetroLeg | BusLeg)[];
  transferNotes: TransferNote[];
  warnings: string[];               // e.g., "Bus wait time unknown", "Approximate bus path"
};

type RouteResponse = {
  itineraries: Itinerary[];
  dataVersion: { metro: string; bus: string; retrievedAt: string };
  notFound?: { reason: string; suggestions: string[] };
};
```
Endpoints: `GET /api/suggest?q&lat&lon` · `GET /api/reverse?lat&lon` · `GET /api/route` (or `POST`) · `GET /api/meta` (data versions, attributions).
Validate all inputs (zod), cap lengths, rate-limit per IP, return typed errors.

## 5. Frontend structure
```
/src
  /app                    # routes, layouts, API routes
  /components
    /search               # LocationInput, SuggestionList, SwapButton, ModeSwitch
    /results              # SummaryCard, AlternativeCards, Timeline, LineChip, StepRow
    /map                  # MapView, layers (metro/bus/walk), markers, legend, camera controller
    /ui                   # primitives per design.md
  /lib
    /routing              # RAPTOR, scoring, itinerary builder
    /geo                  # haversine, bbox, polyline helpers
    /data                 # index loaders, search index
    /geocode              # photon client + cache
  /hooks                  # useGeolocation, useRoute, useDebounced
  /styles                 # tokens from design.md
  /i18n                   # string table
```
State: URL is the source of truth for from/to/mode/time; local UI state for panels; React Query/SWR for fetches with abort support.

## 6. Performance & resilience
- Preload fonts, lazy-load the map and heavy libs below the fold; code-split by route.
- Compress data indexes (gzip/brotli); ship only what the client needs; server-side routing keeps the client light.
- Cache geocoding (LRU in memory + HTTP cache headers); aggressive caching of static data with versioned file names.
- Timeouts, retries with backoff, circuit-break on provider failures; every failure maps to a designed UI state (FEATURES F8).
- Service worker (optional) for offline shell and cached recent routes; do not cache stale transit data silently — show data date.

## 7. Environment variables (`.env.example` must list all)
```
NEXT_PUBLIC_MAP_STYLE_URL=        # basemap style (see DATA_SOURCES 2.4)
ORS_API_KEY=                      # OpenRouteService (if chosen) — ask owner to create
PHOTON_BASE_URL=https://photon.komoot.io
APP_CONTACT_EMAIL=                # for User-Agent on geocoder requests — ask owner
DATA_STALE_DAYS=90
```
If any key is needed, **stop and ask the owner** with exact steps (where to sign up, which free tier, which variable).

## 8. Security & privacy
No secrets in client bundles (only `NEXT_PUBLIC_` values that are safe). Sanitise/validate everything; CSP headers; no coordinate logging; footer states what location data is sent to third parties (Photon, walking router).

## 9. Deployment
Propose 2 free options with trade-offs (e.g., Vercel/Netlify/Cloudflare Pages for the app; routing as a serverless function **if** memory/time limits allow, else a small free-tier container). **Ask the owner** before deploying anywhere or buying a domain.
