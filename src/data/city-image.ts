import type { CityConfig } from '../config/cities'
import { queryOverpass } from '../lib/osm/overpass'
import { annotateEdgeStructure, type EdgeStructure } from '../lib/ioc/edge-structure'
import { annotatePathStructure, type PathStructure } from '../lib/ioc/path-structure'
import { annotateNodeImage, type NodeVerdict } from '../lib/ioc/node-image'

export interface CityImage {
  collection: GeoJSON.FeatureCollection
  fetchedAt: number
  sourceTime: string | null
  /**
   * The *display* set hit its cap, so paths/districts/nodes/landmarks counts
   * understate what exists.
   *
   * Scoped to the display set on purpose. `.edges` is a separate output with
   * its own budget — it was pulled out of `.display` precisely so it could not
   * compete — so counting edge elements against this cap reported "limited
   * sample" on every system while the display set was comfortably under it.
   * Measured on central Bangkok: 1063 display elements against a cap of 1200,
   * flagged truncated anyway because 1284 combined elements crossed 1200.
   */
  truncated: boolean
  /** The edge set hit its own cap. */
  edgeTruncated: boolean
  /**
   * The crossing-witness set hit its cap.
   *
   * This one matters more than it looks. Seam vs barrier is decided entirely by
   * how many road nodes touch an edge, so dropping witnesses does not merely
   * shrink a count — it biases every verdict toward "barrier". Overpass returns
   * witnesses in a stable, not spatially random order, so the bias is
   * systematic rather than noise.
   */
  crossingsTruncated: boolean
  /** Road nodes, unnamed included. Evidence for the seam/barrier reading. */
  crossings: [number, number][]
  /** Edge counts by measured structure. */
  edgeSummary: Record<EdgeStructure, number>
  /** Named path counts by measured connectivity. */
  pathSummary: Record<PathStructure, number>
  /**
   * The named network's dominant direction and how strongly it points that way.
   * When `grained` is false there is no larger system for a path to align to,
   * which is itself the finding, and alignment is withheld.
   */
  pathGrain: { bearingDeg: number; concentration: number; grained: boolean }
  /**
   * Junctions scored on functional importance against image strength.
   *
   * `shapeless` is the one to look at: a junction doing real work that nobody
   * could pick out of its surroundings.
   */
  nodeSummary: Record<NodeVerdict, number>
  nodeImaged: number
}

export const CITY_ELEMENTS = [
  { id: 'paths', label: 'Paths', question: 'How do people move through the city?', proxy: 'Named main streets and pedestrian routes' },
  { id: 'edges', label: 'Edges', question: 'What divides or connects parts of the city?', proxy: 'Waterways, rail corridors and coastlines' },
  { id: 'districts', label: 'Districts', question: 'Which areas have a recognisable identity?', proxy: 'Named neighbourhood and suburb locations; not perceived boundaries' },
  { id: 'nodes', label: 'Nodes', question: 'Where do routes and activities converge?', proxy: 'Transit stations, public squares and markets' },
  { id: 'landmarks', label: 'Landmarks', question: 'What helps someone find their bearings?', proxy: 'Named historic features and visitor attractions' },
] as const
export type CityElement = typeof CITY_ELEMENTS[number]['id']

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

/** Element cap for the drawn city image — reported as `truncated` when hit. */
export const CITY_IMAGE_MAX_ELEMENTS = 1200

/**
 * Separate cap for edge geometry.
 *
 * Edges are few (28 in a 1.7km² central Bangkok window) but their structure is
 * unreadable if they arrive fragmented, so they get a budget of their own rather
 * than competing with the road-dense display set for one cap.
 */
export const CITY_IMAGE_MAX_EDGES = 600

