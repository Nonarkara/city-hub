/**
 * Open-Meteo: free, no auth, CORS-safe.
 * Current weather + wind for heat vital + PM2.5 drift advisory.
 */
import { cachedFetch } from '../lib/cached-fetch'

export interface CityWeather {
  temp: number
  feelsLike: number
  windSpeed: number
  windDir: number
  windCardinal: string
}

/** Back-compat alias — Bangkok specifically. */
export type BangkokWeather = CityWeather

const TTL = 10 * 60_000

function toCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
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
      '&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m' +
      `&timezone=${encodeURIComponent(timezone)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
    const d = await res.json()
    const c = d.current as {
      temperature_2m: number
      apparent_temperature: number
      wind_speed_10m: number
      wind_direction_10m: number
    }
    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      windSpeed: Math.round(c.wind_speed_10m),
      windDir: Math.round(c.wind_direction_10m),
      windCardinal: toCardinal(c.wind_direction_10m),
    }
  }, TTL)
}

/** Bangkok wrapper — preserves the existing import surface. */
export async function bangkokWeather(): Promise<BangkokWeather> {
  return fetchWeather(100.5018, 13.7563, 'Asia/Bangkok')
}
