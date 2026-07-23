/**
 * NASA data: FIRMS (Fire Information for Resource Management System)
 * + GIBS (Global Imagery Browse Services).
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const TTL_FIRES = 10 * 60 * 1000

const PROXY    = import.meta.env.VITE_PROXY_URL as string | undefined
const MAP_KEY  = import.meta.env.VITE_FIRMS_MAP_KEY as string | undefined

/**
 * NASA FIRMS CSV for last-24h fires in Thailand (VIIRS_SNPP_NRT, ~3h latency).
 *
 * FIRMS requires a free MAP_KEY (https://firms.modaps.eosdis.nasa.gov/api/map_key/)
 * — the keyless endpoint returns HTTP 400, and the endpoint is CORS-blocked
 * from the browser anyway. Two working paths:
 *   1. Proxied (production): `${VITE_PROXY_URL}/firms/country/csv/...` — the
 *      Worker injects its FIRMS_MAP_KEY secret into the URL path.
 *   2. Direct (dev): needs VITE_FIRMS_MAP_KEY in .env.local.
 * With neither configured this throws; loaders catch and the layer stays
 * hidden (the GISTDA fires layer covers the same data).
 */
export async function firmsThailand24h(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('nasa/firms-th-24h', async () => {
    if (!PROXY && !MAP_KEY) throw new Error('FIRMS MAP key not configured')
    const url = PROXY
      ? `${PROXY}/firms/country/csv/VIIRS_SNPP_NRT/THA/1`
      : `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${MAP_KEY}/VIIRS_SNPP_NRT/THA/1`
    const res = await fetch(url, { signal: timeoutSignal(15_000) })
    if (!res.ok) throw new Error(`FIRMS ${res.status}`)
    const csv = await res.text()
    return csvToGeoJSON(csv)
  }, TTL_FIRES)
}

function csvToGeoJSON(csv: string): GeoJSON.FeatureCollection {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return { type: 'FeatureCollection', features: [] }
  const header = lines[0].split(',').map((h) => h.trim())
  const latIdx = header.indexOf('latitude')
  const lngIdx = header.indexOf('longitude')
  const brIdx = header.indexOf('bright_ti4')
  const confIdx = header.indexOf('confidence')
  const dateIdx = header.indexOf('acq_date')
  const timeIdx = header.indexOf('acq_time')
  const features: GeoJSON.Feature[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const lat = Number(cols[latIdx])
    const lng = Number(cols[lngIdx])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        brightness: brIdx >= 0 ? Number(cols[brIdx]) : null,
        confidence: confIdx >= 0 ? cols[confIdx] : null,
        acq_date: dateIdx >= 0 ? cols[dateIdx] : null,
        acq_time: timeIdx >= 0 ? cols[timeIdx] : null,
        source: 'FIRMS-VIIRS',
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

/**
 * GIBS WMTS tile template for MODIS Aerosol Optical Depth.
 * Date defaults to yesterday (UTC) — many GIBS layers are 1 day behind.
 */
export function gibsAerosolTileTemplate(targetDate?: string): string {
  // Daily product — clamp to yesterday; today's granule isn't processed yet.
  const yest = gibsYesterday()
  let d = targetDate ?? yest
  if (d > yest) d = yest
  // MODIS_Combined_Value_Added_AOD — daily, level 6 cap, PNG tiles
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_Value_Added_AOD/default/${d}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`
}

export function gibsViirsTrueColorTemplate(date?: string): string {
  const d = date ?? gibsYesterday()
  // VIIRS_SNPP_CorrectedReflectance_TrueColor — daily JPEG tiles, level 9 cap
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
}

function gibsYesterday(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}
