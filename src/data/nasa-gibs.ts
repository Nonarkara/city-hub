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

/** MODIS Terra True Color Corrected Reflectance — daily 250m. The ground.
 *  Clamps to yesterday: today's granule isn't processed yet, so a date of
 *  "today" (the app default) would 400 and render blank. */
export function gibsTrueColorTiles(targetDate?: string): string {
  const yest = yesterdayUtcDate()
  let date = targetDate ?? yest
  if (date > yest) date = yest
  return buildTileUrl('MODIS_Terra_CorrectedReflectance_TrueColor', date, 9)
}

/** VIIRS Black Marble nighttime lights — 500m. Annual composite. */
export function gibsNightLightsTiles(targetDate?: string): string {
  // Annual composite — fixed reference date works across all of 2024
  const date = targetDate ? `${targetDate.substring(0, 4)}-01-01` : '2024-01-01'
  return buildTileUrl('VIIRS_Black_Marble', date, 8, 'png')
}

/** MODIS Terra Land Surface Temperature Day — monthly 1km. Heat island viz.
 *  Monthly composites publish after the month closes, so clamp the requested
 *  month to the last complete one — the current month would 400 and go blank. */
export function gibsLstTiles(targetDate?: string): string {
  const prevMonth = firstOfPreviousMonth()
  let date = targetDate ? `${targetDate.substring(0, 7)}-01` : prevMonth
  if (date > prevMonth) date = prevMonth
  return buildTileUrl('MODIS_Terra_L3_Land_Surface_Temp_Mthly_Day', date, 7, 'png')
}

/** AIRS Carbon Monoxide (500 hPa volume mixing ratio) — daily, keyless.
 *  Clamps to yesterday like the other daily products. */
export function gibsCOTiles(targetDate?: string): string {
  const yest = yesterdayUtcDate()
  let date = targetDate ?? yest
  if (date > yest) date = yest
  return buildTileUrl('AIRS_L2_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Day', date, 6, 'png')
}

/** OMPS Sulphur Dioxide (planetary boundary layer) — daily, keyless. */
export function gibsSO2Tiles(targetDate?: string): string {
  const yest = yesterdayUtcDate()
  let date = targetDate ?? yest
  if (date > yest) date = yest
  return buildTileUrl('OMPS_SO2_Planetary_Boundary_Layer', date, 6, 'png')
}

/** MODIS Terra NDVI 8-day — 250m vegetation health. AlphaEarth-class proxy. */
export function gibsNdviTiles(targetDate?: string): string {
  // MODIS 8-day composites exist only on a fixed cadence: day-of-year 1, 9, 17, …
  // Arbitrary dates 400 and render blank, so snap to the latest cadence date,
  // then step back one full period to allow for processing lag.
  const base = targetDate ? new Date(targetDate) : new Date()
  const yearStart = Date.UTC(base.getUTCFullYear(), 0, 1)
  const doy = Math.floor((base.getTime() - yearStart) / 86_400_000) + 1
  const lastCompositeDoy = doy - ((doy - 1) % 8)
  const d = new Date(yearStart + (lastCompositeDoy - 1 - 8) * 86_400_000)
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
