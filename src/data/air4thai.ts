/**
 * Air4Thai — Pollution Control Department (PCD) official air quality.
 * The authoritative Thai government source for air quality monitoring.
 *
 * Endpoint: http://air4thai.pcd.go.th/services/getNewAQI_JSON.php
 * - No API key required
 * - ~77 stations across 46 provinces, ~15 in Bangkok metro
 * - Returns: PM2.5, PM10, O3, CO, NO2, SO2, AQI, lat/lng, timestamps
 *
 * This is the source the BMA and Ministry of Public Health actually use.
 * We display it alongside GISTDA and WAQI for multi-source validation.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/air4thai` : 'https://air4thai.pcd.go.th/services'

const TTL = 10 * 60 * 1000 // 10 min — PCD updates hourly

export interface Air4ThaiStation {
  stationID: string
  nameTH: string
  nameEN: string
  areaTH: string
  areaEN: string
  lat: number
  lng: number
  pm25: number
  pm10: number | null
  o3: number | null
  co: number | null
  no2: number | null
  so2: number | null
  aqi: number
  aqilevel: number
  lastUpdate: string
}

export interface Air4ThaiData {
  stations: Air4ThaiStation[]
  lastUpdate: string
}

/** Map a real AQI number to a band label (matches the map's AQI_COLORS buckets) */
function aqiLevelText(aqi: number): string {
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'unhealthy-sensitive'
  if (aqi <= 200) return 'unhealthy'
  return 'hazardous'
}

/** Derive PCD's 1–5 band from the AQI number (the live payload carries only AQI.aqi) */
function aqiLevelFromAqi(aqi: number): number {
  if (aqi <= 50) return 1
  if (aqi <= 100) return 2
  if (aqi <= 150) return 3
  if (aqi <= 200) return 4
  return 5
}

/** PCD marks offline readings with '-1' or empty strings — treat as missing, never 0. */
function parseReading(v: unknown): number | null {
  if (v == null || v === '' || v === '-1') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Fetch all stations for Bangkok metro (region=1) */
export async function fetchAir4ThaiBangkok(): Promise<Air4ThaiData> {
  return cachedFetch('air4thai/bangkok', async () => {
    const url = `${BASE}/getNewAQI_JSON.php?region=1`
    const res = await fetch(url, { signal: timeoutSignal(15_000) })
    if (!res.ok) throw new Error(`Air4Thai ${res.status}`)
    const data = await res.json()

    const stationsRaw = data?.stations ?? []
    const stations: Air4ThaiStation[] = []

    // Live record shape (all values are strings):
    // { lat, long, AQILast: { date, PM25: { aqi, value }, AQI: { aqi }, ... } }
    for (const s of stationsRaw) {
      const lat = Number(s.lat)
      const lng = Number(s.long ?? s.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) continue

      const last = (s.AQILast ?? {}) as Record<string, unknown>
      const aqi = parseReading((last.AQI as Record<string, unknown> | undefined)?.aqi)
      const pm25 = parseReading((last.PM25 as Record<string, unknown> | undefined)?.value)
      // No live AQI or PM2.5 reading → station is offline; skip it
      if (aqi == null || pm25 == null) continue

      stations.push({
        stationID: String(s.stationID ?? ''),
        nameTH: String(s.nameTH ?? s.stationID ?? ''),
        nameEN: String(s.nameEN ?? ''),
        areaTH: String(s.areaTH ?? ''),
        areaEN: String(s.areaEN ?? ''),
        lat,
        lng,
        pm25,
        pm10: parseReading((last.PM10 as Record<string, unknown> | undefined)?.value),
        o3: parseReading((last.O3 as Record<string, unknown> | undefined)?.value),
        co: parseReading((last.CO as Record<string, unknown> | undefined)?.value),
        no2: parseReading((last.NO2 as Record<string, unknown> | undefined)?.value),
        so2: parseReading((last.SO2 as Record<string, unknown> | undefined)?.value),
        aqi,
        aqilevel: aqiLevelFromAqi(aqi),
        lastUpdate: String(last.date ?? ''),
      })
    }

    return {
      stations,
      lastUpdate: String(data?.LastUpdate ?? ''),
    }
  }, TTL)
}

/** Convert to GeoJSON for map rendering */
export async function fetchAir4ThaiGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const data = await fetchAir4ThaiBangkok()
  return {
    type: 'FeatureCollection',
    features: data.stations.map((s) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.lng, s.lat] as [number, number],
      },
      properties: {
        stationID: s.stationID,
        nameTH: s.nameTH,
        nameEN: s.nameEN,
        areaTH: s.areaTH,
        areaEN: s.areaEN,
        pm25: s.pm25,
        pm10: s.pm10,
        o3: s.o3,
        co: s.co,
        no2: s.no2,
        so2: s.so2,
        aqi: s.aqi,
        aqilevel: s.aqilevel,
        level: aqiLevelText(s.aqi),
        lastUpdate: s.lastUpdate,
      },
    })),
  }
}

/** Get Bangkok-wide summary stats from PCD stations */
export async function fetchAir4ThaiSummary(): Promise<{
  avgPm25: number
  maxPm25: number
  maxStation: string
  avgAqi: number
  stationCount: number
  dominantPollutant: string
}> {
  const data = await fetchAir4ThaiBangkok()
  const stations = data.stations
  if (stations.length === 0) {
    return { avgPm25: 0, maxPm25: 0, maxStation: '—', avgAqi: 0, stationCount: 0, dominantPollutant: '—' }
  }

  let pm25Sum = 0
  let maxPm25 = 0
  let maxStation = '—'
  let aqiSum = 0

  // Track which pollutant is highest on average
  const pollutantSums: Record<string, number> = { pm25: 0, pm10: 0, o3: 0, no2: 0, so2: 0, co: 0 }

  for (const s of stations) {
    pm25Sum += s.pm25
    aqiSum += s.aqi
    if (s.pm25 > maxPm25) {
      maxPm25 = s.pm25
      maxStation = s.nameEN || s.nameTH
    }
    pollutantSums.pm25 += s.pm25
    pollutantSums.pm10 += s.pm10 ?? 0
    pollutantSums.o3 += s.o3 ?? 0
    pollutantSums.no2 += s.no2 ?? 0
    pollutantSums.so2 += s.so2 ?? 0
    pollutantSums.co += (s.co ?? 0) * 1000 // CO is in mg/m³, scale for comparison
  }

  const count = stations.length
  const dominantPollutant = Object.entries(pollutantSums)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'pm25'

  return {
    avgPm25: Math.round(pm25Sum / count),
    maxPm25: Math.round(maxPm25),
    maxStation,
    avgAqi: Math.round(aqiSum / count),
    stationCount: count,
    dominantPollutant: dominantPollutant.toUpperCase(),
  }
}
