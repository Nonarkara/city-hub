/**
 * IoC 2.0 — edge structure: is this edge a barrier or a seam?
 *
 * Lynch, *The Image of the City* (1960), p.63–64. The sharpest idea in the
 * book, and the most implementable:
 *
 *   "The Central Artery seems to divide absolutely, to isolate…"
 *   "Beacon Street acts not as a barrier but as a seam along which the two
 *    major areas are clearly joined together."
 *
 * Same line on the map. Opposite planning conclusion. Today the app draws
 * every edge identically, so the distinction is invisible — which means the
 * one structural property Lynch singles out as most consequential is the one
 * the tool refuses to compute.
 *
 * ## How this is measured
 *
 * A seam is an edge the city *uses*: things meet it. A barrier is an edge the
 * city *works around*: nothing meets it. So we count how many roads touch each
 * edge, and divide by its length. Dense → seam. Sparse → barrier.
 *
 * "Roads touch it" is taken from OSM highway *nodes*, not from named ways.
 * That distinction is the whole point: counting named ways would report every
 * Bangkok canal as a barrier, because the alleys and service roads that cross
 * them are mostly unnamed. Naming bias would have inverted the finding on
 * exactly the city this tool cares most about.
 *
 * ## What this does not do
 *
 * Lynch described the phenomenon qualitatively and **gave no thresholds**.
 * The bands below are ours. They are a design decision, stated openly, and they
 * should be calibrated against the case Lynch used — Boston's Central Artery
 * (a barrier) against the Charles River (a seam) — before anyone quotes a
 * verdict as if Lynch had endorsed it. Until that calibration is done, treat
 * these as ordered categories for comparing edges within one city, not as
 * absolute scores.
 */

export type EdgeStructure = 'seam' | 'partial' | 'barrier'

export interface EdgeStructureReading {
  /** Roads touching this edge. */
  crossings: number
  /** Edge length in kilometres, from its geometry. */
  lengthKm: number
  /** Roads per kilometre. */
  densityPerKm: number
  structure: EdgeStructure
}

/**
 * The remaining weakness, stated plainly.
 *
 * An *unnamed* edge that is also short still divides a handful of crossings by a
 * short length: one 50-metre fragment measured 36.6 crossings/km and called
 * itself a seam. Grouping by name cannot fix an edge with no name to group by.
 * Treat verdicts on unnamed sub-200-metre edges as indicative, and compare edges
 * within a city rather than across cities.
 *
 * ## How crossings are found at all, because the obvious version is wrong
 *
 * `highway` on an OSM *node* is street furniture — traffic_signals, crossing,
 * street_lamp. Central Bangkok has 581 such tagged nodes and **zero** matching any
 * road classification; building crossings from them would have measured lamp
 * posts and called every canal a barrier. The query instead recurses: edges →
 * their nodes → the ways through them → those ways' nodes.
 *
 * ## Three artefacts had to go before crossings-per-km meant anything
 *
 * 1. Edges shared the road-dense display set's `out geom 1200`, so the Chao
 *    Phraya came back as a 10-metre stub and reported 2203 crossings/km.
 * 2. OSM splits one waterway into many ways. Khlong Khu Mueang Derm arrived as
 *    twelve fragments; measured individually each inherited every crossing near
 *    it and divided by its own length.
 * 3. Fixing both, the same central Bangkok window reads 6 seams and 1 barrier
 *    over 7 edge groups (from 28 ways), 0.8–15.5 crossings/km.
 */

/**
 * Crossing witnesses are matched within this distance of the edge centreline.
 *
 * OSM ways meet at shared nodes, so a road that genuinely crosses a canal has
 * a node lying *on* that canal's geometry and the true distance is ~0. The
 * tolerance absorbs digitisation noise and small bridges that do not quite
 * share a node. 30m is roughly one street width: wide enough to forgive
 * sloppy geometry, tight enough that a road in the next block over does not
 * count as a crossing.
 */
export const CROSSING_TOLERANCE_M = 30

/** Roads per km at or above which an edge is treated as a seam. */
export const SEAM_THRESHOLD_PER_KM = 8

/** Below this, an edge is treated as a barrier. */
export const BARRIER_THRESHOLD_PER_KM = 2

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LON_AT_EQ = 111_320

type LngLat = [number, number]

/**
 * Local planar frame in metres, equirectangular about the edge's first point.
 *
 * Over a 4km study window the distortion of a local tangent plane is far below
 * the 30m matching tolerance, and it keeps the segment maths honest instead of
 * mixing degrees with metres.
 */
function toMetres(origin: LngLat): (p: LngLat) => [number, number] {
  const [lon0, lat0] = origin
  const kx = M_PER_DEG_LON_AT_EQ * Math.cos((lat0 * Math.PI) / 180)
  return ([lon, lat]: LngLat) => [(lon - lon0) * kx, (lat - lat0) * M_PER_DEG_LAT]
}

/** Shortest distance in metres from `p` to the segment `a`–`b`. */
export function pointToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  // `a` is the origin of the local frame, so it maps to (0,0) and the vector
  // a→b is just b's own coordinates. Getting this wrong (subtracting p instead
  // of a) silently returns plausible-looking wrong distances.
  const toM = toMetres(a)
  const [px, py] = toM(p)
  const [vx, vy] = toM(b)
  const lenSq = vx * vx + vy * vy
  if (lenSq === 0) return Math.hypot(px, py)
  // Projection parameter of p onto a–b, clamped to the segment.
  const t = Math.max(0, Math.min(1, (px * vx + py * vy) / lenSq))
  return Math.hypot(px - t * vx, py - t * vy)
}

