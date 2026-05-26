# UNL Dependency Inventory · 2026-05-26

**Purpose:** Catalog every UNL-API call site, SDK import, hosted dataset, and credential — and list candidate replacements for each. **No code is being moved tonight.** This document is the morning conversation.

The dashboard currently uses UNL for ONE thing only: **vector basemap tiles**. All operational data (PM2.5, AQI, weather, floods, civic issues, news, satellite imagery, fires, ASEAN comparisons, district boundaries) comes from non-UNL sources — GISTDA, NASA, BMA, Open-Meteo, TMD, GDELT, Traffy, WAQI, data.go.th, JAXA, Earth Engine, Longdo. Replacing UNL is therefore a **basemap-only** migration. The data layer is already UNL-free.

---

## A. Code touchpoints

### A.1 Direct UNL API call site

| File | Line | What it does |
|---|---|---|
| [src/components/MapView.tsx](src/components/MapView.tsx) | 7–134 | Inlines a MapLibre `StyleSpecification` with `omv` vector source pointing at `https://tiles.unl.global/v1/vector/1/{z}/{x}/{y}`. Defines all basemap layers (`water`, `landuse`, `boundaries`, `roads`, `buildings`, `places`) referencing UNL's OMV (Open Map Vector) source-layer schema. |
| [src/components/MapView.tsx](src/components/MapView.tsx) | 11 | `glyphs: 'https://assets.vector.hereapi.com/fonts/{fontstack}/{range}.pbf'` — note this is **HERE Maps**, not UNL. UNL uses HERE for glyphs. Could continue independently. |
| [src/components/MapView.tsx](src/components/MapView.tsx) | 158–169 | `transformRequest` injects `x-unl-api-key` and `x-unl-vpm-id` headers on every `tiles.unl.global` request. **Only call surface where UNL credentials touch the wire.** |
| [src/components/map-layers/use-bangkok-layers.ts](src/components/map-layers/use-bangkok-layers.ts) | 850–890 | `addBuildings3D` re-uses the UNL `omv` source's `buildings` source-layer for 3D extrusions. Reads `height` / `render_height` / `levels` fields. **Schema-dependent.** |
| [src/components/map-layers/use-bangkok-layers.ts](src/components/map-layers/use-bangkok-layers.ts) | 139 | `'buildings-3d': 'omv'` — toggle config mapping the layer to the UNL source. |

### A.2 UNL credential / config plumbing

| File | Line | What it does |
|---|---|---|
| [src/App.tsx](src/App.tsx) | 21 | `const API_KEY = import.meta.env.VITE_UNL_API_KEY` |
| [src/App.tsx](src/App.tsx) | 66, 127 | Passes `vpmId` and `apiKey` to `<MapView>` and `<CityRail>`. |
| [src/App.tsx](src/App.tsx) | 121 | Renders `<span className="topbar-vpm-label">UNL VPM</span>` (cosmetic label). |
| [src/config/cities.ts](src/config/cities.ts) | 17, 85 | `const vpmId = import.meta.env.VITE_UNL_VPM_ID as string` + export. |
| [src/components/CityRail.tsx](src/components/CityRail.tsx) | 53, 94, 119–122 | Displays a `VPM` badge with the VPM ID at the bottom of the desktop rail (cosmetic; informational only). |

### A.3 SDK / package dependencies

| Where | What |
|---|---|
| [package.json](package.json) line 15 | `"unl-map-js": "^0.1.7"` — installed but **NOT used for rendering** (per [memory](.claude/projects/-Users-nonarkara-Projects-UNL/memory/feedback_unl-sdk-cjs-vite.md): SDK breaks under Vite ESM, MapLibre is used directly). Brings in `unl-core` as transitive dep. |
| [package-lock.json](package-lock.json) line 4082, 4098 | `unl-core` (from `github:u-n-l/core-js`) and `unl-map-js` resolved. |
| [vite.config.ts](vite.config.ts) line 13 | `define: { global: 'globalThis' }` — polyfill required only because `unl-core` references Node's `global`. **Becomes obsolete the moment `unl-map-js` is removed from package.json.** |
| [src/main.tsx](src/main.tsx) line 7 | Comment references `unl-map-js` (no functional import). |

### A.4 Environment variables

| File | Var | Value (today) |
|---|---|---|
| [.env.local](.env.local) | `VITE_UNL_API_KEY` | `YnEdoQIcy0NK5EVTkaZULfKAymInGXxB` |
| [.env.local](.env.local) | `VITE_UNL_VPM_ID` | `1f984423-a423-48dc-8168-8adcc8fcac58` |
| [.env.example](.env.example) | `VITE_UNL_API_KEY`, `VITE_UNL_VPM_ID` | (placeholders) |
| Cloudflare Pages env | `VITE_UNL_API_KEY`, `VITE_UNL_VPM_ID` | Live secrets in Pages dashboard. |

