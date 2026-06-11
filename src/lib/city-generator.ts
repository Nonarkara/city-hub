import tzLookup from 'tz-lookup'
import type { CityConfig } from '../config/cities'

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

export interface GeneratedCity {
  config: CityConfig
  nutrition: NutritionLevel
}

export type NutritionLevel = 'instant-noodle' | 'street-food' | 'real-food' | 'gourmet'

export function nutritionLabel(level: NutritionLevel): string {
  switch (level) {
    case 'instant-noodle': return '🍜 Instant Noodle'
    case 'street-food': return '🍛 Street Food'
    case 'real-food': return '🍽️ Real Food'
    case 'gourmet': return '🌟 Gourmet'
  }
}

export function nutritionScore(level: NutritionLevel): number {
  switch (level) {
    case 'instant-noodle': return 15
    case 'street-food': return 45
    case 'real-food': return 75
    case 'gourmet': return 95
  }
}

/** Search Nominatim for city candidates. Free, no key, CORS-safe. */
export async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const url =
    'https://nominatim.openstreetmap.org/search' +
    `?q=${encodeURIComponent(query)}` +
    '&format=json&limit=8&addressdetails=1&dedupe=1&accept-language=en'
  const res = await fetch(url, { headers: { 'User-Agent': 'CityHub/1.0' } })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const results = await res.json() as NominatimResult[]
  return results
    .filter((r) => {
      const t = `${r.class}:${r.type}:${r.addresstype ?? ''}`.toLowerCase()
      return /place|boundary/.test(t) && !/continent|country|postcode|road|house/.test(t)
    })
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 6)
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

  // Estimate area from bbox (rough)
  const widthKm = Math.abs(e - w) * 111
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
    populationMillions: 1.0,       // placeholder — update after adding city
    founded: undefined,
    climate: 'Unknown — add locally',
    distinctiveness: `${name}, ${country}. Auto-generated global city config from OpenStreetMap. Local civic feeds can be attached later.`,
    kpis: [
      { label: 'POPULATION', value: '—' },
      { label: 'SMART SCORE', value: '—' },
      { label: 'IOC STATUS', value: 'LIVE' },
    ],
  }
}

/** Nutrition level for a city config. */
export function computeNutrition(city: CityConfig): NutritionLevel {
  const layerCount = city.availableLayers.length
  if (layerCount >= 30) return 'gourmet'
  if (layerCount >= 20) return 'real-food'
  if (layerCount >= 10) return 'street-food'
  return 'instant-noodle'
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
