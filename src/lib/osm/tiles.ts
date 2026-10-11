/**
 * Place-name labels drawn from OpenStreetMap via CARTO.
 * The OSMF public tile server (tile.openstreetmap.org) is not a basemap
 * here — its tile usage policy forbids this kind of app traffic.
 */
export const OSM_LABEL_TILES = [
  'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
  'https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
  'https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
] as const

/** Required ODbL credit plus the tile host. Shown in the map attribution control. */
export const OSM_TILE_ATTRIBUTION = '© OpenStreetMap contributors © CARTO'

export const FORBIDDEN_OSM_TILE_HOST = 'tile.openstreetmap.org'
