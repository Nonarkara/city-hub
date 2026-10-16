/**
 * Place-name labels drawn from OpenStreetMap via CARTO.
 * The OSMF public tile server (tile.openstreetmap.org) is not a basemap
 * here — its tile usage policy forbids this kind of app traffic, and it now
 * answers such requests with an explicit 403 "App is not following the tile
 * usage policy" tile (verified 2026-10-16).
 *
 * CARTO requires an API key. Verified 2026-10-16: every basemaps.cartocdn.com
 * endpoint — `dark_only_labels`, `rastertiles/voyager_labels`, `dark_nolabels`
 * — answers an unauthenticated request with a black tile stamped diagonally
 *
 *     API KEY REQUIRED
 *     carto.com/basemaps/apikey
 *
 * That stamp is not subtle and it lands on the primary surface of the whole
 * product. There is no keyless label provider left that respects OSMF's usage
 * policy, so the honest behaviour is to draw no labels at all rather than draw
 * a watermarked map. Set VITE_CARTO_API_KEY (free) to get labels back.
 *
 * Esri imagery itself is unaffected and serves clean tiles without a key —
 * the stamp came from the label layer, not from the imagery.
 */

// Optional-chained: the node test runner imports this module directly, and
// `import.meta.env` does not exist there.
const CARTO_API_KEY = (import.meta.env?.VITE_CARTO_API_KEY as string | undefined)?.trim() ?? ''

/** True when CARTO labels will actually render rather than stamp the map. */
export const hasCartoLabels = CARTO_API_KEY.length > 0

/** Empty without a key: MapLibre must not be handed a stamping tile URL. */
export const OSM_LABEL_TILES: readonly string[] = hasCartoLabels
  ? [
      `https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png?api_key=${CARTO_API_KEY}`,
      `https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png?api_key=${CARTO_API_KEY}`,
      `https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png?api_key=${CARTO_API_KEY}`,
    ]
  : []

/**
 * ODbL credit plus the tile host. Empty without a key, because no OSM labels
 * are being rendered and crediting a source that is not on screen would be a
 * claim the map is not making.
 */
export const OSM_TILE_ATTRIBUTION = hasCartoLabels ? '© OpenStreetMap contributors © CARTO' : ''

export const FORBIDDEN_OSM_TILE_HOST = 'tile.openstreetmap.org'