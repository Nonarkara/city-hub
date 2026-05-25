/**
 * Longdo Map — Thai-native cartography (longdo.com).
 *
 * Strengths over the UNL basemap: hyper-local Bangkok POIs, Thai-language
 * street names, soi-level detail that global basemaps miss. The natural
 * "alt basemap" for any Thai city dashboard.
 *
 * Reality check on what this key unlocks (probed 2026-05-26):
 *   ✅ Base map tiles via ms.longdo.com/mmmap/tile.php — works
 *   ❌ Traffic / weather as MapLibre raster layers — Longdo only serves
 *      those through their proprietary JS SDK at runtime, not as
 *      standalone tile endpoints. Tried tile.php?layer=traffic, msn-server
 *      tile path, and several documented variants — all return base map.
 *   ❌ REST search / POI / cluster — return 404/500 with this key;
 *      those likely need a different product tier.
 *
 * If we want Longdo Traffic on the map later, the path is: embed their JS
 * SDK and render its traffic layer onto a transparent canvas stacked on
 * top of MapLibre. Not in scope here.
 */
const KEY = import.meta.env.VITE_LONGDO_KEY as string | undefined

const TILE_BASE = 'https://ms.longdo.com/mmmap/tile.php'

/** Is a Longdo key configured? Used to gate the basemap layer. */
export function longdoKeyAvailable(): boolean {
  return typeof KEY === 'string' && KEY.length > 8
}

/**
 * MapLibre tile URL template for the Longdo base map.
 * Uses XYZ ({z}/{x}/{y}) Web Mercator (epsg3857) — same scheme as our
 * other raster sources, so it drops straight into MapLibre.
 */
export function longdoBasemapTiles(): string {
  if (!KEY) return ''
  return `${TILE_BASE}?zoom={z}&x={x}&y={y}&key=${KEY}&proj=epsg3857&HD=1`
}
