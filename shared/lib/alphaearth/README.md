# AlphaEarth — shared pattern

Pre-baked year-over-year land-change overlays from Google DeepMind's Satellite Embedding model. **Bake offline → commit static files → dashboard reads them.** No Earth Engine calls at runtime, no quota concerns, no auth on the deployed frontend.

## Canonical implementation

Working source of truth lives in **`chonburi-control-tower`**:

| File | What it is |
|------|------------|
| `chonburi-control-tower/scripts/alphaearth/fetch_embeddings.py` | Pulls 64-band annual embedding GeoTIFFs from Earth Engine for a named AOI + year |
| `chonburi-control-tower/scripts/alphaearth/compute_change.py` | Per-pixel L2 distance between two years → colourised RGBA PNG + bounds JSON sidecar + manifest |
| `chonburi-control-tower/scripts/alphaearth/README.md` | Auth setup recipe (gcloud ADC workaround — default EE client is blocked by Google) |
| `chonburi-control-tower/scripts/alphaearth/requirements.txt` | `earthengine-api numpy rasterio Pillow` |
| `chonburi-control-tower/apps/web/src/components/AlphaEarth/ChangeOverlay.tsx` | `useAlphaEarthState()` + `useChangeOverlayLayer()` hooks |
| `chonburi-control-tower/apps/web/src/components/AlphaEarth/AlphaEarthBadge.tsx` | Compact left-sidebar badge with year-pair + stats |
| `chonburi-control-tower/docs/ALPHAEARTH_NOTES.md` | Reference: capabilities matrix, per-dashboard fit, caveats, cost, v2 upgrade path |

## Drop-in to another dashboard (5 minutes)

1. Copy `scripts/alphaearth/` into your repo. Add your AOI to the `AOIS` dict:

   ```python
   AOIS = {
       "chonburi":  (100.965, 13.342, 101.005, 13.380),
       "your-aoi":  (W, S, E, N),  # ← add this
   }
   ```

2. Copy `apps/web/src/components/AlphaEarth/` into `src/components/` (or wherever the dashboard's components live). If your dashboard uses MapLibre / Mapbox / DeckGL, the `BitmapLayer` in `useChangeOverlayLayer` works as-is. For Leaflet, swap the layer factory body for `L.imageOverlay(image, [[s, w], [n, e]])`.

3. One-time gcloud ADC auth (see `chonburi-control-tower/scripts/alphaearth/README.md` for full recipe — needed because Google blocks the default EE client).

4. Bake:
   ```bash
   python3 scripts/alphaearth/fetch_embeddings.py --aoi your-aoi --years 2023 2024
   python3 scripts/alphaearth/compute_change.py \
       --year-a apps/web/public/data/alphaearth/raw/alphaearth-your-aoi-2023.tif \
       --year-b apps/web/public/data/alphaearth/raw/alphaearth-your-aoi-2024.tif \
       --out apps/web/public/data/alphaearth/change-your-aoi-2023-2024.png
   ```

5. Commit the PNG + JSON sidecar + manifest. Done — the layer is live on next deploy.

## Constraints (read before extending)

- 10 m floor at the model. EE single-download cap is 50 MB → **20 m at city scale is the practical default**, not 10 m. (For finer detail, use EE batch Export to Cloud Storage; pipeline doesn't do that yet.)
- Annual cadence only — not near-real-time. For ~weekly Sentinel-1 GRD changes, use a separate pipeline.
- 64-dim vector is opaque. Communicate as "this pixel's signature changed by Δ between 2023 and 2024 — go look", not "the AI says X happened here".
- Cloud-cover noise in monsoon Thailand — trust multi-year trends over single-year jumps.

## Fit map per dashboard

See `chonburi-control-tower/docs/ALPHAEARTH_NOTES.md` §4 for the full table. Quick reference:

- **HIGH**: any city/regional dashboard with land-change relevance — Chonburi, BMA, SCITI, SCITI Monitor, Padawan Kuching, globalmonitor, Nakhon Si Thammarat
- **HIGH-conditional**: Chulalongkorn campus / CT-01 (10 m is fine for quad/cluster scale; carbon overlay is the natural framing for Manoj Lohatepanont's Net Zero brief)
- **MEDIUM**: 2026 Oil Crisis (refinery/storage), Phuket smart bus (density)
- **NO**: anything non-geospatial (day trading, NSP, Axiom, etc.)