### A.5 Cosmetic / documentation references (no migration impact)

- Project name `unl-city-hub` ([package.json](package.json), [package-lock.json](package-lock.json), [.claude/launch.json](.claude/launch.json), [worker/wrangler.toml](worker/wrangler.toml) `unl-city-proxy`).
- Cloudflare project name `unl-city-hub`.
- GitHub repo `Nonarkara/unl-city-hub`.
- Custom domain `unl.nonarkara.org`.
- README/context.md references throughout `worker/`, `docs/`, `context.md`, `tasks/lessons.md`.
- `popup className: 'unl-popup'` (CSS class name only — purely cosmetic).
- Comments in [use-bangkok-layers.ts](src/components/map-layers/use-bangkok-layers.ts) lines 407, 851, 852 referencing UNL.

These are name/string references only. They can be left as-is during a basemap swap, or rebranded later in one find-replace pass.

### A.6 What UNL is NOT involved in

The data layer (everything in `src/data/`) is UNL-free. Confirmed call surfaces:

- `src/data/gistda.ts` — GISTDA PM2.5 / floods / fires / AQI stations / provincial rank.
- `src/data/openmeteo.ts`, `openmeteo-aq.ts`, `openmeteo-forecast.ts` — Open-Meteo weather + air quality + forecast.
- `src/data/nasa.ts`, `nasa-gibs.ts` — NASA FIRMS fires + GIBS satellite imagery.
- `src/data/bma.ts`, `datago-bma.ts`, `datago.ts` — BMA / data.go.th datasets.
- `src/data/traffy.ts` — Traffy Fondue civic issues.
- `src/data/gdelt.ts` — GDELT news pulse.
- `src/data/waqi.ts` — WAQI stations.
- `src/data/asean-aqi.ts` — ASEAN capital AQI comparison.
- `src/data/tmd.ts` — TMD official forecast.
- `src/data/alphaearth.ts` — Google Earth Engine AlphaEarth embeddings.
- `src/data/longdo.ts` — Longdo Map alternative basemap (already wired as a layer toggle).
- `src/data/supabase-cache.ts` — Supabase persistence.
- `worker/src/index.ts` — Cloudflare Worker proxy. Does **not** call UNL. Proxies CORS-blocked APIs (FIRMS, data.go.th, etc.). Name only.

---

## B. What UNL actually provides

After the inventory: UNL delivers **one** capability to this dashboard.

**Vector basemap tiles** at `tiles.unl.global/v1/vector/1/{z}/{x}/{y}`. The OMV schema exposes source-layers: `water`, `landuse`, `boundaries`, `roads`, `buildings`, `places`. Building polygons include `height` / `render_height` / `levels` for the 3D extrusion layer.

That's it. The "VPM" abstraction is essentially a per-customer tenant scope on the same tile server — visible as a badge in the rail and as an HTTP header. No VPM-specific data is uploaded; the city GeoJSON / district boundaries / overlays in this codebase are all from BMA / OSM / GISTDA, not from UNL Studio.

---

## C. Replacement candidates (basemap only)

Schema-by-schema substitutions for the UNL OMV layer. **Non picks; this is options, not a recommendation.**

### C.1 Vector tile providers (compatible with MapLibre + transformRequest pattern)

| Provider | Cost | Schema | Notes |
|---|---|---|---|
| **MapTiler Cloud** | Free 100k req/mo; paid above | OpenMapTiles | Style JSON edits needed (source-layer names differ from OMV: `water`, `landcover`, `boundary`, `transportation`, `building`, `place`). Has building heights. Has Thai labels. Has glyphs hosted. Pay-as-you-grow. |
| **OpenFreeMap** | Free forever, donation-funded | OpenMapTiles | Same schema as MapTiler. Community-run servers; uptime less guaranteed than commercial. No auth, no rate-limit. |
| **Stadia Maps** | Free dev tier | OpenMapTiles | Solid. Multiple style options (Outdoors, Smooth Dark, etc.). |
| **Protomaps (self-host)** | Free; storage cost only | Protomaps own schema | Single `.pmtiles` file (world ~80 GB; ASEAN-only ~5 GB; Thailand-only ~700 MB). Host on Cloudflare R2 (already in stack) or static CDN. Zero per-request cost forever. Schema is Protomaps-specific (well-documented). |
| **Mapbox** | Paid (50k free MAU) | Mapbox Streets | Excellent quality, full geocoding, building heights. Requires Mapbox token. |
| **HERE Vector Tiles direct** | HERE freemium | HERE schema | UNL is reselling HERE under the hood (glyphs already from HERE). Going direct to HERE removes one layer of dependency. Auth via HERE API key. |

