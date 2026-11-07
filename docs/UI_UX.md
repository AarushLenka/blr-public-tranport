# UI_UX.md — Applying design.md, motion, and content design

## 1. Authority
`design.md` is the visual source of truth (palette, type, spacing, radii, shadows, components, tone). This file only adds **what design.md doesn't cover**: layout behaviour, motion, transit colour semantics, and content rules. If design.md contradicts this file on visuals, **design.md wins**; log it in `DECISIONS.md`. If design.md is silent on something, choose the closest consistent option and note it.

Before writing UI code: read `design.md` fully, load the frontend/UI design skill if available, convert design.md into a single tokens file (`/src/styles/tokens.*`), and build primitives first (button, input, chip, card, sheet, skeleton). Components must consume tokens only.

## 2. Layout
**Mobile (≤ 768 px, primary)**
- Full-screen map behind. Top: floating search card (From/To/swap). Bottom: draggable **bottom sheet** with three snap points (peek: summary · half: timeline · full: details/alternatives). Sheet drag uses spring physics; map padding updates with the sheet.
**Laptop / desktop (≥ 1024 px, required)**
- Left side panel (400–440 px) with search + results; map fills the rest. Panel scrolls independently; the map stays full-height.
- At 1024–1279 px keep the same split, with 29 px panel padding instead of 43 px. Do not introduce a third breakpoint with different navigation.
- Keep thumb-reachable controls at the bottom on mobile.
- Both layouts are first-class: every feature (search, modes, results, map, share, theme) must work at 390 px and at 1440 px.
**Landing state**: not a marketing page — the planner **is** the home screen. A single hero line + the search card over a calm map; the pre-prompt for location sits inline, not as a modal wall.

## 3. Transit colour semantics
- **Metro line colours come from data** (`route_color`/OSM `colour`, verified against BMRCL). Render as: `LineChip` = coloured dot/pill + the **line name text** (e.g., "Purple Line"). Text colour auto-chosen for ≥ 4.5:1 contrast; if the real colour fails contrast as a background, use it as a border/dot with neutral surface instead of altering the colour.
- **Bus**: one consistent mode colour from design.md accent/secondary (not a metro colour — pick one that is distinguishable from all metro line colours in the real data; verify programmatically with a colour-distance check and log it). Bus chips show the route number in a monospace-ish tabular style.
- **Walking**: neutral grey, dashed.
- Map polylines, timeline rails, chips, markers and legend all use the **same** colour for the same leg. Colour is never the only signal (names, icons, patterns).
- Interchange marker: ring with two (or more) line colours; board/alight markers: filled in line colour with white inner dot.

## 4. Motion system (smooth, purposeful, performant)
Define motion tokens once (durations, easings, springs) and reuse.
- Durations: micro 120–180 ms · standard 240–320 ms · emphasis 400–600 ms. Easing: ease-out for entrances, ease-in-out for moves, springs (stiffness ~300, damping ~30) for sheets and drags.
- **Page load**: staggered fade/slide-up of search card → mode switch → map controls (≤ 600 ms total).
- **Input focus**: field expands subtly; label/placeholder transitions; suggestion list animates height + items stagger (30 ms steps, max 6 items animated).
- **Swap**: icon rotates 180°, the two values cross-slide.
- **Geolocation**: pulsing dot while locating; success = soft ripple, then label morphs to "Current location".
- **Calculating**: skeleton cards shimmer; map shows a subtle animated "searching" arc between pins.
- **Results reveal**: summary card springs in; timeline rows stagger in; **route draws along the map progressively** (≈ 900 ms, ease-in-out) leg by leg in order, with markers popping in as the line reaches them; camera eases to `fitBounds`.
- **Mode switch**: shared-layout transition; old route fades/shrinks while the new draws.
- **Step interaction**: expanding a step animates height with smooth content fade; tapping a step flies the camera (≈ 700 ms) and pulses the leg.
- **Bottom sheet**: spring snap with velocity, rubber-banding at limits.
- **Micro-interactions**: button press scale 0.97, hover lift on desktop, copy-link confirmation morph (icon → check).
- **Performance rules**: animate only `transform` and `opacity` (and MapLibre paint props); avoid layout thrash; use `will-change` sparingly; no animation longer than 600 ms for UI feedback; keep ≥ 55 fps on a mid-range Android (test with CPU throttling 4×).
- **Reduced motion**: with `prefers-reduced-motion: reduce`, replace movement with opacity fades, disable route-draw animation (render instantly), disable parallax/pulses. Provide this behaviour, don't just remove animations ad hoc.

