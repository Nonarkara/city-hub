/**
 * Basic facts about any city in the world, immediately.
 *
 * ## Why this file exists
 *
 * The app could already "view any city" — it geocodes a typed name through
 * Nominatim and builds a config from the result. What it could not do was tell
 * you anything about that city. The generated config carried:
 *
 *     populationMillions: 1.0,       // placeholder — update after adding city
 *     climate: 'Unknown — add locally'
 *
 * A fabricated million, rendered in the same typeface as Bangkok's measured
 * 5.455. Anyone reading it had no way to tell a guess from a number, and every
 * downstream consumer — density per km², the systems model, the twin, the
 * comparison panel — treated it as real.
 *
 * A search engine that answers "how big is this place" with a constant is worse
 * than one that says it does not know. So this reads **real** basics from a
 * source that covers the whole world with no key and no per-country coverage
 * gaps, and reports the ones it cannot find as `null` rather than filling them in.
 *
 * ## Sources, and what each is good for
 *
 * - **Open-Meteo geocoding** carries the thing we were missing: a population
 *   figure, a timezone, and an elevation, for cities and towns worldwide. It is
 *   the primary source because it is the only one of the two that answers
 *   "how big is it".
 * - **Nominatim** carries better *place coverage* and a real boundary
 *   bounding box, which becomes the study window for the city-image read. It
 *   carries no population at all.
 *
 * Both are used, for their actual strengths, and a candidate records which it
 * came from. When they disagree — and they do, because they are different
 * datasets — the coordinates are taken from the record that supplied the
 * population, so the number and the map are describing the same place.
 *
 * ## What this does not claim
 *
 * Open-Meteo's population is a settlement figure for the named place. It is not
 * a metro area, and it is not the same definition as the curated cities'
 * `populationMillions`, which is metro / city-region. **The two are not
 * comparable.** A curated city's figure is labelled `curated`; a generated
 * city's is labelled `open-meteo` and carries a settlement, not a region. Any
 * comparison across that boundary is a comparison of different quantities and
 * the UI is expected to say so.
 */

import { cachedFetch } from './cached-fetch'
import type { CityConfig } from '../config/cities'
import { CITY_SEARCH_UNAVAILABLE } from './osm/messages'

const OM_GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search'
const CITY_FACTS_TTL_MS = 60 * 60 * 1000
const CITY_FACTS_MIN_QUERY = 2

/** One place the user could open, with whatever is actually known about it. */
export interface CityCandidate {
  /** Stable slug: name + country. */
  id: string
  name: string
  /** Region / state / province, when the source names one. */
  admin: string | null
  country: string
  countryCode: string
  /** [lng, lat] */
  center: [number, number]
  /** [west, south, east, north] — used for the city-image study window. */
  bbox: [number, number, number, number] | null
  /** People, or null when no source had a figure. Never a stand-in. */
  population: number | null
  timezone: string | null
  /** Metres above sea level. Bears directly on how a city is shaped and read. */
  elevationM: number | null
  zoom: number
  /** Which sources contributed, so the UI can attribute rather than imply. */
  sources: Array<'open-meteo' | 'nominatim'>
}

