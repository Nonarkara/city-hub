/**
 * UNL City Hub — API Proxy Worker
 *
 * Unblocks CORS-restricted APIs for the Bangkok super-dashboard.
 * Routes:
 *   /data-go-th/*  → data.go.th CKAN API
 *   /firms/*       → NASA FIRMS fire data
 *   /traffy/*      → Traffy Fondue civic issues
 *   /gdelt/*       → GDELT news/sentiment API
 *
 * All responses carry CORS headers + short Cloudflare cache.
 */

export interface Env {
  HF_API_TOKEN?: string
}

const TARGETS: Record<string, { origin: string; cacheSeconds: number }> = {
  'data-go-th': { origin: 'https://data.go.th/api/3/action', cacheSeconds: 300 },
  'firms':      { origin: 'https://firms.modaps.eosdis.nasa.gov/api', cacheSeconds: 600 },
  'traffy':     { origin: 'https://publicapi.traffy.in.th', cacheSeconds: 120 },
  'gdelt':      { origin: 'https://api.gdeltproject.org/api/v2', cacheSeconds: 300 },
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // TimeFM forecast — POST /forecast/timefm
    if (url.pathname === '/forecast/timefm' && request.method === 'POST') {
      return handleTimeFM(request, env)
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    // Parse /:target/*path
    const m = url.pathname.match(/^\/([^/]+)(\/.*)?$/)
    if (!m) return json({ error: 'Bad path' }, 400)

    const targetKey = m[1]
    const target = TARGETS[targetKey]
    if (!target) return json({ error: `Unknown target: ${targetKey}` }, 400)

    const path = (m[2] ?? '').replace(/^\//, '')
    const upstream = new URL(target.origin + '/' + path + url.search)

    try {
      const upstreamRes = await fetch(upstream.toString(), {
        headers: {
          'Accept': 'application/json, text/csv, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
      })

      // Pass through body with added CORS + cache headers
      const res = new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'application/json',
          'Cache-Control': `public, max-age=${target.cacheSeconds}`,
        },
      })
      return res
    } catch (err) {
      return json({ error: 'Upstream failed', detail: String(err) }, 502)
    }
  },
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  })
}

// ── TimeFM forecast ────────────────────────────────────────────────────────
//
// Proxies HuggingFace serverless inference for google/timesfm-2.0-500m-pytorch
// when HF_API_TOKEN is configured. Otherwise (or on HF failure) returns a
// Holt-Winters forecast computed in-Worker — same shape, honestly labelled.

interface ForecastRequest {
  series: number[]
  horizon: number
  seasonalPeriod?: number
}

interface ForecastResponse {
  forecast: number[]
  lower?: number[]
  upper?: number[]
  model: 'timefm-2.0' | 'holt-winters'
}

async function handleTimeFM(request: Request, env: Env): Promise<Response> {
  let body: ForecastRequest
  try {
    body = await request.json() as ForecastRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const series = (body.series ?? []).filter((v) => Number.isFinite(v))
  const horizon = Math.max(1, Math.min(168, body.horizon ?? 24))
  const period = body.seasonalPeriod ?? 24

  if (series.length < 4) {
    return json({ error: 'series too short (min 4)' }, 400)
  }

  // Try HF if we have a token
  if (env.HF_API_TOKEN) {
    try {
      const hfRes = await fetch(
        'https://api-inference.huggingface.co/models/google/timesfm-2.0-500m-pytorch',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.HF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: { history: series, horizon },
            options: { wait_for_model: true },
          }),
        },
      )
      if (hfRes.ok) {
        const data = await hfRes.json() as { forecast?: number[]; predictions?: number[] }
        const forecast = data.forecast ?? data.predictions
        if (Array.isArray(forecast) && forecast.length > 0) {
          const response: ForecastResponse = { forecast: forecast.slice(0, horizon), model: 'timefm-2.0' }
          return json(response)
        }
      }
      // Fall through to Holt-Winters on any HF failure
    } catch {
      // Fall through
    }
  }

  // Holt-Winters fallback — same algorithm as the client-side last-resort,
  // but server-computed so the Worker contract is consistent.
  const hw = holtWintersWorker(series, horizon, Math.min(period, Math.floor(series.length / 2)))
  const response: ForecastResponse = {
    forecast: hw.forecast,
    lower: hw.lower,
    upper: hw.upper,
    model: 'holt-winters',
  }
  return json(response)
}

function holtWintersWorker(
  series: number[],
  horizon: number,
  period: number,
  alpha = 0.3,
  beta = 0.05,
  gamma = 0.2,
): { forecast: number[]; lower: number[]; upper: number[] } {
  const n = series.length
  const p = Math.max(2, period)
  const initLevel = series.slice(0, p).reduce((a, b) => a + b, 0) / p
  let trend = 0
  for (let i = 0; i < p && p + i < n; i++) {
    trend += (series[p + i] - series[i]) / p
  }
  trend = trend / p
  const seasonal = series.slice(0, p).map((v) => v - initLevel)

  let level = initLevel
  const residuals: number[] = []
  for (let t = p; t < n; t++) {
    const s = seasonal[t % p]
    const prevLevel = level
    level = alpha * (series[t] - s) + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    seasonal[t % p] = gamma * (series[t] - level) + (1 - gamma) * s
    residuals.push(series[t] - (prevLevel + trend + s))
  }
  const resMean = residuals.reduce((a, b) => a + b, 0) / Math.max(1, residuals.length)
  const resVar = residuals.reduce((a, b) => a + (b - resMean) ** 2, 0) / Math.max(1, residuals.length - 1)
  const resStd = Math.sqrt(Math.max(0, resVar))

  const forecast: number[] = []
  const lower: number[] = []
  const upper: number[] = []
  for (let h = 1; h <= horizon; h++) {
    const s = seasonal[(n - 1 + h) % p]
    const yhat = level + h * trend + s
    const sigma = resStd * Math.sqrt(h)
    forecast.push(yhat)
    lower.push(yhat - 1.28 * sigma)
    upper.push(yhat + 1.28 * sigma)
  }
  return { forecast, lower, upper }
}
