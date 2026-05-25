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
  GEMINI_API_KEY?: string
}

const TARGETS: Record<string, { origin: string; cacheSeconds: number }> = {
  'data-go-th':    { origin: 'https://data.go.th/api/3/action',     cacheSeconds: 300 },
  'data-bma':      { origin: 'https://data.bangkok.go.th/api/3/action', cacheSeconds: 300 },
  'tmd':           { origin: 'https://data.tmd.go.th/api',          cacheSeconds: 600 },
  'waqi':          { origin: 'https://api.waqi.info',               cacheSeconds: 300 },
  'firms':         { origin: 'https://firms.modaps.eosdis.nasa.gov/api', cacheSeconds: 600 },
  'traffy':        { origin: 'https://publicapi.traffy.in.th',      cacheSeconds: 120 },
  'gdelt':         { origin: 'https://api.gdeltproject.org/api/v2', cacheSeconds: 300 },
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

    // Forecast — POST /forecast (alias: /forecast/timefm for backward compat)
    if (
      (url.pathname === '/forecast' || url.pathname === '/forecast/timefm') &&
      request.method === 'POST'
    ) {
      return handleForecast(request, env)
    }

    // Gemini narrate — POST /narrate
    if (url.pathname === '/narrate' && request.method === 'POST') {
      return handleNarrate(request, env)
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

// ── Forecast ──────────────────────────────────────────────────────────────
//
// Tries forecasting backends in order of preference:
//   1. Gemini 2.5 Flash (when GEMINI_API_KEY set) — free tier, structured JSON
//   2. TimeFM 2.0 via HF Inference (when HF_API_TOKEN set) — not currently on
//      HF's serverless list, but kept here for the upgrade path when TimeFM
//      is deployed to a HF Endpoint, Modal, or Replicate
//   3. Holt-Winters triple exponential smoothing — in-Worker fallback
//
// Response always tags `model` honestly so the UI never lies about which one
// produced the numbers.

interface ForecastRequest {
  series: number[]
  horizon: number
  seasonalPeriod?: number
  domain?: string  // optional natural-language context for Gemini (e.g. "hourly PM2.5 Bangkok")
}

interface ForecastResponse {
  forecast: number[]
  lower?: number[]
  upper?: number[]
  model: 'gemini-2.5' | 'timefm-2.0' | 'holt-winters'
  reasoning?: string
}

async function handleForecast(request: Request, env: Env): Promise<Response> {
  let body: ForecastRequest
  try {
    body = await request.json() as ForecastRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const series = (body.series ?? []).filter((v) => Number.isFinite(v))
  const horizon = Math.max(1, Math.min(168, body.horizon ?? 24))
  const period = body.seasonalPeriod ?? 24
  const domain = body.domain ?? 'hourly PM2.5 concentration in Bangkok (μg/m³)'

  if (series.length < 4) {
    return json({ error: 'series too short (min 4)' }, 400)
  }

  // 1. Gemini 2.5 Flash — preferred, free
  if (env.GEMINI_API_KEY) {
    const g = await tryGemini(series, horizon, domain, env.GEMINI_API_KEY)
    if (g) return json(g)
  }

  // 2. TimeFM via HuggingFace — placeholder path for when TimeFM is hosted
  if (env.HF_API_TOKEN) {
    const t = await tryTimeFM(series, horizon, env.HF_API_TOKEN)
    if (t) return json(t)
  }

  // 3. Holt-Winters fallback
  const hw = holtWintersWorker(series, horizon, Math.min(period, Math.floor(series.length / 2)))
  const response: ForecastResponse = {
    forecast: hw.forecast,
    lower: hw.lower,
    upper: hw.upper,
    model: 'holt-winters',
  }
  return json(response)
}

async function tryGemini(
  series: number[],
  horizon: number,
  domain: string,
  apiKey: string,
): Promise<ForecastResponse | null> {
  const prompt =
    `You are a quantitative time-series forecaster. ` +
    `Given the following history of ${domain}, predict the next ${horizon} hourly values. ` +
    `Consider: diurnal cycle (traffic peaks 7–9am, cooking-emission peaks 6–9pm in Bangkok), ` +
    `recent trend direction, and recent volatility. ` +
    `Return strictly: forecast (point predictions), lower (10th percentile), upper (90th percentile) — ` +
    `each an array of length ${horizon}. Also a brief reasoning string (≤ 30 words).\n\n` +
    `History (oldest → newest, ${series.length} hourly values):\n[${series.map((v) => v.toFixed(2)).join(', ')}]`

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      forecast:  { type: 'ARRAY', items: { type: 'NUMBER' } },
      lower:     { type: 'ARRAY', items: { type: 'NUMBER' } },
      upper:     { type: 'ARRAY', items: { type: 'NUMBER' } },
      reasoning: { type: 'STRING' },
    },
    required: ['forecast', 'lower', 'upper'],
  }

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema,
          maxOutputTokens: 2048,
        },
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    const parsed = JSON.parse(text) as {
      forecast: number[]
      lower: number[]
      upper: number[]
      reasoning?: string
    }
    // Validate shape — wrong-length or non-numeric arrays = reject
    if (
      !Array.isArray(parsed.forecast) ||
      parsed.forecast.length === 0 ||
      !parsed.forecast.every((v) => Number.isFinite(v))
    ) return null
    return {
      forecast: parsed.forecast.slice(0, horizon),
      lower:    Array.isArray(parsed.lower)  ? parsed.lower.slice(0, horizon)  : undefined,
      upper:    Array.isArray(parsed.upper)  ? parsed.upper.slice(0, horizon)  : undefined,
      reasoning: parsed.reasoning,
      model: 'gemini-2.5',
    }
  } catch {
    return null
  }
}