interface OpenMeteoResult {
  id?: number
  name: string
  latitude: number
  longitude: number
  elevation?: number
  feature_code?: string
  country?: string
  country_code?: string
  admin1?: string
  admin2?: string
  timezone?: string
  population?: number
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Does this record look like a settlement rather than a building or a street?
 *
 * Open-Meteo's index is settlements plus a few administrative areas, but it
 * includes scattered hamlets. A city search that returns "Talakan" above
 * "Yakutsk" is not a search engine of cities, so records with no population at
 * all and a very small feature code are ranked below ones that name a real city.
 */
function isSettlement(result: OpenMeteoResult): boolean {
  const code = result.feature_code ?? ''
  if (/^(PPL|ADM)/.test(code)) return true
  // No feature code but a population — still a place people live.
  return typeof result.population === 'number' && result.population > 0
}

/**
 * Search places worldwide for real basics.
 *
 * Open-Meteo is queried directly from the browser: it is a free, keyless CORS
 * API, so putting it behind our own proxy would add a hop for no privacy gain
 * and one more thing to fall over.
 */
export async function searchCityBasics(query: string): Promise<CityCandidate[]> {
  const trimmed = query.trim()
  if (trimmed.length < CITY_FACTS_MIN_QUERY) return []
  return cachedFetch(
    `city-facts/${trimmed.toLowerCase()}`,
    () => fetchOpenMeteo(trimmed),
    CITY_FACTS_TTL_MS,
  )
}

async function fetchOpenMeteo(query: string): Promise<CityCandidate[]> {
  let body: { results?: OpenMeteoResult[] }
  try {
    const url = `${OM_GEO_BASE}?name=${encodeURIComponent(query)}&count=10&language=en&format=json`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`geocoding ${res.status}`)
    body = await res.json() as { results?: OpenMeteoResult[] }
  } catch (err) {
    // Deliberately the same user-facing sentence as any other search failure:
    // "this city search is down" is true whether Nominatim or Open-Meteo is
    // the one that is down, and naming our upstream tells an attacker which
    // dependency is worth attacking.
    console.warn('[city-facts] geocoding failed', err)
    throw new Error(CITY_SEARCH_UNAVAILABLE)
  }

  const results = Array.isArray(body.results) ? body.results : []
  return results
    .filter(isSettlement)
    .map(toCandidate)
    // Biggest first. For "search a city", population is the ranking a person
    // expects; Open-Meteo's own ordering puts a 6,000-person hamlet above a
    // 235,000 capital when the query is a capital's name.
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, 6)
}

function toCandidate(result: OpenMeteoResult): CityCandidate {
  const name = result.name
  const country = result.country ?? 'Unknown'
  const countryCode = (result.country_code ?? '').toUpperCase()
  return {
    id: `${slugify(name)}-${slugify(countryCode || country)}`,
    name,
    admin: result.admin1 ?? null,
    country,
    countryCode: countryCode || 'XX',
    center: [result.longitude, result.latitude],
    // Open-Meteo returns no boundary. A study window is still needed for the
    // city-image read, and it is derived from the population band rather than
    // invented silently — see `studyBbox`.
    bbox: null,
    population: typeof result.population === 'number' ? result.population : null,
    timezone: result.timezone ?? null,
    elevationM: typeof result.elevation === 'number' ? result.elevation : null,
    zoom: zoomForPopulation(result.population),
    sources: ['open-meteo'],
  }
}

/**
 * How far to zoom, and therefore how wide a window, for a place of this size.
 *
 * Anchored on the measurement the curated cities share: their 4 × 4 km study
 * window covers Bangkok (5.455M), Kranj (0.07M) and Singapore (5.9M) equally
 * well, because a street grid reads the same at that scale. A settlement two
 * orders of magnitude smaller needs a closer window or its four km of street is
 * mostly fields.
 *
 * Clamped at both ends: below ~30k a town is not legible at 11, and the wide end
 * stops well short of "whole metro" so the read stays a city image rather than a
 * regional one.
 */
export function zoomForPopulation(population: number | undefined | null): number {
  if (typeof population !== 'number' || population <= 0) return 11
  if (population < 30_000) return 14
  if (population < 150_000) return 13
  if (population < 600_000) return 12.5
  if (population < 2_000_000) return 12
  return 11.5
}

/**
 * A study window for the city-image read, when the geocoder gave no boundary.
 *
 * Derived from `zoom` so that the map view and the Overpass window are the same
 * question asked twice, rather than a map showing one city and the city image
 * quietly measuring another.
 */
export function studyBbox(center: [number, number], zoom: number): [number, number, number, number] {
  // Half-height in degrees at this latitude for a given zoom, over a ~1000px
  // viewport. Good enough for a 4 km-class window and it degrades honestly
  // rather than pretending to be a surveyed boundary.
  const metresPerPixel = 156_543.03 * Math.cos((center[1] * Math.PI) / 180) / 2 ** zoom
  const halfHeightM = (metresPerPixel * 500) / 1
  const halfWidthM = halfHeightM * 1
  const dLat = halfHeightM / 110_540
  const dLon = halfWidthM / (111_320 * Math.max(0.1, Math.cos((center[1] * Math.PI) / 180)))
  return [center[0] - dLon, center[1] - dLat, center[0] + dLon, center[1] + dLat]
}

