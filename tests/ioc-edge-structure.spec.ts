import { expect, test } from '@playwright/test'
import {
  annotateEdgeStructure,
  classifyEdge,
  countCrossings,
  pointToPolylineM,
  pointToSegmentM,
  edgeLengthKm,
  polylineLengthKm,
  BARRIER_THRESHOLD_PER_KM,
  CROSSING_TOLERANCE_M,
  SEAM_THRESHOLD_PER_KM,
} from '../src/lib/ioc/edge-structure'
import { cityImageQuery, parseCityImage } from '../src/data/city-image'
import { CITIES } from '../src/config/cities'

/**
 * IoC 2.0 slice 1 — barrier vs seam.
 *
 * Lynch, *The Image of the City* (1960), p.63–64: an edge the city joins
 * along is a seam; one it works around is a barrier. The test case is his own
 * — Boston's Central Artery against the Charles River — and the method has to
 * separate them or it is not measuring what Lynch meant.
 */

const BOSTON: [number, number] = [-71.06, 42.35]

/** A 1km east–west line, used as a synthetic edge. */
function line(lengthM: number, at: [number, number] = BOSTON): [number, number][] {
  const degPerM = 1 / (111_320 * Math.cos((at[1] * Math.PI) / 180))
  return [at, [at[0] + lengthM * degPerM, at[1]]]
}

/** A point `offsetM` north of the middle of `lengthM` long line at [at]. */
function crossingAt(lengthM: number, offsetM: number, at: [number, number] = BOSTON): [number, number] {
  const mid = at[0] + (lengthM / 2) * (1 / (111_320 * Math.cos((at[1] * Math.PI) / 180)))
  return [mid, at[1] + offsetM / 110_540]
}

test('point-to-segment distance is measured on the segment, not its endpoints', () => {
  const a: [number, number] = [0, 0]
  const b: [number, number] = [0.01, 0] // ~1.1km east
  const mid: [number, number] = [0.005, 0]
  // Directly above the middle of the segment.
  const perp = pointToSegmentM([0.005, 0.001], a, b)
  expect(perp).toBeGreaterThan(100)
  expect(perp).toBeLessThan(120)
  // Beyond either end, the nearest point is the endpoint, not the projection.
  expect(pointToSegmentM([0.02, 0], a, b)).toBeGreaterThan(1000)
})

test('a crossing counts only within tolerance of the centreline', () => {
  const edge = line(1000)
  expect(countCrossings([edge], [crossingAt(1000, 0)])).toBe(1)
  expect(countCrossings([edge], [crossingAt(1000, CROSSING_TOLERANCE_M - 5)])).toBe(1)
  expect(countCrossings([edge], [crossingAt(1000, CROSSING_TOLERANCE_M + 60)])).toBe(0)
})

test('polyline length is measured in kilometres', () => {
  expect(polylineLengthKm(line(1000))).toBeCloseTo(1, 2)
  expect(polylineLengthKm([[0, 0]])).toBe(0)
})

// The two cases Lynch contrasts on p.63–64. The Charles River runs through a
// dense fabric of crossings; the Central Artery had none — "inaccessible to
// pedestrians, at some points impassable".
test('a densely crossed edge reads as a seam and an uncrossed one as a barrier', () => {
  const seamEdge = line(1000)
  const seamCrossings = Array.from({ length: 20 }, (_, i) => crossingAt(1000, 0, [BOSTON[0] + i * 0.00002, BOSTON[1]]))
  const seam = classifyEdge(countCrossings([seamEdge], seamCrossings), polylineLengthKm(seamEdge))
  expect(seam.structure).toBe('seam')
  expect(seam.densityPerKm).toBeGreaterThanOrEqual(SEAM_THRESHOLD_PER_KM)

  const barrierEdge = line(1000)
  const barrier = classifyEdge(countCrossings([barrierEdge], []), polylineLengthKm(barrierEdge))
  expect(barrier.structure).toBe('barrier')
  expect(barrier.densityPerKm).toBeLessThan(BARRIER_THRESHOLD_PER_KM)
})

test('the band between the thresholds is partial, not silently rounded to an end', () => {
  // 4 crossings over 1km sits between the two thresholds.
  const edge = line(1000)
  const crossings = Array.from({ length: 4 }, (_, i) => crossingAt(1000, 0, [BOSTON[0] + i * 0.0001, BOSTON[1]]))
  const reading = classifyEdge(countCrossings([edge], crossings), polylineLengthKm(edge))
  expect(reading.structure).toBe('partial')
})

