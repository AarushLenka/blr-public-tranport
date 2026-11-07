# FEATURES.md — Exact behaviour

Every feature lists **Behaviour**, **Data**, and **Edge cases**. Visual styling comes from `design.md` + `UI_UX.md`.

---
## F1. Location inputs with autocomplete
**Behaviour**
- Two fields: **From** and **To**, plus a swap button (animated rotate + field cross-fade).
- Suggestions appear after 2 characters, debounced ~250 ms, cancel in-flight requests when the query changes.
- Suggestion list merges, de-duplicates and ranks:
  1. **Metro stations** (local index, instant)
  2. **BMTC bus stops** (local index, instant)
  3. **Places / landmarks / addresses** from a free geocoder (Photon by Komoot, biased to the Bengaluru bounding box; see `DATA_SOURCES.md`)
  4. Recent searches (localStorage, max 5)
- Each suggestion shows: icon by type (metro / bus / place), primary name, secondary line (area/locality or line colour dot(s) for stations).
- Keyboard: ↑/↓ to move, Enter to select, Esc to close; full ARIA combobox pattern. Touch targets ≥ 44 px.
- Highlight the matched substring. Fuzzy and typo-tolerant for local indexes (MiniSearch/Fuse); handle common aliases ("Majestic" ↔ official station name, "KR Puram", "Kempegowda", "Whitefield") **only if the alias exists in real data/OSM `alt_name`/`name:en` tags** — do not hand-invent aliases.
- Bias results toward Bengaluru bbox (approx. lat 12.70–13.30, lon 77.30–77.90; confirm and store in config). Results outside Bengaluru are filtered out.
- A "Pick on map" option lets the user tap the map to set a point (reverse-geocoded to a label).
**Edge cases**: empty query shows recents + "Use current location" (for From); no results shows a helpful empty state; geocoder down → local stations/stops still work and a subtle notice appears.

## F2. Current location default (From)
**Behaviour**
- On first load, show a friendly in-app pre-prompt ("Allow location so we can start from where you are") **before** triggering the browser permission dialog. Only call `navigator.geolocation` after the user taps Allow/Continue.
- On success: From = "Current location" with a live pulsing dot; reverse-geocode (Photon reverse) for a readable sub-label (e.g., locality). Keep raw lat/lon for routing.
- Accuracy handling: if accuracy > 500 m, show "approximate location" hint and allow the user to refine.
- If the user is **outside Bengaluru** (outside bbox): say so politely, don't route from there, leave From empty.
- On deny/unavailable/timeout: From stays empty, with an inline, non-blocking message and a "Use my location" retry button. Never re-prompt in a loop.
- HTTPS is required for geolocation; ensure dev and prod use secure contexts (localhost is fine).
- Don't store location server-side. Don't log coordinates.

## F3. Mode selector
Segmented control: **Best · Metro · Bus**. Switching animates the result panel (shared-layout transition) and re-colours the map route. "Best" may combine bus + metro with walking links. "Metro" = metro + walking only. "Bus" = bus + walking only.

## F4. Metro result (must show all of this)
For the chosen itinerary, a vertical step timeline:
1. **Walk** to the nearest/boarding station: name, distance, minutes. (Station choice comes from the routing engine, not simply "nearest by straight line".)
2. **Board** at `<Station>` on the **`<Colour> Line`** towards `<terminus / direction>` (colour chip + line name).
3. **Ride** N stops (expandable list of intermediate stations).
4. **Change** at `<Interchange station>` to the **`<Colour> Line`** towards `<terminus>` (platform/level info **only if present in real data**).
5. **Ride** N stops.
6. **Get off** at `<Station>` (+ suggested exit/gate **only if present in real data**).
7. **Walk** to destination: distance, minutes.
Also show: total time, total stops, number of changes, first/last train times and headway if available in real data (clearly labelled "scheduled").
Line names/colours must be **derived from the dataset** (GTFS `route_color` / OSM `colour`) and cross-checked against the official BMRCL source. Never hardcode a list of lines from memory; line openings and extensions change. See `DATA_SOURCES.md` §Verification.

