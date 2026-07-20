# Lessons — UNL City Hub

## 2026-07-21 · A "valid" Mapbox token can still 401 on tiles — the account was disabled
- **What went wrong:** After swapping in a new restricted Mapbox token, the map was black. `/tokens/v2` said `TokenValid`, so the token looked fine — but every tile/style request returned `401 {"message":"Not Authorized - Invalid Token"}`. Chased it as a URL-restriction/scope problem for several cycles. Root cause: the **whole Mapbox account** is disabled (free-tier cap or billing) — the OLD token 401s identically, and 401s are cache-controlled 12h.
- **Correct behaviour:** When Mapbox tiles 401, test BOTH the token metadata (`/tokens/v2`) AND a raw tile fetch. TokenValid + tile-401 = account-level, not token-level; no token change fixes it (billing is Dr Non's). Don't trust a URL-restricted token via curl OR the in-app Browser pane either — both lack a real origin and 401 the same way a broken token would. Only real Chrome on the live allowlisted domain is a valid test.
- **How to recognise:** all tokens 401 at once; `/tokens/v2` = TokenValid; `cache-control: max-age=43200` on the 401. See [[reference_mapbox-account-down]]. Fix path: go tokenless (ESRI + AWS Terrarium + OSM) — it's more resilient and matches "open + precise" anyway.

## 2026-07-21 · Tokenless 3D city stack (no Mapbox): Terrarium terrain + OSM building extrusion
- **What went wrong / learned:** Needed Google-Earth-style 3D for Kranj but Mapbox was down. Mapbox's `composite`/`building` layer and terrain-dem are the usual path — all dead here.
- **Correct behaviour:** Fully tokenless works and is cleaner: `raster-dem` from **AWS Terrarium** (`s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, `encoding:'terrarium'`) + `map.setTerrain` drapes ANY basemap (ESRI satellite → relief). Buildings: bake OSM footprints once to a static GeoJSON (Overpass; **main mirror needs a User-Agent header or it 406s** — use kumi mirror or set UA) and `fill-extrusion` by a computed height property. 3D cities need pitch set at BOTH map init (deep-link path) and in flyTo (tab-click path) — the fly effect skips the first mount.
- **How to recognise:** if a demo needs 3D and Mapbox is unavailable/undesired, reach for Terrarium + OSM, not Mapbox composite. See [[feature_kranj-3d-demo]].

## 2026-06-26 · city-hub Pages project is NOT git-auto-deployed (deploy = build + wrangler)
- **What went wrong:** Twice told Dr Non "pushed, refresh in ~3 min" assuming a `git push` to the GitHub repo auto-builds Cloudflare Pages. It does not. `wrangler pages project list` shows `city-hub` with **Git Provider: No**; production sat on commit `a3c6f31` for 2 weeks while I pushed commits to GitHub that never went live.
- **Correct behaviour:** Deploy is **manual, local-build + direct upload**:
  `npm run build` (Vite inlines `VITE_*` from `.env.local` at build time) → `wrangler pages deploy dist --project-name=city-hub --branch=main`. The main alias `city-hub.pages.dev` updates within seconds.
- **How to recognise:** `git push` alone never changes the live site. Confirm with `wrangler pages deployment list --project-name=city-hub` or `curl -s https://city-hub.pages.dev/ | grep index-` (bundle hash changes). `unl-city-hub.pages.dev` is the older secondary alias; active prod is `city-hub`.

## 2026-06-26 · Preview sandbox blocks external map tiles — verify maps on the deployed site via Chrome MCP
- **What went wrong:** Spent many cycles trying to verify the Mapbox traffic overlay in the Claude Preview sandbox. The sandbox iframe blocks external tile servers (NASA GIBS = `Failed to fetch (0)`, Mapbox tiles never requested), so panes render **black** and `map.isStyleLoaded()` stays false → the overlay (correctly) never applies. Looked like a code bug; it was the environment.
- **Correct behaviour:** A direct `fetch()` from `preview_eval` *can* reach the tile servers (different context) — use it to prove endpoint+token work (Mapbox traffic tile `200`, 44 KB). To verify maps actually **render**, use the **Chrome MCP** (`mcp__Claude_in_Chrome__*`) against the deployed URL — a real browser, no sandbox CORS wall. That's where the traffic congestion lines showed.
- **How to recognise:** Maps black in preview but open-meteo etc. return 200; console shows `AJAXError: Failed to fetch (0)` for tile hosts. Verify on the deployed site, not in preview.

## 2026-06-26 · Stale SPA after redeploy → "Failed to fetch dynamically imported module"
- **What went wrong:** After deploying, opening Split in the browser threw `Failed to fetch dynamically imported module: .../SplitCompare-<oldhash>.js` → ErrorBoundary ("SYSTEM ERROR"). The browser had the **old cached `index.html` shell** referencing lazy-chunk hashes the new deploy deleted.
- **Correct behaviour:** Not a code bug. Hard-reload / cache-bust (`?cb=...`) or visit the deployment-specific subdomain for the fresh shell. A normal user reload fixes it.
- **How to recognise:** `Failed to fetch dynamically imported module` naming a chunk hash that 404s, right after a redeploy.

## 2026-06-10 · Grid snap system — floating panels obstructing map

- **What went wrong:** `.small-multiples-wrap` and `.multicity-chart-wrap` were positioned at `right: 340px` with `width: 340px`. At 1456px viewport the SmallMultiplesGrid was covering x:776–1116 — deep inside the map center zone. Map visible area shrank to ~245px wide. The `.counterpart-strip` bled from `left:220px` all the way to `right:0`, running under the right panel instead of stopping at its left edge. `.compare-panel` had a hard-coded `z-index: 20` outside the design system z-scale. Topbar mode buttons ("SIT ROOM", "ACTION CENTER") wrapped at 1280–1400px viewport widths.
- **Correct behavior:**
  - Every floating panel must snap to a zone boundary — never float freely inside the map zone.
  - `--snap-right: 320px` is the right panel left edge. Use `right: 320px` for panels that should abut the right column.
  - SmallMultiplesGrid defaults to `collapsed: true` — shows only a 44px toggle strip. User opts in to expand it. Map stays clear by default.
  - CounterpartStrip: `right: 320px` (not `right: 0`) to stop at the right panel boundary.
  - z-index values must use CSS variables (`var(--z-modal)`, `var(--z-overlay)`, etc.) — never raw numbers.
  - Topbar labels wrapped inside `<span className="topbar-btn-label">` — hidden via `@media (max-width: 1400px)` so `·` dots remain as affordances, aria-labels preserve accessibility.
- **How to recognize:** If any fixed-position element uses `right: N px` where N ≠ 0 and N ≠ 320 (right panel width), verify the element is actually snapped to a zone boundary and not floating in the map zone. If a panel is always-visible by default and wider than ~120px, it should have a collapse toggle.

## 2026-05-25 · GISTDA AirQuality_hourly endpoint is intermittently empty
- **What went wrong:** Built PM2.5 STATIONS layer expecting the GISTDA `FR_Fire/AirQuality_hourly` service to be populated. At PoC time the entire service returned 0 features across all provinces, leaving the layer empty.
- **Correct behavior:** The KPI panel's live PM2.5 uses a different endpoint (`pm25.gistda.or.th/rest/getPm25byLocation`) which always has data. The stations layer is wired correctly — just upstream-dry.
- **How to recognize:** Returns shape `{ features: [], displayFieldName, fieldAliases, ... }` with `featureCount === 0` consistently. Service still responds 200 OK.
- **Treatment:** Don't fake. Layer renders empty when source is empty. Document the gap in the layer tooltip.

## 2026-05-25 · GISTDA hotspot_npp_daily service hasn't refreshed since Apr 2023
- **What went wrong:** Shared lib `fetchHotspotsGeoJSON()` uses `where=datetime > CURRENT_TIMESTAMP - 2` — but the field is `date` (epoch ms), not `datetime`. ArcGIS returns 400 "Failed to execute query".
- **Also:** When unfiltered, the endpoint returns 1001 features all dated 2023-04-06 — the upstream service hasn't been refreshed in years.
- **Correct behavior:** Fetch unfiltered (1000-row cap) and filter client-side by the `date` epoch field. Be honest about the vintage in the layer description.
- **How to recognize:** ArcGIS 400 error with message "Failed to execute query." for time-clause queries; or all features showing the same `date` from years ago.
- **Treatment:** Bypassed the shared lib helper for this specific endpoint in `src/data/gistda.ts`. Wave 2 should report this upstream to GISTDA and consider a different source (NASA FIRMS via Worker proxy).

## 2026-05-25 · CORS walls confirmed for FIRMS + data.go.th
- **What went wrong:** Direct browser fetch to `firms.modaps.eosdis.nasa.gov` and `data.go.th/api/3/...` both fail with `TypeError: Failed to fetch` (CORS preflight blocked).
- **Correct behavior:** Plan B already in the playbook §02 — server-side proxy via a single Cloudflare Worker. Don't burn cycles trying public CORS proxies (rightly blocked by Claude Code's sandbox as data exfiltration risk).
- **How to recognize:** `TypeError: Failed to fetch` with no HTTP status; OPTIONS preflight returns 4xx or no CORS headers.
- **Treatment:** Honest empty state in the UI ("CORS BLOCKED · WAVE 2 WILL PROXY"). Layers/panels are wired and will populate once the proxy lands.

## 2026-05-25 · Preview screenshot tool letterboxes viewport
- **What went wrong:** After `window.location.reload()` in the preview, the in-page viewport size persisted at 1280×720 but the screenshot tool rendered the app within a much larger frame with extensive black letterbox.
- **Correct behavior:** Verify via `preview_eval` (which reports the true viewport) before assuming the screenshot is broken. Use `preview_resize` to set explicit dimensions — preset names sometimes reset to the wrong defaults.
- **Treatment:** Trust eval over screenshot for layout state. Screenshots are still useful for color and visual style verification when the viewport renders correctly.
