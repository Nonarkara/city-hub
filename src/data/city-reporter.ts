/**
 * City Reporter v2 integration — live citizen-submitted incident reports.
 *
 * Backend: https://city-reporter-v2.onrender.com (Non's Render-deployed
 * Express + LINE/Telegram + Supabase service). Already in production.
 * Returns GeoJSON of citizen submissions across Bangkok, Chiang Mai,
 * Phuket, and any other Thai location citizens have reported from.
 *
 * UNL has no equivalent — they're a basemap reseller, not a civic platform.
 */
import { cachedFetch } from '../lib/cached-fetch'

const ENDPOINT = 'https://city-reporter-v2.onrender.com/api/reports/geojson'
const TTL = 2 * 60_000 // 2 min — citizen reports are time-sensitive

export interface CitizenReport {
  id: string
  ticket: string
  type: string
  urgency: 'สูง' | 'ปานกลาง' | 'ต่ำ' | string
  status: 'received' | 'assigned' | 'in_progress' | 'resolved' | string
  timestamp: string
}

export async function fetchCitizenReports(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('city-reporter/reports-geojson', async () => {
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
    try {
      const res = await fetch(ENDPOINT)
      if (!res.ok) throw new Error(`City Reporter ${res.status}`)
      const data = (await res.json()) as GeoJSON.FeatureCollection
      return data && data.type === 'FeatureCollection' ? data : empty
    } catch (err) {
      // Throw so cachedFetch can serve stale instead of caching an empty result.
      console.warn('[city-reporter] fetch failed:', err)
      throw err
    }
  }, TTL)
}

/**
 * Filter the global feed to features within an [w,s,e,n] bbox.
 * Used to scope to the active city.
 */
export function reportsInBbox(
  fc: GeoJSON.FeatureCollection,
  bbox: [number, number, number, number],
): GeoJSON.FeatureCollection {
  const [w, s, e, n] = bbox
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => {
      if (f.geometry.type !== 'Point') return false
      const [lng, lat] = f.geometry.coordinates as [number, number]
      return lng >= w && lng <= e && lat >= s && lat <= n
    }),
  }
}

/** Aggregate stats from a feature collection — for narrative grounding. */
export function summarizeReports(fc: GeoJSON.FeatureCollection): {
  total: number
  byUrgency: Record<string, number>
  byType: Record<string, number>
} {
  const byUrgency: Record<string, number> = {}
  const byType: Record<string, number> = {}
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as CitizenReport
    const u = p.urgency ?? 'unknown'
    const t = p.type ?? 'unknown'
    byUrgency[u] = (byUrgency[u] ?? 0) + 1
    byType[t] = (byType[t] ?? 0) + 1
  }
  return { total: fc.features.length, byUrgency, byType }
}
