/**
 * Open-Meteo: free, no auth, CORS-safe.
 * Current weather + wind for heat vital + PM2.5 drift advisory.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from '../lib/request-timeout'

export interface CityWeather {
  temp: number
  feelsLike: number
  windSpeed: number
  windDir: number
  windCardinal: string
  condition: string   // tactical short-code: CLR / PRT / OVC / FOG / RAIN / SNOW / TSTM / DRZL / SHWR
}

/** WMO weather code → tactical short code */
function wmoToCondition(code: number): string {
  if (code === 0)                      return 'CLR'
  if (code <= 2)                       return 'PRT'   // partly cloudy
  if (code === 3)                      return 'OVC'   // overcast
  if (code === 45 || code === 48)      return 'FOG'
  if (code >= 51 && code <= 57)        return 'DRZL'  // drizzle
  if (code >= 61 && code <= 67)        return 'RAIN'
  if (code >= 71 && code <= 77)        return 'SNOW'
  if (code >= 80 && code <= 82)        return 'SHWR'  // showers
  if (code === 85 || code === 86)      return 'SNOW'
  if (code >= 95)                      return 'TSTM'
  return 'PRT'
}

/** Back-compat alias — Bangkok specifically. */
export type BangkokWeather = CityWeather

const TTL = 10 * 60_000

function toCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function finiteField(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Open-Meteo weather invalid field: current.${key}`)
  }
  return value
}

/** Validate the external response before any value reaches the UI or cache. */
export function parseOpenMeteoWeather(payload: unknown): CityWeather {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Open-Meteo weather response is not an object')
  }
  const current = (payload as Record<string, unknown>).current
  if (!current || typeof current !== 'object') {
    throw new Error('Open-Meteo weather response is missing current')
  }
  const record = current as Record<string, unknown>
  const windSpeed = finiteField(record, 'wind_speed_10m')
  if (windSpeed < 0) throw new Error('Open-Meteo weather wind speed is out of range')
  const windDirection = finiteField(record, 'wind_direction_10m')
  if (windDirection < 0 || windDirection > 360) {
    throw new Error('Open-Meteo weather wind direction is out of range')
  }
  const weatherCode = finiteField(record, 'weather_code')
  return {
    temp: Math.round(finiteField(record, 'temperature_2m')),
    feelsLike: Math.round(finiteField(record, 'apparent_temperature')),
    windSpeed: Math.round(windSpeed),
    windDir: Math.round(windDirection),
    windCardinal: toCardinal(windDirection),
    condition: wmoToCondition(weatherCode),
  }
}

/**
 * Generic — fetch current weather for any [lng, lat] center.
 * cacheKey uniqueness derived from coords so each city is cached independently.
 */
export async function fetchWeather(lng: number, lat: number, timezone = 'Asia/Bangkok'): Promise<CityWeather> {
  const cacheKey = `openmeteo/weather/${lat.toFixed(3)},${lng.toFixed(3)}`
  return cachedFetch(cacheKey, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      '&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code' +
      `&timezone=${encodeURIComponent(timezone)}`
    const res = await fetch(url, { signal: timeoutSignal(15_000) })
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    return parseOpenMeteoWeather(await res.json())
  }, TTL)
}

/** Bangkok wrapper — preserves the existing import surface. */
export async function bangkokWeather(): Promise<BangkokWeather> {
  return fetchWeather(100.5018, 13.7563, 'Asia/Bangkok')
}
