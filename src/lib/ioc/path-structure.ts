/**
 * IoC 2.0 — path structure: is this path connected to the city, or detached from it?
 *
 * Lynch, *The Image of the City* (1960), p.54–61. Paths are the first element
 * he works through, and he runs through their measurable attributes: a path may
 * be **identifiable** (continuous), **directional** (a gradient makes one end
 * unlike the other), **scaled** (position along the line is felt), **aligned**
 * (its direction is referable to a larger system), and **connected** into a
 * structure.
 *
 * Then the finding that should govern a planning tool:
 *
 * > paths that are physically prominent but *cut off* from the city do not enter
 * > the image at all.
 *
 * The Central Artery in Boston — "more detached from its surroundings… Many
 * subjects had great difficulty aligning the Artery to surrounding elements."
 * The Los Angeles freeways — "were not felt to be 'in' the rest of the city, and
 * coming off an exit ramp was typically a moment of severe disorientation."
 *
 * That is an operational statement, not a metaphor: **high capacity, low image
 * value.** It is exactly the failure mode of the infrastructure city this tool
 * models, and until now the app had no notion of it — every named street drew
 * identically.
 *
 * ## How this is measured
 *
 * Two numbers per path, from geometry already in hand:
 *
 * - **Junction density.** Places where another *named* path meets this one, per
 *   kilometre. This is Lynch's "connected", and it is the half of detachment we
 *   can count honestly.
 * - **Alignment.** How far the path's direction of travel sits off the network's
 *   dominant grain. This is Lynch's "aligned" — a path is alignable when its
 *   direction is referable to a larger system.
 *
 * And one he pins down precisely: junctions of more than four points "almost
 * always gave trouble", and a taxi dispatcher named the five-pointed Church
 * Green crossing as one of two things that troubled him in a city he knew
 * exceptionally well. So `worstDegree` is measured and reported.
 *
 * ## Grouping comes first, and it is not optional
 *
 * OSM splits one named street into many ways. Measured on central Bangkok:
 * **701 path ways collapse to 116 named paths**, and *Arun Ammarin Road alone
 * arrives as 42 separate ways*. Measuring a fragment individually divides its
 * junctions across its pieces and then divides by its own tiny length — the same
 * failure that reported 2203 crossings/km for a 10-metre stub of the Chao
 * Phraya before edges got their own budget. A city path is one thing made of
 * several ways, so it is measured as one thing.
 *
 * ## Two weaknesses, stated rather than hidden
 *
 * 1. **Named paths only.** Junctions are counted between *named* streets, so an
 *    alley or a soi that meets a main street is invisible here. This biases the
 *    count **downward** — it is the same naming trap that would have called every
 *    Bangkok canal a barrier if edges were measured on named roads. Compare paths
 *    within a city; never across.
 * 2. **Thresholds are ours.** Lynch described detachment qualitatively and gave
 *    no numbers. The bands below are a design decision, stated openly. Calibrate
 *    against Boston's Central Artery before quoting a verdict as though Lynch
 *    had endorsed it.
 */

import { polylineLengthKm } from './edge-structure'

export type PathStructure = 'linked' | 'sparse' | 'detached'

export interface PathStructureReading {
  /** Distinct places where another named path meets this one. */
  junctions: number
  /** Junction places per kilometre. */
  junctionDensityPerKm: number
  /**
   * How many path branches meet at the busiest single point on this path.
   * Lynch's rule of thumb is that more than four gives trouble.
   */
  worstDegree: number
  /** Length across all fragments, in kilometres. */
  lengthKm: number
  structure: PathStructure
  /**
   * Degrees off the network's dominant grain, 0–90. Null when the path has no
   * usable direction of travel (a loop, or something that doubles back so far
   * that start and end say nothing about which way it runs).
   */
  alignmentDeg: number | null
}

/** Junction places per km at or above which a path is treated as linked into the city. */
export const LINKED_THRESHOLD_PER_KM = 6

/** Below this, a path is sparse. */
export const SPARSE_THRESHOLD_PER_KM = 2

/**
 * Minimum length for the `detached` verdict.
 *
 * Detachment is a claim about a *prominent* path that the city does not join.
 * A 200-metre lane with two junctions is unremarkable; calling it detached would
 * be technically true and practically useless. Short sparse paths stay `sparse`.
 */
export const DETACHED_MIN_KM = 0.5

