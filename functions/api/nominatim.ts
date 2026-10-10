/**
 * Cloudflare Pages function: GET /api/nominatim?q=
 * Keeps Nominatim off the browser when the SPA is served without the Worker.
 */
import { handleNominatimRequest } from '../../src/lib/osm/nominatim-http'

export function onRequestGet(context: { request: Request }): Promise<Response> {
  return handleNominatimRequest(new URL(context.request.url))
}