## F5. Bus result (must show all of this)
Step timeline:
1. **Walk** to boarding bus stop: stop name, distance, minutes.
2. **Board** bus `<Route number>` at `<Stop name>` towards `<destination/headsign>`.
3. **Ride** N stops (expandable list).
4. **Get off / switch** at `<Stop>`; if switching: **Board** `<Route number>` at the same/nearby stop (state walking distance between stops if different).
5. **Get off** at `<Stop>`.
6. **Walk** to destination.
Show: total time, transfers, approx. wait (from scheduled headway if known, else "frequency unknown" — never invent), and a note that stand/bay numbers are shown only if the dataset has them.
Bus number chips use a consistent bus colour (see `UI_UX.md`); BMTC route numbers keep their exact real format (e.g., letters/suffixes preserved).

## F6. Map
- Library: MapLibre GL JS with a free vector/raster basemap (see `ARCHITECTURE.md`). Light/dark basemap follows `design.md` theme.
- Layers:
  - **Metro legs**: polyline in the line's real colour, drawn along real track geometry (from GTFS shapes or OSM route relations; if only stop-to-stop straight segments exist, say so in `DATA_LOG.md` and draw them honestly).
  - **Bus legs**: bus colour, along GTFS shape or OSM route geometry; fall back to stop-to-stop lines only if no shape exists.
  - **Walking legs**: dashed neutral line along real footpaths (walking router) or straight dashed line with "approx." if routing unavailable.
  - **Markers**: start, destination, boarding, interchange (distinct), alighting. Metro markers use the line colour; label with station/stop name.
  - Optionally render all metro lines faintly as context (toggle), each in its real colour.
- Animation: route draws progressively (line-dash/`line-gradient` animation) after results arrive; camera `fitBounds` with padding that accounts for the bottom sheet (mobile) or side panel (desktop).
- Interaction: tapping a timeline step flies the camera to that leg and highlights it; tapping a marker highlights its step.
- Legend (collapsible) lists the lines/modes visible on the current route.

## F7. Result presentation & alternatives
- Top summary card: total time, arrival time (if "depart now" assumed), changes, walking distance, mode icons strip in line colours (e.g., [walk] → [purple chip] → [green chip] → [walk]).
- Alternatives as horizontally scrollable cards (Fastest / Fewest transfers / Least walking). Selecting one updates timeline + map.
- Each timeline row is progressive-disclosure: collapsed headline, expand for intermediate stops.
- Departure time: default "Now" (Asia/Kolkata); optional "Leave at" picker. Timetable-based results use that time.

## F8. States
Initial · Locating · Searching suggestions · Calculating route (skeletons, not spinners only) · Results · No route found (explain why and suggest alternatives, e.g., try Bus mode or a nearer point) · Offline · Geocoder error · Data stale (warn if data older than the threshold in config).

## F9. Sharing & URLs
URL encodes from, to, mode, time: `/route?from=<lat,lon|id>&to=<lat,lon|id>&mode=best&t=...`. Loading such a URL runs the search directly. "Copy link" button with animated confirmation. Use `navigator.share` on mobile when available. Update the URL without full reload; support back/forward.

## F10. Accessibility & i18n
- WCAG 2.2 AA; never rely on colour alone (line chips always carry the line name text). Visible focus; screen-reader-friendly timeline (ordered list with clear step text); `prefers-reduced-motion` honoured (see `UI_UX.md`).
- Build with i18n in mind (string table). v1 ships English; Kannada is a stretch goal that must use real, reviewed translations — ask the owner before adding.

## F12. Responsive shell and theme switch
**Behaviour**
- One responsive shell, not two products: below 1024 px a full-screen map with a floating search card and a draggable bottom-sheet for results; at 1024 px and above a 440 px scrollable panel beside a full-height map. All features exist at both sizes.
- Header control **Light / Dark**. Default from `prefers-color-scheme`, explicit choice persisted in `localStorage`, applied before first paint. The map basemap switches with the theme.
- Every state (empty, loading, results, error, no route, offline notice, data info) is styled in both themes and at 320, 390, 768, 1024, 1440 px.
- No horizontal overflow; tap targets ≥ 44 px; long names never clip.
**Data**: none.
**Edge cases**: stored theme value invalid or storage blocked → fall back to system preference; reduced motion still true in both themes.

## F11. Privacy
No accounts, no trackers by default. Location stays in the browser except as coordinates sent to the routing/geocoding endpoints for the request (document this in the footer/info sheet). Ask the owner before adding analytics.
