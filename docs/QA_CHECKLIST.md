# QA_CHECKLIST.md — Nothing is "done" until this passes (with evidence)

Store evidence (screenshots, logs, notes) under `/docs/evidence/<section>/`. Tick items in `PROGRESS.md`.

## A. Data integrity (most important)
- [ ] Every dataset has a `DATA_LOG.md` entry: source URL, licence, retrieval date, feed version, counts, gaps.
- [ ] GTFS/validator report saved; errors fixed or explained.
- [ ] Metro: each operational line's station list and order matches the official BMRCL source; line names and colours match; interchange stations match the official map.
- [ ] Bus: ≥ 20 sampled routes verified against an independent source; coverage numbers logged.
- [ ] No hard-coded station/line/route/stop facts in source code (grep for literals; all come from `/data/processed`). Test fixtures are slices of real data.
- [ ] No UI string invents data (no placeholder stations, fake bus numbers, made-up times).
- [ ] All coordinates inside the service bbox; spot-check 20 random stops on the map.
- [ ] "Data last updated" and attributions visible in-app and accurate.

## B. Routing correctness — 10 hand-verified real trips
Choose with the owner's input where possible; include at least:
- [ ] 2 single-line metro trips
- [ ] 2 metro trips with one interchange
- [ ] 1 metro trip needing walking to a farther-but-better station
- [ ] 2 bus-only trips (direct)
- [ ] 1 bus trip with a transfer
- [ ] 1 combined bus + metro trip
- [ ] 1 trip where metro is *not* optimal (app must prefer bus in Best mode)
For each: compare boarding stop, line/bus number, direction, interchange, alighting stop with Google Maps/Moovit/BMRCL/BMTC info; log differences and justify (schedule vs. data age) in `/docs/evidence/routing/`.
- [ ] Same-origin/destination, very short trips, and outside-service-area inputs handled with clear messages.
- [ ] Mode filter: Metro never returns bus legs; Bus never returns metro legs.
- [ ] Alternatives are distinct and correctly labelled.

## C. Feature behaviour
- [ ] Autocomplete: suggestions within ~400 ms perceived; stations/stops instant; geocoder results biased to Bengaluru; no results outside the city; keyboard + screen reader work; debounced and cancelled requests (verify in network panel).
- [ ] Geolocation: pre-prompt shows first; browser prompt only after consent; success fills From; deny/timeout/outside-city paths work; retry works; no prompt loop; no coordinates sent to our server logs.
- [ ] Swap, recents, map-pin selection work.
- [ ] Metro result shows every item in FEATURES F4 (nearest/boarding station, line + colour, direction, interchange + new line, alighting station, stops count, walking legs, total time).
- [ ] Bus result shows every item in FEATURES F5 (boarding stop, bus number, direction, get-off/switch stop, stops count, walking legs).
- [ ] Map: each metro line drawn in its real colour; bus and walk styled per spec; markers for start/board/interchange/alight/end; legend correct; tapping steps ↔ map highlights work.
- [ ] Share link reproduces the same result in a fresh tab; back/forward navigation works.
- [ ] Offline, geocoder-down, routing-error, no-route, and stale-data states render correctly.

## D. UI/UX & motion
- [ ] UI matches `design.md` (tokens only; no off-system colours/fonts except real transit colours).
- [ ] Layout verified at 360, 390, 768, 1024, 1440 px; light and dark; long names do not overflow.
- [ ] Motion spec implemented (load, focus, swap, locating, results reveal, route draw, mode switch, sheet, micro-interactions).
- [ ] ≥ 55 fps during route draw and sheet drags with 4× CPU throttle (performance trace saved).
- [ ] `prefers-reduced-motion` produces non-animated equivalents.
- [ ] A first-time tester can answer "which line/bus, where to switch, where to get off" from the result card alone (5-second test with ≥ 3 people if the owner can arrange it).

## E. Accessibility
- [ ] axe/Lighthouse a11y ≥ 95, zero critical issues.
- [ ] Keyboard-only run through the full flow; visible focus everywhere.
- [ ] Screen-reader pass (VoiceOver or NVDA) on search + results.
- [ ] Colour is never the only signal; contrast AA verified, including text on real line colours.

## F. Performance & reliability
- [ ] Lighthouse mobile: Performance ≥ 85, Best Practices ≥ 95, SEO ≥ 90.
- [ ] Route query p95 < 800 ms warm; first result ≤ 3 s on throttled 4G.
- [ ] Bundle size reviewed; map and heavy libs lazy-loaded.
- [ ] Rate limits/caching verified against Photon and walking router terms (request counts logged for a typical session).
- [ ] No console errors/warnings in a normal session.

## G. Security & privacy
- [ ] No secrets in repo or client bundle; `.env.example` complete.
- [ ] Inputs validated; API rate-limited; CSP and security headers set.
- [ ] Footer/info sheet explains what location data goes to which third party.
- [ ] No analytics/trackers unless the owner approved.

## H. Release
- [ ] README complete (setup, env vars, data refresh, deployment, known limitations).
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` all green.
- [ ] Production smoke test: search, geolocation, results, map, share link.
- [ ] Known limitations listed honestly (e.g., bus timings unavailable for X% of routes).
