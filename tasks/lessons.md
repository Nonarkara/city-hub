# Lessons — UNL City Hub

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
