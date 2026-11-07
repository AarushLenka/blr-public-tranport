# TASKS.md — Phased plan

Rules: finish a phase's **exit criteria** before the next. Update `PROGRESS.md`, `DECISIONS.md`, `DATA_LOG.md` at every phase end. ⛔ = checkpoint where you must message the owner and wait.

## Phase 0 — Orientation
- Read all docs in the order given in `AGENTS.md`. List available skills/tools into `PROGRESS.md`.
- ⛔ If `design.md` is missing → ask for it now.
- Initialise repo, Next.js + TS strict, lint/format/test tooling, `.env.example`, folder layout.
**Exit**: app boots, CI-style script (`lint`, `typecheck`, `test`, `build`) passes.

## Phase 1 — Data discovery & verification (no UI yet)
- Follow `DATA_SOURCES.md` §2 for metro, bus, geocoder, basemap, walking router.
- Download samples, validate, cross-check, fill `DATA_LOG.md`.
- Produce a **Data Findings Report** (`/docs/data-findings.md`): what exists, licences, coverage %, gaps, recommended path.
- ⛔ **Checkpoint A**: send the owner the report with a recommendation and any decisions needed (bus data gaps, routing approach, API keys such as ORS/basemap, hosting preference). Wait for answers.
**Exit**: owner-approved data plan; verified sample datasets in `/data/raw` with checksums.

## Phase 2 — Data pipeline
- Scripts: download → validate → normalise to internal schema → build indexes (stops search index, routing index, shapes) → `meta` file.
- Compute transfers (interchanges; metro↔bus and bus↔bus walking links) with real distances where possible.
- `npm run data:refresh` with diff report; unit tests on pipeline invariants (counts, bbox, ordering).
**Exit**: processed data loads in < target time; validation report clean or explained.

## Phase 3 — Routing engine
- Implement RAPTOR/CSA (or approved alternative), scoring (PRD §6), alternatives labelling, mode filters.
- Fixtures from **real** data slices. Tests: known real trips (see QA), transfer correctness, mode filters, edge cases (same stop, very close points, outside service area).
- Walking legs integration with caching + fallback.
**Exit**: `/api/route` returns typed itineraries for ≥ 10 verified trips; p95 latency within target.

## Phase 4 — Search & location
- Local index + Photon proxy + merge/rank; autocomplete UI per FEATURES F1; geolocation pre-prompt, permission flow, reverse geocoding per F2; swap; recents; map pin pick.
**Exit**: autocomplete and location flows behave per spec incl. denied/outside-city/offline cases.

## Phase 5 — Core UI & map
- Tokens from `design.md`; primitives; layout (bottom sheet / side panel); `MapView` with basemap, colour-coded metro/bus/walk layers, markers, legend, camera control.
- Results UI: summary, strip, alternatives, timeline with expandable stops; metro and bus step content exactly per F4/F5.
**Exit**: end-to-end search → results → map works on mobile and desktop with real data.

## Phase 6 — Motion & polish
- Implement the motion system (UI_UX §4) incl. progressive route draw, sheet springs, micro-interactions, skeletons; reduced-motion variants.
- Empty/error/offline/stale states; share link; URL sync; data info sheet with attributions and "last updated".
**Exit**: motion spec met at ≥ 55 fps under 4× CPU throttle; all states designed.

## Phase 7 — QA & hardening
- Run `QA_CHECKLIST.md` fully; fix; store evidence in `/docs/evidence/`.
- Accessibility audit, Lighthouse, cross-browser (Chrome, Safari iOS, Firefox), slow-network test.
- Security pass (inputs, headers, rate limits, secrets).
**Exit**: all checklist items pass.

## Phase 8 — Release prep
- README (setup, env, data refresh, architecture overview, known limitations).
- ⛔ **Checkpoint B**: ask owner about hosting account, domain, analytics (default none), and legal text (attributions/privacy). Do not deploy without approval.
- Deploy (if approved), smoke test production, record URL in `PROGRESS.md`.
**Exit**: live site passes smoke tests; handover notes written.

## Standing backlog (only on owner request)
Kannada UI (needs reviewed translations) · live arrivals (needs verified real-time feed) · saved places · PWA install/offline · upcoming-lines layer · accessibility-first routing (step-free paths, only if real data exists) · fare estimates (only from official fare tables).
