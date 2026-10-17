import { test, expect } from '@playwright/test'
import {
  annotatePathStructure,
  classifyPath,
  findJunctions,
  groupPaths,
  networkGrain,
  pathBearingDeg,
  pathLengthKm,
  segmentIntersectionM,
  bearingDeltaDeg,
  DETACHED_MIN_KM,
  JUNCTION_MERGE_M,
  MIN_GRAIN_CONCENTRATION,
} from '../src/lib/ioc/path-structure'
import { parseCityImage } from '../src/data/city-image'

type LngLat = [number, number]

/** 0.001° of longitude at Bangkok is ~102m — enough that metres are meaningful. */
let nextId = 1
function path(name: string, coords: LngLat[]) {
  return {
    type: 'way' as const,
    id: nextId++,
    tags: { name, highway: 'secondary' },
    geometry: coords.map(([lon, lat]) => ({ lat, lon })),
  }
}

function imageOf(paths: { name: string; coords: LngLat[] }[]) {
  return parseCityImage({ elements: paths.map((p) => path(p.name, p.coords)) })
}

function groupsOf(collection: GeoJSON.FeatureCollection) {
  return groupPaths(collection)
}

function frameOf(collection: GeoJSON.FeatureCollection) {
  const origin = collection.features[0]?.geometry
  const [lon0, lat0] = origin?.type === 'LineString' ? origin.coordinates[0] : [100.5, 13.75]
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180)
  return ([lon, lat]: LngLat): [number, number] => [(lon - lon0) * kx, (lat - lat0) * 110_540]
}

test('one street drawn as several ways is one path, measured as one thing', () => {
  // OSM splits a street at every attribute change. Measured on central Bangkok:
  // 701 path ways collapse to 116 named paths, and Arun Ammarin Road arrives as
  // 42 of them. Measuring a fragment alone divides its junctions across pieces
  // and then divides by its own tiny length.
  const image = imageOf([
    { name: 'Long Road', coords: [[100.50, 13.75], [100.51, 13.75]] },
    { name: 'Long Road', coords: [[100.51, 13.75], [100.52, 13.75]] },
    { name: 'Long Road', coords: [[100.52, 13.75], [100.53, 13.75]] },
  ])
  const groups = groupsOf(image.collection)
  expect(groups).toHaveLength(1)
  expect(groups[0].geometry).toHaveLength(3)
  expect(groups[0].osmIds).toHaveLength(3)
  // Summed, not routed through: three fragments is one 3km street, not 1km.
  expect(pathLengthKm(groups[0].geometry)).toBeGreaterThan(2.9)
})

test('a crossing at a shared node counts as a junction', () => {
  // The trap that made this measurement look like scarcity. OSM streets meet by
  // sharing a node, so the crossing sits at the *end* of one way. An
  // open-interval intersection test rejected almost every real crossing in
  // central Bangkok: 29 junctions across 116 paths, and 85 paths touching
  // nothing.
  const image = imageOf([
    { name: 'East Street', coords: [[100.50, 13.75], [100.505, 13.75]] },
    { name: 'North Street', coords: [[100.505, 13.749], [100.505, 13.751]] },
  ])
  const { readings } = annotatePathStructure(image.collection)
  expect(readings.get('East Street')?.junctions).toBe(1)
  expect(readings.get('North Street')?.junctions).toBe(1)
})

test('a street meeting itself is not a junction', () => {
  // Guarded by name, not by falsifying the geometry — which is what lets the
  // intersection test count endpoints honestly.
  const image = imageOf([
    { name: 'Split Road', coords: [[100.50, 13.75], [100.51, 13.75]] },
    { name: 'Split Road', coords: [[100.51, 13.75], [100.52, 13.75]] },
  ])
  const { readings } = annotatePathStructure(image.collection)
  expect(readings.get('Split Road')?.junctions).toBe(0)
})

