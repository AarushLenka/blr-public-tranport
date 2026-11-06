# PRD — Bengaluru Transit Planner

## 1. Problem
Getting around Bengaluru by public transport is confusing: Namma Metro has several colour-coded lines with interchanges, BMTC has thousands of bus services with unclear stop names, and existing apps either hide detail or are cluttered. People want one clean answer to: *"I'm here, I need to get there — what exactly do I board, where do I change, where do I get off?"*

## 2. Goal
A fast, beautiful, mobile-first website that takes **Start** and **Destination** and returns the most optimal public-transport route in Bengaluru, shown as:
- clear step-by-step instructions, and
- a colour-coded route on an interactive map.

## 3. Target users
- Daily commuters comparing metro vs. bus
- New residents, students, visitors who don't know station/stop names
- Mostly on phones, often outdoors, sometimes on slow networks

## 4. Scope (v1)
**In scope**
1. Two-location input with live autocomplete suggestions (places, landmarks, metro stations, bus stops).
2. Start location defaults to the user's current location (browser geolocation, permission requested gracefully).
3. Three result modes: **Best (combined)**, **Metro**, **Bus**.
4. Metro result: nearest boarding station, line (name + colour) to take, direction/terminus, interchange station(s) and the line to switch to, alighting station, exit-side walking to destination, number of stops, approx. time.
5. Bus result: boarding bus stop/stand, bus number(s), where to get off or switch, number of stops, approx. time; walking legs.
6. Map showing the route, **colour-coded by leg** (each metro line in its own colour, bus in a bus colour, walking dashed).
7. Real data only, with visible attribution and "last updated".
8. Polished UI/UX with smooth, purposeful animation, following `design.md`.
9. Shareable URL for any route; responsive on laptop and mobile; light and dark themes with a persistent switch (per `DESIGN.md`).

**Out of scope for v1 (do not build unless the owner asks)**
- Accounts/login, payments/ticketing, saved trips
- Live vehicle tracking (unless a free, licensed real-time feed is verified and the owner approves)
- Auto/cab/bike-taxi, driving navigation
- Native apps (PWA install is fine, optional)

## 5. User stories
- As a commuter I type "Indiranagar" and "Electronic City" and see the fastest option with exact lines and the interchange.
- As a visitor I allow location and my start is filled in automatically; I only type the destination.
- As a user without a metro nearby I switch to Bus and see which stop to walk to and which number to board.
- As a user I tap a step in the list and the map zooms to that leg.
- As a user I share the link with a friend and they see the same route.

## 6. Definition of "optimal"
Default ranking minimises **generalised cost** = in-vehicle time + waiting time (half the headway when frequency-based) + walking time × 1.5 + 5 min × each transfer. Also surface alternatives labelled **Fastest**, **Fewest transfers**, **Least walking** when they differ. The agent must document the exact formula in `DECISIONS.md` and keep it configurable.

## 7. Success criteria
- Correctness: 10/10 hand-verified trips match real stops/lines/interchanges.
- Speed: first useful result ≤ 3 s on 4G; autocomplete suggestion latency ≤ 400 ms perceived.
- Clarity: a first-time user can state "which line, where to switch, where to get off" from the result card without opening the map.
- Quality: Lighthouse mobile Perf ≥ 85, A11y ≥ 95; animations hold ≥ 55 fps on a mid-range phone.

## 8. Principles
1. Truth over completeness — never fake data.
2. One screen, one question: from → to → answer.
3. Colour and motion carry meaning, never decoration alone.
4. Graceful degradation: no location permission, no network, no route found — each has a designed state.
