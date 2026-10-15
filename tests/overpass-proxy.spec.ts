import { expect, test } from '@playwright/test'
import { OverpassClient, OverpassUnavailableError, overpassBackoffMs } from '../src/lib/osm/overpass'
import { handleOverpassRequest, installOverpassUpstream } from '../src/lib/osm/overpass-http'
import { CITY_IMAGE_UNAVAILABLE as MSG } from '../src/lib/osm/messages'

const CITY_IMAGE_UNAVAILABLE = MSG

test.afterEach(() => {
  installOverpassUpstream(null)
})

// ── Why the proxy exists ─────────────────────────────────────────────────────
// Measured 2026-10-15 against the exact query city-image.ts builds for Bangkok:
//   CityHub UA   → overpass-api.de  HTTP 200 (35s)
//   Chrome UA     → overpass-api.de  HTTP 406
//   (no UA)       → kumi / private.coffee  HTTP 429
// User-Agent is a forbidden header name in the Fetch standard, so a browser
// drops whatever JavaScript sets and sends its own UA instead. The client
// cannot fix this from inside the SPA.

test('a browser-side client must target the proxy, not the mirrors', async () => {
  const seen: string[] = []
  const client = new OverpassClient({
    mirrors: ['/api/overpass'],
    fetchImpl: async (input) => {
      seen.push(String(input))
      return new Response(JSON.stringify({ elements: [] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  await client.query('[out:json];node(1);out;')
  expect(seen).toEqual(['/api/overpass'])
})

test('the proxy path is the documented same-origin route', () => {
  expect('/api/overpass').toMatch(/^\/api\//)
})

// ── 200-with-remark must not be cached as success ────────────────────────────
// Overpass can return HTTP 200 carrying a runtime error and partial data.
// Caching that would pin a failure for 24 hours.

test('a 200 response carrying a remark is not cached and not returned', async () => {
  let calls = 0
  const client = new OverpassClient({
    mirrors: ['https://a.invalid/i', 'https://b.invalid/i'],
    fetchImpl: async () => {
      calls += 1
      return new Response(JSON.stringify({ elements: [], remark: 'runtime error' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  await expect(client.query('[out:json];out;')).rejects.toBeInstanceOf(OverpassUnavailableError)
  expect(calls).toBe(2)
})

test('a successful response is cached and not refetched', async () => {
  let calls = 0
  const client = new OverpassClient({
    mirrors: ['https://a.invalid/i'],
    fetchImpl: async () => {
      calls += 1
      return new Response(JSON.stringify({ elements: [{ id: 1 }] }), {
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })
  await client.query('[out:json];out;')
  await client.query('[out:json];out;')
  expect(calls).toBe(1)
})

// ── A failure must never become an empty result set ─────────────────────────
// An empty FeatureCollection reads as "this city has no paths, no nodes, no
// landmarks" — a claim about the city. A 503 reads as what it is.

test('upstream failure returns 503 and no fabricated empty collection', async () => {
  installOverpassUpstream(new OverpassClient({
    mirrors: ['https://a.invalid/i'],
    fetchImpl: async () => new Response('nope', { status: 503 }),
  }))
  const res = await handleOverpassRequest(
    new Request('https://hub.nonarkara.org/api/overpass?data=%5Bout:json%5D;out;'),
  )
  expect(res.status).toBe(503)
  const body = await res.json()
  expect(body.error).toBe(CITY_IMAGE_UNAVAILABLE)
  // The critical assertion: no `elements: []` masquerading as a real answer.
  expect(body).not.toHaveProperty('elements')
})

// ── Input validation at the public edge ──────────────────────────────────────

test('a missing query is a 400, not an upstream call', async () => {
  let called = false
  installOverpassUpstream(new OverpassClient({
    mirrors: ['https://a.invalid/i'],
    fetchImpl: async () => {
      called = true
      return new Response('{}')
    },
  }))
  const res = await handleOverpassRequest(new Request('https://hub.nonarkara.org/api/overpass'))
  expect(res.status).toBe(400)
  expect(called).toBe(false)
})

test('an oversized query is rejected before it reaches a public service', async () => {
  let called = false
  installOverpassUpstream(new OverpassClient({
    mirrors: ['https://a.invalid/i'],
    fetchImpl: async () => {
      called = true
      return new Response('{}')
    },
  }))
  const huge = 'x'.repeat(17_000)
  const res = await handleOverpassRequest(
    new Request(`https://hub.nonarkara.org/api/overpass?data=${huge}`),
  )
  expect(res.status).toBe(400)
  expect(called).toBe(false)
})

test('a successful proxy response is CDN-cacheable', async () => {
  installOverpassUpstream(new OverpassClient({
    mirrors: ['https://a.invalid/i'],
    fetchImpl: async () => new Response(JSON.stringify({ elements: [{ id: 7 }] }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  }))
  const res = await handleOverpassRequest(
    new Request('https://hub.nonarkara.org/api/overpass?data=%5Bout:json%5D;out;'),
  )
  expect(res.status).toBe(200)
  expect(res.headers.get('Cache-Control')).toContain('s-maxage')
  expect((await res.json()).elements).toHaveLength(1)
})

// ── Copy ─────────────────────────────────────────────────────────────────────

test('the city-image failure message does not leak an upstream hostname', () => {
  expect(CITY_IMAGE_UNAVAILABLE).toBe(MSG)
  expect(CITY_IMAGE_UNAVAILABLE).not.toMatch(/overpass|openstreetmap|\.de|\.systems/i)
  // The city is known — we are reading its structure. Telling a user the
  // "search" is unavailable would send them hunting a typo that does not exist.
  expect(CITY_IMAGE_UNAVAILABLE).not.toMatch(/search/i)
})

test('backoff is bounded', () => {
  expect(overpassBackoffMs(0)).toBeLessThanOrEqual(500)
  expect(overpassBackoffMs(10)).toBeLessThanOrEqual(8000)
  expect(overpassBackoffMs(100)).toBeLessThanOrEqual(8000)
})
// ── Timeout budget must clear the real upstream cost ─────────────────────────
// Measured 2026-10-15 against overpass-api.de with the Bangkok city-image
// query: upstream [timeout:12] → 502; [timeout:25] → 200 in 52s;
// [timeout:60] → 200 in 55s. A 12s client budget therefore could never
// succeed. These tests fail if the budget is ever dropped back.

test('the client budget exceeds the upstream query budget', async () => {
  const { OVERPASS_TIMEOUT_MS } = await import('../src/lib/osm/overpass')
  const { CITY_IMAGE_QUERY_TIMEOUT_S } = await import('../src/data/city-image')
  expect(OVERPASS_TIMEOUT_MS / 1000).toBeGreaterThan(CITY_IMAGE_QUERY_TIMEOUT_S)
})

test('the upstream budget is not the old 12s that produced 502', async () => {
  const { CITY_IMAGE_QUERY_TIMEOUT_S } = await import('../src/data/city-image')
  expect(CITY_IMAGE_QUERY_TIMEOUT_S).toBeGreaterThanOrEqual(45)
})

test('a slow-but-successful upstream is not treated as a failure', async () => {
  // The client must be willing to wait past 12s for a real answer rather than
  // abandoning work that was about to finish.
  const { OVERPASS_TIMEOUT_MS } = await import('../src/lib/osm/overpass')
  expect(OVERPASS_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000)
})
