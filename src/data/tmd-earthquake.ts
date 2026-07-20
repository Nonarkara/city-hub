/**
 * TMD Earthquake API — Thai Meteorological Department seismic events.
 * Real-time earthquake data for Thailand and surrounding region.
 *
 * Endpoint: https://data.tmd.go.th/api/DailySeismicEvent/v1/
 * - No API key required
 * - Returns: magnitude, depth, latitude, longitude, location, datetime
 *
 * Recent relevance: 2025 Myanmar earthquake was felt in Bangkok.
 * Early warning and seismic monitoring saves lives.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/tmd-earthquake` : 'https://data.tmd.go.th/api/DailySeismicEvent/v1'

const TTL = 5 * 60 * 1000 // 5 min — earthquakes are rare but important

export interface EarthquakeEvent {
  id: string
  magnitude: number
  depthKm: number
  lat: number
  lng: number
  locationTH: string
  locationEN: string
  datetime: string
  feltInBangkok: boolean
  distanceKmFromBkk: number
}

// Bangkok reference point
const BKK_LAT = 13.7563
const BKK_LNG = 100.5018

/** Haversine distance in km */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function magnitudeColor(mag: number): string {
  if (mag < 3) return '#8bc34a'
  if (mag < 4) return '#fdd835'
  if (mag < 5) return '#fb8c00'
  if (mag < 6) return '#e53935'
  return '#7e0023'
}

function magnitudeLabel(mag: number): string {
  if (mag < 3) return 'minor'
  if (mag < 4) return 'light'
  if (mag < 5) return 'moderate'
  if (mag < 6) return 'strong'
  if (mag < 7) return 'major'
  return 'great'
}

export async function fetchTmdEarthquakes(): Promise<EarthquakeEvent[]> {
  return cachedFetch('tmd/earthquakes', async () => {
    const url = `${BASE}/`
    const res = await fetch(url, { signal: timeoutSignal(15_000) })
    if (!res.ok) throw new Error(`TMD Earthquake ${res.status}`)
    const data = await res.json()

    const events: EarthquakeEvent[] = []
    const rawEvents = data?.EarthquakeEvent ?? data?.events ?? data?.data ?? []
    const eventArray = Array.isArray(rawEvents) ? rawEvents : [rawEvents].filter(Boolean)

    for (const e of eventArray) {
      const lat = Number(e.Latitude ?? e.lat ?? 0)
      const lng = Number(e.Longitude ?? e.lng ?? e.lon ?? 0)
      const mag = Number(e.Magnitude ?? e.magnitude ?? 0)
      if (!lat || !lng || !mag) continue

      const dist = distanceKm(BKK_LAT, BKK_LNG, lat, lng)
      const felt = dist < 500 && mag >= 4.0 // Felt if within 500km and mag >= 4

      events.push({
        id: String(e.EventID ?? e.id ?? `${lat}-${lng}-${mag}`),
        magnitude: mag,
        depthKm: Number(e.Depth ?? e.depth ?? 0),
        lat,
        lng,
        locationTH: String(e.ThaiLocation ?? e.locationTH ?? e.location ?? ''),
        locationEN: String(e.EnglishLocation ?? e.locationEN ?? ''),
        datetime: String(e.OriginDateTime ?? e.datetime ?? e.date ?? ''),
        feltInBangkok: felt,
        distanceKmFromBkk: Math.round(dist),
      })
    }

    // Sort by most recent (assuming datetime format allows string sort)
    events.sort((a, b) => b.datetime.localeCompare(a.datetime))
    return events
  }, TTL)
}

export async function fetchEarthquakeGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const events = await fetchTmdEarthquakes()
  return {
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [e.lng, e.lat] as [number, number],
      },
      properties: {
        id: e.id,
        magnitude: e.magnitude,
        depthKm: e.depthKm,
        locationTH: e.locationTH,
        locationEN: e.locationEN,
        datetime: e.datetime,
        feltInBangkok: e.feltInBangkok,
        distanceKmFromBkk: e.distanceKmFromBkk,
        level: magnitudeLabel(e.magnitude),
        color: magnitudeColor(e.magnitude),
      },
    })),
  }
}

/** Get only recent significant events (last 7 days, mag >= 3.5) */
export async function fetchRecentSignificantEarthquakes(): Promise<EarthquakeEvent[]> {
  const all = await fetchTmdEarthquakes()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  return all.filter((e) => {
    if (e.magnitude < 3.5) return false
    const d = new Date(e.datetime)
    return d >= cutoff
  })
}