### C.2 Glyphs / fonts

| Source | Notes |
|---|---|
| HERE (currently used) | Already wired at `assets.vector.hereapi.com`. Works without UNL — keep until decision. |
| MapTiler glyphs | `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=...` — included with MapTiler key. |
| OpenFreeMap glyphs | `https://tiles.openfreemap.org/fonts/...` — included free. |
| Self-host PBF fonts | Generate with `fontnik`, host on R2/S3. ~50 MB for 8 fontstacks × 256 ranges. |

### C.3 Building heights for 3D extrusion

Current code at [use-bangkok-layers.ts:850](src/components/map-layers/use-bangkok-layers.ts) reads `height` / `render_height` / `levels` from UNL's `buildings` source-layer.

| Source | What it has | Notes |
|---|---|---|
| OpenMapTiles `building` source-layer | `render_height`, `render_min_height` | Direct replacement; same MapLibre paint config works after renaming `omv` → `openmaptiles` and `buildings` → `building`. |
| **Overture Maps Buildings** | `height` attribute, GeoParquet | Higher quality (Microsoft + Google + Meta consortium data). Self-host or query via DuckDB; not a tile source out of the box. |
| Protomaps `buildings` layer | `height` attribute | Bundled in Protomaps PMTiles; works out of the box. |

### C.4 Geocoding (open TODO in [context.md](context.md) line 69 — "Add UNL geocoding search bar")

Not currently in production. If the search bar is built later:

| Service | Cost | Notes |
|---|---|---|
| **Photon** (Komoot) | Free, OSS | Self-host or use Komoot's public instance. OSM-based. |
| **Nominatim** (OSM) | Free, with usage policy | Standard OSM geocoder. Rate limits on public instance; self-host for production. |
| **MapTiler Geocoding** | Included with MapTiler plan | Convenient if MapTiler is chosen for tiles. |
| **Pelias** | Free, OSS | Self-host stack; richer than Photon. Used by Stadia. |

---

## D. Migration shape (informational, not a plan)

When the migration runs, it will touch in approximately this order:

1. **Pick a tile provider** (Section C.1). Update `UNL_STYLE` in [MapView.tsx](src/components/MapView.tsx) — change tile URL, source name, source-layer references in all `layers[]` entries.
2. **Remove `transformRequest` UNL auth block** ([MapView.tsx:158-169](src/components/MapView.tsx)). Replace with new provider's auth pattern (query-string key for MapTiler/Mapbox, or no auth for OpenFreeMap/self-hosted).
3. **Update [use-bangkok-layers.ts](src/components/map-layers/use-bangkok-layers.ts)** `LAYER_SOURCES['buildings-3d']` and `addBuildings3D` — rename `omv` → new source name, rename `buildings` source-layer if schema differs.
4. **Drop `unl-map-js` from [package.json](package.json)**. Run `npm uninstall unl-map-js`. Remove the `define: { global: 'globalThis' }` line from [vite.config.ts](vite.config.ts) (no longer needed).
5. **Remove `vpmId` plumbing** — [config/cities.ts](src/config/cities.ts) export, [App.tsx](src/App.tsx) reads, [CityRail.tsx](src/components/CityRail.tsx) VPM badge, `<span>UNL VPM</span>` in topbar. Or keep `vpmId` semantically and rename — Non's call.
6. **Update env vars** — remove `VITE_UNL_API_KEY` and `VITE_UNL_VPM_ID` from [.env.local](.env.local), [.env.example](.env.example), and Cloudflare Pages dashboard. Add whatever the new provider needs.
7. **Rebrand naming** (optional pass) — `unl-city-hub` → new name across [package.json](package.json), Cloudflare project, GitHub repo, custom domain, [worker/wrangler.toml](worker/wrangler.toml) (`unl-city-proxy` → ...), README/context.md/docs.
8. **Cancel UNL account.** Non's hand — not Claude's.

Estimated touched lines for a "tile swap only" (steps 1–4): ~50 lines across 3 files. Rebrand (step 7) is several dozen string replaces across ~10 files.

---

## E. Open questions for the morning

1. Do you want a paid commercial provider (MapTiler / Mapbox / Stadia) or a free / self-hosted setup (OpenFreeMap / Protomaps on R2)?
2. Is the "VPM" semantic something you want to keep (per-city tenant scoping) or drop entirely? If keep, what does it mean post-UNL?
3. Rebrand timing: swap tiles only and keep the `unl-city-hub` name until later? Or rebrand at the same time?
4. The unused `unl-map-js` package and its `global: 'globalThis'` polyfill — remove now (one-line cleanup, no risk) or in the migration pass?
