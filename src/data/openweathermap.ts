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
  // API key injected server-side by the Worker (OWM_KEY secret).
  // Returns null gracefully if the key isn't set — callers already handle null.
  const url = `${PROXY}/owm/onecall?lat=${BKK_LAT}&lon=${BKK_LON}&exclude=minutely,hourly,daily&units=metric`
  try {
    const res = await fetch(url)
    if (!res.ok) return null   // 401 (no key), 429, etc. — silently skip
    return await res.json() as OWMWeather
  } catch {
    return null
  }
}