/**
 * Contacts within this distance are one junction, not several.
 *
 * OSM splits ways at attribute changes and at bridge decks, so one real
 * intersection can arrive as three or four coincident segment crossings. 20m is
 * roughly half a street width — enough to absorb that splitting, tight enough to
 * keep two genuinely separate crossings apart.
 */
export const JUNCTION_MERGE_M = 20

/**
 * Below this straightness ratio a path has no direction of travel worth aligning.
 *
 * `displacement / length`. A straight street scores 1. A right-angle L is about
 * 0.7 and still reads as having an orientation. A loop or a doubling-back street
 * scores near 0 and is honestly directionless.
 */
export const MIN_STRAIGHTNESS = 0.3

/**
 * Below this concentration the network has no grain, and alignment is not
 * reported at all.
 *
 * Central Bangkok measures 0.064 — the named street network genuinely points in
 * every direction at once, which is what a radial city on a river delta looks
 * like. Quoting "87.9° off the network grain" against a resultant vector that
 * is mostly noise is false precision, and it would produce a confident-looking
 * alignment column for every path in the window. So the measurement is withheld
 * and the finding is reported instead: this is Los Angeles' finding arrived at
 * from the other side — a street you cannot align to anything because there is
 * no larger system to align it to.
 */
export const MIN_GRAIN_CONCENTRATION = 0.15

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LON_AT_EQ = 111_320

type LngLat = [number, number]
type Metres = [number, number]

/** A city path as the several polylines that make it up. */
export type PathGeometry = LngLat[][]

/** Local planar frame in metres, equirectangular about a fixed origin. */
function toMetres(origin: LngLat): (p: LngLat) => Metres {
  const [lon0, lat0] = origin
  const kx = M_PER_DEG_LON_AT_EQ * Math.cos((lat0 * Math.PI) / 180)
  return ([lon, lat]: LngLat) => [(lon - lon0) * kx, (lat - lat0) * M_PER_DEG_LAT]
}

function metresBetween(a: Metres, b: Metres): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/**
 * Proper intersection of two segments, in metres.
 *
 * Returns the crossing point, or null. Collinear overlap returns null on
 * purpose: two paths that share a stretch are not intersecting *at* a junction,
 * and counting the shared run would manufacture junctions along every shared
 * frontage.
 *
 * Endpoints count. This is the single most important line in the file, because
 * getting it wrong looks like data scarcity rather than a bug: **OSM streets
 * cross by sharing a node**, so a real intersection sits at `t = 1` for one way
 * and `t = 0` for the other. An open-interval test therefore rejected almost
 * every genuine crossing in the window — it reported 29 junctions across 116
 * named paths in central Bangkok, and 85 of those paths as touching nothing at
 * all. Same-path adjacency is handled where it actually belongs, by the name
 * check in `findJunctions`, not by falsifying the geometry here.
 */
export function segmentIntersectionM(a1: Metres, a2: Metres, b1: Metres, b2: Metres): Metres | null {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1]
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1]
  const denom = d1x * d2y - d1y * d2x
  // Parallel or degenerate. Collinear overlap falls out here too, which is what
  // we want.
  if (Math.abs(denom) < 1e-9) return null
  const ox = b1[0] - a1[0], oy = b1[1] - a1[1]
  const t = (ox * d2y - oy * d2x) / denom
  const u = (ox * d1y - oy * d1x) / denom
  // Outside either segment. The ends are deliberately included — see above.
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return [a1[0] + t * d1x, a1[1] + t * d1y]
}

export interface BoundingBox { minX: number; minY: number; maxX: number; maxY: number }

