# DATA_SOURCES.md — Real data only

## 1. The rule
Every fact shown in the app (station, line, line colour, bus stop, route number, headsign, stop order, coordinates, timings) must come from a **real, verifiable source** recorded in `DATA_LOG.md`. This file tells you where to look and how to prove it. It deliberately does **not** list facts like "the Yellow Line runs from X to Y" — line status and extensions change, and you must read them from current data.

If you cannot find or verify data: do not substitute. Mark the gap, tell the user in the UI where relevant, log it, and **ask the owner** (see `AGENTS.md` §4).

## 2. Discovery procedure (do this in Phase 1, using web search/fetch tools)
For **each** dataset below: find the current official/most authoritative source, read the licence/terms, download a sample, validate it, and record everything in `DATA_LOG.md` (URL, licence, retrieval date, feed version/date, counts, gaps).

### 2.1 Namma Metro (BMRCL)
Look, in this order, for:
1. A published **GTFS** feed for BMRCL/Namma Metro (check Bengaluru/Karnataka open-data portals, the BMRCL website, Open Transit Data / Mobility Database / Transitland feed registries, and reputable community GTFS repos). Prefer official; accept community feeds only if licence permits and cross-checks pass.
2. **OpenStreetMap** (via Overpass API or a Geofabrik/BBBike Bengaluru extract): `route=subway` / `route=light_rail` relations, `railway=station` + `station=subway` nodes, `colour` tags, `public_transport=stop_area`, `network`, `operator`, `ref`. OSM gives geometry, stop order, and often line colours.
3. The official **BMRCL website/map** for authoritative line names, colours, station lists, interchange stations, first/last train times and fare/timing pages — use as the cross-check even when you build from GTFS/OSM.
Required outputs: lines (name, colour hex, status open/under-construction), ordered stations per line & direction, station coordinates, interchange stations (stations shared by ≥2 lines), shapes/geometry, headways/first-last trains.
Only include **operational** sections in routing. Under-construction lines/stations may be shown only in a clearly marked "upcoming" layer **if** real data supports it and the owner approves — default: exclude.

### 2.2 BMTC buses
Look for:
1. A **GTFS** feed for BMTC (check Karnataka/Bengaluru open data portals, BMTC's own site/open-data pages, transit-feed registries, and community mirrors).
2. **OpenStreetMap** bus stops (`highway=bus_stop`, `public_transport=platform`) and `route=bus` relations in Bengaluru (coverage is partial — measure it).
3. Any official BMTC open API/timetable pages.
Required outputs: stops (id, name, lat/lon), routes (number/short name, headsign/direction), trips + stop_times (ordered stops), shapes if available, frequencies or timetables.
Measure and log **coverage**: number of stops, routes, % routes with shapes, % with timetables, date of the feed. If BMTC data is partial, outdated, or unlicensed → **STOP and ask the owner** with the options you found (e.g., ship Metro-first with Bus limited to verified routes; use OSM-only bus routes with a "may be incomplete" label; seek official data access).
Never infer a bus route's stop sequence from "common knowledge".

### 2.3 Geocoding / autocomplete
- **Photon** (Komoot, OSM-based, designed for search-as-you-type): `https://photon.komoot.io/api/?q=...&lat=...&lon=...&limit=...&lang=en` plus `/reverse`. Verify current usage terms and rate limits; add `bbox` for Bengaluru; cache. Consider self-hosting Photon or Pelias later if needed.
- **Do not use public Nominatim for autocomplete** (forbidden by its usage policy). Nominatim may be used for occasional reverse geocoding only if its policy allows (≤1 req/s, valid User-Agent) — prefer Photon reverse.
- Local **index of metro stations + bus stops** (from §2.1/2.2) must power instant suggestions even if the geocoder is down.

### 2.4 Basemap tiles
Choose a free basemap whose terms allow your traffic, with attribution: e.g., **OpenFreeMap** (free OSM vector tiles), **Protomaps** (self-hosted PMTiles of a Bengaluru extract — most robust and free), or MapTiler/Stadia free tiers (need a key → ask owner). **Do not use `tile.openstreetmap.org` raster tiles as the production basemap** (OSM tile usage policy). Record the choice in `DECISIONS.md`.

### 2.5 Walking geometry & distances
Options (verify limits): **OpenRouteService** free tier (needs a free API key → ask owner), **Valhalla/OSRM** self-hosted from the OSM extract, or a public instance only for development. Cache results. If unavailable, draw a dashed straight line labelled "approx." and compute distance with haversine × a documented detour factor; log this as a known limitation.

### 2.6 Real-time (optional, only if verified)
Only add live arrivals/vehicle positions if a free, licensed GTFS-Realtime (or equivalent) feed is found and works. Otherwise: scheduled data only, labelled "scheduled".

## 3. Verification (required before any dataset is used)
1. **Schema validation**: run a GTFS validator (e.g., MobilityData `gtfs-validator`) or equivalent; record errors/warnings.
2. **Cross-checks** (log evidence):
   - Metro: every line's station list and order vs. the official BMRCL page; interchange stations vs. official map; line colours vs. official branding; station coordinates plotted on the basemap and spot-checked against satellite/OSM.
   - Bus: sample ≥ 20 routes — compare stop sequences/headsigns with an independent source (BMTC site, OSM relation, on-street signage photos if provided by the owner).
3. **Geographic sanity**: all coordinates inside the Bengaluru bbox (or the metro/bus service area); no (0,0) points; distance between consecutive stops plausible.
4. **Duplicate/naming normalisation**: merge duplicate stops only by documented rules (same name + within X m); never rename stations away from the official name. Keep `name`, `name_kn` (if present in data) and `source_id`.
5. **Freshness**: store feed publish/retrieval dates; add a config threshold (e.g., warn if > 90 days old) and show "Data last updated" in the UI.
6. **Licence & attribution**: GTFS/OSM/Photon/basemap licences recorded; ODbL attribution "© OpenStreetMap contributors" displayed on the map; other attributions in the footer.

## 4. Normalised internal schema (build in `/scripts`, output to `/data/processed`)
```
stops:   id, name, lat, lon, mode('metro'|'bus'), source, parent_station?, lines?[]
routes:  id, short_name, long_name, mode, colour_hex?, text_colour_hex?, status
trips:   id, route_id, direction_id, headsign, service_id, shape_id?
stop_times: trip_id, stop_id, seq, arrival, departure   (or frequencies)
shapes:  id -> [[lon,lat],...]
transfers: from_stop, to_stop, min_walk_seconds, source('gtfs'|'computed')
meta:    dataset, source_url, licence, retrieved_at, feed_version, counts{}
```
Computed transfers (walking links between stops/stations ≤ ~400 m, interchanges, metro-bus links) must be flagged `source:'computed'` and use real walking distances where possible.

## 5. Refresh strategy
- A single command (`npm run data:refresh`) re-downloads, validates, rebuilds indexes, and prints a diff report (added/removed stops/routes). It must fail loudly on validation errors.
- Schedule/documentation for monthly refresh; never auto-deploy a refresh that fails validation.

## 6. What to do when data is missing
| Situation | Action |
|---|---|
| No metro GTFS | Build from OSM + official BMRCL cross-check; ask owner to confirm |
| No bus timetable | Show route/stop sequence only, no times; label "timings unavailable" |
| No bus shapes | Draw stop-to-stop lines, label "approximate path" |
| No platform/exit info | Do not show it |
| Line status unclear | Exclude from routing; ask owner |
| Licence unclear | Do not ship that dataset; ask owner |
