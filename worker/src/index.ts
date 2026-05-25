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

export interface Env {}

const TARGETS: Record<string, { origin: string; cacheSeconds: number }> = {
  'data-go-th': { origin: 'https://data.go.th/api/3/action', cacheSeconds: 300 },
  'firms':      { origin: 'https://firms.modaps.eosdis.nasa.gov/api', cacheSeconds: 600 },
  'traffy':     { origin: 'https://publicapi.traffy.in.th', cacheSeconds: 120 },
  'gdelt':      { origin: 'https://api.gdeltproject.org/api/v2', cacheSeconds: 300 },
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
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