test('coincident contacts collapse into one junction place', () => {
  // OSM splits ways at bridge decks, so one intersection can arrive several
  // times. Counted raw it would read as a cluster of junctions.
  const image = imageOf([
    { name: 'Riverside', coords: [[100.50, 13.75], [100.52, 13.75]] },
    { name: 'Cross A', coords: [[100.505, 13.749], [100.505, 13.751]] },
    { name: 'Cross B', coords: [[100.5051, 13.749], [100.5051, 13.751]] },
    { name: 'Cross C', coords: [[100.5049, 13.749], [100.5049, 13.751]] },
  ])
  const groups = groupsOf(image.collection)
  const junctions = findJunctions(groups, frameOf(image.collection))
  const onRiverside = junctions.filter((j) => j.paths.includes('Riverside'))
  expect(onRiverside).toHaveLength(1)
  // …and that junction records all four paths present, which is the degree.
  expect(onRiverside[0].paths.length).toBe(4)
})

test('junction degree counts the branches meeting, as Lynch counts them', () => {
  // "Crossings of more than four points almost always gave trouble" — the
  // taxi driver named the five-pointed Church Green crossing. Five roads must
  // read as five *at one place*; spread 100m apart they are four separate
  // degree-2 junctions, which is a different and equally correct reading.
  const hub: LngLat = [100.515, 13.75]
  const roads = [
    { name: 'Main', coords: [[100.50, 13.75], [100.53, 13.75]] as LngLat[] },
    { name: 'North', coords: [hub, [100.515, 13.752]] },
    { name: 'South', coords: [hub, [100.515, 13.748]] },
    { name: 'Shallow East', coords: [hub, [100.517, 13.7515]] },
    { name: 'Shallow West', coords: [hub, [100.513, 13.7485]] },
  ]
  const { readings } = annotatePathStructure(imageOf(roads).collection)
  expect(readings.get('Main')?.junctions).toBe(1)
  expect(readings.get('Main')?.worstDegree).toBe(5)
})

test('detachment is about prominence: long and unjoined, not merely short', () => {
  expect(classifyPath(0, 5)).toBe('detached')
  expect(classifyPath(1, 3)).toBe('detached')
  // A lane with two junctions is unremarkable, and calling it detached would be
  // technically true and practically useless.
  expect(classifyPath(0, DETACHED_MIN_KM - 0.05)).toBe('sparse')
  expect(classifyPath(4, 2)).toBe('sparse')
  expect(classifyPath(20, 2)).toBe('linked')
})

test('bearing reads the street, not the order OSM returned its ways in', () => {
  // Ways arrive in id order, not geographic order. Taking "first way's start"
  // and "last way's end" gave 300m of displacement on a 7.6km street made of 42
  // fragments, and failed the straightness test for 50 of 116 paths.
  const fragments: LngLat[][] = [
    [[100.52, 13.75], [100.53, 13.75]],
    [[100.50, 13.75], [100.51, 13.75]],
    [[100.51, 13.75], [100.52, 13.75]],
  ]
  const toM = ([lon, lat]: LngLat): [number, number] => [lon * 102_000, lat * 110_540]
  const bearing = pathBearingDeg(fragments, toM)
  // Due east in any fragment order; its reverse folds to the same alignment.
  expect(bearingDeltaDeg(bearing!, 90)).toBeLessThan(1)
})

test('a doubling-back street is honestly directionless', () => {
  const out: LngLat[] = []
  for (let i = 0; i <= 20; i += 1) out.push([100.5 + i * 0.001, 13.75])
  for (let i = 20; i >= 0; i -= 1) out.push([100.5 + i * 0.001, 13.75])
  const toM = ([lon, lat]: LngLat): [number, number] => [lon * 102_000, lat * 110_540]
  expect(pathBearingDeg([out], toM)).toBeNull()
})

