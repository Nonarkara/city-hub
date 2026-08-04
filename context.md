# UNL City Intelligence Hub — Context

## What this is
A replicable city intelligence dashboard PoC using UNL Global as the Location OS. One codebase, many city clients. Adding a new city = one config object in `src/config/cities.ts`.

## Stack
- Vite + React 19 + TypeScript
- MapLibre GL JS (direct) with UNL tile auth via `transformRequest`
- Tailwind v4 + Dr Non design tokens
- Deploy target: Cloudflare Pages

## UNL Credentials
- **VPM ID:** `1f984423-a423-48dc-8168-8adcc8fcac58`
- **API Key:** stored in `.env.local` only — never in source
- **Tile URL:** `https://tiles.unl.global/v1/vector/1/{z}/{x}/{y}` (auth via request headers)
- **Developer Portal:** https://platform.unl.global/developer_portal

## Key Technical Notes
- `unl-map-js` SDK NOT used for rendering — its CJS → ESM conversion under Vite produces a triple-nested default export that breaks silently. MapLibre GL is imported directly instead.
- Auth still goes through the same UNL tile server with `x-unl-api-key` + `x-unl-vpm-id` headers via MapLibre's `transformRequest`.
- `define: { global: 'globalThis' }` in vite.config.ts required because `unl-core` (a dependency) references Node's `global` at module load time.
- StrictMode removed from main.tsx — imperative map libraries cannot tolerate React's double-mount dev behaviour.

## File Structure
```
src/
  config/cities.ts       ← city registry (THE replicability layer)
  components/
    MapView.tsx          ← MapLibre map with UNL tile auth
    CityRail.tsx         ← desktop rail + mobile bottom sheet
    KpiCard.tsx          ← metric display
  App.tsx                ← layout shell
  index.css              ← design tokens + responsive breakpoints
```

## Adding a New City
In `src/config/cities.ts`, add one object to `CITIES` (bbox, timezone, tier, layers, facts). Lite cities inherit `LITE_LAYERS` (global AQ/fires/sat only).

### Adding 3D (portable — proven Ljubljana 2026-08-04)
Conservation law: `city.threeD ∧ city.buildings3dUrl` ⇒ MapView drapes Terrarium DEM + extrudes OSM footprints with `{h, real, base?}`. No invented heights.

```bash
python3 scripts/bake-city-buildings.py \
  --city ljubljana \
  --bbox 14.48,46.03,14.54,46.08 \
  --output public/geo/ljubljana-buildings.geojson
```

Then set on the city config: `threeD: true`, `buildings3dUrl`, optional `heading` + `basemapDefault: 'esri-imagery'`. 3D cities today: Bangkok, Kranj, **Ljubljana**.

BKKx Minecraft/Arnis is a separate deep tier — see `BKKx/worlds/ljubljana-centre-java/bkkx-manifest.json` (scaffold; world binary pending Arnis run).

## Deployment
```bash
npm run build        # → dist/
# Deploy dist/ to Cloudflare Pages
# Set env vars: VITE_UNL_API_KEY, VITE_UNL_VPM_ID
```

## Next Steps (production scale)
- [x] Build Cloudflare Worker proxy for CORS-blocked APIs
- [x] Integrate Traffy Fondue civic complaint data
- [x] Integrate Open-Meteo Air Quality (US AQI)
- [x] Add God Mode narrative layer (GDELT news + sentiment + reality check)
- [x] Add Supabase scaffolding for longitudinal data caching
- [ ] Add VPM data layers: upload city GeoJSON to VPM via UNL Studio, render as `addSource` / `addLayer`
- [ ] Upgrade to Next.js 16 for SSR + API routes when Supabase data sources are added
- [ ] Add UNL geocoding search bar for address lookup within VPM
- [ ] Add predictive risk scoring (time-series trend analysis on cached data)

---

## Bangkok Super Dashboard (Wave 1 — built 2026-05-25)

When `activeCity.id === 'bangkok'`, the dashboard activates "super mode" — adding 8 live data layers and 4 panels driven by five named sources.

### Sources wired
- **GISTDA** (live): PM2.5 by location, AQI stations, hotspot snapshot, central floods, BKK districts (via shared lib in `_shared/lib/gistda.js` through Vite alias `@shared`)
- **NASA** (live): GIBS aerosol WMTS raster; FIRMS CORS-blocked (Wave 2 proxy)
- **BMA** (live, community + static): BTS/MRT/ARL via hand-curated GeoJSON in `public/geo/bkk-rail.json`; central districts via `public/geo/bangkok-districts.geojson`
- **data.go.th** (CORS-blocked): panel renders honest empty state with link-out
- **JAXA**: pending tile in rail with PENDING SOURCE badge — needs free Earth API registration