test('density is per kilometre, so a long quiet edge is not read as short and busy', () => {
  // Same 10 crossings, twice the length → half the density. Without dividing by
  // length every edge would score by how far it runs, not by what meets it.
  const crossings = Array.from({ length: 10 }, (_, i) => crossingAt(1000, 0, [BOSTON[0] + i * 0.0002, BOSTON[1]]))
  const shortEdge = classifyEdge(countCrossings([line(1000)], crossings), polylineLengthKm(line(1000)))
  const longEdge = classifyEdge(countCrossings([line(2000)], crossings), polylineLengthKm(line(2000)))
  expect(shortEdge.densityPerKm).toBe(10)
  expect(longEdge.densityPerKm).toBe(5)
  expect(shortEdge.structure).toBe('seam')
  expect(longEdge.structure).toBe('partial')
})

test('annotate tags edges and emits one crossing point per contact', () => {
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: line(1000) }, properties: { kind: 'edges', name: 'Crossed river', osmId: 1 } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: line(1000, [BOSTON[0] + 0.01, BOSTON[1]]) }, properties: { kind: 'edges', name: 'Untouched rail', osmId: 2 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: BOSTON }, properties: { kind: 'nodes', name: 'A node', osmId: 3 } },
    ],
  }
  const crossings = Array.from({ length: 12 }, (_, i) => crossingAt(1000, 0, [BOSTON[0] + i * 0.0001, BOSTON[1]]))
  const { summary, crossingFeatures } = annotateEdgeStructure(collection, crossings)

  expect(collection.features[0].properties?.structure).toBe('seam')
  expect(collection.features[1].properties?.structure).toBe('barrier')
  // Non-edge features are left alone.
  expect(collection.features[2].properties?.structure).toBeUndefined()
  expect(summary.seam).toBe(1)
  expect(summary.barrier).toBe(1)
  expect(crossingFeatures).toHaveLength(12)
  expect(crossingFeatures[0].properties?.kind).toBe('crossings')
})

// The second artefact this slice produced, stated as a test. OSM splits one
// waterway into many ways — Khlong Khu Mueang Derm arrived as six fragments
// between 10m and 160m. Measured per fragment, each one inherited every
// crossing near it and divided by its own tiny length, reporting 2203
// crossings/km for a piece of the Chao Phraya.
test('fragments of one named waterway are measured as one edge, not several', () => {
  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      // Three 10m pieces of the same named canal, end to end.
      ...[0, 1, 2].map((i) => ({
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: line(10, [BOSTON[0] + i * 0.0002, BOSTON[1]]) },
        properties: { kind: 'edges', name: 'Khlong Khu Mueang Derm', osmId: 10 + i },
      })),
      // A genuinely different unnamed feature stays its own edge.
      { type: 'Feature', geometry: { type: 'LineString', coordinates: line(10, [BOSTON[0] + 0.02, BOSTON[1]]) }, properties: { kind: 'edges', name: 'Mapped feature', osmId: 20 } },
    ],
  }
  // 12 crossings spread along the whole 30m canal.
  const crossings = Array.from({ length: 12 }, (_, i) => crossingAt(30, 0, [BOSTON[0] + i * 0.0006, BOSTON[1]]))
  const { summary, readings } = annotateEdgeStructure(collection, crossings)

  // One edge, not four: the three fragments share a verdict and a summary slot.
  expect(summary.seam).toBe(1)
  expect(summary.barrier).toBe(1)
  // Every fragment carries the same reading, so the whole canal renders as one.
  const structures = collection.features.map((f) => f.properties?.structure)
  expect(structures.slice(0, 3)).toEqual(['seam', 'seam', 'seam'])
  expect(readings.get('10')).toEqual(readings.get('11'))
  expect(readings.get('11')).toEqual(readings.get('12'))
})

test('edge length is the sum of its parts, with no path drawn between them', () => {
  const parts = [line(1000), line(1000, [BOSTON[0] + 0.5, BOSTON[1]])]
  expect(edgeLengthKm(parts)).toBeCloseTo(2, 2)
  // A crossing near the second part counts, even though the parts are far apart.
  expect(countCrossings(parts, [crossingAt(1000, 0, [BOSTON[0] + 0.5, BOSTON[1]])])).toBe(1)
})