test('alignment is withheld when the network has no grain to align to', () => {
  // Central Bangkok measures concentration 0.064 — the named network points every
  // way at once. Quoting a deviation from a resultant that is mostly noise is
  // false precision, so the measurement is withheld and the finding reported.
  const spokes: { name: string; coords: LngLat[] }[] = []
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2
    spokes.push({
      name: `Spoke ${i}`,
      coords: [[100.5, 13.75], [100.5 + Math.cos(angle) * 0.02, 13.75 + Math.sin(angle) * 0.02]],
    })
  }
  const image = imageOf(spokes)
  const groups = groupsOf(image.collection)
  const grain = networkGrain(groups, frameOf(image.collection))
  expect(grain.concentration).toBeLessThan(MIN_GRAIN_CONCENTRATION)
  const annotation = annotatePathStructure(image.collection)
  expect(annotation.grained).toBe(false)
  expect([...annotation.readings.values()].every((r) => r.alignmentDeg === null)).toBe(true)
})

test('a grid has a grain, and its paths report alignment against it', () => {
  const grid: { name: string; coords: LngLat[] }[] = []
  for (let i = 0; i < 6; i += 1) {
    grid.push({ name: `E-W ${i}`, coords: [[100.50, 13.75 + i * 0.001], [100.53, 13.75 + i * 0.001]] })
  }
  for (let i = 0; i < 3; i += 1) {
    grid.push({ name: `N-S ${i}`, coords: [[100.50 + i * 0.001, 13.75], [100.50 + i * 0.001, 13.755]] })
  }
  const image = imageOf(grid)
  const annotation = annotatePathStructure(image.collection)
  // Two families of six and three — the resultant points along one of them.
  expect(annotation.grained).toBe(true)
  const alignments = [...annotation.readings.values()].map((r) => r.alignmentDeg)
  expect(alignments.every((a) => a !== null)).toBe(true)
  expect(alignments.every((a) => a! >= 0 && a! <= 90)).toBe(true)
})

test('parallel streets never meet, however close they are', () => {
  const image = imageOf([
    { name: 'North Road', coords: [[100.50, 13.75], [100.53, 13.75]] },
    { name: 'South Road', coords: [[100.50, 13.7505], [100.53, 13.7505]] },
  ])
  const { readings } = annotatePathStructure(image.collection)
  expect(readings.get('North Road')?.junctions).toBe(0)
  expect(readings.get('South Road')?.junctions).toBe(0)
})

test('a shared frontage is not a junction', () => {
  // Collinear overlap must not manufacture a junction along every metre of
  // shared street wall.
  const image = imageOf([
    { name: 'Upper', coords: [[100.50, 13.75], [100.53, 13.75]] },
    { name: 'Lower', coords: [[100.51, 13.75], [100.52, 13.75]] },
  ])
  const { readings } = annotatePathStructure(image.collection)
  expect(readings.get('Upper')?.junctions).toBe(0)
})

test('segment maths is honest about degenerate input', () => {
  const p = (x: number, y: number): [number, number] => [x, y]
  expect(segmentIntersectionM(p(0, 0), p(10, 0), p(5, -5), p(5, 5))).toEqual([5, 0])
  expect(segmentIntersectionM(p(0, 0), p(10, 0), p(20, 0), p(30, 0))).toBeNull()
  expect(segmentIntersectionM(p(0, 0), p(0, 0), p(0, 0), p(10, 10))).toBeNull()
  // Parallel, never crossing.
  expect(segmentIntersectionM(p(0, 0), p(10, 0), p(0, 5), p(10, 5))).toBeNull()
})

test('an empty city image is not a city with no detached paths', () => {
  const annotation = annotatePathStructure(parseCityImage({ elements: [] }).collection)
  expect(annotation.readings.size).toBe(0)
  expect(annotation.junctionFeatures).toHaveLength(0)
  expect(annotation.grained).toBe(false)
  expect(annotation.summary).toEqual({ linked: 0, sparse: 0, detached: 0 })
})

test('junction merge radius is tight enough to keep real crossings apart', () => {
  // ~102m per 0.001° here, so two crossings 100m along a street are two
  // junctions, not one smeared blob.
  expect(JUNCTION_MERGE_M).toBeLessThan(50)
})