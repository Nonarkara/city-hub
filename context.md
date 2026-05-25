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
In `src/config/cities.ts`, add one object to `CITIES`:
```ts
{
  id: 'singapore',
  name: 'Singapore',
  country: 'SG',
  center: [103.8198, 1.3521],
  zoom: 12,
  kpis: [
    { label: 'POPULATION', value: '5.9', unit: 'M' },
    { label: 'SMART SCORE', value: '91.4' },
    { label: 'IOC STATUS', value: 'LIVE' },
  ],
}
```
No other changes needed.

## Deployment
```bash
npm run build        # → dist/
# Deploy dist/ to Cloudflare Pages
# Set env vars: VITE_UNL_API_KEY, VITE_UNL_VPM_ID
```

## Next Steps (production scale)
- [ ] Add VPM data layers: upload city GeoJSON to VPM via UNL Studio, render as `addSource` / `addLayer`
- [ ] Connect real KPI data from Supabase (per city table)
- [ ] Add satellite tile toggle (UNL `v1/sat/1/{z}/{x}/{y}` endpoint)
- [ ] Upgrade to Next.js 16 for SSR + API routes when Supabase data sources are added
- [ ] Add UNL geocoding search bar for address lookup within VPM

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

