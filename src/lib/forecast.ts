/**
 * TimeFM-class forecasting. Calls the Cloudflare Worker /forecast/timefm route,
 * which proxies HuggingFace serverless inference for google/timesfm-2.0-500m
 * when HF_API_TOKEN is set. Falls back to Holt-Winters (triple exponential
 * smoothing) on either side of the wire — so the UI always gets a forecast and
 * always knows which model produced it.
 */

const PROXY = import.meta.env.VITE_PROXY_URL as string

export type ForecastModel = 'timefm-2.0' | 'holt-winters'

export interface ForecastResult {
  forecast: number[]            // Predicted values for the next `horizon` steps
  lower?: number[]              // Optional 80% lower confidence band
  upper?: number[]              // Optional 80% upper confidence band
  model: ForecastModel
  durationMs: number
}

/**
 * Forecast the next `horizon` points of a time series. Tries the Worker
 * (TimeFM-backed when HF_API_TOKEN is configured) and falls back to a local
 * Holt-Winters implementation if the Worker is unreachable.
 */
export async function forecastSeries(
  series: number[],
  horizon: number,
  seasonalPeriod = 24,
): Promise<ForecastResult> {
  const t0 = performance.now()
  // Strip non-finite points (TimeFM/HW both choke on NaN)
  const clean = series.filter((v) => Number.isFinite(v))
  if (clean.length < seasonalPeriod) {
    // Too short for seasonal model — flat-line extension
    const last = clean.length > 0 ? clean[clean.length - 1] : 0
    return {
      forecast: Array(horizon).fill(last),
      model: 'holt-winters',
      durationMs: performance.now() - t0,
    }
  }

  // Try the Worker first
  try {
    const url = `${PROXY}/forecast/timefm`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series: clean, horizon, seasonalPeriod }),
    })
    if (res.ok) {
      const data = await res.json() as {
        forecast: number[]
        lower?: number[]
        upper?: number[]
        model: ForecastModel
      }
      return { ...data, durationMs: performance.now() - t0 }
    }
  } catch {
    // Fall through to local
  }

  // Local Holt-Winters (last-resort fallback — usually Worker handles this)
  const hw = holtWinters(clean, horizon, seasonalPeriod)
  return { ...hw, model: 'holt-winters', durationMs: performance.now() - t0 }
}

/**
 * Additive Holt-Winters triple exponential smoothing. Hand-coded, no deps.
 * Reasonable for hourly data with 24h seasonality (PM2.5, traffic, etc.).
 */
export function holtWinters(
  series: number[],
  horizon: number,
  period = 24,
  alpha = 0.3,
  beta = 0.05,
  gamma = 0.2,
): { forecast: number[]; lower: number[]; upper: number[] } {
  const n = series.length
  // Initial level = mean of first period; initial trend = mean of period diffs
  const initLevel = series.slice(0, period).reduce((a, b) => a + b, 0) / period
  let trend = 0
  for (let i = 0; i < period; i++) {
    trend += (series[period + i] - series[i]) / period
  }
  trend /= period

  // Initial seasonal indices = first-period values - initial level
  const seasonal = series.slice(0, period).map((v) => v - initLevel)

  let level = initLevel
  const residuals: number[] = []

  for (let t = period; t < n; t++) {
    const s = seasonal[t % period]
    const prevLevel = level
    level = alpha * (series[t] - s) + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    seasonal[t % period] = gamma * (series[t] - level) + (1 - gamma) * s
    residuals.push(series[t] - (prevLevel + trend + s))
  }

  // Residual std for confidence band (z=1.28 → 80% band)
  const resMean = residuals.reduce((a, b) => a + b, 0) / Math.max(1, residuals.length)
  const resVar = residuals.reduce((a, b) => a + (b - resMean) ** 2, 0) / Math.max(1, residuals.length - 1)
  const resStd = Math.sqrt(Math.max(0, resVar))

  const forecast: number[] = []
  const lower: number[] = []
  const upper: number[] = []
  for (let h = 1; h <= horizon; h++) {
    const s = seasonal[(n - 1 + h) % period]
    const yhat = level + h * trend + s
    // Variance widens with horizon — sqrt(h) is the textbook approximation
    const sigma = resStd * Math.sqrt(h)
    forecast.push(yhat)
    lower.push(yhat - 1.28 * sigma)
    upper.push(yhat + 1.28 * sigma)
  }
  return { forecast, lower, upper }
}
