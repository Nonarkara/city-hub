import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { clearCache } from '../src/lib/cached-fetch'
import {
  CITY_SEARCH_UNAVAILABLE,
} from '../src/lib/osm/messages'
import {
  NOMINATIM_ENDPOINT,
  NOMINATIM_USER_AGENT,
  NominatimUpstream,
  setNominatimUpstreamForTests,
} from '../src/lib/osm/nominatim-upstream'
import { handleNominatimRequest } from '../src/lib/osm/nominatim-http'
import {
  OVERPASS_MIRRORS,
  OVERPASS_USER_AGENT,
  OverpassClient,
  installOverpassClient,
  overpassBackoffMs,
} from '../src/lib/osm/overpass'
import { FORBIDDEN_OSM_TILE_HOST, OSM_LABEL_TILES, OSM_TILE_ATTRIBUTION } from '../src/lib/osm/tiles'
import {
  filterNominatimResults,
  nominatimSearchUrl,
  searchNominatim,
  type NominatimResult,
} from '../src/lib/city-generator'
import {
  fetchOsmEmergency,
  osmElementsToFeatures,
  resetOsmDegradedForTests,
  takeOsmDegradedNotice,
} from '../src/data/osm-pois'

test.describe.configure({ mode: 'serial' })

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

function header(init: RequestInit | undefined, name: string): string {
  const headers = init?.headers
  if (!headers || headers instanceof Headers || Array.isArray(headers)) return ''
  return headers[name] ?? ''
}

function place(partial: Partial<NominatimResult> & Pick<NominatimResult, 'place_id' | 'class' | 'type'>): NominatimResult {
  return {
    display_name: 'Place',
    lat: '13.75',
    lon: '100.5',
    boundingbox: ['13.6', '13.9', '100.3', '100.7'],
    ...partial,
  }
}

test.beforeEach(() => {
  clearCache()
  resetOsmDegradedForTests()
  setNominatimUpstreamForTests(null)
  installOverpassClient()
})

test('label tiles use CARTO and credit OpenStreetMap contributors', () => {
  expect(OSM_LABEL_TILES.length).toBeGreaterThan(0)
  for (const tile of OSM_LABEL_TILES) {
    expect(tile).toContain('basemaps.cartocdn.com')
    expect(tile).not.toContain(FORBIDDEN_OSM_TILE_HOST)
  }
  expect(OSM_TILE_ATTRIBUTION).toContain('OpenStreetMap contributors')
  expect(OSM_TILE_ATTRIBUTION).toContain('CARTO')

  const mapView = read('src/components/MapView.tsx')
  expect(mapView).not.toContain('https://tile.openstreetmap.org')
  expect(mapView).toContain('OSM_TILE_ATTRIBUTION')
})

test('the browser city search never calls Nominatim directly', () => {
  const client = read('src/lib/city-generator.ts')
  expect(client).not.toContain('https://nominatim.openstreetmap.org')
  expect(client).not.toContain('https://overpass-api.de')
  expect(nominatimSearchUrl('Jakarta', '')).toBe('/api/nominatim?q=Jakarta')
  expect(nominatimSearchUrl('Jakarta', 'https://proxy.example/')).toBe(
    'https://proxy.example/nominatim?q=Jakarta',
  )
  expect(nominatimSearchUrl('Jakarta', 'https://proxy.example')).not.toContain('openstreetmap.org')
})

test('Nominatim upstream sends an identifying User-Agent, caches, and waits 1s', async () => {
  let now = 0
  const sleeps: number[] = []
  const calls: { url: string; ua: string }[] = []
  const client = new NominatimUpstream({
    clock: {
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms)
        now += ms
      },
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, ua: header(init, 'User-Agent') })
      return new Response(JSON.stringify([
        place({ place_id: calls.length, class: 'place', type: 'city', display_name: url }),
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    },
  })

  const first = await client.search('Jakarta')
  const cached = await client.search('  jakarta ')
  const second = await client.search('Bandung')

  expect(first).toHaveLength(1)
  expect(cached).toEqual(first)
  expect(calls).toHaveLength(2)
  expect(calls[0].url.startsWith(NOMINATIM_ENDPOINT)).toBe(true)
  expect(calls[0].ua).toBe(NOMINATIM_USER_AGENT)
  expect(calls[0].ua.toLowerCase()).not.toContain('python')
  expect(calls[1].url).toContain('bandung')
  expect(sleeps).toEqual([1000])
  expect(second).toHaveLength(1)
})

test('Nominatim HTTP adapter hides upstream failures and skips short queries', async () => {
  let fetches = 0
  setNominatimUpstreamForTests(new NominatimUpstream({
    clock: { now: () => 0, sleep: async () => {} },
    fetchImpl: async () => {
      fetches += 1
      return new Response('blocked', { status: 403 })
    },
  }))

  const short = await handleNominatimRequest(new URL('http://local/api/nominatim?q=a'))
  expect(short.status).toBe(200)
  expect(await short.json()).toEqual({ results: [] })
  expect(fetches).toBe(0)

  const failed = await handleNominatimRequest(new URL('http://local/api/nominatim?q=Jakarta'))
  expect(failed.status).toBe(503)
  const body = await failed.json() as { error: string }
  expect(body.error).toBe(CITY_SEARCH_UNAVAILABLE)
  expect(JSON.stringify(body)).not.toMatch(/403|nominatim\.openstreetmap/i)
})

