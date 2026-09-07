/**
 * GloFAS / Open-Meteo Flood API — river discharge forecast.
 *
 * GloFAS v4 is the Copernicus Global Flood Awareness System, produced by
 * ECMWF. Open-Meteo wraps it with a free, no-auth REST API.
 *
 * Thresholds:
 * - Chao Phraya / Bangkok: published Nakhon Sawan bands (2k / 3.5k / 5k m³/s).
 * - Every other city: relative to the last 45 days at that GloFAS cell.
 *   Never reuse Chao Phraya bands on the Vltava, Singapore, or a dry centroid.
 *
 * Source for Chao Phraya: Near real-time flood forecasting for Chao Phraya,
 * ScienceDirect 2024. Transit ~3.5 days Nakhon Sawan → Bangkok.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const TTL = 3 * 60 * 60_000  // 3 hours — GloFAS updates 4× daily
const PAST_DAYS = 45

export type FloodThresholdMode = 'chao-phraya' | 'relative'

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
  peakDischarge: number | null
  peakDate:      string | null
  currentDischarge: number
  trend:         'rising' | 'falling' | 'stable'
  mode:          FloodThresholdMode
  /** False when the 5 km cell looks dry — do not treat as ALL CLEAR. */
  usable:        boolean
}

function chaoPhrayaRisk(m3s: number): FloodForecastDay['risk'] {
  if (m3s >= 5000) return 'emergency'
  if (m3s >= 3500) return 'warning'
  if (m3s >= 2000) return 'watch'
  return 'low'
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function relativeRisk(q: number, p90: number): FloodForecastDay['risk'] {
  if (!(p90 > 0)) return 'low'
  const ratio = q / p90
  if (ratio >= 4) return 'emergency'
  if (ratio >= 2.5) return 'warning'
  if (ratio >= 1.5) return 'watch'
  return 'low'
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * GloFAS river discharge at an arbitrary point (modelled, 5 km).
 * Bangkok flood ops should use {@link fetchChaoPrayaForecast} (Nakhon Sawan).
 */
export async function fetchGlofasForecast(
  lat: number,
  lng: number,
  gauge: string,
  days = 16,
  mode: FloodThresholdMode = 'relative',
): Promise<FloodForecast> {
  const key = `glofas/${mode}/${lat.toFixed(2)},${lng.toFixed(2)}/${days}`
  return cachedFetch(key, async () => {
    const forecastDays = Math.min(46, days)
    const past = mode === 'relative' ? PAST_DAYS : 0
    const url =
      `https://flood-api.open-meteo.com/v1/flood` +
      `?latitude=${lat}&longitude=${lng}` +
      `&daily=river_discharge` +
      `&forecast_days=${forecastDays}` +
      (past > 0 ? `&past_days=${past}` : '') +
      `&models=seamless` +
      `&cell_selection=nearest`
    const res = await fetch(url, { signal: timeoutSignal(15_000) })
    if (!res.ok) throw new Error(`GloFAS ${res.status}`)
    const data = await res.json() as {
      daily: { time: string[]; river_discharge: (number | null)[] }
    }

    const times     = data.daily.time
    const discharge = data.daily.river_discharge
    const today = new Date().toISOString().slice(0, 10)
    const pastVals: number[] = []
    const futureIdx: number[] = []
    times.forEach((date, i) => {
      const q = discharge[i]
      if (date < today) {
        if (q != null && q > 0) pastVals.push(q)
      } else {
        futureIdx.push(i)
      }
    })
    // If the API returned only forecast rows (chao-phraya mode), treat all as future.
    const idx = mode === 'chao-phraya' || futureIdx.length === 0
      ? times.map((_, i) => i)
      : futureIdx

    const p90 = percentile([...pastVals].sort((a, b) => a - b), 90)
    const medianPast = percentile([...pastVals].sort((a, b) => a - b), 50)

    const forecastSlice: FloodForecastDay[] = idx.map((i) => {
      const q = discharge[i] ?? 0
      const risk = mode === 'chao-phraya' ? chaoPhrayaRisk(q) : relativeRisk(q, p90)
      return {
        date: times[i],
        discharge: Math.round(q),
        risk,
        bangkokETA: mode === 'chao-phraya' && risk !== 'low' ? addDays(times[i], 4) : undefined,
      }
    })

    const validQ = forecastSlice.map((d) => d.discharge).filter((q) => q > 0)
    const hasQ = validQ.length > 0
    const peak = hasQ ? Math.max(...validQ) : null
    const peakIdx = peak !== null ? forecastSlice.findIndex((d) => d.discharge === peak) : -1

    const first3 = validQ.slice(0, 3)
    const last3 = validQ.slice(-3)
    const avgFirst = first3.reduce((s, v) => s + v, 0) / Math.max(1, first3.length)
    const avgLast = last3.reduce((s, v) => s + v, 0) / Math.max(1, last3.length)
    const trend: FloodForecast['trend'] =
      !hasQ                     ? 'stable'  :
      avgLast > avgFirst * 1.15 ? 'rising'  :
      avgLast < avgFirst * 0.85 ? 'falling' : 'stable'

    const usable = mode === 'chao-phraya'
      ? hasQ
      : medianPast >= 5 || (peak ?? 0) >= 20

    return {
      gauge,
      lat,
      lng,
      days:             forecastSlice,
      peakDischarge:    peak !== null ? Math.round(peak) : null,
      peakDate:         peakIdx >= 0 ? forecastSlice[peakIdx].date : null,
      currentDischarge: Math.round(validQ[0] ?? 0),
      trend,
      mode,
      usable,
    }
  }, TTL)
}

/**
 * Chao Phraya at Nakhon Sawan confluence (15.7°N, 100.0°E) —
 * the standard upstream indicator for Bangkok flood risk.
 */
export async function fetchChaoPrayaForecast(days = 30): Promise<FloodForecast> {
  return fetchGlofasForecast(15.7, 100.0, 'Nakhon Sawan (Chao Phraya confluence)', days, 'chao-phraya')
}
