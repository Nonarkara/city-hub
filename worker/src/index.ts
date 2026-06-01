/**
 * Dr Non's City Hub — API Proxy Worker
 *
 * Security model
 * ──────────────
 * • CORS origin-locked to nonarkara.org + city-hub.pages.dev + localhost (dev).
 *   Wildcard CORS removed — this Worker must not be usable as a free public proxy.
 * • Sensitive AI endpoints (/narrate, /forecast, /ee/mapid) carry rate-limit
 *   headers so CF Rate Limiting rules can cap them at the dashboard level.
 * • API keys for keyed upstream APIs (WAQI, OpenAQ, OWM) live here as Worker
 *   secrets — never in the SPA bundle.
 *
 * Routes:
 *   /data-go-th/*   → data.go.th CKAN API
 *   /waqi/*         → WAQI Air Quality API  (key injected server-side)
 *   /openaq/*       → OpenAQ v3             (key injected server-side)
 *   /owm/*          → OpenWeatherMap 3.0    (key injected server-side)
 *   /firms/*        → NASA FIRMS fire data
 *   /traffy/*       → Traffy Fondue civic issues
 *   /gdelt/*        → GDELT news/sentiment API
 *   /forecast       → TimeFM / Gemini / Holt-Winters forecasting
 *   /narrate        → Gemini situation narration
 *   /ee/mapid       → Earth Engine tile token minting
 *
 * All responses carry CORS headers + short Cloudflare cache.
 */

export interface Env {
  HF_API_TOKEN?: string
  GEMINI_API_KEY?: string
  TIMEFM_ENDPOINT_URL?: string
  GCP_SERVICE_ACCOUNT_JSON?: string
  // Keyed API secrets — injected server-side, never sent to client
  WAQI_TOKEN?: string
  OPENAQ_KEY?: string
  OWM_KEY?: string
}

// ── Origin allowlist ──────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://hub.nonarkara.org',
  'https://city-hub.pages.dev',
  'https://unl.nonarkara.org',   // legacy
])

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  // Allow Cloudflare preview deployments (*.city-hub.pages.dev)
  if (/^https:\/\/[a-f0-9]+\.city-hub\.pages\.dev$/.test(origin)) return true
  // Allow localhost during development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true
  return false
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = isAllowedOrigin(origin) ? origin! : 'https://hub.nonarkara.org'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

const TARGETS: Record<string, { origin: string; cacheSeconds: number }> = {
  'data-go-th':    { origin: 'https://data.go.th/api/3/action',     cacheSeconds: 300 },
  'data-bma':      { origin: 'https://data.bangkok.go.th/api/3/action', cacheSeconds: 300 },
  'tmd':           { origin: 'https://data.tmd.go.th/api',          cacheSeconds: 600 },
  'tmd-earthquake':{ origin: 'https://data.tmd.go.th/api/DailySeismicEvent/v1', cacheSeconds: 300 },
  'waqi':          { origin: 'https://api.waqi.info',               cacheSeconds: 300 },
  'air4thai':      { origin: 'http://air4thai.pcd.go.th/services',  cacheSeconds: 600 },
  'firms':         { origin: 'https://firms.modaps.eosdis.nasa.gov/api', cacheSeconds: 600 },
  'traffy':        { origin: 'https://publicapi.traffy.in.th',      cacheSeconds: 120 },
  'gdelt':         { origin: 'https://api.gdeltproject.org/api/v2', cacheSeconds: 300 },
  'thaiwater':     { origin: 'https://www.thaiwater.net',           cacheSeconds: 600 },
  'openaq':        { origin: 'https://api.openaq.org/v3',           cacheSeconds: 300 },
  'owm':           { origin: 'https://api.openweathermap.org/data/3.0', cacheSeconds: 300 },
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url    = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors   = corsHeaders(origin)

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // Reject cross-origin requests from unknown origins
    // (Allow null-origin for same-origin server-side use / Wrangler dev)
    if (origin && !isAllowedOrigin(origin)) {
      return new Response('Forbidden', { status: 403 })
    }

    // Forecast — POST /forecast (alias: /forecast/timefm for backward compat)
    if (
      (url.pathname === '/forecast' || url.pathname === '/forecast/timefm') &&
      request.method === 'POST'
    ) {
      return handleForecast(request, env, cors)
    }

    // Gemini narrate — POST /narrate
    if (url.pathname === '/narrate' && request.method === 'POST') {
      return handleNarrate(request, env, cors)
    }

    // Earth Engine getMapId — POST /ee/mapid
    if (url.pathname === '/ee/mapid' && request.method === 'POST') {
      return handleEEMapId(request, env, cors)
    }

    if (request.method !== 'GET') {
      return jsonCors({ error: 'Method not allowed' }, 405, cors)
    }

    // Parse /:target/*path
    const m = url.pathname.match(/^\/([^/]+)(\/.*)?$/)
    if (!m) return jsonCors({ error: 'Bad path' }, 400, cors)

    const targetKey = m[1]
    const target    = TARGETS[targetKey]
    if (!target) return jsonCors({ error: `Unknown target: ${targetKey}` }, 400, cors)

    const path     = (m[2] ?? '').replace(/^\//, '')
    const upstream = new URL(target.origin + '/' + path + url.search)

    // ── Server-side key injection ─────────────────────────────────────────────
    // API keys for these services live in Worker secrets, never in the SPA bundle.
    if (targetKey === 'waqi' && env.WAQI_TOKEN) {
      upstream.searchParams.set('token', env.WAQI_TOKEN)
    }
    if (targetKey === 'openaq' && env.OPENAQ_KEY) {
      upstream.searchParams.set('api_key', env.OPENAQ_KEY)
    }
    if (targetKey === 'owm' && env.OWM_KEY) {
      upstream.searchParams.set('appid', env.OWM_KEY)
    }

    try {
      const upstreamHeaders: Record<string, string> = {
        'Accept': 'application/json, text/csv, text/plain, */*',
        'User-Agent': 'CityhubProxy/2.0',
      }
      // OpenAQ uses bearer auth
      if (targetKey === 'openaq' && env.OPENAQ_KEY) {
        upstreamHeaders['X-API-Key'] = env.OPENAQ_KEY
      }

      const upstreamRes = await fetch(upstream.toString(), { headers: upstreamHeaders })

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: {
          ...cors,
          'Content-Type': upstreamRes.headers.get('Content-Type') ?? 'application/json',
          'Cache-Control': `public, max-age=${target.cacheSeconds}`,
        },
      })
    } catch (err) {
      return jsonCors({ error: 'Upstream failed', detail: String(err) }, 502, cors)
    }
  },
}