test('browser search uses the API, caches, and does not surface Nominatim status codes', async () => {
  const calls: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('q=Oslo')) {
      return new Response(JSON.stringify({ error: 'nope' }), { status: 503 })
    }
    return new Response(JSON.stringify({
      results: [
        place({ place_id: 1, class: 'place', type: 'city', display_name: 'Nairobi, Kenya', importance: 0.8 }),
        place({ place_id: 2, class: 'boundary', type: 'country', addresstype: 'country', display_name: 'Kenya', importance: 1 }),
      ],
    }), { status: 200 })
  }) as typeof fetch

  try {
    const first = await searchNominatim('Nairobi')
    const second = await searchNominatim('Nairobi')
    expect(first.map((r) => r.place_id)).toEqual([1])
    expect(second).toEqual(first)
    expect(calls).toEqual([nominatimSearchUrl('Nairobi')])
    expect(calls[0]).not.toContain('openstreetmap.org')
    const worker = read('worker/src/index.ts')
    expect(worker).toContain("pathname === '/nominatim'")
    expect(worker).toContain('handleNominatimRequest')
    await expect(searchNominatim('Oslo')).rejects.toThrow(CITY_SEARCH_UNAVAILABLE)
    await expect(searchNominatim('x')).resolves.toEqual([])
  } finally {
    globalThis.fetch = original
    clearCache()
  }
})

test('place filter keeps cities and drops countries and roads', () => {
  const kept = filterNominatimResults([
    place({ place_id: 1, class: 'place', type: 'city', importance: 0.4 }),
    place({ place_id: 2, class: 'boundary', type: 'administrative', addresstype: 'country', importance: 0.9 }),
    place({ place_id: 3, class: 'highway', type: 'road', importance: 0.2 }),
    place({ place_id: 4, class: 'place', type: 'town', importance: 0.7 }),
  ])
  expect(kept.map((r) => r.place_id)).toEqual([4, 1])
})

test('Overpass backs off on 429/504, then uses the next mirror', async () => {
  expect(overpassBackoffMs(0)).toBe(500)
  expect(overpassBackoffMs(1)).toBe(1000)
  expect(overpassBackoffMs(2)).toBe(2000)
  expect(overpassBackoffMs(10)).toBe(8000)

  const sleeps: number[] = []
  const urls: string[] = []
  let ua = ''
  const client = new OverpassClient({
    clock: {
      now: () => 0,
      sleep: async (ms) => { sleeps.push(ms) },
    },
    fetchImpl: async (url, init) => {
      urls.push(url)
      ua = header(init, 'User-Agent')
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      expect(String(init?.body)).toContain('data=')
      if (url === OVERPASS_MIRRORS[0]) return new Response('slow', { status: 504 })
      if (url === OVERPASS_MIRRORS[1]) return new Response('rate', { status: 429 })
      return new Response(JSON.stringify({ elements: [{ type: 'node', id: 1 }] }), { status: 200 })
    },
  })

  const first = await client.query('[out:json];out;')
  const cached = await client.query('[out:json];out;')
  expect(first).toEqual({ elements: [{ type: 'node', id: 1 }] })
  expect(cached).toEqual(first)
  expect(urls).toEqual([...OVERPASS_MIRRORS])
  expect(sleeps).toEqual([500, 1000])
  expect(ua).toBe(OVERPASS_USER_AGENT)
})

test('Overpass 406 falls through to the next mirror without a rate-limit backoff', async () => {
  const sleeps: number[] = []
  const urls: string[] = []
  const client = new OverpassClient({
    clock: { now: () => 0, sleep: async (ms) => { sleeps.push(ms) } },
    fetchImpl: async (url) => {
      urls.push(url)
      if (url === OVERPASS_MIRRORS[0]) return new Response('missing ua', { status: 406 })
      return new Response(JSON.stringify({ elements: [] }), { status: 200 })
    },
  })
  await client.query('needs-ua')
  expect(urls).toEqual([OVERPASS_MIRRORS[0], OVERPASS_MIRRORS[1]])
  expect(sleeps).toEqual([])
})

test('Overpass timeout skips to the next mirror without a rate-limit backoff', async () => {
  const sleeps: number[] = []
  const urls: string[] = []
  const client = new OverpassClient({
    clock: { now: () => 0, sleep: async (ms) => { sleeps.push(ms) } },
    fetchImpl: async (url) => {
      urls.push(url)
      if (url === OVERPASS_MIRRORS[0]) throw new DOMException('timed out', 'TimeoutError')
      return new Response(JSON.stringify({ elements: [] }), { status: 200 })
    },
  })
  await client.query('timeout-query')
  expect(urls).toEqual([OVERPASS_MIRRORS[0], OVERPASS_MIRRORS[1]])
  expect(sleeps).toEqual([])
})

test('a down Overpass degrades to an empty place layer', async () => {
  installOverpassClient(new OverpassClient({
    clock: { now: () => 0, sleep: async () => {} },
    fetchImpl: async () => new Response('down', { status: 504 }),
  }))

  const data = await fetchOsmEmergency()
  expect(data.type).toBe('FeatureCollection')
  expect(data.features).toEqual([])
  expect(takeOsmDegradedNotice()).toContain('temporarily unavailable')
  expect(takeOsmDegradedNotice()).toBeNull()
})

test('Overpass nodes become amenity features and unknown elements are dropped', () => {
  const fc = osmElementsToFeatures([
    {
      type: 'node',
      id: 9,
      lat: 13.75,
      lon: 100.5,
      tags: { amenity: 'hospital', name: 'Test Hospital', 'name:th': 'โรงพยาบาล' },
    },
    { type: 'way', id: 3, lat: 13.7, lon: 100.4, tags: { amenity: 'school' } },
    { type: 'node', id: 4, lat: 13.7, lon: 100.4, tags: { amenity: 'not-a-place' } },
  ])
  expect(fc.features).toHaveLength(1)
  expect(fc.features[0].properties).toMatchObject({
    id: 9,
    amenity: 'hospital',
    name: 'Test Hospital',
    nameTH: 'โรงพยาบาล',
  })
})
