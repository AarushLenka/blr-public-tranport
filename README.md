# Bengaluru Transit

A route planner for Namma Metro and BMTC buses. Enter two places and get a colour-coded map, the line to take, where to change, and where to get off.

Built from open GTFS feeds. No live vehicle tracking, no accounts, no API keys.

## Run locally

```bash
npm ci
npm run dev
```

Open http://localhost:3000, then choose **Plan a journey** (`/plan`).

The routing index is committed at `data/processed/network.json`, so the app runs without downloading feeds. To rebuild it from the raw feeds:

```bash
mkdir -p data/raw
# place the bmrcl and bmtc GTFS folders in data/raw/bmrcl and data/raw/bmtc
npm run data:build
```

The build script streams the large BMTC `stop_times.txt`, keeps weekday service for 2026-11-13, computes headways, slices metro shapes, and writes `network.json` plus `meta.json`.

## Routes

| Route | Method | Notes |
| --- | --- | --- |
| `/` | GET | Landing page |
| `/plan` | GET | The planner |
| `/api/suggest?q=&lat=&lon=` | GET | Fuzzy local stop search merged with Photon places inside the Bengaluru bounding box |
| `/api/reverse?lat=&lon=` | GET | Photon reverse geocode, falling back to the nearest stop |
| `/api/route` | POST | `{ from, to, mode }` where mode is `best`, `metro` or `bus` |
| `/api/meta` | GET | Feed versions, counts, index build date |
| `/api/network` | GET | Metro line geometry for the map context layer |
| `/api/health` | GET | Load balancer probe, 503 when the index cannot load |

Routing is frequency-based RAPTOR over the processed index. Four rounds are allowed. Access and egress walking use a 1.25 detour factor at 4.8 km/h. Waits use half the published headway, with an 8 minute fallback that is flagged in the UI. Metro-only searches reach up to 12 km for access and egress stations, and the result warns when that walk is long instead of returning no route.

## Deployment

### No secrets are required

This deployment needs no database, no auth provider, no paid API key and no map token. The only environment variable is an optional `PHOTON_BASE_URL` for a self-hosted geocoder. Keep it server-side: do not rename it with a `NEXT_PUBLIC_` prefix. `.env*` files are ignored by git, except `.env.example`.

If you add a paid geocoder or analytics later:

- keep credentials server-side and read them in a route handler;
- never put a key in a `NEXT_PUBLIC_` variable or in client JavaScript;
- store deploy secrets in the platform's secret manager, not in the image;
- rotate any key that has ever been committed.

### Vercel

The repository is ready to import into Vercel with no environment variables:

1. Push the repository, including `data/processed/network.json` (it is not ignored).
2. Import it in Vercel. The framework is detected as Next.js; `vercel.json` pins the Mumbai (`bom1`) region so functions run next to the data.
3. Deploy. `next.config.ts` traces `data/processed/**` into the API functions, and `npm run prebuild` copies the MapLibre worker into `public/`.

From the CLI:

```bash
npx vercel
npx vercel --prod
```

Set `PHOTON_BASE_URL` only if you run your own Photon instance. If Photon is unreachable, stop and station search still works from the local index. Do not add a filesystem cache or SQLite database; Vercel functions are ephemeral, and the processed index is read-only.

### Build and run

```bash
npm ci
npm run build
PORT=3000 npm start
```

Or with Docker:

```bash
docker build -t blr-transit .
docker run --rm -p 3000:3000 blr-transit
```

The image runs as a non-root user and includes a `HEALTHCHECK` against `/api/health`.

### Load balancing

The app is stateless across requests and needs no sticky sessions:

- run two or more identical replicas behind any HTTP load balancer;
- probe `GET /api/health`, which returns `200` with index counts or `503` when the data file is missing;
- terminate TLS at the proxy and forward `X-Forwarded-For`; the app trusts the first address only when the proxy sets it, so never expose port 3000 directly to the internet;
- scale on CPU. Each replica reads the 6.4 MB index once at first request and keeps the parsed graph in memory, so allow at least 512 MB per replica;
- keep all replicas on the same image tag. There is no shared mutable state to synchronise.

The rate limiter is a per-process burst guard. For a global quota across replicas, add a shared limiter at the edge (for example the load balancer or a gateway).

### Caching

| Layer | Behaviour |
| --- | --- |
| Transit index | Read once per process and reused; immutable until the container is replaced |
| Route results | In-memory exact-request cache for 60 seconds, bounded to 300 entries per replica |
| `/api/meta` | `Cache-Control: public, max-age=300` |
| `/api/network` | `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` |
| Fonts | One year, immutable |
| MapLibre worker | One day |
| `/api/route`, `/api/suggest`, `/api/reverse`, `/api/health` | `no-store` so trip points do not sit in a shared CDN |
| Static build assets | Hashed filenames with Next.js immutable caching |

Do not put a CDN in front of the POST route. If you add one, make sure it does not cache request bodies containing locations.

### Security

- Security headers are set in `next.config.ts`: `nosniff`, frame denial, strict referrer policy, a restrictive permissions policy, and same-origin opener policy.
- The processed data lives outside `public/`, so it is not downloadable as a static file.
- Inputs are validated with Zod and coordinates are bounded to the Bengaluru area.
- API requests are limited to 120 route and 240 suggest requests per minute per client per replica.
- No cookies are set. Up to five recent places stay in `localStorage` so they can be picked again.
- Place search sends the typed query to Photon, an OpenStreetMap geocoder. Location is used only after an explicit browser prompt.
- Add HSTS at the TLS proxy. Do not enable it on a plain HTTP origin.
- A Content Security Policy is not set in code because MapLibre needs inline styles and Next.js injects a bootstrap script. If you add one at the proxy, allow `style-src 'unsafe-inline'`, `worker-src blob:`, and the OpenFreeMap tile, sprite, glyph and style origins.

### Updating data

1. Replace the feeds in `data/raw/`.
2. Run `npm run data:build`.
3. Check `/api/health` and the counts in the data dialog.
4. Build and roll out a new image tag. The route cache is per process, so a rolling deploy clears it naturally.

## Data and attribution

- Namma Metro GTFS: https://github.com/Vonter/bmrcl-gtfs (ODbL)
- BMTC GTFS: https://github.com/Vonter/bmtc-gtfs (ODbL)
- Map tiles: OpenFreeMap, data from OpenStreetMap contributors

Metro times in the feed are approximated from the official timetable. Bus times are interpolated and can drift. Bus paths are drawn stop to stop. The UI states all three limits next to the results and in the data dialog.

## Checks

```bash
npm run typecheck
npm run build
```