/** Shortest distance in metres from `p` to a polyline. */
export function pointToPolylineM(p: LngLat, line: LngLat[]): number {
  let best = Infinity
  for (let i = 0; i < line.length - 1; i += 1) {
    const d = pointToSegmentM(p, line[i], line[i + 1])
    if (d < best) best = d
    if (best === 0) break
  }
  return best
}

/**
 * An edge as the several polylines that make it up.
 *
 * OSM splits one waterway into many short ways — measured 2026-10-16, Khlong
 * Khu Mueang Derm arrived as six fragments between 10m and 160m. Measuring each
 * fragment separately divides a river's crossings across its pieces and then
 * divides by a 10-metre length, which reported 2203 crossings/km for a
 * fragment of the Chao Phraya. A city edge is one thing made of several ways,
 * so it is measured as one thing.
 */
export type EdgeGeometry = LngLat[][]

/** Shortest distance in metres from `p` to any part of the edge. */
export function pointToEdgeM(p: LngLat, lines: EdgeGeometry): number {
  let best = Infinity
  for (const line of lines) {
    const d = pointToPolylineM(p, line)
    if (d < best) best = d
    if (best === 0) break
  }
  return best
}

/** Length of an edge in kilometres — the sum of its parts, not a path through them. */
export function edgeLengthKm(lines: EdgeGeometry): number {
  return lines.reduce((total, line) => total + polylineLengthKm(line), 0)
}

/** Length of a polyline in kilometres. */
export function polylineLengthKm(line: LngLat[]): number {
  if (line.length < 2) return 0
  const toM = toMetres(line[0])
  let metres = 0
  let prev = toM(line[0])
  for (let i = 1; i < line.length; i += 1) {
    const cur = toM(line[i])
    metres += Math.hypot(cur[0] - prev[0], cur[1] - prev[1])
    prev = cur
  }
  return metres / 1000
}

/**
 * Count the roads that touch this edge.
 *
 * A crossing witness is counted once per edge, so a dense junction cannot
 * inflate the count by contributing many nodes at one place.
 */
export function countCrossings(lines: EdgeGeometry, crossings: LngLat[], toleranceM = CROSSING_TOLERANCE_M): number {
  if (lines.length === 0) return 0
  let count = 0
  for (const p of crossings) {
    if (pointToEdgeM(p, lines) <= toleranceM) count += 1
  }
  return count
}

/** Classify one edge from its measured crossing density. */
export function classifyEdge(crossings: number, lengthKm: number): EdgeStructureReading {
  const densityPerKm = lengthKm > 0 ? crossings / lengthKm : 0
  const structure: EdgeStructure =
    densityPerKm >= SEAM_THRESHOLD_PER_KM ? 'seam'
      : densityPerKm >= BARRIER_THRESHOLD_PER_KM ? 'partial'
        : 'barrier'
  return { crossings, lengthKm: round2(lengthKm), densityPerKm: round2(densityPerKm), structure }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Tag every edge feature with its measured structure.
 *
 * Mutates in place and returns the same collection, because the map renders the
 * collection it is given and a second parallel array would have to be kept in
 * sync by hand.
 *
 * Also returns `crossingFeatures`: one point per road-meets-edge contact,
 * tagged with that edge's structure. Drawing them makes a seam legible as
 * *stitching* — you can count the joins — rather than as a line someone
 * coloured differently. Without them the seam/barrier distinction is a label;
 * with them it is a picture of the evidence.
 */
export function annotateEdgeStructure(
  collection: GeoJSON.FeatureCollection,
  crossings: LngLat[],
): {
  readings: Map<string, EdgeStructureReading>
  summary: Record<EdgeStructure, number>
  crossingFeatures: GeoJSON.Feature[]
} {
  const readings = new Map<string, EdgeStructureReading>()
  const summary: Record<EdgeStructure, number> = { seam: 0, partial: 0, barrier: 0 }
  const crossingFeatures: GeoJSON.Feature[] = []

  // One city edge may arrive as many OSM ways. Group first, measure second —
  // otherwise each fragment inherits every crossing near it and divides by its
  // own tiny length.
  const groups = new Map<string, { geometry: EdgeGeometry; ids: string[] }>()
  for (const feature of collection.features) {
    if (feature.properties?.kind !== 'edges') continue
    if (feature.geometry?.type !== 'LineString') continue
    const name = String(feature.properties.name ?? '')
    const osmId = String(feature.properties.osmId)
    // Named waterway → one edge. Unnamed ways stay distinct: two railways with
    // no name are two railways, and merging them would invent a single river.
    const key = name && name !== 'Mapped feature' ? `name:${name}` : `id:${osmId}`
    const existing = groups.get(key)
    if (existing) {
      existing.geometry.push(feature.geometry.coordinates as LngLat[])
      existing.ids.push(osmId)
    } else {
      groups.set(key, { geometry: [feature.geometry.coordinates as LngLat[]], ids: [osmId] })
    }
  }

  for (const [, group] of groups) {
    const contacts = crossings.filter((p) => pointToEdgeM(p, group.geometry) <= CROSSING_TOLERANCE_M)
    const reading = classifyEdge(contacts.length, edgeLengthKm(group.geometry))
    for (const id of group.ids) {
      const target = collection.features.find((f) => String(f.properties?.osmId) === id)
      if (target) target.properties = { ...target.properties, structure: reading.structure }
      readings.set(id, reading)
    }
    summary[reading.structure] += 1

    for (const p of contacts) {
      crossingFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: p },
        properties: { kind: 'crossings', structure: reading.structure, osmType: 'node' },
      })
    }
  }
  return { readings, summary, crossingFeatures }
}