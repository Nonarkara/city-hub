/**
 * Cross-city pattern detection — finds time-lagged correlations between the
 * 5 City Hub cities. Surfaces insights like:
 *
 *   "Bangkok's PM2.5 is following Chiang Mai's pattern from 72h ago — expect
 *    a similar peak in ~6h."
 *
 * This is structural intelligence UNL fundamentally cannot do — they don't
 * aggregate across cities. Non does, because every city in his manifest
 * pulls from the same global sources (Open-Meteo, WAQI, GDELT).
 *
 * Implementation: short-window similarity between cities' AQI trajectories.
 * We fetch each city's 24h forecast, normalise, and look for the lag that
 * minimises distance — if it's tight, we have a pattern.
 */
import type { CityConfig } from '../config/cities'
import { CITIES } from '../config/cities'
import { fetchAQIForecast } from '../data/openmeteo-forecast'

export interface CrossCityPattern {
  fromCity: string         // city whose past matches the current city
  fromCityId: string
  metric: 'aqi'
  lagHours: number         // how many hours behind/ahead
  similarity: number       // 0–1 (higher = tighter match)
  message: string          // human-readable insight
  prediction: string       // what to expect next
}

/** Mean of an array of numbers. */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

/** Standard deviation. */
function std(arr: number[]): number {
  const m = mean(arr)
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)))
}

/** Z-score normalisation — makes cities at different baselines comparable. */
function normalise(arr: number[]): number[] {
  const m = mean(arr)
  const s = std(arr) || 1
  return arr.map((v) => (v - m) / s)
}

/** Pearson correlation coefficient between two equal-length arrays. */
function correlation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 4) return 0
  const ma = mean(a), mb = mean(b)
  let num = 0, da = 0, db = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  const denom = Math.sqrt(da * db)
  return denom === 0 ? 0 : num / denom
}

/**
 * Slide `peer` across `current` by lag hours and find the lag where
 * correlation is highest. Negative lag = peer leads current.
 */
function bestLag(current: number[], peer: number[], maxLag = 12): { lag: number; score: number } {
  let best = { lag: 0, score: 0 }
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const start = Math.max(0, lag)
    const end = Math.min(current.length, current.length + lag)
    const a: number[] = [], b: number[] = []
    for (let i = start; i < end; i++) {
      const j = i - lag
      if (j >= 0 && j < peer.length) {
        a.push(current[i])
        b.push(peer[j])
      }
    }
    if (a.length < 4) continue
    const c = correlation(a, b)
    if (Math.abs(c) > Math.abs(best.score)) {
      best = { lag, score: c }
    }
  }
  return best
}

/**
 * Build cross-city patterns for the active city by comparing its 24h forecast
 * against the other 4 cities. Returns up to 3 strongest signals.
 */
export async function detectCrossCityPatterns(activeCity: CityConfig): Promise<CrossCityPattern[]> {
  const peers = CITIES.filter((c) => c.id !== activeCity.id)

  // Fetch forecasts in parallel
  const all = await Promise.all([
    fetchAQIForecast(activeCity.center[0], activeCity.center[1], activeCity.timezone).catch(() => null),
    ...peers.map((p) =>
      fetchAQIForecast(p.center[0], p.center[1], p.timezone).catch(() => null),
    ),
  ])

  const currentForecast = all[0]
  if (!currentForecast || currentForecast.hours.length < 8) return []

  const currentSeries = currentForecast.hours.map((h) => h.usAqi)
  const currentNorm = normalise(currentSeries)

  const patterns: CrossCityPattern[] = []

  peers.forEach((peer, idx) => {
    const peerForecast = all[idx + 1]
    if (!peerForecast || peerForecast.hours.length < 8) return

    const peerSeries = peerForecast.hours.map((h) => h.usAqi)
    const peerNorm = normalise(peerSeries)

    const { lag, score } = bestLag(currentNorm, peerNorm, 12)

    // Only surface patterns with high enough similarity
    if (Math.abs(score) < 0.65) return

    let message: string
    let prediction: string

    if (lag < 0) {
      // peer leads current — peer's past matches our future
      const lagHrs = Math.abs(lag)
      message = `${peer.name}'s AQI trajectory leads ${activeCity.name}'s by ${lagHrs}h.`
      const peerPeakIdx = peerForecast.hours.indexOf(
        peerForecast.hours.reduce((m, h) => (h.usAqi > m.usAqi ? h : m)),
      )
      prediction = `Expect a similar peak around ${peerForecast.hours[peerPeakIdx]?.usAqi ?? '—'} AQI ~${lagHrs}h from now.`
    } else if (lag > 0) {
      // peer lags current — current's pattern reaching peer
      message = `${activeCity.name}'s AQI pattern is reaching ${peer.name} (lag ${lag}h).`
      prediction = `${peer.name} should expect ${activeCity.name}'s current trajectory within ${lag}h.`
    } else {
      // synchronized
      message = `${activeCity.name} and ${peer.name} are moving in lockstep on AQI.`
      prediction = `Whatever drives ${peer.name} likely drives ${activeCity.name} too.`
    }

    patterns.push({
      fromCity: peer.name,
      fromCityId: peer.id,
      metric: 'aqi',
      lagHours: lag,
      similarity: Math.abs(score),
      message,
      prediction,
    })
  })

  // Strongest first
  patterns.sort((a, b) => b.similarity - a.similarity)
  return patterns.slice(0, 3)
}
