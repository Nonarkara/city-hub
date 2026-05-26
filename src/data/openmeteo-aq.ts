/**
 * Open-Meteo Air Quality API — CORS-safe, no auth.
 * Provides US AQI + individual pollutant readings for any city by lat/lng.
 */
import { cachedFetch } from '../lib/cached-fetch'

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

/** Generic — fetch current AQI for any [lng, lat]. */
export async function fetchAQI(lng: number, lat: number, timezone = 'Asia/Bangkok'): Promise<CityAQI> {
  const cacheKey = `openmeteo/aqi/${lat.toFixed(3)},${lng.toFixed(3)}`
  return cachedFetch(cacheKey, async () => {
    const url =
      'https://air-quality-api.open-meteo.com/v1/air-quality' +
      `?latitude=${lat}&longitude=${lng}` +
      '&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone' +
      `&timezone=${encodeURIComponent(timezone)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Open-Meteo AQ ${res.status}`)
    const d = await res.json()
    const c = d.current as {
      us_aqi: number
      pm10: number
      pm2_5: number
      carbon_monoxide: number
      nitrogen_dioxide: number
      sulphur_dioxide: number
      ozone: number
    }
    const usAqi = Math.round(c.us_aqi)
    return {
      usAqi,
      pm25: Math.round(c.pm2_5 * 10) / 10,
      pm10: Math.round(c.pm10 * 10) / 10,
      no2: Math.round(c.nitrogen_dioxide * 10) / 10,
      o3: Math.round(c.ozone * 10) / 10,
      so2: Math.round(c.sulphur_dioxide * 10) / 10,
      co: Math.round(c.carbon_monoxide * 10) / 10,
      level: aqiToLevel(usAqi),
    }
  }, TTL)
}

/** Bangkok wrapper. */
export async function bangkokAQI(): Promise<BangkokAQI> {
  return fetchAQI(100.5018, 13.7563, 'Asia/Bangkok')
}
