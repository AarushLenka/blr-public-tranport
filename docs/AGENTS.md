# AGENTS.md — Bengaluru Transit Planner (START HERE)

You are the build agent for **Bengaluru Transit Planner**: a website where a person enters two places in Bengaluru and gets the best route by **Namma Metro**, **BMTC bus**, or a combination, with a colour-coded map and very clear step-by-step instructions.

## 0. Read order (mandatory, before writing any code)
1. `AGENTS.md` (this file)
2. `DESIGN.md` (the owner's visual source of truth, including the dark-theme tokens; if missing, STOP and ask, see §4)
3. `PRD.md` → what and why
4. `FEATURES.md` → exact behaviour of every feature
5. `DATA_SOURCES.md` → where real data comes from and how to verify it
6. `ARCHITECTURE.md` → stack, data pipeline, routing engine, API contract
7. `UI_UX.md` → how to apply design.md, motion, content design
8. `TASKS.md` → phased plan with checkpoints
9. `QA_CHECKLIST.md` → acceptance tests; nothing is "done" until it passes

Precedence when documents conflict: **owner's latest chat instruction > design.md (visuals only) > FEATURES.md > ARCHITECTURE.md > everything else.** Log every conflict you resolve in `DECISIONS.md`.

## 1. Non-negotiable rules
1. **No fabricated transport data. Ever.** Every station, line, colour, stop, route number, timing and coordinate must come from a verified real source (see `DATA_SOURCES.md`). No placeholder stations, no "sample" bus numbers, no invented timings, no LLM-recalled facts used as data. If real data for something cannot be found, say so in the UI and in `DATA_LOG.md`, and ask the owner (§4). A missing feature is acceptable; a fake one is not.
2. **Free only.** Use free/open APIs and open-source libraries. Never add a paid service without asking.
3. **Never commit secrets.** API keys go in `.env.local` (git-ignored) with an `.env.example` listing every variable.
4. **Respect API terms.** Identify the app in User-Agent/Referer where required, debounce requests, cache aggressively, never hammer public servers (Nominatim autocomplete is forbidden by its policy; see `DATA_SOURCES.md`).
5. **Show provenance.** The UI footer/info sheet shows data sources, licences and "data last updated" dates.
6. **Be honest about uncertainty.** Scheduled times are not live times unless a real-time feed is verified. Label accordingly.
7. **Follow DESIGN.md exactly** for colours, typography, spacing, radii, components, in both the light and dark theme. Do not invent a competing style. Only metro line colours and the mode colours defined in `UI_UX.md` may extend it.

## 2. Working method
- Work phase by phase per `TASKS.md`. At each phase end: run the phase's acceptance checks, update `PROGRESS.md`, and commit.
- Keep three living logs in the repo root:
  - `PROGRESS.md` — what is done / in progress / blocked.
  - `DECISIONS.md` — every non-trivial choice with the reason and alternatives.
  - `DATA_LOG.md` — for each dataset: source URL, licence, retrieval date, version/feed date, record counts, known gaps, verification evidence.
- Prefer small, typed, tested modules. TypeScript strict mode. No `any` without a comment.
- Verify before claiming. Run the build, tests, and the app. Open it in a real browser (via a browser/Playwright skill or tool if available) and look at the result. Never report "works" from reading code alone.

## 3. Skills and tools — use what the harness provides
At the very start, list the skills/tools available to you and record them in `PROGRESS.md`. Then use them as follows (use the closest available equivalent; if none exists, say so and proceed manually):
- **Frontend / UI design skill** (e.g. `frontend-design`): use for every UI component, layout and animation pass, together with `design.md`. Read its SKILL.md before writing UI code.
- **Web research / fetch / search tools**: use to discover and verify data sources, check current metro line status, read licences and API docs. Do not rely on memory for any fact that can change (line openings, extensions, endpoints, rate limits).
- **Browser automation / Playwright / screenshot tools**: use for end-to-end tests, visual checks at 360 px, 768 px, 1440 px, and for verifying animations and the map.
- **Code execution / bash**: use for data pipeline scripts (GTFS download, validation, indexing).
- **Testing / lint / type-check tools**: run on every phase.
- **Doc skills**: only if the owner asks for documents.
If a skill you need is not installed, tell the owner what it would have been used for and continue with the best alternative.

## 4. When you MUST stop and ask the owner
Ask concisely (one message, numbered questions, with your recommended default for each). Do not guess, and do not stall on things you can decide yourself.
Ask when:
1. `design.md` is missing or ambiguous on something that blocks UI work.
2. An API key or account is required (e.g. OpenRouteService, MapTiler, hosting). Say exactly what to create, where, and which env var to put it in.
3. **Real data for a required feature cannot be found or its licence forbids use** (e.g. no usable BMTC timetable feed). Present the options found, with pros/cons.
4. A choice materially affects cost, hosting, architecture or scope (e.g. self-host a routing engine vs. in-app routing).
5. Source data disagrees with another credible source in a way you cannot resolve (e.g. a station name or line status).
6. Anything involving the owner's identity, domain name, deployment account, analytics, or legal text.
Do NOT ask about: library choices within the agreed stack, file layout, naming, minor UI details covered by design.md.

## 5. Definition of done (whole project)
- All `QA_CHECKLIST.md` items pass, with evidence (screenshots/logs) stored in `/docs/evidence/`.
- Every displayed station, line, stop and bus number traces back to an entry in `DATA_LOG.md`.
- 10 hand-verified real trips (see QA) match what official/maps sources say for stops, line colours and interchanges.
- Lighthouse (mobile) Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
- README explains setup, env vars, data refresh, and deployment.

## 6. Suggested repo layout
```
/ (repo root)
  AGENTS.md  PRD.md  FEATURES.md  DATA_SOURCES.md  ARCHITECTURE.md  UI_UX.md  TASKS.md  QA_CHECKLIST.md  design.md
  PROGRESS.md  DECISIONS.md  DATA_LOG.md  README.md  .env.example
  /data/raw        # untouched downloads (git-ignored if large; keep checksums)
  /data/processed  # compact indexes built by the pipeline
  /scripts         # data pipeline (download, validate, build index)
  /src             # app (see ARCHITECTURE.md)
  /docs/evidence   # screenshots, test output, verification notes
```
