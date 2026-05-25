# Bangkok Super Dashboard — Wave 1 TODO

## Setup
- [x] Verify upstream files exist (gistda.js, bangkok-districts.geojson, bts-mrt.ts, request-coalesce.ts)
- [x] Add Vite alias `@shared` → `../_shared` in vite.config.ts
- [x] Copy `bangkok-districts.geojson` into `public/geo/`
- [x] Build BTS/MRT/ARL key-station snapshot → `public/geo/bkk-rail.json` (community feed dead — hand-curated 30 stations + 5 simplified lines)

## Lib
- [x] Port `request-coalesce.ts` → `src/lib/cached-fetch.ts`
- [x] Add `freshness.ts` helper for "X AGO" labels

## Data fetchers
- [x] `src/data/gistda.ts` — Bangkok wrappers (PM2.5 live, AQI stations, fires, floods, provinces)
- [x] `src/data/nasa.ts` — FIRMS Thailand CSV + GIBS WMTS templates
- [x] `src/data/bma.ts` — load BTS/MRT/Districts GeoJSON
- [x] `src/data/datago.ts` — CKAN search for Bangkok datasets (CORS-blocked, awaits Wave 2 proxy)

## Layer hooks
- [x] Consolidated `src/components/map-layers/use-bangkok-layers.ts` — single hook owns 7 live layers via addSource/addLayer + visibility toggle

## UI components
- [x] `src/config/bangkok-layers.ts` — layer catalog with 10 items (8 live + 2 pending)
- [x] `src/components/LayerRail.tsx` — right-edge toggle rail + source status block + mobile FAB
- [x] `src/components/DataFeedPanel.tsx` — data.go.th list with honest CORS empty state
- [x] `src/components/BangkokKpiPanel.tsx` — live PM2.5 + 24h sparkline + AQI level word + 24h max
- [x] `src/components/Sparkline.tsx` — inline SVG, no library
- [x] Modify `MapView.tsx` — `onMapReady` callback to expose map ref
- [x] Modify `CityRail.tsx` — Bangkok-mode KPI variant
- [x] Modify `App.tsx` — conditional render LayerRail + DataFeedPanel for bangkok
- [x] Modify `index.css` — styles for rail, panel, sparkline, pending chip, FAB, mobile sheet

## Verify
- [x] PM2.5 LIVE KPI shows real value with sparkline (11.1 µg/m³ at test time, GOOD level, 24h max 22.7)
- [x] Districts overlay renders (6 central districts visible with amber labels at zoom ≥ 11)
- [x] BTS/MRT/ARL renders with line colors + interchange/regular station dots + labels
- [x] Mobile: layer rail collapses to FAB top-right with active count
- [x] City switch deactivates super-dashboard mode (verified via state)
- [x] No API keys leak to src/ (verified)
- [x] Layer rail shows 2 PENDING tiles with amber chip + tooltip
- [x] Source status grid shows freshness labels per source

## Known limitations (Wave 2)
- GISTDA AirQuality_hourly intermittently empty — PM2.5 LIVE KPI uses fallback endpoint always
- GISTDA hotspot_npp_daily last refreshed Apr 2023 (1001 historical fires render correctly)
- NASA FIRMS CORS-blocked → empty layer until Worker proxy
- data.go.th CORS-blocked → empty feed panel with link-out until Worker proxy
- JAXA Himawari-9: needs free Earth API registration
- BMA Open Data: needs DEPA contact for endpoint catalog

## Review
**Shipped:** Bangkok-only super mode with 8 live data layers (7 GeoJSON/raster + 1 live KPI) across 4 named sources (GISTDA, NASA, BMA, data.go.th). 2 PENDING placeholders for JAXA + BMA Open Data are wired in the rail. Mobile-perfect responsive layout. All design DNA preserved (amber accent, hard edges, mono labels, 3 text sizes, no shadows/gradients).

**Learned:** GISTDA portal services are unreliable individually (hourly AQI empty, hotspots 2-year stale) — diversity of sources is essential. CORS is the next hard wall — a single Cloudflare Worker can unblock 2 sources at once.

**Remains:** Worker proxy for FIRMS + data.go.th (the Wave 1 plan's plan-B). JAXA registration. Direct BMA contact via DEPA.