## 5. Content design — make information obvious
Write instructions as **plain, imperative sentences** with the key facts bolded in the UI, e.g.:
- "Walk 450 m to **Indiranagar** station (6 min)" ← names/values come from real data
- "Take the **[Line name] Line** towards **[terminus]** — 8 stops"
- "Change at **[Interchange]** to the **[Line name] Line** towards **[terminus]**"
- "Get off at **[Station]**, then walk 300 m (4 min)"
Rules:
1. Every step answers: *what to do, where, which line/bus, which direction, how many stops, how long.*
2. Show the **direction as a terminus name** (from data), not just "northbound".
3. Always show total time, arrival time, changes, walking distance up top.
4. Station/stop names exactly as in data; never abbreviate inconsistently.
5. Uncertain/missing info is stated plainly ("Bus frequency not available") — never hidden, never invented.
6. Numbers use tabular figures; times in 12/24h per locale setting in design.md; IST.
7. Keep microcopy short, friendly, and consistent with design.md tone.
8. Provide a compact "strip" summary: [walk] → [line chip] → [line chip] → [walk], with minutes.

## 6. Components to build (each with all states + a11y)
`LocationInput` (combobox) · `SuggestionItem` · `SwapButton` · `ModeSwitch` · `LocationPrePrompt` · `SummaryCard` · `RouteStrip` · `AlternativeCard` · `Timeline`/`StepRow` · `LineChip` · `BusChip` · `StopList` (expandable) · `BottomSheet` · `MapView` + layers · `Legend` · `Toast` · `EmptyState` · `ErrorState` · `Skeletons` · `DataInfoSheet` (sources, licences, last updated).

## 7. Accessibility
Keyboard-complete; ARIA combobox/listbox for autocomplete; live region announces results ("3 routes found, fastest 42 minutes"); focus management when the sheet/panel changes; contrast AA for all text and UI; hit targets ≥ 44 px; map has an equivalent text alternative (the timeline). Test with a screen reader pass and axe.## 8. Visual QA

Check at 360, 390, 768, 1024, 1440 px; light and dark; with long station names; with 3+ transfers; slow network; reduced motion. Save screenshots to `/docs/evidence/ui/`.

## 9. Theme switch (owner addition)

- A single labelled control in the header switches **Light / Dark**. Default follows `prefers-color-scheme`; an explicit choice persists in `localStorage` and wins on later visits.
- Apply the theme on `<html data-theme>` before first paint (inline bootstrap script) so there is no flash of the wrong theme.
- Both themes use the tokens in `DESIGN.md`; no component may hardcode a light-only colour. Check every component, including the map basemap, skeletons, errors, the sheet and focus rings, in both themes.
- The map uses a matching free basemap (light style / dark style) from the same provider. Metro line and bus colours are data and do not change between themes.
- Icon and text in the switch both change: sun + "Light", moon + "Dark". The control has an accessible name and reflects state with `aria-pressed`.

## 10. Responsive behaviour requirements

| Width | Shell | Results | Map |
|---|---|---|---|
| ≤ 767 px | Full-screen map, fixed top bar, floating search card | Bottom sheet, drag handle, three snap heights (peek / half / full) | Behind everything; camera padding accounts for the sheet |
| 768–1023 px | Same as mobile, search card max-width 520 px centred | Bottom sheet | Behind everything |
| ≥ 1024 px | Split: 440 px scrollable panel + full-height map | In the panel, normal flow | Right pane, never behind the panel |

- No horizontal scrolling at 320 px. Long station names wrap or truncate with the full name available in the step text.
- Tap targets ≥ 44 px; inputs use 16 px minimum text on mobile to avoid iOS zoom.
- The sheet must not cover the search card; map controls stay reachable above it.
- Verify both themes at 390, 768, 1024 and 1440 px before calling the UI done.
