import tzLookup from 'tz-lookup'
import type { CityConfig } from '../config/cities'
import { cachedFetch } from './cached-fetch'
import { CITY_SEARCH_UNAVAILABLE } from './osm/messages'

export interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string] // [s, n, w, e]
  type: string
  class: string
  addresstype?: string
  importance?: number
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
    country_code?: string
  }
}

const NOMINATIM_CLIENT_TTL_MS = 10 * 60 * 1000

function readProxyUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { VITE_PROXY_URL?: string } }).env
  return typeof env?.VITE_PROXY_URL === 'string' ? env.VITE_PROXY_URL : ''
}

/**
 * Browser search hits our API. The public geocoder is called only by the
 * Worker, the Pages function, or the Vite dev server.
 * With VITE_PROXY_URL the Worker serves `/nominatim`; otherwise the same-origin
 * Pages function or Vite middleware serves `/api/nominatim`.
 */
export function nominatimSearchUrl(query: string, proxyUrl = readProxyUrl()): string {
  const q = encodeURIComponent(query.trim())
  const proxy = proxyUrl.trim().replace(/\/$/, '')
  if (proxy) return `${proxy}/nominatim?q=${q}`
  return `/api/nominatim?q=${q}`
}

export function filterNominatimResults(results: NominatimResult[]): NominatimResult[] {
  return results
    .filter((r) => {
      const t = `${r.class}:${r.type}:${r.addresstype ?? ''}`.toLowerCase()
      return /place|boundary/.test(t) && !/continent|country|postcode|road|house/.test(t)
    })
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 6)
}

/** Search city candidates through the server-side Nominatim proxy. */
export async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  try {
    return await cachedFetch(
      `nominatim/${trimmed.toLowerCase()}`,
      () => fetchNominatimApi(trimmed),
      NOMINATIM_CLIENT_TTL_MS,
    )
  } catch (err) {
    console.warn('[nominatim] search failed', err)
    throw new Error(CITY_SEARCH_UNAVAILABLE)
  }
}

async function fetchNominatimApi(query: string): Promise<NominatimResult[]> {
  const res = await fetch(nominatimSearchUrl(query), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`city search ${res.status}`)
  const body = await res.json() as { results?: NominatimResult[] } | NominatimResult[]
  const results = Array.isArray(body) ? body : body.results
  if (!Array.isArray(results)) throw new Error('city search payload')
  return filterNominatimResults(results)
}

/** Convert Nominatim result → CityConfig. */
export function nominatimToCityConfig(result: NominatimResult): CityConfig {
  const lat = parseFloat(result.lat)
  const lon = parseFloat(result.lon)
  const [s, n, w, e] = result.boundingbox.map(parseFloat)

  // Extract city name and country from display_name
  const parts = result.display_name.split(',').map((p) => p.trim()).filter(Boolean)
  const name =
    result.address?.city ??
    result.address?.town ??
    result.address?.village ??
    result.address?.municipality ??
    parts[0] ??
    'Unnamed place'
  const country = result.address?.country ?? parts[parts.length - 1] ?? 'Unknown'

  // Generate a unique slug id (name + country to avoid collisions)
  const countrySlug = country.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${countrySlug}`

  // Generate HUD label from first 3 letters, uppercase
  const hudClockLabel = name.slice(0, 3).toUpperCase()

  // Timezone from tz-lookup
  let timezone: string
  try {
    timezone = tzLookup(lat, lon)
  } catch {
    timezone = 'UTC'
  }

  // GDELT query
  const gdeltQuery = `${name} ${country}`.toLowerCase()

  // Estimate area from bbox (rough) — longitude degrees shrink with latitude
  const widthKm = Math.abs(e - w) * 111 * Math.cos((lat * Math.PI) / 180)
  const heightKm = Math.abs(n - s) * 111
  const area_km2 = Math.round(widthKm * heightKm)

  return {
    id,
    name,
    country: countryCode(country, result.address?.country_code),
    center: [lon, lat],
    zoom: 11,
    bbox: [w, s, e, n],
    timezone,
    hudClockLabel,
    countryName: country,
    gdeltQuery,
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2,
    // 0, not 1.0. See `populationMillions` in config/cities.ts. Nominatim
    // carries no population, so this path genuinely does not know — and a
    // search result that says "not published" is worth more than one that
    // invents a round number the user cannot distinguish from a real reading.
    populationMillions: 0,
    founded: undefined,
    climate: 'Not from a source',
    distinctiveness: `${name}, ${country}. Located from OpenStreetMap; only global feeds are attached. The city's image — its paths, edges, districts, nodes and landmarks — is read from OpenStreetMap and needs no local curation.`,
    kpis: [
      { label: 'POPULATION', value: 'NOT PUBLISHED' },
      { label: 'SMART SCORE', value: 'NO TWIN' },
      { label: 'IOC STATUS', value: 'LIVE' },
    ],
  }
}

function countryCode(countryName: string, iso2?: string): string {
  if (iso2 && /^[a-z]{2}$/i.test(iso2)) return iso2.toUpperCase()
  const map: Record<string, string> = {
    'Thailand': 'TH',
    'Singapore': 'SG',
    'Malaysia': 'MY',
    'Indonesia': 'ID',
    'Philippines': 'PH',
    'Vietnam': 'VN',
    'Cambodia': 'KH',
    'Laos': 'LA',
    'Myanmar': 'MM',
    'Brunei': 'BN',
    'Japan': 'JP',
    'South Korea': 'KR',
    'China': 'CN',
    'India': 'IN',
    'United States': 'US',
    'United Kingdom': 'GB',
    'Germany': 'DE',
    'France': 'FR',
    'Netherlands': 'NL',
  }
  return map[countryName] ?? 'XX'
}

// Layer IDs that lite-tier cities know how to load (same as cities.ts)
const LITE_LAYERS = [
  'pm25-waqi',
  'pm25-openaq',
  'fires-firms',
  'aerosol-gibs',
  'weather-owm',
  'sat-true-color',
  'sat-night-lights',
  'sat-esri',
  'sat-sentinel2',
  'sat-ndvi',
]