// The trap this slice actually fell into, stated as a test.
//
// `highway` on an OSM *node* is street furniture — traffic_signals, crossing,
// street_lamp. Measured 2026-10-16 in central Bangkok: 581 nodes carry a
// `highway` tag, and the number matching any road classification was **zero**.
// Building crossings from them would have measured lamp posts and called every
// canal a barrier. Crossings are found by recursion instead — edges → their
// nodes → the ways through them → those ways' nodes.
test('a node matching no Lynch predicate is a crossing witness, not a drawn element', () => {
  const image = parseCityImage({ elements: [
    // Furniture that a highway-tag filter would have counted as a "road".
    { type: 'node', id: 1, lat: 42.3505, lon: -71.0605, tags: { highway: 'traffic_signals' } },
    { type: 'node', id: 2, lat: 42.3508, lon: -71.0608, tags: { highway: 'street_lamp' } },
    // A node with no tags at all — how Overpass emits `node(w.cw)` members.
    { type: 'node', id: 3, lat: 42.351, lon: -71.06 },
    // A drawn node: must NOT become a crossing.
    { type: 'node', id: 4, lat: 42.3512, lon: -71.06, tags: { name: 'Station', railway: 'station' } },
  ]})
  expect(image.crossings).toHaveLength(3)
  expect(image.collection.features.filter((f) => f.properties?.kind === 'crossings')).toHaveLength(0)
  expect(image.collection.features.filter((f) => f.properties?.kind === 'nodes')).toHaveLength(1)
})

test('the query finds crossings by recursion, not by tagging road nodes', () => {
  const query = cityImageQuery(CITIES.find((c) => c.id === 'bangkok')!)
  // edges → their nodes → ways through them → those ways' nodes.
  expect(query).toContain('node(w.edges)->.en')
  expect(query).toContain('way(bn.en)->.cw')
  expect(query).toContain('node(w.cw)->.cross')
  // No highway-tag node filter anywhere: it returns furniture.
  expect(query).not.toMatch(/node\[highway/)
  // Three outputs, three limits. Edges got their own cap after measurement:
  // sharing the display budget truncated a river to a 10-metre stub, and
  // crossings-per-km on a fragment is not a number, it is an artefact.
  expect(query).toContain('.display out geom 1200')
  expect(query).toContain('.edges out geom 600')
  expect(query).toContain('.cross out body 8000')
  // Edges must not also sit in the display set, or they compete for its cap.
  expect(query.split('->.display')[0]).not.toContain('waterway')
  expect(query.split('->.display')[0]).not.toContain('railway=rail')
})

test('parseCityImage separates crossing witnesses from the drawn city image', () => {
  const elements = [
    // A north–south river, ~1.1km long.
    { type: 'way', id: 10, geometry: [{ lat: 42.35, lon: -71.06 }, { lat: 42.36, lon: -71.06 }], tags: { waterway: 'river', name: 'River' } },
    { type: 'way', id: 11, geometry: [{ lat: 42.34, lon: -71.05 }, { lat: 42.34, lon: -71.04 }], tags: { highway: 'primary', name: 'Main Road' } },
    // Unnamed road nodes running *along* the river — evidence only.
    ...Array.from({ length: 12 }, (_, i) => ({ type: 'node', id: 100 + i, lat: 42.35 + i * 0.0007, lon: -71.06, tags: {} })),
  ]
  const image = parseCityImage({ elements, osm3s: { timestamp_osm_base: '2026-05-31T22:37:44Z' } })

  // The five Lynch elements are drawn; the witnesses are not among them.
  expect(image.collection.features.filter((f) => f.properties?.kind === 'edges')).toHaveLength(1)
  expect(image.collection.features.filter((f) => f.properties?.kind === 'paths')).toHaveLength(1)
  expect(image.collection.features.filter((f) => f.properties?.kind === 'crossings')).toHaveLength(12)
  expect(image.crossings).toHaveLength(12)
  expect(image.edgeSummary).toEqual({ seam: 1, partial: 0, barrier: 0 })
  expect(image.sourceTime).toBe('2026-05-31T22:37:44Z')
  expect(image.truncated).toBe(false)
})

test('a truncated sample is reported, not hidden', () => {
  const elements = Array.from({ length: 1200 }, (_, i) => ({
    type: 'way', id: i + 1,
    geometry: [{ lat: 42.3 + i * 1e-5, lon: -71.1 }, { lat: 42.3 + (i + 1) * 1e-5, lon: -71.1 }],
    tags: { highway: 'primary', name: `Road ${i}` },
  }))
  const image = parseCityImage({ elements })
  expect(image.truncated).toBe(true)
})

test('a remark in a 200 response is still a failure', () => {
  expect(() => parseCityImage({ elements: [], remark: 'runtime error: query timed out' })).toThrow()
})