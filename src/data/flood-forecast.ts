/**
 * GloFAS / Open-Meteo Flood API — river discharge forecast.
 *
 * GloFAS v4 is the Copernicus Global Flood Awareness System, produced by
 * ECMWF. It provides global river discharge forecasts at 5 km resolution,
 * up to 46 days deterministic + 46-day ensemble extension.
 *
 * Open-Meteo wraps GloFAS v4 with a free, no-auth REST API:
 *   https://flood-api.open-meteo.com/v1/flood?latitude=13.75&longitude=100.50
 *   &daily=river_discharge&forecast_days=46&ensemble=true
 *
 * For Bangkok / Chao Phraya at Nakhon Sawan gauge (15.7°N, 100.0°E):
 * - Discharge > 2,000 m³/s at Nakhon Sawan = elevated Bangkok risk
 * - Discharge > 3,500 m³/s at Nakhon Sawan = significant flood risk
 * - Discharge > 5,000 m³/s = 2011-level major flood territory
 * - Transit time: 3–3.5 days from Nakhon Sawan to Bangkok (139 km, Ping/Wang confluence)
 *
 * Source: Near real-time flood forecasting for Chao Phraya, ScienceDirect 2024
 */
import { cachedFetch } from '../lib/cached-fetch'

const TTL = 3 * 60 * 60_000  // 3 hours — GloFAS updates 4× daily

export interface FloodForecastDay {
  date:         string    // YYYY-MM-DD
  discharge:    number    // m³/s
  risk:         'low' | 'watch' | 'warning' | 'emergency'
  bangkokETA?:  string    // date Bangkok would be affected (discharge + 3.5 days)
}

export interface FloodForecast {
  gauge:         string
  lat:           number
  lng:           number
  days:          FloodForecastDay[]
  peakDischarge: number
  peakDate:      string
  currentDischarge: number
  trend:         'rising' | 'falling' | 'stable'
}

function dischargeToRisk(m3s: number): FloodForecastDay['risk'] {
  if (m3s >= 5000) return 'emergency'
  if (m3s >= 3500) return 'warning'
  if (m3s >= 2000) return 'watch'
  return 'low'
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * Fetch Chao Phraya river discharge forecast.
 * Uses the Nakhon Sawan confluence gauge (15.7°N, 100.0°E) —
 * the standard upstream indicator for Bangkok flood risk.
 */
export async function fetchChaoPrayaForecast(days = 30): Promise<FloodForecast> {
  return cachedFetch('glofas/chao-phraya', async () => {
    const url =
      `https://flood-api.open-meteo.com/v1/flood` +
      `?latitude=15.7&longitude=100.0` +
      `&daily=river_discharge` +
      `&forecast_days=${Math.min(46, days)}` +
      `&models=seamless`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GloFAS ${res.status}`)
    const data = await res.json() as {
      daily: { time: string[]; river_discharge: (number | null)[] }
    }

    const times     = data.daily.time
    const discharge = data.daily.river_discharge

    const forecastDays: FloodForecastDay[] = times.map((date, i) => {
      const q    = discharge[i] ?? 0
      const risk = dischargeToRisk(q)
      return {
        date,
        discharge: Math.round(q),
        risk,
        // Bangkok affected 3.5 days after upstream Nakhon Sawan
        bangkokETA: risk !== 'low' ? addDays(date, 4) : undefined,
      }
    })

    const validQ  = discharge.filter((q): q is number => q !== null && q > 0)
    const peak    = Math.max(...validQ)
    const peakIdx = discharge.findIndex((q) => q === peak)

    const first3  = validQ.slice(0, 3)
    const last3   = validQ.slice(-3)
    const avgFirst = first3.reduce((s, v) => s + v, 0) / first3.length
    const avgLast  = last3.reduce((s, v) => s + v, 0) / last3.length
    const trend: FloodForecast['trend'] =
      avgLast > avgFirst * 1.15 ? 'rising' :
      avgLast < avgFirst * 0.85 ? 'falling' : 'stable'

    return {
      gauge:            'Nakhon Sawan (Chao Phraya confluence)',
      lat:              15.7,
      lng:              100.0,
      days:             forecastDays,
      peakDischarge:    Math.round(peak),
      peakDate:         times[peakIdx] ?? times[0],
      currentDischarge: Math.round(validQ[0] ?? 0),
      trend,
    }
  }, TTL)
}
