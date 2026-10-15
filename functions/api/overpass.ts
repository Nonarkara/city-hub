/**
 * Cloudflare Pages function: POST /api/overpass
 *
 * Proxies Overpass so the identifying User-Agent survives. Browsers cannot set
 * User-Agent (it is a forbidden header name), and the public mirrors reject a
 * browser UA with 406 / rate-limit it with 429. Nominatim already runs this
 * way; this is the same arrangement for the Lynch city-image query.
 *
 * POST body is `data=<query>` (form-encoded) or a raw text body, matching the
 * Overpass API's own convention.
 */
import { handleOverpassRequest } from '../../src/lib/osm/overpass-http'

const MAX_BODY_CHARS = 16_000

async function readFormData(request: Request): Promise<string> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('application/x-www-form-urlencoded')) {
    const raw = await request.text()
    return new URLSearchParams(raw).get('data') ?? ''
  }
  return request.text()
}

export function onRequestPost(context: { request: Request }): Promise<Response> {
  return handleOverpassRequest(context.request, {
    readBody: async (request) => {
      const body = await readFormData(request)
      return body.length > MAX_BODY_CHARS ? body.slice(0, MAX_BODY_CHARS + 1) : body
    },
  })
}

/** GET is supported so the endpoint is inspectable from a browser or curl. */
export function onRequestGet(context: { request: Request }): Promise<Response> {
  return handleOverpassRequest(context.request)
}