/**
 * Cap for crossing witnesses.
 *
 * This was 3000 and it was quietly wrong. Measured 2026-10-17 on central
 * Bangkok: the window contains **5077** road nodes touching an edge, and
 * `out body 3000` returned 2999 of them — 41% of the evidence, discarded with
 * no signal, from a set that decides every seam/barrier verdict.
 *
 * 8000 covers the measured window at 0.42MB and 25s, which is cheap next to the
 * 41s the full query already takes. The cap still exists for denser cities,
 * which is why `crossingsTruncated` is reported rather than assumed.
 */
export const CITY_IMAGE_MAX_CROSSINGS = 8000

export function cityImageQuery(city: CityConfig): string {
  const [w, s, e, n] = studyBounds(city)
  const box = `${s},${w},${n},${e}`
  // Three outputs, three budgets.
  //
  // Measured 2026-10-16: with edges sharing the display set's `out geom 1200`,
  // a road-dense window truncated them to fragments — the Chao Phraya came back
  // as a 10-metre stub, and crossings-per-km on a fragment is meaningless (it
  // reported 2203/km). An edge has to arrive *whole* or its structure cannot be
  // read at all, so it gets its own budget, and it is no longer in `.display`.
  //
  // Crossings are found by recursion, not by tagging. `highway` on a *node* is
  // street furniture — traffic_signals, crossing, street_lamp — measured in
  // central Bangkok as 581 tagged nodes of which **zero** matched any road
  // classification. Asking which roads meet an edge means asking which roads
  // contain its nodes: edges → their nodes → the ways through them → those
  // ways' nodes, matched to the edge geometry by the client.
  return `[out:json][timeout:${CITY_IMAGE_QUERY_TIMEOUT_S}];(
    way[highway~"^(primary|secondary|tertiary|pedestrian)$"][name](${box});
    node[place~"^(suburb|neighbourhood|quarter)$"][name](${box});
    nwr[railway=station][name](${box});
    nwr[public_transport=station][name](${box});
    nwr[amenity=marketplace][name](${box});
    nwr[place=square][name](${box});
    nwr[historic][name](${box});
    nwr[tourism~"^(attraction|museum|viewpoint)$"][name](${box});
  )->.display;
  (
    way[waterway~"^(river|canal)$"](${box});
    way[railway=rail](${box});
    way[natural=coastline](${box});
  )->.edges;
  node(w.edges)->.en;
  way(bn.en)->.cw;
  node(w.cw)->.cross;
  .display out geom ${CITY_IMAGE_MAX_ELEMENTS};
  .edges out geom ${CITY_IMAGE_MAX_EDGES};
  .cross out body ${CITY_IMAGE_MAX_CROSSINGS};`
}

/**
 * `cityName` is used only to reject the city's own name as un-nameable content
 * at a junction — "Bangkok" near a junction tells you where you already are.
 * Optional so that parsing stays usable without a city in hand.
 */