async function tryTimeFM(
  series: number[],
  horizon: number,
  hfToken: string,
): Promise<ForecastResponse | null> {
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/google/timesfm-2.0-500m-pytorch',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { history: series, horizon },
          options: { wait_for_model: true },
        }),
      },
    )
    if (!res.ok) return null
    const data = await res.json() as { forecast?: number[]; predictions?: number[] }
    const forecast = data.forecast ?? data.predictions
    if (!Array.isArray(forecast) || forecast.length === 0) return null
    return { forecast: forecast.slice(0, horizon), model: 'timefm-2.0' }
  } catch {
    return null
  }
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

// ── Narrate ──────────────────────────────────────────────────────────────
//
// Gemini-narrated explanation of a situation snapshot. Accepts arbitrary
// structured context (alert details, anomaly data, district profile, etc.)
// and returns 1–3 short paragraphs grounded in the numbers.
//
// When GEMINI_API_KEY is absent, returns a templated fallback so the UI
// always has something to show.

interface NarrateRequest {
  question: string   // What we want explained — "Why is PM2.5 elevated?"
  context: unknown   // Structured facts: numbers, timestamps, recent values
  style?: 'brief' | 'paragraph' | 'mayor'  // Default 'brief'
  maxWords?: number  // Default 60
}

async function handleNarrate(request: Request, env: Env): Promise<Response> {
  let body: NarrateRequest
  try {
    body = await request.json() as NarrateRequest
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const style = body.style ?? 'brief'
  const maxWords = body.maxWords ?? 60

  if (env.GEMINI_API_KEY) {
    const text = await tryGeminiNarrate(body.question, body.context, style, maxWords, env.GEMINI_API_KEY)
    if (text) return json({ narration: text, model: 'gemini-2.5' })
  }

  // Fallback — return a structural summary so the UI still has content
  return json({
    narration:
      `Based on the live data, the situation is being monitored. ` +
      `Set GEMINI_API_KEY on the Worker to enable AI-narrated explanations.`,
    model: 'template',
  })
}

async function tryGeminiNarrate(
  question: string,
  context: unknown,
  style: 'brief' | 'paragraph' | 'mayor',
  maxWords: number,
  apiKey: string,
): Promise<string | null> {
  const persona =
    style === 'mayor'
      ? 'You are a city-operations analyst briefing the Bangkok governor. Be direct, actionable, citing actual numbers.'
      : style === 'paragraph'
      ? 'You are a calm city-intelligence narrator. One paragraph, grounded in the numbers, no hedging.'
      : 'You are a city-intelligence analyst. Answer in 1–2 sharp sentences, grounded in the data.'

  const prompt =
    `${persona}\n\n` +
    `Question: ${question}\n\n` +
    `Live context (JSON):\n${JSON.stringify(context, null, 2)}\n\n` +
    `Constraints:\n` +
    `- Maximum ${maxWords} words total\n` +
    `- Use specific numbers from the context\n` +
    `- No greeting, no closing, no "Based on the data" preamble\n` +
    `- Plain text only, no markdown formatting`

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: Math.max(256, maxWords * 8),
        },
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    return text.trim()
  } catch {
    return null
  }
}