function jsonCors(obj: unknown, status = 200, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Back-compat: internal helpers that still use a fixed cors object get a shim
function json(obj: unknown, status = 200): Response {
  return jsonCors(obj, status, corsHeaders(null))
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

async function handleForecast(request: Request, env: Env, cors: Record<string, string> = corsHeaders(null)): Promise<Response> {
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

  // 2. TimeFM — HF serverless by default, override with TIMEFM_ENDPOINT_URL
  //    when you've deployed TimeFM yourself (HF Space, Modal, Vertex, etc.)
  if (env.HF_API_TOKEN) {
    const t = await tryTimeFM(series, horizon, env.HF_API_TOKEN, env.TIMEFM_ENDPOINT_URL)
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
  endpointOverride?: string,
): Promise<ForecastResponse | null> {
  // Endpoint resolution priority:
  //   1. TIMEFM_ENDPOINT_URL secret (point at your own deployment — HF Space,
  //      Modal, Vertex AI, anything that accepts {history, horizon} POST)
  //   2. HF serverless inference for google/timesfm-2.0-500m-pytorch — NOTE:
  //      not on HF's serverless allow-list as of 2026-05, will 404
  // For production use we recommend deploying TimeFM yourself; the most
  // common paths are:
  //   • HF Space (free CPU): fork google/timesfm-2.0 demo, deploy as Gradio
  //   • Modal: 40-line modal_app.py, free $30/mo GPU credits
  //   • Vertex AI: paid, integrates with Google Cloud
  // See worker/README.md for full deployment instructions.
  const endpoint = endpointOverride ??
    'https://api-inference.huggingface.co/models/google/timesfm-2.0-500m-pytorch'
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { history: series, horizon },
        options: { wait_for_model: true },
      }),
    })
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

