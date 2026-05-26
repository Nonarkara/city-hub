/**
 * Open-Meteo Air Quality — 24h hourly forecast.
 * Same CORS-safe, no-auth endpoint as the current-AQI fetch but with hourly forecast.
 * TTL: 30 min (forecast changes slowly).
 */
import { cachedFetch } from '../lib/cached-fetch'
import { aqiToRisk, type RiskLevel } from '../lib/risk'

const TTL = 30 * 60_000

export interface AQIForecastHour {
  time: string   // ISO string
  usAqi: number
  pm25: number
}

export interface AQIForecast {
  hours: AQIForecastHour[]   // next 24h from current time
  peakAqi: number
  peakHour: string           // "16:00"
  peakLevel: RiskLevel
  currentAqi: number
}

/** Generic — fetch 24h forecast for any [lng, lat]. */
export async function fetchAQIForecast(lng: number, lat: number, timezone = 'Asia/Bangkok'): Promise<AQIForecast> {
  const cacheKey = `openmeteo/aqi-forecast/${lat.toFixed(3)},${lng.toFixed(3)}`
  return cachedFetch(cacheKey, async () => {
    const url =
      'https://air-quality-api.open-meteo.com/v1/air-quality' +
      `?latitude=${lat}&longitude=${lng}` +
      '&hourly=us_aqi,pm2_5' +
      '&forecast_days=2' +
      `&timezone=${encodeURIComponent(timezone)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Open-Meteo Forecast ${res.status}`)
    const d = await res.json()

    const allTimes = d.hourly.time as string[]
    const allAqi = (d.hourly.us_aqi as (number | null)[]).map((v) => Math.round(v ?? 0))
    const allPm25 = (d.hourly.pm2_5 as (number | null)[]).map((v) => Math.round((v ?? 0) * 10) / 10)

    // Slice from current hour forward, 24 entries
    const now = new Date()
    const currentHourStr = now.toISOString().slice(0, 13)
    const startIdx = allTimes.findIndex((t) => t.startsWith(currentHourStr.slice(0, 13)))
    const from = startIdx >= 0 ? startIdx : 0

    const hours: AQIForecastHour[] = allTimes.slice(from, from + 24).map((time, i) => ({
      time,
      usAqi: allAqi[from + i] ?? 0,
      pm25: allPm25[from + i] ?? 0,
    }))

    const peakAqi = Math.max(...hours.map((h) => h.usAqi))
    const peakIdx = hours.findIndex((h) => h.usAqi === peakAqi)
    const peakDate = new Date(hours[peakIdx]?.time ?? now.toISOString())
    const peakHour = peakDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })

    return {
      hours,
      peakAqi,
      peakHour,
      peakLevel: aqiToRisk(peakAqi),
      currentAqi: hours[0]?.usAqi ?? 0,
    }
  }, TTL)
}

/** Bangkok wrapper. */
export async function bangkokAQIForecast(): Promise<AQIForecast> {
  return fetchAQIForecast(100.5018, 13.7563, 'Asia/Bangkok')
}