export function parseCityImage(payload: unknown, fetchedAt = Date.now(), cityName = ''): CityImage {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid city image response')
  const data = payload as { elements?: unknown; remark?: unknown; osm3s?: { timestamp_osm_base?: unknown } }
  if (!Array.isArray(data.elements) || data.remark) throw new Error('Incomplete city image response')
  const features: GeoJSON.Feature[] = []
  const crossings: [number, number][] = []
  // Counted per budget, because each output has its own cap. One combined
  // counter cannot tell you which cap was hit, and comparing the wrong total to
  // the wrong cap is how every system ended up labelled a limited sample while
  // the display set sat at 1063 of 1200.
  let displayDrawn = 0
  let edgeDrawn = 0
  for (const raw of data.elements) {
    if (!raw || typeof raw !== 'object') continue
    const el = raw as { type?: string; id?: number; lat?: number; lon?: number; geometry?: {lat: number; lon: number}[]; tags?: Record<string, string> }
    if (!el.id) continue
    const t = el.tags ?? {}
    const kinds: CityElement[] = []
    if (t.highway && /^(primary|secondary|tertiary|pedestrian)$/.test(t.highway) && t.name) kinds.push('paths')
    if (/^(river|canal)$/.test(t.waterway ?? '') || t.railway === 'rail' || t.natural === 'coastline') kinds.push('edges')
    if (/^(suburb|neighbourhood|quarter)$/.test(t.place ?? '') && t.name) kinds.push('districts')
    if (t.railway === 'station' || t.public_transport === 'station' || t.amenity === 'marketplace' || t.place === 'square') kinds.push('nodes')
    if ((t.historic || /^(attraction|museum|viewpoint)$/.test(t.tourism ?? '')) && t.name) kinds.push('landmarks')

    // A node that matches none of the five Lynch element predicates is a
    // crossing witness: the query emits them from `node(w.cw)`, the nodes of
    // roads that meet an edge. No drawn element can land here, because every
    // drawn node carries exactly one of the predicates above.
    if (el.type === 'node' && kinds.length === 0) {
      if (Number.isFinite(el.lon) && Number.isFinite(el.lat)) crossings.push([el.lon!, el.lat!])
      continue
    }
    if (!el.tags) continue

    const coords = el.geometry?.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p) => [p.lon, p.lat])
    let geometry: GeoJSON.Geometry | null = null
    if (coords && coords.length >= 2) geometry = { type: 'LineString', coordinates: coords }
    else if (Number.isFinite(el.lon) && Number.isFinite(el.lat)) geometry = { type: 'Point', coordinates: [el.lon!, el.lat!] }
    // Relations without usable geometry are excluded rather than placed at an invented centroid.
    if (!geometry) continue
    // An element can only be in one of the two budgets: `.display` and `.edges`
    // are disjoint query sets, so the `edges` predicate identifies its output.
    if (kinds.includes('edges')) edgeDrawn += 1
    else displayDrawn += 1
    for (const kind of kinds) features.push({
      type: 'Feature', geometry,
      properties: { kind, name: t['name:en'] ?? t.name ?? t.waterway ?? t.railway ?? 'Mapped feature', osmType: el.type, osmId: el.id },
    })
  }
  const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features }
  // Annotate after the whole set is built: an edge's structure is measured
  // against every crossing in the window, not against those seen so far.
  const structure = annotateEdgeStructure(collection, crossings)
  // Paths are measured against each other rather than against road-node
  // witnesses, so this runs on the drawn collection and reports junction
  // places — the evidence for the detachment reading, drawn not asserted.
  const paths = annotatePathStructure(collection)
  // Crossing points live in the same source so one setData keeps the drawing and
  // its evidence in step. They carry `kind: 'crossings'`, which is never one of
  // the five Lynch elements, so element counts are unaffected.
  collection.features.push(...structure.crossingFeatures, ...paths.junctionFeatures)
  // Runs last: it scores the junctions the path pass just drew, against every
  // nameable element in the window.
  const nodes = annotateNodeImage(collection, cityName)
  return { collection, fetchedAt,
    crossings, edgeSummary: structure.summary,
    pathSummary: paths.summary,
    pathGrain: { ...paths.grain, grained: paths.grained },
    nodeSummary: nodes.summary,
    nodeImaged: nodes.imagedCount,
    sourceTime: typeof data.osm3s?.timestamp_osm_base === 'string' ? data.osm3s.timestamp_osm_base : null,
    truncated: displayDrawn >= CITY_IMAGE_MAX_ELEMENTS,
    edgeTruncated: edgeDrawn >= CITY_IMAGE_MAX_EDGES,
    crossingsTruncated: crossings.length >= CITY_IMAGE_MAX_CROSSINGS }
}

const cache = new Map<string, Promise<CityImage>>()
export function fetchCityImage(city: CityConfig): Promise<CityImage> {
  const key = city.center.join(',')
  const existing = cache.get(key)
  if (existing) return existing
  const pending = queryOverpass(cityImageQuery(city)).then((data) => parseCityImage(data, Date.now(), city.name)).catch((error) => {
    cache.delete(key)
    throw error
  })
  cache.set(key, pending)
  return pending
}
