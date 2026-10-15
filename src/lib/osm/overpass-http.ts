/**
 * Server-side Overpass adapter.
 *
 * Why this exists, and why the browser cannot do it instead:
 *
 * The public Overpass mirrors rate-limit by User-Agent. Measured 2026-10-15
 * against the exact query `city-image.ts` builds for Bangkok:
 *
 *   UA "CityHub/0.9 (…; civic place overlay)"  → overpass-api.de  HTTP 200, 35s
 *   UA "Mozilla/5.0 … Chrome/131.0 …"          → overpass-api.de  HTTP 406
 *   no UA                                      → kumi / private.coffee  HTTP 429
 *
 * `User-Agent` is a FORBIDDEN header name in the Fetch standard. A browser
 * silently drops anything a script sets, so every browser-side request arrives
 * with the browser's own UA — which the primary mirror answers with 406. The
 * mirrors then 429 the browser for "not including a meaningful User-Agent".
 *
 * The client in `overpass.ts` cannot fix this from inside the SPA, because the
 * one header that would fix it is exactly the header the browser will not let
 * JavaScript set. Nominatim already solved this by moving server-side
 * (`nominatim-upstream.ts` says so explicitly); this is the same move for
 * Overpass.
 *
 * Everything else — mirror order, backoff, cache, the 200-with-remark check —
 * is delegated to `OverpassClient`, so the browser path and this path cannot
 * drift apart in behaviour.
 */
import { OverpassClient, OverpassUnavailableError, type OverpassClientOptions } from './overpass'
import { CITY_IMAGE_UNAVAILABLE } from './messages'

export { OverpassUnavailableError }

/**
 * Overpass is a free public service. Requests are proxied through here so every
 * request carries one identifying User-Agent and the mirrors see a single
 * well-behaved client rather than per-visitor browser strings.
 *
 * Upstream answers are cached by `OverpassClient` for 24h and by the CDN for a
 * further 24h, because the underlying OSM data changes on its own schedule and
 * not in response to us.
 */
const CDN_CACHE = 'public, max-age=3600, s-maxage=86400'

let upstream: OverpassClient | null = null

export function overpassUpstream(options?: OverpassClientOptions): OverpassClient {
  if (!upstream) upstream = new OverpassClient(options)
  return upstream
}

/** Test hook. Pass nothing to restore a fresh default client. */
export function installOverpassUpstream(client?: OverpassClient | null): void {
  upstream = client ?? null
}

/**
 * Validate before proxying. The query is a string the SPA controls, and it is
 * forwarded to a public service as a POST body — so cap its length rather than
 * trusting the caller to stay well-behaved.
 */
const MAX_QUERY_CHARS = 16_000

export interface OverpassHttpOptions {
  /** Read the query from a POST body instead of a `data` URL parameter. */
  readBody?: (request: Request) => Promise<string>
}

async function readQuery(request: Request, opts: OverpassHttpOptions): Promise<string | null> {
  if (opts.readBody) return opts.readBody(request)
  const url = new URL(request.url)
  const param = url.searchParams.get('data')
  return param
}

export async function handleOverpassRequest(
  request: Request,
  options: OverpassHttpOptions & OverpassClientOptions = {},
): Promise<Response> {
  const query = await readQuery(request, options)
  if (typeof query !== 'string' || query.trim().length === 0) {
    return Response.json({ error: 'A `data` query parameter is required.' }, { status: 400 })
  }
  if (query.length > MAX_QUERY_CHARS) {
    return Response.json({ error: 'Query is too long.' }, { status: 400 })
  }
  try {
    const data = await overpassUpstream(options).query(query)
    return Response.json(data, { headers: { 'Cache-Control': CDN_CACHE } })
  } catch (err) {
    // Never fabricate an empty result set on failure. An empty FeatureCollection
    // reads as "this city has no paths, no nodes, no landmarks", which is a
    // claim. 503 reads as "the upstream is down", which is the truth.
    console.error('[overpass] upstream failed', err)
    return Response.json({ error: CITY_IMAGE_UNAVAILABLE }, { status: 503 })
  }
}