### Architecture
- TTL cache + concurrent dedup in `src/lib/cached-fetch.ts` (ported from geopolitics `request-coalesce.ts`)
- Single hook `useBangkokLayers` owns all 7 source/layer pairs via MapLibre `addSource`/`addLayer` + visibility toggle
- Layer catalog single source of truth in `src/config/bangkok-layers.ts`
- Bangkok-mode KPI panel shows live PM2.5 + 24h sparkline (no library — inline SVG)

### Known limitations (Wave 2 work)
- GISTDA AirQuality_hourly endpoint intermittently empty (KPI uses a different always-on endpoint)
- GISTDA hotspot service last refreshed Apr 2023 (1001 historical fires render)
- NASA FIRMS CORS-blocked from browser
- data.go.th CORS-blocked from browser
- JAXA + BMA-direct integrations pending (visible as disabled tiles)

### Run
```bash
cd /Users/nonarkara/Projects/UNL
npm run dev
# Bangkok loads with super mode auto-enabled at localhost:5173
```

### Verification
1. KPI panel shows live PM2.5 value with 24h sparkline
2. Districts overlay: 6 central BMA districts with amber hairline + uppercase labels
3. Rail: BTS Sukhumvit (green), BTS Silom (dark green), MRT Blue, MRT Purple, ARL (red) + interchange amber dots
4. Toggle GIBS aerosol → faint raster overlay (best at zoom ≤ 6)
5. Toggle GISTDA fires → 1001 dots across Thailand (zoom out to see)
6. Switch to Phuket/Kuching → super mode deactivates, layers are torn down, generic KPI strip returns
7. Resize ≤ 480 → layer rail becomes FAB top-right, data feed panel hidden, all targets ≥ 44 px

See `tasks/todo.md` and `tasks/lessons.md` for the full Wave 1 trace.

---

## Bangkok Super Dashboard (Wave 2 — built 2026-05-25)

### What shipped
- **Cloudflare Worker proxy** (`worker/`) deployed to `cityhub-proxy.drnon.workers.dev` (earlier hostname `unl-city-proxy.drnon.workers.dev` is retired — returns 404)
  - Unblocks `data.go.th`, NASA FIRMS, Traffy Fondue, GDELT from browser CORS
  - Route-based: `/data-go-th/*`, `/firms/*`, `/traffy/*`, `/gdelt/*`
- **Traffy Fondue integration** (`src/data/traffy.ts`)
  - Real-time citizen complaint GeoJSON layer (`traffy-issues`) with 500-point cap
  - Color-coded by problem type: floods (blue), roads (orange), buildings (red), electricity (yellow), garbage (brown)
  - Click popup with AI summary, status, address
  - Stats fetcher for vitals bar: active issues count + top categories
  - Flood-specific alert generator cross-references with GISTDA flood polygons
- **Open-Meteo Air Quality** (`src/data/openmeteo-aq.ts`)
  - US AQI + PM2.5/PM10/NO₂/O₃/SO₂/CO readings
  - New map layer `aqi-live`: large translucent halo colored by AQI level
  - Vitals bar now shows US AQI as primary air metric, PM2.5 as fallback
  - Mobile strip shows AQI when available
- **data.go.th via proxy** (`src/data/datago.ts`)
  - DataFeedPanel now populates real Bangkok datasets from CKAN
- **God Mode narrative layer** (`src/data/gdelt.ts` + `AlertPanel`)
  - GDELT Doc API fetches latest Bangkok news (6 headlines)
  - Sentiment tone bar (-10 to +10 scale, color-coded)
  - **Reality Check**: compares sensor severity vs news tone → CONFIRMED / UNDERSTATED / OVERSTATED / CALM
- **Supabase scaffolding** (`src/lib/supabase.ts`, `src/data/supabase-cache.ts`, `supabase/schema.sql`)
  - Optional backend for longitudinal data storage
  - `data_cache` table with upsert + history query
  - `pageviews` table for analytics
- **City expansion**: added Chiang Mai + Singapore to registry
- **Error Boundary** (`src/components/ErrorBoundary.tsx`) wraps entire app
- **Dead code removal**: `BangkokKpiPanel.tsx`, `Sparkline.tsx` deleted

