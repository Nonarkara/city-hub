/**
 * NASA data: FIRMS (Fire Information for Resource Management System)
 * + GIBS (Global Imagery Browse Services).
 */
import { cachedFetch } from '../lib/cached-fetch'

const TTL_FIRES = 10 * 60 * 1000

/**
 * NASA FIRMS public CSV endpoint for last-24h fires in Thailand.
 * Note: The /api/area/csv/ endpoint requires no key for public area requests.
 * If CORS blocks (likely from a browser), this falls through to the empty-collection
 * fallback and the layer simply doesn't appear — the GISTDA fires layer remains visible
 * for the same data.
 */
export async function firmsThailand24h(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('nasa/firms-th-24h', async () => {
    // VIIRS_SNPP_NRT — best near-real-time fire data, ~3h latency
    // Country code THA, 1-day window
    const url =
      'https://firms.modaps.eosdis.nasa.gov/api/country/csv/c/VIIRS_SNPP_NRT/THA/1'
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`FIRMS ${res.status}`)
      const csv = await res.text()
      return csvToGeoJSON(csv)
    } catch {
      // CORS or rate-limit — return empty FC. The GISTDA hotspots layer still works.
      return { type: 'FeatureCollection', features: [] }
    }
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
export function gibsAerosolTileTemplate(date?: string): string {
  const d = date ?? gibsYesterday()
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
