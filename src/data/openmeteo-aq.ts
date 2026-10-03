/**
 * Open-Meteo Air Quality API — CORS-safe, no auth.
 * Provides US AQI + individual pollutant readings for any city by lat/lng.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from '../lib/request-timeout'

const TTL = 10 * 60_000

export interface CityAQI {
  usAqi: number
  pm25: number
  pm10: number
  no2: number
  o3: number
  so2: number
  co: number
  level: 'good' | 'moderate' | 'unhealthy-sensitive' | 'unhealthy' | 'very-unhealthy' | 'hazardous'
}

/** Back-compat alias. */
export type BangkokAQI = CityAQI

function aqiToLevel(aqi: number): CityAQI['level'] {
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'unhealthy-sensitive'
  if (aqi <= 200) return 'unhealthy'
  if (aqi <= 300) return 'very-unhealthy'
  return 'hazardous'
}

function finiteField(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Open-Meteo AQ invalid field: current.${key}`)
  }
  return value
}

/** Validate the external response before any value reaches the UI or cache. */
export function parseOpenMeteoAQ(payload: unknown): CityAQI {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Open-Meteo AQ response is not an object')
  }
  const current = (payload as Record<string, unknown>).current
  if (!current || typeof current !== 'object') {
    throw new Error('Open-Meteo AQ response is missing current')
  }
  const record = current as Record<string, unknown>
  const usAqi = Math.round(finiteField(record, 'us_aqi'))
  if (usAqi < 0 || usAqi > 1_000) {
    throw new Error('Open-Meteo AQ current.us_aqi is out of range')
  }
  const pollutant = (key: string) => {
    const value = finiteField(record, key)
    if (value < 0) throw new Error(`Open-Meteo AQ invalid field: current.${key}`)
    return Math.round(value * 10) / 10
  }
  return {
    usAqi,
    pm25: pollutant('pm2_5'),
    pm10: pollutant('pm10'),
    no2: pollutant('nitrogen_dioxide'),
    o3: pollutant('ozone'),
    so2: pollutant('sulphur_dioxide'),
    co: pollutant('carbon_monoxide'),
    level: aqiToLevel(usAqi),
  }
}

/** Generic — fetch current AQI for any [lng, lat]. */
export async function fetchAQI(lng: number, lat: number, timezone = 'Asia/Bangkok'): Promise<CityAQI> {
  const cacheKey = `openmeteo/aqi/${lat.toFixed(3)},${lng.toFixed(3)}`
  return cachedFetch(cacheKey, async () => {
    const url =
      'https://air-quality-api.open-meteo.com/v1/air-quality' +
      `?latitude=${lat}&longitude=${lng}` +
      '&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone' +
      `&timezone=${encodeURIComponent(timezone)}`
    const res = await fetch(url, { signal: timeoutSignal(15_000) })
    if (!res.ok) throw new Error(`Open-Meteo AQ ${res.status}`)
    return parseOpenMeteoAQ(await res.json())
  }, TTL)
}

/** Bangkok wrapper. */
export async function bangkokAQI(): Promise<BangkokAQI> {
  return fetchAQI(100.5018, 13.7563, 'Asia/Bangkok')
}
