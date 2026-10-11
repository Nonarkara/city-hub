/**
 * HTTP adapter for the server-side Nominatim client.
 * Shared by the Cloudflare Worker, the Pages function, and the Vite dev server.
 */
import { CITY_SEARCH_UNAVAILABLE } from './messages'
import { nominatimUpstream } from './nominatim-upstream'

export { CITY_SEARCH_UNAVAILABLE }

export async function handleNominatimRequest(url: URL): Promise<Response> {
  const query = url.searchParams.get('q') ?? ''
  if (query.trim().length > 200) {
    return Response.json({ error: 'Query is too long.' }, { status: 400 })
  }
  if (query.trim().length < 2) {
    return Response.json({ results: [] })
  }
  try {
    const results = await nominatimUpstream().search(query)
    return Response.json(
      { results },
      { headers: { 'Cache-Control': 'public, max-age=86400' } },
    )
  } catch (err) {
    console.error('[nominatim] upstream failed', err)
    return Response.json({ error: CITY_SEARCH_UNAVAILABLE }, { status: 503 })
  }
}
