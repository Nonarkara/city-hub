/**
 * WAQI (World Air Quality Index) / aqicn.org — a second AQ sensor network
 * distinct from GISTDA. Free, but requires a token from
 * https://aqicn.org/data-platform/token/
 *
 * Set `VITE_WAQI_TOKEN` in `.env.local` to activate. Without a real token
 * the API returns sandbox data (not Bangkok-accurate).
 *
 * Two endpoints used:
 *   /feed/here/?token=...           single nearest station to a coordinate
 *   /map/bounds/?latlng=...&token=... all stations in a bbox (GeoJSON-able)
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE  = PROXY ? `${PROXY}/waqi` : 'https://api.waqi.info'
// Token is injected server-side by the Worker when routing through PROXY.
// Falls back to 'demo' for direct calls (dev without a proxy).
const TOKEN = PROXY ? '' : ((import.meta.env.VITE_WAQI_TOKEN as string | undefined) ?? 'demo')

const TTL = 5 * 60 * 1000

const BKK_BBOX: [number, number, number, number] = [100.30, 13.45, 100.95, 14.00]

export interface WAQIStation {
  uid: number
  name: string
  lat: number
  lng: number
  aqi: number
}

export function waqiTokenIsReal(): boolean {
  return TOKEN !== 'demo' && TOKEN.length > 4
}

/**
 * Generic — fetch WAQI stations for any bbox.
 * bbox = [west, south, east, north]
 */
export async function fetchWAQIStationsByBbox(
  bbox: [number, number, number, number],
  cacheKey?: string,
): Promise<GeoJSON.FeatureCollection> {
  const key = cacheKey ?? `waqi/bbox/${bbox.map((n) => n.toFixed(3)).join(',')}`
  return cachedFetch(key, async () => {
    // Throw on failure so cachedFetch can serve stale — never cache an
    // error-as-empty result for the full TTL.
    // WAQI bounds API uses lat1,lng1,lat2,lng2 (SW corner first, then NE corner)
    const [w, s, e, n] = bbox
    const latlng = `${s},${w},${n},${e}`
    // When proxied: Worker injects token. Direct: append token (demo or real).
    const tokenParam = TOKEN ? `&token=${TOKEN}` : ''
    const url = `${BASE}/map/bounds/?latlng=${latlng}${tokenParam}`
    const res = await fetch(url, { signal: timeoutSignal(15_000) })
    if (!res.ok) throw new Error(`WAQI ${res.status}`)
    const json = await res.json()
    if (json?.status !== 'ok') throw new Error(`WAQI status ${json?.status ?? 'unknown'}`)
    const stations = (json.data ?? []) as Array<{ uid: number; lat: number; lon: number; aqi: string; station: { name: string } }>
    return {
      type: 'FeatureCollection' as const,
      features: stations
        .filter((s) => Number.isFinite(Number(s.aqi)))
        .map((s): GeoJSON.Feature => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: {
            uid: s.uid,
            name: s.station?.name ?? `WAQI ${s.uid}`,
            aqi: Number(s.aqi),
            level:
              Number(s.aqi) >= 301 ? 'hazardous' :
              Number(s.aqi) >= 201 ? 'very-unhealthy' :
              Number(s.aqi) >= 151 ? 'unhealthy' :
              Number(s.aqi) >= 101 ? 'unhealthy-sensitive' :
              Number(s.aqi) >= 51  ? 'moderate' :
                                     'good',
          },
        })),
    }
  }, TTL)
}

/** Bangkok wrapper — preserves existing import path. */
export async function bangkokWAQIStations(): Promise<GeoJSON.FeatureCollection> {
  return fetchWAQIStationsByBbox(BKK_BBOX, 'waqi/bangkok-bbox')
}
