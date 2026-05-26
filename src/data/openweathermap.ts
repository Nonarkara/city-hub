/**
 * OpenWeatherMap One Call API 3.0 Integration
 */

const PROXY = import.meta.env.VITE_PROXY_URL ?? 'http://127.0.0.1:8787'
const BKK_LAT = 13.7563
const BKK_LON = 100.5018

export interface OWMWeather {
  current: {
    temp: number
    feels_like: number
    pressure: number
    humidity: number
    uvi: number
    clouds: number
    visibility: number
    wind_speed: number
    weather: Array<{ main: string; description: string; icon: string }>
  }
  alerts?: Array<{
    event: string
    start: number
    end: number
    description: string
  }>
}

export async function fetchOWMWeather(): Promise<OWMWeather | null> {
  const key = import.meta.env.VITE_OPENWEATHERMAP_KEY
  if (!key) {
    console.warn('VITE_OPENWEATHERMAP_KEY not set.')
    return null
  }

  const url = `${PROXY}/owm/onecall?lat=${BKK_LAT}&lon=${BKK_LON}&exclude=minutely,hourly,daily&units=metric&appid=${key}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OWM error: ${res.status}`)
  
  return await res.json() as OWMWeather
}
