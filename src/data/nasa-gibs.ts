/**
 * NASA GIBS — Global Imagery Browse Services.
 *
 * Free, no-auth raster tiles of every NASA satellite product. Tiles served
 * via WMTS in EPSG:3857 (Web Mercator), GoogleMapsCompatible_Level{N}.
 *
 * For full layer catalog: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
 *
 * Date handling: most daily layers want yesterday's date in UTC — today's pass
 * may not be processed yet. Monthly products want first of the previous month.
 */

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

function pad(n: number): string { return n.toString().padStart(2, '0') }

function yesterdayUtcDate(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function firstOfPreviousMonth(): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - 1)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`
}

/**
 * Build a tile URL template MapLibre can consume directly.
 * `level` is the maximum zoom available for that product:
 * - 9: 250m MODIS daily (true color, NDVI)
 * - 8: 500m VIIRS night lights
 * - 7: 1km MODIS LST monthly
 */
function buildTileUrl(
  layer: string,
  date: string,
  level: number,
  ext: 'jpg' | 'png' = 'jpg',
): string {
  return `${GIBS_BASE}/${layer}/default/${date}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`
}

/** MODIS Terra True Color Corrected Reflectance — daily 250m. The ground. */
export function gibsTrueColorTiles(): string {
  return buildTileUrl('MODIS_Terra_CorrectedReflectance_TrueColor', yesterdayUtcDate(), 9)
}

/** VIIRS Black Marble nighttime lights — 500m. Annual composite. */
export function gibsNightLightsTiles(): string {
  // Annual composite — fixed reference date works across all of 2024
  return buildTileUrl('VIIRS_Black_Marble', '2024-01-01', 8, 'png')
}

/** MODIS Terra Land Surface Temperature Day — monthly 1km. Heat island viz. */
export function gibsLstTiles(): string {
  return buildTileUrl('MODIS_Terra_L3_Land_Surface_Temp_Mthly_Day', firstOfPreviousMonth(), 7, 'png')
}

/** MODIS Terra NDVI 8-day — 250m vegetation health. AlphaEarth-class proxy. */
export function gibsNdviTiles(): string {
  // NDVI 8-day composite uses fixed cadence — go back ~16 days to ensure availability
  const d = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000)
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  return buildTileUrl('MODIS_Terra_NDVI_8Day', date, 9, 'png')
}

/**
 * Esri World Imagery — up to 30cm/pixel high-res aerial.
 * Zero auth, public service. ArcGIS XYZ scheme (note: y/x order swapped vs
 * Mercator standard, but MapLibre's {y} placeholder handles it correctly).
 */
export function esriWorldImageryTiles(): string {
  return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
}

/**
 * Sentinel-2 cloudless 2023 mosaic — 10m ESA imagery, cloud-free.
 * Served by EOX (eox.at) via WMTS. Beautiful continuous true-color base.
 */
export function sentinel2CloudlessTiles(): string {
  return 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg'
}