export function bboxOf(lines: PathGeometry, toM: (p: LngLat) => Metres): BoundingBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const line of lines) {
    for (const point of line) {
      const [x, y] = toM(point)
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return { minX, minY, maxX, maxY }
}

function boxesOverlap(a: BoundingBox, b: BoundingBox, pad: number): boolean {
  return a.minX - pad <= b.maxX && b.minX - pad <= a.maxX && a.minY - pad <= b.maxY && b.minY - pad <= a.maxY
}

/** One named path, grouped from its OSM ways. */
export interface PathGroup {
  name: string
  geometry: PathGeometry
  osmIds: string[]
}

/**
 * Group path features by name.
 *
 * Group first, measure second — the fragmentation numbers are in the header of
 * this file and they are not small. Unnamed ways are not drawn at all: the query
 * requires `[name]`, so every path here is a place someone has named, and there
 * is no key to group an unnamed one by.
 */
export function groupPaths(collection: GeoJSON.FeatureCollection): PathGroup[] {
  const groups = new Map<string, PathGroup>()
  for (const feature of collection.features) {
    if (feature.properties?.kind !== 'paths') continue
    if (feature.geometry?.type !== 'LineString') continue
    const name = String(feature.properties.name ?? '')
    const osmId = String(feature.properties.osmId)
    if (!name || name === 'Mapped feature' || !osmId) continue
    const existing = groups.get(name)
    if (existing) {
      existing.geometry.push(feature.geometry.coordinates as LngLat[])
      existing.osmIds.push(osmId)
    } else {
      groups.set(name, { name, geometry: [feature.geometry.coordinates as LngLat[]], osmIds: [osmId] })
    }
  }
  return [...groups.values()]
}

/**
 * The network's dominant grain: the length-weighted mean direction of every
 * named path in the window.
 *
 * `concentration` is the mean resultant length (0–1): how much of the network's
 * length actually points the same way. A radial city like Bangkok has a genuinely
 * low value, and that is a finding rather than a defect — a street in a city with
 * no dominant grain has nothing to align to, which is the same legibility
 * problem Lynch found in Los Angeles, arrived at from the other direction.
 */
export function networkGrain(groups: PathGroup[], toM: (p: LngLat) => Metres): { bearingDeg: number; concentration: number } {
  let sumSin = 0, sumCos = 0, totalWeight = 0
  for (const group of groups) {
    for (const line of group.geometry) {
      for (let i = 1; i < line.length; i += 1) {
        const a = toM(line[i - 1]), b = toM(line[i])
        const dx = b[0] - a[0], dy = b[1] - a[1]
        const len = Math.hypot(dx, dy)
        if (len < 1) continue
        // Bearing clockwise from north, so 0° is up and the fold at 90° in
        // `alignmentDeg` means "or its reverse", which is the same alignment.
        const theta = Math.atan2(dx, dy)
        sumSin += len * Math.sin(theta)
        sumCos += len * Math.cos(theta)
        totalWeight += len
      }
    }
  }
  if (totalWeight === 0) return { bearingDeg: 0, concentration: 0 }
  return {
    bearingDeg: normaliseDeg((Math.atan2(sumSin, sumCos) * 180) / Math.PI),
    concentration: Math.hypot(sumSin, sumCos) / totalWeight,
  }
}

/** Fold an angle into 0–360. */
export function normaliseDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * Angular distance between two bearings, folded to 0–90.
 *
 * The fold is not a convenience. A street running north and a street running
 * south are the *same* alignment as far as the image is concerned; only a
 * difference beyond 90° means the network runs across them.
 */
export function bearingDeltaDeg(a: number, b: number): number {
  let d = Math.abs(normaliseDeg(a) - normaliseDeg(b)) % 180
  if (d > 90) d = 180 - d
  return d
}

/**
 * Direction of travel for one path, or null when it has none.
 *
 * End-to-end, not a sum of segment vectors: a street that turns a corner has
 * segments pointing both ways that cancel to nearly nothing, which would make
 * every L-shaped street in the city directionless. What a traveller has is a
 * start and an end.
 *
 * **Which** start and end is the trap. OSM returns ways in id order, not
 * geographic order, so "the first vertex of the first way" and "the last vertex
 * of the last way" are two arbitrary points on the street — for *Arun Ammarin
 * Road*, which arrives as 42 separate ways, they are 300m apart on a 7.6km
 * street, and the straightness test then failed for 50 of 116 paths. The two
 * most widely separated fragment endpoints are used instead, which is the
 * street's actual long axis.
 *
 * The straightness test then catches the genuine failure: a loop or a
 * doubling-back street, where no pair of endpoints says which way it runs.
 */
export function pathBearingDeg(lines: PathGeometry, toM: (p: LngLat) => Metres): number | null {
  const endpoints: Metres[] = []
  let lengthM = 0
  for (const line of lines) {
    if (line.length < 2) continue
    const first = toM(line[0])
    const last = toM(line[line.length - 1])
    endpoints.push(first, last)
    let cursor = first
    for (let i = 1; i < line.length; i += 1) {
      const cur = toM(line[i])
      lengthM += metresBetween(cursor, cur)
      cursor = cur
    }
  }
  if (endpoints.length < 2 || lengthM < 1) return null

  let best = 0, from: Metres | null = null, to: Metres | null = null
  for (const a of endpoints) {
    for (const b of endpoints) {
      const d = metresBetween(a, b)
      if (d > best) { best = d; from = a; to = b }
    }
  }
  if (!from || !to || best / lengthM < MIN_STRAIGHTNESS) return null
  return normaliseDeg((Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI)
}

/** Length of a path in kilometres — the sum of its parts, not a route through them. */
export function pathLengthKm(lines: PathGeometry): number {
  return lines.reduce((total, line) => total + polylineLengthKm(line), 0)
}

export interface Junction {
  /** Junction location, in the window's local metre frame. */
  at: Metres
  /** Which named paths meet here, including the one being measured. */
  paths: string[]
}

/**
 * Every junction in the window, found once and reused by every path.
 *
 * Computing them per-path would be quadratic in the worst case and, worse,
 * would compute the same answer several times in several slightly different
 * ways. One pass, one truth.
 *
 * Excluded, deliberately:
 * - pairs from the same named path — its own fragments meet at their shared
 *   ends, and that is one street, not a junction;
 * - segment endpoints, in `segmentIntersectionM` — consecutive ways in a path
 *   share nodes;
 * - collinear overlap — a shared frontage is not a crossing.
 */
export function findJunctions(groups: PathGroup[], toM: (p: LngLat) => Metres): Junction[] {
  // Flatten to individual ways, tagged with their group, so a pair test can ask
  // "same street?" before doing any geometry.
  type Way = { name: string; box: BoundingBox; segments: [Metres, Metres][] }
  const ways: Way[] = []
  for (const group of groups) {
    for (const line of group.geometry) {
      if (line.length < 2) continue
      const segments: [Metres, Metres][] = []
      let prev = toM(line[0])
      for (let i = 1; i < line.length; i += 1) {
        const cur = toM(line[i])
        if (metresBetween(prev, cur) > 0.5) segments.push([prev, cur])
        prev = cur
      }
      if (!segments.length) continue
      ways.push({ name: group.name, box: bboxOf([line], toM), segments })
    }
  }

  const raw: { at: Metres; paths: Set<string> }[] = []
  for (let i = 0; i < ways.length; i += 1) {
    for (let j = i + 1; j < ways.length; j += 1) {
      const a = ways[i], b = ways[j]
      // The same street meeting itself is not a junction. This is the only
      // adjacency guard needed, and it is why `segmentIntersectionM` can safely
      // count endpoints.
      if (a.name === b.name) continue
      if (!boxesOverlap(a.box, b.box, 1)) continue
      for (const [a1, a2] of a.segments) {
        for (const [b1, b2] of b.segments) {
          const hit = segmentIntersectionM(a1, a2, b1, b2)
          if (!hit) continue
          raw.push({ at: hit, paths: new Set([a.name, b.name]) })
        }
      }
    }
  }

  return mergeContacts(raw)
}

/**
 * Collapse coincident contacts into junction *places*.
 *
 * OSM splits ways at attribute changes and bridge decks, so one real
 * intersection routinely arrives as several crossings a metre or two apart.
 * Each is also a distinct pair of ways, so the raw set repeats the same
 * intersection many times over.
 *
 * Merged with a spatial hash rather than a scan. Once endpoints count, central
 * Bangkok produces thousands of raw contacts, and the obvious
 * `contacts.find(...)` merge is quadratic — which is how a 42ms measurement
 * turns into a multi-second freeze the moment the input is realistic.
 */
function mergeContacts(raw: { at: Metres; paths: Set<string> }[]): Junction[] {
  const cell = Math.max(1, JUNCTION_MERGE_M)
  const buckets = new Map<string, Junction[]>()
  const key = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`
  const junctions: Junction[] = []

  for (const contact of raw) {
    const [x, y] = contact.at
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell)
    let merged = false
    // Two cells of slack, because a neighbour's bucket may still hold a contact
    // within the merge radius of this point.
    for (let dx = -1; dx <= 1 && !merged; dx += 1) {
      for (let dy = -1; dy <= 1 && !merged; dy += 1) {
        for (const candidate of buckets.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (metresBetween(candidate.at, contact.at) > JUNCTION_MERGE_M) continue
          for (const name of contact.paths) if (!candidate.paths.includes(name)) candidate.paths.push(name)
          merged = true
          break
        }
      }
    }
    if (merged) continue
    const junction: Junction = { at: contact.at, paths: [...contact.paths] }
    junctions.push(junction)
    const k = key(x, y)
    const bucket = buckets.get(k)
    if (bucket) bucket.push(junction)
    else buckets.set(k, [junction])
  }
  return junctions
}

/** Classify one path from its measured junction density and length. */
export function classifyPath(junctions: number, lengthKm: number): PathStructure {
  const density = lengthKm > 0 ? junctions / lengthKm : 0
  if (density >= LINKED_THRESHOLD_PER_KM) return 'linked'
  if (density < SPARSE_THRESHOLD_PER_KM) return lengthKm >= DETACHED_MIN_KM ? 'detached' : 'sparse'
  return 'sparse'
}

export interface PathStructureAnnotation {
  readings: Map<string, PathStructureReading>
  summary: Record<PathStructure, number>
  /** One point per junction, for drawing the evidence. */
  junctionFeatures: GeoJSON.Feature[]
  grain: { bearingDeg: number; concentration: number }
  /** False when the network has no dominant direction to align to. */
  grained: boolean
}

/**
 * Measure every named path in a city image.
 *
 * Returns the readings keyed by name, plus junction points so the map can draw
 * the evidence rather than only assert a verdict — the same rule the edges lens
 * follows. A detached path with no visible junctions on it is a claim; a
 * detached path with nothing crossing it on screen is a picture of one.
 */
export function annotatePathStructure(collection: GeoJSON.FeatureCollection): PathStructureAnnotation {
  const groups = groupPaths(collection)
  const summary: Record<PathStructure, number> = { linked: 0, sparse: 0, detached: 0 }
  const readings = new Map<string, PathStructureReading>()

  if (!groups.length) {
    return { readings, summary, junctionFeatures: [], grain: { bearingDeg: 0, concentration: 0 }, grained: false }
  }

  // One origin for the whole window keeps every length, bearing and junction in
  // the same frame.
  const first = groups[0].geometry[0]?.[0]
  const toM = toMetres(first ?? [0, 0])
  const grain = networkGrain(groups, toM)
  const grained = grain.concentration >= MIN_GRAIN_CONCENTRATION
  const junctions = findJunctions(groups, toM)

  for (const group of groups) {
    const here = junctions.filter((j) => j.paths.includes(group.name))
    const worstDegree = here.reduce((worst, j) => Math.max(worst, j.paths.length), 0)
    const lengthKm = pathLengthKm(group.geometry)
    const structure = classifyPath(here.length, lengthKm)
    const bearing = pathBearingDeg(group.geometry, toM)
    summary[structure] += 1
    readings.set(group.name, {
      junctions: here.length,
      junctionDensityPerKm: round2(lengthKm > 0 ? here.length / lengthKm : 0),
      worstDegree,
      lengthKm: round2(lengthKm),
      structure,
      alignmentDeg: bearing === null || !grained ? null : round2(bearingDeltaDeg(bearing, grain.bearingDeg)),
    })
  }

  // Back to lng/lat for drawing. The local frame is metres about `first`, so the
  // inverse is exact rather than approximate.
  const [lon0, lat0] = first
  const kx = M_PER_DEG_LON_AT_EQ * Math.cos((lat0 * Math.PI) / 180)
  const junctionFeatures: GeoJSON.Feature[] = junctions.map((junction) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon0 + junction.at[0] / kx, lat0 + junction.at[1] / M_PER_DEG_LAT] },
    properties: { kind: 'junctions', degree: junction.paths.length, name: junction.paths.join(' · ') },
  }))

  // Stamp the verdict back onto the ways, the way `annotateEdgeStructure` does
  // for edges, so the map can filter on `structure` without a second lookup
  // table that would have to be kept in step by hand.
  const byOsmId = new Map<string, string>()
  for (const group of groups) for (const id of group.osmIds) byOsmId.set(id, group.name)
  for (const feature of collection.features) {
    if (feature.properties?.kind !== 'paths') continue
    const reading = readings.get(byOsmId.get(String(feature.properties.osmId)) ?? '')
    if (reading) {
      feature.properties = { ...feature.properties, structure: reading.structure, junctions: reading.junctions }
    }
  }

  return { readings, summary, junctionFeatures, grain, grained }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}