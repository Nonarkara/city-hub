import type { CityConfig } from '../config/cities'
import { queryOverpass } from '../lib/osm/overpass'

export const CITY_ELEMENTS = [
  { id: 'paths', label: 'Paths', question: 'How do people move through the city?', proxy: 'Named main streets and pedestrian routes' },
  { id: 'edges', label: 'Edges', question: 'What divides or connects parts of the city?', proxy: 'Waterways, rail corridors and coastlines' },
  { id: 'districts', label: 'Districts', question: 'Which areas have a recognisable identity?', proxy: 'Named neighbourhood and suburb locations; not perceived boundaries' },
  { id: 'nodes', label: 'Nodes', question: 'Where do routes and activities converge?', proxy: 'Transit stations, public squares and markets' },
  { id: 'landmarks', label: 'Landmarks', question: 'What helps someone find their bearings?', proxy: 'Named historic features and visitor attractions' },
] as const
export type CityElement = typeof CITY_ELEMENTS[number]['id']
export interface CityImage {
  collection: GeoJSON.FeatureCollection
  fetchedAt: number
  sourceTime: string | null
  truncated: boolean
}

export function studyBounds(city: CityConfig): [number, number, number, number] {
  const [lng, lat] = city.center
  const dy = 2 / 111.32
  const dx = 2 / (111.32 * Math.max(0.1, Math.cos(lat * Math.PI / 180)))
  return [lng - dx, lat - dy, lng + dx, lat + dy]
}

/**
 * Upstream work budget, in seconds.
 *
 * This query is genuinely expensive — measured 2026-10-15 at 52s for a partial
 * result and 55s for the full 1200 elements. A 12s budget does not make it
 * faster; it makes the gateway abandon work that was about to succeed, which
 * is how it fails: HTTP 502 "server at capacity".
 *
 * Must stay below OVERPASS_TIMEOUT_MS (90s) in overpass.ts, or the client
 * aborts work the server is still finishing.
 */
export const CITY_IMAGE_QUERY_TIMEOUT_S = 60

export function cityImageQuery(city: CityConfig): string {
  const [w, s, e, n] = studyBounds(city)
  const box = `${s},${w},${n},${e}`
  return `[out:json][timeout:${CITY_IMAGE_QUERY_TIMEOUT_S}];(
    way[highway~"^(primary|secondary|tertiary|pedestrian)$"][name](${box});
    way[waterway~"^(river|canal)$"](${box});
    way[railway=rail](${box});
    way[natural=coastline](${box});
    node[place~"^(suburb|neighbourhood|quarter)$"][name](${box});
    nwr[railway=station][name](${box});
    nwr[public_transport=station][name](${box});
    nwr[amenity=marketplace][name](${box});
    nwr[place=square][name](${box});
    nwr[historic][name](${box});
    nwr[tourism~"^(attraction|museum|viewpoint)$"][name](${box});
  );out geom 1200;`
}

export function parseCityImage(payload: unknown, fetchedAt = Date.now()): CityImage {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid city image response')
  const data = payload as { elements?: unknown; remark?: unknown; osm3s?: { timestamp_osm_base?: unknown } }
  if (!Array.isArray(data.elements) || data.remark) throw new Error('Incomplete city image response')
  const features: GeoJSON.Feature[] = []
  for (const raw of data.elements) {
    if (!raw || typeof raw !== 'object') continue
    const el = raw as { type?: string; id?: number; lat?: number; lon?: number; geometry?: {lat: number; lon: number}[]; tags?: Record<string, string>; bounds?: {minlat: number; maxlat: number; minlon: number; maxlon: number} }
    if (!el.id || !el.tags) continue
    const t = el.tags
    const kinds: CityElement[] = []
    if (t.highway && /^(primary|secondary|tertiary|pedestrian)$/.test(t.highway) && t.name) kinds.push('paths')
    if (/^(river|canal)$/.test(t.waterway ?? '') || t.railway === 'rail' || t.natural === 'coastline') kinds.push('edges')
    if (/^(suburb|neighbourhood|quarter)$/.test(t.place ?? '') && t.name) kinds.push('districts')
    if (t.railway === 'station' || t.public_transport === 'station' || t.amenity === 'marketplace' || t.place === 'square') kinds.push('nodes')
    if ((t.historic || /^(attraction|museum|viewpoint)$/.test(t.tourism ?? '')) && t.name) kinds.push('landmarks')
    const coords = el.geometry?.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => [p.lon, p.lat])
    let geometry: GeoJSON.Geometry | null = null
    if (coords && coords.length >= 2) geometry = { type: 'LineString', coordinates: coords }
    else if (Number.isFinite(el.lon) && Number.isFinite(el.lat)) geometry = { type: 'Point', coordinates: [el.lon!, el.lat!] }
    // Relations without usable geometry are excluded rather than placed at an invented centroid.
    if (!geometry) continue
    for (const kind of kinds) features.push({
      type: 'Feature', geometry,
      properties: { kind, name: t['name:en'] ?? t.name ?? t.waterway ?? t.railway ?? 'Mapped feature', osmType: el.type, osmId: el.id },
    })
  }
  return { collection: { type: 'FeatureCollection', features }, fetchedAt,
    sourceTime: typeof data.osm3s?.timestamp_osm_base === 'string' ? data.osm3s.timestamp_osm_base : null,
    truncated: data.elements.length >= 1200 }
}

const cache = new Map<string, Promise<CityImage>>()
export function fetchCityImage(city: CityConfig): Promise<CityImage> {
  const key = city.center.join(',')
  const existing = cache.get(key)
  if (existing) return existing
  const pending = queryOverpass(cityImageQuery(city)).then((data) => parseCityImage(data)).catch((error) => {
    cache.delete(key)
    throw error
  })
  cache.set(key, pending)
  return pending
}
