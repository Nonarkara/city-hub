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

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/air4thai` : 'http://air4thai.pcd.go.th/services'

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
  pm10: number
  o3: number
  co: number
  no2: number
  so2: number
  aqi: number
  aqilevel: number
  lastUpdate: string
}

export interface Air4ThaiData {
  stations: Air4ThaiStation[]
  lastUpdate: string
}

/** Parse AQI level number to text */
function aqiLevelText(level: number): string {
  if (level <= 25) return 'good'
  if (level <= 50) return 'moderate'
  if (level <= 100) return 'unhealthy-sensitive'
  if (level <= 200) return 'unhealthy'
  return 'hazardous'
}

/** Fetch all stations for Bangkok metro (region=1) */
export async function fetchAir4ThaiBangkok(): Promise<Air4ThaiData> {
  return cachedFetch('air4thai/bangkok', async () => {
    const url = `${BASE}/getNewAQI_JSON.php?region=1`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Air4Thai ${res.status}`)
    const data = await res.json()

    const stationsRaw = data?.stations ?? []
    const stations: Air4ThaiStation[] = []

    for (const s of stationsRaw) {
      const lat = Number(s.lat ?? 0)
      const lng = Number(s.lng ?? 0)
      if (!lat || !lng) continue

      const aqi = Number(s.AQI?.aqi ?? 0)
      const aqilevel = Number(s.AQI?.aqilevel ?? 0)

      stations.push({
        stationID: String(s.stationID ?? ''),
        nameTH: String(s.nameTH ?? s.stationID ?? ''),
        nameEN: String(s.nameEN ?? ''),
        areaTH: String(s.areaTH ?? ''),
        areaEN: String(s.areaEN ?? ''),
        lat,
        lng,
        pm25: Number(s.PM25?.value ?? 0),
        pm10: Number(s.PM10?.value ?? 0),
        o3: Number(s.O3?.value ?? 0),
        co: Number(s.CO?.value ?? 0),
        no2: Number(s.NO2?.value ?? 0),
        so2: Number(s.SO2?.value ?? 0),
        aqi,
        aqilevel,
        lastUpdate: String(s.LastUpdate?.PM25?.date ?? s.LastUpdate?.date ?? ''),
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
        level: aqiLevelText(s.aqilevel),
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
    pollutantSums.pm10 += s.pm10
    pollutantSums.o3 += s.o3
    pollutantSums.no2 += s.no2
    pollutantSums.so2 += s.so2
    pollutantSums.co += s.co * 1000 // CO is in mg/m³, scale for comparison
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
