/**
 * data.gov.sg integration — Singapore's national open-data portal.
 *
 * Public, no key, CORS-friendly. Endpoints used:
 *   - /v1/environment/psi              regional PSI (5 regions × all pollutants)
 *   - /v1/environment/rainfall         rain gauges (~70 stations, 5-min readings)
 *   - /v1/environment/uv-index         national UV index
 *   - /v1/environment/air-temperature  air temp stations
 *   - /v1/transport/taxi-availability  live taxi positions as MultiPoint geom
 *
 * This is what "deep open data" looks like when a city actually publishes it.
 * UNL has zero offering for Singapore beyond the basemap.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const BASE = 'https://api.data.gov.sg/v1'
const TTL_SHORT = 2 * 60_000
const TTL_MED = 10 * 60_000

// ── PSI (regional air quality) ─────────────────────────────────────────────

interface PSIReading {
  region: 'north' | 'south' | 'east' | 'west' | 'central'
  psi_24h?: number
  pm25_24h?: number
  pm10_24h?: number
  o3_8h?: number
  no2_1h?: number
  so2_24h?: number
  co_8h?: number
}

interface RegionMeta {
  name: string
  label_location: { latitude: number; longitude: number }
}

export interface PSIBundle {
  timestamp: string
  regions: PSIReading[]
  regionMeta: RegionMeta[]
  /** Worst region by PSI 24h. */
  worst?: PSIReading
}

interface PSIRaw {
  region_metadata: RegionMeta[]
  items: Array<{
    timestamp: string
    update_timestamp: string
    readings: Record<string, Record<string, number>>
  }>
}

/**
 * Singapore PSI — 5 regions × all pollutants. Updated hourly.
 */
export async function fetchSingaporePSI(): Promise<PSIBundle | null> {
  return cachedFetch('datagov-sg/psi', async () => {
    try {
      const res = await fetch(`${BASE}/environment/psi`, { signal: timeoutSignal(15_000) })
      if (!res.ok) throw new Error(`data.gov.sg PSI ${res.status}`)
      const raw = (await res.json()) as PSIRaw
      const item = raw.items?.[0]
      if (!item) return null
      const regionMeta = raw.region_metadata ?? []
      const regions: PSIReading[] = (['north', 'south', 'east', 'west', 'central'] as const).map((r) => ({
        region: r,
        psi_24h: item.readings.psi_twenty_four_hourly?.[r],
        pm25_24h: item.readings.pm25_twenty_four_hourly?.[r],
        pm10_24h: item.readings.pm10_twenty_four_hourly?.[r],
        o3_8h: item.readings.o3_eight_hour_max?.[r],
        no2_1h: item.readings.no2_one_hour_max?.[r],
        so2_24h: item.readings.so2_twenty_four_hourly?.[r],
        co_8h: item.readings.co_eight_hour_max?.[r],
      }))
      const worst = regions.reduce((w, r) => ((r.psi_24h ?? 0) > (w?.psi_24h ?? 0) ? r : w), regions[0])
      return { timestamp: item.timestamp, regions, regionMeta, worst }
    } catch (err) {
      // Throw so cachedFetch can serve stale instead of caching a null result.
      console.warn('[datagov-sg] PSI fetch failed:', err)
      throw err
    }
  }, TTL_MED)
}

// ── Rainfall stations ─────────────────────────────────────────────────────

export interface RainfallStation {
  id: string
  name: string
  lat: number
  lng: number
  rainfallMm5min: number
}

interface RainfallRaw {
  metadata: {
    stations: Array<{
      id: string
      device_id: string
      name: string
      location: { latitude: number; longitude: number }
    }>
  }
  items: Array<{
    timestamp: string
    readings: Array<{ station_id: string; value: number }>
  }>
}

export async function fetchSingaporeRainfall(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('datagov-sg/rainfall', async () => {
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
    try {
      const res = await fetch(`${BASE}/environment/rainfall`, { signal: timeoutSignal(15_000) })
      if (!res.ok) throw new Error(`data.gov.sg rainfall ${res.status}`)
      const raw = (await res.json()) as RainfallRaw
      const item = raw.items?.[0]
      if (!item) return empty
      const readings = new Map<string, number>()
      for (const r of item.readings ?? []) readings.set(r.station_id, r.value)
      const features: GeoJSON.Feature[] = (raw.metadata?.stations ?? []).map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.location.longitude, s.location.latitude] },
        properties: {
          id: s.id,
          name: s.name,
          rainfall_mm: readings.get(s.id) ?? 0,
        },
      }))
      return { type: 'FeatureCollection', features }
    } catch (err) {
      console.warn('[datagov-sg] rainfall fetch failed:', err)
      throw err
    }
  }, TTL_SHORT)
}

// ── UV index ──────────────────────────────────────────────────────────────

export interface SingaporeUVPoint {
  timestamp: string
  value: number
}

interface UVRaw {
  items: Array<{
    timestamp: string
    update_timestamp: string
    index: Array<{ value: number; timestamp: string }>
  }>
}

export async function fetchSingaporeUV(): Promise<{ current: number; series: SingaporeUVPoint[] } | null> {
  return cachedFetch('datagov-sg/uv', async () => {
    try {
      const res = await fetch(`${BASE}/environment/uv-index`, { signal: timeoutSignal(15_000) })
      if (!res.ok) throw new Error(`data.gov.sg UV ${res.status}`)
      const raw = (await res.json()) as UVRaw
      const latest = raw.items?.[0]
      if (!latest) return null
      const series = (latest.index ?? []).map((p) => ({ timestamp: p.timestamp, value: p.value }))
      return { current: series[0]?.value ?? 0, series }
    } catch (err) {
      console.warn('[datagov-sg] UV fetch failed:', err)
      throw err
    }
  }, TTL_MED)
}

// ── Taxi availability ─────────────────────────────────────────────────────

interface TaxiRaw {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'MultiPoint'; coordinates: number[][] }
    properties: { timestamp: string; taxi_count: number }
  }>
}

export async function fetchSingaporeTaxis(): Promise<{
  count: number
  geo: GeoJSON.FeatureCollection
} | null> {
  return cachedFetch('datagov-sg/taxi', async () => {
    try {
      const res = await fetch(`${BASE}/transport/taxi-availability`, { signal: timeoutSignal(15_000) })
      if (!res.ok) throw new Error(`data.gov.sg taxis ${res.status}`)
      const raw = (await res.json()) as TaxiRaw
      const f = raw.features?.[0]
      if (!f) return null
      // Convert MultiPoint into individual Point features for rendering
      const coords = (f.geometry?.coordinates ?? []) as number[][]
      const features: GeoJSON.Feature[] = coords.map((c, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: c },
        properties: { id: `taxi-${i}`, ts: f.properties.timestamp },
      }))
      return {
        count: f.properties?.taxi_count ?? coords.length,
        geo: { type: 'FeatureCollection', features },
      }
    } catch (err) {
      console.warn('[datagov-sg] taxi fetch failed:', err)
      throw err
    }
  }, TTL_SHORT)
}
