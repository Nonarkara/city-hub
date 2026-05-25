/**
 * Open-Meteo: free, no auth, CORS-safe.
 * Bangkok current weather for heat vital + wind direction (PM2.5 drift advisory).
 */
import { cachedFetch } from '../lib/cached-fetch'

export interface BangkokWeather {
  temp: number
  feelsLike: number
  windSpeed: number
  windDir: number
  windCardinal: string
}

const TTL = 10 * 60_000

function toCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

export async function bangkokWeather(): Promise<BangkokWeather> {
  return cachedFetch('openmeteo/bkk-weather', async () => {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018' +
      '&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m' +
      '&timezone=Asia%2FBangkok'
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