async function handleNarrate(request: Request, env: Env, cors: Record<string, string> = corsHeaders(null)): Promise<Response> {
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

// ── Earth Engine getMapId ─────────────────────────────────────────────────
//
// Renders a Google Earth Engine expression to a tile URL template that
// MapLibre can consume directly. Auth path:
//   1. Read GCP_SERVICE_ACCOUNT_JSON (the full service-account JSON blob)
//   2. Sign a JWT with the private key (RS256), assertion grant
//   3. Exchange JWT for an OAuth2 access token at oauth2.googleapis.com/token
//   4. POST the expression to earthengine.googleapis.com/v1/.../maps
//   5. Return the tileFetcher URL template (with token embedded)
//
// Tokens are cached at module scope for ~50min (Google issues 1h tokens).
//
// Pre-built expressions for common products live in EE_PRESETS.

interface EEMapRequest {
  preset?: 'alphaearth' | 'sentinel2-rgb' | 'modis-ndvi' | 's5p-no2' | 's5p-co' | 's5p-so2' | 'ghsl-pop' | 'dynamic-world' | 'sentinel1-sar' | 'landsat-thermal'
  startDate?: string
  endDate?: string
}

const getEEPresets = (start: string, end: string): Record<string, { expression: object; visualization: object; attribution?: string }> => ({
  // Google AlphaEarth Foundations — 64-dim annual satellite embeddings.
  // Visualize first 3 PCA bands as RGB.
  alphaearth: {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.first',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.filterDate',
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: 'ImageCollection.load',
                              arguments: { id: { constantValue: 'GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL' } },
                            },
                          },
                          start: { constantValue: start },
                          end: { constantValue: end },
                        },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['A00', 'A01', 'A02'] },
            },
          },
        },
      },
    },
    visualization: { min: -0.3, max: 0.3, gamma: 1.4 },
    attribution: 'Google Earth Engine · AlphaEarth Foundations',
  },
  // Sentinel-5P NO2 — Nitrogen Dioxide (traffic/industrial indicator)
  's5p-no2': {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.mean',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.filterDate',
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: 'ImageCollection.load',
                              arguments: { id: { constantValue: 'COPERNICUS/S5P/OFFL/L3_NO2' } },
                            },
                          },
                          start: { constantValue: start },
                          end: { constantValue: end },
                        },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['NO2_column_number_density'] },
            },
          },
        },
      },
    },
    visualization: { min: 0, max: 0.0002, palette: ['black', 'blue', 'purple', 'cyan', 'green', 'yellow', 'red'] },
    attribution: 'Copernicus Sentinel-5P · ESA',
  },
  // Sentinel-5P CO — Carbon Monoxide (burning/vehicle indicator)
  's5p-co': {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.mean',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.filterDate',
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: 'ImageCollection.load',
                              arguments: { id: { constantValue: 'COPERNICUS/S5P/OFFL/L3_CO' } },
                            },
                          },
                          start: { constantValue: start },
                          end: { constantValue: end },
                        },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['CO_column_number_density'] },
            },
          },
        },
      },
    },
    visualization: { min: 0, max: 0.05, palette: ['black', 'blue', 'green', 'yellow', 'red'] },
    attribution: 'Copernicus Sentinel-5P · ESA',
  },
  // Sentinel-5P SO2 — Sulfur Dioxide (industrial/power plant indicator)
  's5p-so2': {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.mean',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.filterDate',
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: 'ImageCollection.load',
                              arguments: { id: { constantValue: 'COPERNICUS/S5P/OFFL/L3_SO2' } },
                            },
                          },
                          start: { constantValue: start },
                          end: { constantValue: end },
                        },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['SO2_column_number_density'] },
            },
          },
        },
      },
    },
    visualization: { min: 0, max: 0.001, palette: ['black', 'blue', 'cyan', 'yellow', 'red'] },
    attribution: 'Copernicus Sentinel-5P · ESA',
  },
  // GHSL Population Density 2025 — Global Human Settlement Layer
  'ghsl-pop': {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.first',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.load',
                        arguments: { id: { constantValue: 'JRC/GHSL/P2023A/GHS_POP' } },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['population_count'] },
            },
          },
        },
      },
    },
    visualization: { min: 0, max: 1000, palette: ['000004', '1b0c41', '4a0c6b', '781c6d', 'a52c60', 'cf4446', 'f17020', 'fca50a', 'f7d31d', 'fcfdbf'] },
    attribution: 'GHSL · European Commission JRC',
  },
  'dynamic-world': {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.mode',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.filterDate',
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: 'ImageCollection.load',
                              arguments: { id: { constantValue: 'GOOGLE/DYNAMICWORLD/V1' } },
                            },
                          },
                          start: { constantValue: start },
                          end: { constantValue: end },
                        },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['label'] },
            },
          },
        },
      },
    },
    visualization: { min: 0, max: 8, palette: ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'] },
    attribution: 'Dynamic World · WRI/Google',
  },
  'sentinel1-sar': {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.median',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.filterDate',
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: 'ImageCollection.load',
                              arguments: { id: { constantValue: 'COPERNICUS/S1_GRD' } },
                            },
                          },
                          start: { constantValue: start },
                          end: { constantValue: end },
                        },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['VV'] },
            },
          },
        },
      },
    },
    visualization: { min: -25, max: 0, palette: ['000000', 'FFFFFF'] },
    attribution: 'Sentinel-1 SAR · ESA',
  },
  'landsat-thermal': {
    expression: {
      result: '0',
      values: {
        '0': {
          functionInvocationValue: {
            functionName: 'Image.select',
            arguments: {
              input: {
                functionInvocationValue: {
                  functionName: 'ImageCollection.median',
                  arguments: {
                    collection: {
                      functionInvocationValue: {
                        functionName: 'ImageCollection.filterDate',
                        arguments: {
                          collection: {
                            functionInvocationValue: {
                              functionName: 'ImageCollection.load',
                              arguments: { id: { constantValue: 'LANDSAT/LC09/C02/T1_L2' } },
                            },
                          },
                          start: { constantValue: start },
                          end: { constantValue: end },
                        },
                      },
                    },
                  },
                },
              },
              bandSelectors: { constantValue: ['ST_B10'] },
            },
          },
        },
      },
    },
    visualization: { min: 40000, max: 50000, palette: ['000088', '0000ff', '00ffff', 'ffff00', 'ff0000'] },
    attribution: 'Landsat 9 Thermal · USGS/NASA',
  }
})