### File structure (updated)
```
src/
  config/bangkok-layers.ts     ← added Traffy, Open-Meteo sources + AQI colors
  config/cities.ts             ← +Chiang Mai, +Singapore
  data/
    gistda.ts                  ← unchanged
    nasa.ts                    ← unchanged
    bma.ts                     ← unchanged
    datago.ts                  ← uses VITE_PROXY_URL
    openmeteo.ts               ← unchanged
    openmeteo-aq.ts            ← NEW: US AQI fetcher
    traffy.ts                  ← NEW: Traffy Fondue fetcher
    gdelt.ts                   ← NEW: GDELT news fetcher
    supabase-cache.ts          ← NEW: Supabase cache helpers
  lib/
    cached-fetch.ts            ← unchanged
    risk.ts                    ← +aqiToRisk, +civicToRisk, +Reality Check logic
    supabase.ts                ← NEW: Supabase client
  components/
    AlertPanel.tsx             ← +GDELT news, +Reality Check, +Traffy floods
    VitalsBar.tsx              ← +AQI, +Traffy stats
    CityRail.tsx               ← mobile strip shows AQI
    DataFeedPanel.tsx          ← removed CORS blocked message
    LayerRail.tsx              ← +Traffy, +Open-Meteo source probes
    map-layers/use-bangkok-layers.ts  ← +aqi-live, +traffy-issues layers
    ErrorBoundary.tsx          ← NEW
worker/
  src/index.ts                 ← proxy worker
  wrangler.toml
  package.json
supabase/
  schema.sql                   ← CREATE TABLE statements
```

### Deployment (updated)
- **Worker:** `npx wrangler deploy` from `worker/` directory
- **Site:** `npm run build && npx wrangler pages deploy dist --project-name unl-city-hub`
- **Env vars (Cloudflare Pages):** `VITE_UNL_API_KEY`, `VITE_UNL_VPM_ID`, `VITE_PROXY_URL`
- **Optional Supabase:** add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Bangkok Digital Twin Intelligence (2026-07-21)

Kranj-pattern economic/civic brief for Bangkok's full-tier twin:

- **Component:** `src/components/BangkokIntelligence.tsx`
- **Wired into:** `AlertPanel` (top of governor brief scroll) — same slot as `KranjIntelligence` in `LiteCityPanel`
- **CSS:** reuses shared `.ki-*` chrome; shell class `.bkk-intel` (paired with `.kranj-intel` in `index.css`)
- **Data (cited, no invented numbers):**
  - Demographics from `cities.ts` (GPP, GDP/capita, TomTom congestion, green space, Gini)
  - DOPA 2568 × NASA VIIRS shadow population (`dopa-bkk.ts`)
  - SLIC v3.4 pillars (`slic-cityhub.ts`) — Samastiti structural frame
  - Live Chao Phraya discharge via `fetchChaoPrayaForecast` (GloFAS / Open-Meteo)
- **Map layers:** unchanged — Bangkok already has the full super-dashboard layer set (`bangkok-layers.ts`, `use-bangkok-layers.ts`); 3D buildings via Mapbox `buildings-3d` toggle, not a baked GeoJSON like Kranj

---

## Deployment (2026-05-25)

- **GitHub:** https://github.com/Nonarkara/unl-city-hub (private)
- **Cloudflare Pages:** https://unl-city-hub.pages.dev
- **Custom domain:** https://unl.nonarkara.org (DNS via Cloudflare, SSL via Google CA)
- **Wrangler project:** `unl-city-hub`
- **Env vars set in CF Pages secrets:** `VITE_UNL_API_KEY`, `VITE_UNL_VPM_ID`

### Re-deploy after changes
```bash
cd /Users/nonarkara/Projects/UNL
npm run build
npx wrangler pages deploy dist --project-name unl-city-hub
```

Note: Vite bakes `VITE_*` vars at build time — for CI-based deploys, set them in Cloudflare Pages → Settings → Environment Variables (Build only, not Secrets) so they're available during `npm run build`. Current approach is local build + wrangler deploy, which picks up `.env.local`.

---

## Mapbox public token (2026-06-26)

Basemap rendering uses **Mapbox GL JS** (`src/components/MapView.tsx`), not UNL tiles — see README / STORY.md for the May 2026 migration.

| Field | Value |
|--------|--------|
| **Env var** | `VITE_MAPBOX_ACCESS_TOKEN` (local: `.env.local`; Cloudflare Pages: build env) |
| **Token identifier** | Mapbox user `nonarkara`; public token suffix `…aLTw` (last 4 chars only — full value never in git) |
| **URL allowlist** | `*.pages.dev`, `*.nonarkara.org` (configured in Mapbox account → token restrictions) |
| **Restricted on** | 2026-06-26 |

**Operational notes**

- Vite inlines `VITE_*` at build time — rotate or restrict the token in Mapbox, then rebuild and redeploy Pages.
- URL allowlisting limits *which origins* may use the token in the browser; the token still ships in the client bundle. Treat it as a public token with usage bounds, not a secret.
- Primary production host (README): https://city-hub.pages.dev — Wrangler project name `city-hub`.
- Legacy hostnames in older notes (`unl-city-hub.pages.dev`, `unl.nonarkara.org`) may still be on the `*.nonarkara.org` / `*.pages.dev` patterns if DNS points at the same Pages project.