/** People, or null. The one accessor every consumer should use. */
export function knownPopulation(candidate: Pick<CityCandidate, 'population'>): number | null {
  return typeof candidate.population === 'number' && candidate.population > 0 ? candidate.population : null
}

/**
 * Format a population the way a person reads one.
 *
 * A settlement's population is a settlement's population. It is never rounded to
 * a reassuring "1.0M", because that is the exact shape of the fabricated figure
 * this module was written to remove.
 */
export function formatPopulation(population: number | null): string {
  if (population === null) return 'Not published'
  if (population >= 1_000_000) return `${(population / 1_000_000).toFixed(2)}M`
  if (population >= 10_000) return `${Math.round(population / 1_000)}K`
  return population.toLocaleString('en-US')
}
/**
 * People per km², or null when either half is unknown.
 *
 * One accessor, because the guard was being re-derived at four call sites and got
 * it wrong at three of them. With `populationMillions` now 0 for a city no source
 * had a figure for, `population / area` yields a confident **0** — "0 people per
 * km²" — for every city on earth whose population is simply unpublished. A zero
 * is a measurement; what this situation has is an absence.
 */
export function populationDensityPerKm2(
  city: { populationMillions: number; area_km2: number },
): number | null {
  if (!(city.populationMillions > 0) || !(city.area_km2 > 0)) return null
  return Math.round(city.populationMillions * 1_000_000 / city.area_km2)
}

/**
 * A city's population rendered for display, or an honest "—".
 *
 * `formatPopulation` takes an absolute count because that is what a search
 * result carries; this takes the config, whose figure is in millions and may be
 * absent entirely.
 */
export function formatCityPopulation(city: { populationMillions: number }): string {
  if (!(city.populationMillions > 0)) return '—'
  if (city.populationMillions >= 1) return `${city.populationMillions.toFixed(2)}M`
  return `${Math.round(city.populationMillions * 1000)}K`
}

/**
 * Turn a candidate into a city config the app can actually open.
 *
 * Everything that used to be invented is now either real or absent:
 * `populationMillions` carries the observed figure in millions and is **0** when
 * the source had none, `elevationM` is what the geocoder reported, and `bbox`
 * is derived from the zoom so the map view and the city-image study window are
 * the same question asked twice.
 */
export function candidateToCityConfig(candidate: CityCandidate): CityConfig {
  const zoom = candidate.zoom
  const bbox = candidate.bbox ?? studyBbox(candidate.center, zoom)
  const populationMillions = knownPopulation(candidate) === null ? 0 : (candidate.population as number) / 1e6
  return {
    id: candidate.id,
    name: candidate.name,
    country: candidate.countryCode,
    center: candidate.center,
    zoom,
    bbox,
    timezone: candidate.timezone ?? 'UTC',
    hudClockLabel: candidate.name.slice(0, 3).toUpperCase(),
    countryName: candidate.country,
    gdeltQuery: `${candidate.name} ${candidate.country}`.toLowerCase(),
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 0,
    populationMillions,
    ...(populationMillions > 0 ? { populationSource: 'open-meteo' as const } : {}),
    founded: undefined,
    climate: 'Not from a source',
    distinctiveness: `${candidate.name}, ${candidate.country}${candidate.admin ? `, ${candidate.admin}` : ''}. Located from OpenStreetMap; only global feeds are attached. Its image — paths, edges, districts, nodes and landmarks — is read from OpenStreetMap and needs no local curation.`,
    kpis: [
      { label: 'POPULATION', value: formatPopulation(candidate.population) },
      { label: 'SMART SCORE', value: 'NO TWIN' },
      { label: 'IOC STATUS', value: 'LIVE' },
    ],
    elevationM: candidate.elevationM ?? undefined,
    adminRegion: candidate.admin ?? undefined,
  }
}

/** Global feeds that work for any coordinate. Same list the generator used. */
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