let cachedEEToken: { token: string; expires: number } | null = null

async function handleEEMapId(request: Request, env: Env, cors: Record<string, string> = corsHeaders(null)): Promise<Response> {
  if (!env.GCP_SERVICE_ACCOUNT_JSON) {
    return json({
      error: 'Earth Engine not configured',
      hint: 'Set GCP_SERVICE_ACCOUNT_JSON Worker secret. See worker/README.md.',
    }, 503)
  }

  let body: EEMapRequest
  try { body = await request.json() as EEMapRequest } catch { return json({ error: 'Invalid JSON' }, 400) }

  const presetKey = body.preset ?? 'alphaearth'
  const end = body.endDate ?? new Date().toISOString().split('T')[0]
  const start = body.startDate ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const presets = getEEPresets(start, end)
  const preset = presets[presetKey]
  if (!preset) return json({ error: `Unknown preset: ${presetKey}` }, 400)

  let sa: { client_email: string; private_key: string; project_id: string }
  try {
    sa = JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON)
  } catch {
    return json({ error: 'GCP_SERVICE_ACCOUNT_JSON is not valid JSON' }, 500)
  }

  // 1. Get or refresh OAuth token
  let accessToken: string
  if (cachedEEToken && cachedEEToken.expires > Date.now() + 60_000) {
    accessToken = cachedEEToken.token
  } else {
    accessToken = await mintGoogleOAuthToken(sa)
    cachedEEToken = { token: accessToken, expires: Date.now() + 50 * 60_000 }
  }

  // 2. Call EE getMapId
  const eeUrl =
    `https://earthengine.googleapis.com/v1/projects/${sa.project_id}/maps?fields=name`
  const eeBody = { expression: preset.expression, visualizationOptions: preset.visualization }
  const eeRes = await fetch(eeUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eeBody),
  })
  if (!eeRes.ok) {
    const err = await eeRes.text()
    return json({ error: 'EE getMapId failed', detail: err.slice(0, 400) }, 502)
  }
  const eeData = await eeRes.json() as { name: string }
  // tileFetcher URL template — embed {z}/{x}/{y} for MapLibre
  const tileUrl =
    `https://earthengine.googleapis.com/v1/${eeData.name}/tiles/{z}/{x}/{y}`
  return json({
    preset: presetKey,
    tiles: tileUrl,
    attribution: preset.attribution ?? 'Google Earth Engine',
  })
}

/**
 * Mint a Google OAuth2 access token from a service-account JSON.
 * Uses RS256-signed JWT assertion grant — runs entirely in the Worker
 * via Web Crypto API (no Google client lib).
 */
async function mintGoogleOAuthToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/earthengine.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const enc = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const headerB64 = enc(header)
  const payloadB64 = enc(payload)
  const toSign = `${headerB64}.${payloadB64}`

  // Convert PEM private key → CryptoKey
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    der.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(toSign),
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const jwt = `${toSign}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  })
  if (!tokenRes.ok) {
    throw new Error(`OAuth token mint failed: ${tokenRes.status}`)
  }
  const tokenData = await tokenRes.json() as { access_token: string }
  return tokenData.access_token
}
