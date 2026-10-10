/**
 * OpenStreetMap POIs — Critical infrastructure for Bangkok.
 * Hospitals, fire stations, police stations, schools, pharmacies, markets.
 *
 * Uses Overpass API for live queries (cached 24h).
 * Bangkok bbox: lat 13.50-13.95, lon 100.35-100.95
 *
 * No API key required. Free and open data.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { queryOverpass } from '../lib/osm/overpass'

const TTL = 24 * 60 * 60 * 1000 // 24 hours — OSM data changes slowly

// Bangkok bounding box
const BBOX = {
  s: 13.50,
  n: 13.95,
  w: 100.35,
  e: 100.95,
}

export interface OsmPoi {
  id: number
  lat: number
  lng: number
  amenity: string
  name: string
  nameTH?: string
  tags: Record<string, string>
}

const AMENITY_CONFIG: Record<string, { label: string; color: string; icon: string; minZoom: number }> = {
  hospital:      { label: 'HOSPITAL',      color: '#e53935', icon: 'H', minZoom: 10 },
  clinic:        { label: 'CLINIC',        color: '#ff7043', icon: 'C', minZoom: 12 },
  doctors:       { label: 'DOCTOR',        color: '#ff7043', icon: 'D', minZoom: 13 },
  'fire_station':{ label: 'FIRE STATION',  color: '#ff5722', icon: 'F', minZoom: 11 },
  police:        { label: 'POLICE',        color: '#3f51b5', icon: 'P', minZoom: 11 },
  school:        { label: 'SCHOOL',        color: '#4caf50', icon: 'S', minZoom: 12 },
  university:    { label: 'UNIVERSITY',    color: '#4caf50', icon: 'U', minZoom: 11 },
  kindergarten:  { label: 'KINDERGARTEN',  color: '#4caf50', icon: 'K', minZoom: 13 },
  pharmacy:      { label: 'PHARMACY',      color: '#00bcd4', icon: 'Rx', minZoom: 13 },
  marketplace:   { label: 'MARKET',        color: '#ff9800', icon: 'M', minZoom: 12 },
  fuel:          { label: 'GAS STATION',   color: '#795548', icon: 'G', minZoom: 12 },
  bank:          { label: 'BANK',          color: '#9c27b0', icon: 'B', minZoom: 13 },
  atm:           { label: 'ATM',           color: '#9c27b0', icon: 'A', minZoom: 14 },
  embassy:       { label: 'EMBASSY',       color: '#607d8b', icon: 'E', minZoom: 12 },
}

export const OSM_AMENITIES = Object.keys(AMENITY_CONFIG)

export const OSM_DEGRADED_MESSAGE =
  'OpenStreetMap places are temporarily unavailable. The rest of the map still works.'

interface OverpassElement {
  type?: string
  id?: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
}

let osmDegraded = false
let osmNoticeTaken = false

export function takeOsmDegradedNotice(): string | null {
  if (!osmDegraded || osmNoticeTaken) return null
  osmNoticeTaken = true
  return OSM_DEGRADED_MESSAGE
}

export function resetOsmDegradedForTests() {
  osmDegraded = false
  osmNoticeTaken = false
}

function overpassQuery(amenities: string[]): string {
  return `[out:json][timeout:25];
(
  node["amenity"~"^(${amenities.join('|')})$"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
);
out body;`
}

export function osmElementsToFeatures(elements: OverpassElement[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const el of elements) {
    if (el.type !== 'node' || el.lon == null || el.lat == null) continue
    const tags = el.tags ?? {}
    const amenity = tags.amenity ?? ''
    if (!AMENITY_CONFIG[amenity]) continue

    const name = tags.name ?? tags['name:en'] ?? tags['name:th'] ?? AMENITY_CONFIG[amenity].label
    const nameTH = tags['name:th'] ?? ''

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [el.lon, el.lat],
      },
      properties: {
        id: el.id,
        amenity,
        name,
        nameTH,
        color: AMENITY_CONFIG[amenity].color,
        icon: AMENITY_CONFIG[amenity].icon,
        label: AMENITY_CONFIG[amenity].label,
        minZoom: AMENITY_CONFIG[amenity].minZoom,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

async function fetchOverpass(query: string): Promise<GeoJSON.FeatureCollection> {
  const data = await queryOverpass(query) as { elements?: OverpassElement[] }
  return osmElementsToFeatures(data?.elements ?? [])
}

async function loadOsm(cacheKey: string, amenities: string[]): Promise<GeoJSON.FeatureCollection> {
  try {
    return await cachedFetch(cacheKey, () => fetchOverpass(overpassQuery(amenities)), TTL)
  } catch (err) {
    console.warn('[osm] place query failed', err)
    osmDegraded = true
    return { type: 'FeatureCollection', features: [] }
  }
}

/** Fetch all critical infrastructure POIs. Empty collection when Overpass is down. */
export async function fetchOsmPois(): Promise<GeoJSON.FeatureCollection> {
  return loadOsm('osm/pois-bangkok', OSM_AMENITIES)
}

/** Fetch only emergency services (hospitals, fire, police). */
export async function fetchOsmEmergency(): Promise<GeoJSON.FeatureCollection> {
  return loadOsm('osm/emergency-bangkok', ['hospital', 'clinic', 'fire_station', 'police'])
}

/** Fetch only education (schools, universities, kindergartens). */
export async function fetchOsmEducation(): Promise<GeoJSON.FeatureCollection> {
  return loadOsm('osm/education-bangkok', ['school', 'university', 'kindergarten'])
}

/** Get counts by amenity type for analytics */
export async function fetchOsmPoiStats(): Promise<Record<string, number>> {
  const data = await fetchOsmPois()
  const counts: Record<string, number> = {}
  for (const f of data.features) {
    const amenity = String((f.properties as Record<string, unknown>)?.amenity ?? 'unknown')
    counts[amenity] = (counts[amenity] ?? 0) + 1
  }
  return counts
}
