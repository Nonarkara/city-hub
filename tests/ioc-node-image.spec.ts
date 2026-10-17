import { test, expect } from '@playwright/test'
import {
  annotateNodeImage,
  isNameable,
  nodeDensityWarning,
  NODE_CONTENT_MIN,
  NODE_FUNCTION_DEGREE,
  type NodeVerdict,
} from '../src/lib/ioc/node-image'
import { groupPaths, pathKey } from '../src/lib/ioc/path-structure'
import { parseCityImage } from '../src/data/city-image'

type LngLat = [number, number]

let nextId = 1
function path(name: string, coords: LngLat[]) {
  return { type: 'way' as const, id: nextId++, tags: { name, highway: 'secondary' },
    geometry: coords.map(([lon, lat]) => ({ lat, lon })) }
}
function landmark(name: string, coords: LngLat[]) {
  return { type: 'way' as const, id: nextId++, tags: { historic: 'memorial', name },
    geometry: coords.map(([lon, lat]) => ({ lat, lon })) }
}
function landmarkNode(name: string, at: LngLat) {
  return { type: 'node' as const, id: nextId++, tags: { tourism: 'attraction', name }, lat: at[1], lon: at[0] }
}

/** A three-branch junction at `hub`, which is what counts as functionally important. */
function star(hub: LngLat, names: string[]) {
  return [
    path(names[0], [[hub[0] - 0.01, hub[1]], hub]),
    path(names[1], [hub, [hub[0] + 0.01, hub[1]]]),
    path(names[2], [hub, [hub[0], hub[1] + 0.01]]),
  ]
}

function build(elements: unknown[], cityName = 'Testville') {
  return parseCityImage({ elements }, 0, cityName).collection
}

test('a junction doing real work that nobody could name is shapeless', () => {
  // Scollay Square: the switch point at Beacon Hill, which "could not be
  // remembered in any concrete way… nothing else could be agreed upon."
  const hub: LngLat = [100.50, 13.75]
  const image = build(star(hub, ['Alpha Road', 'Beta Road', 'Gamma Road']))
  const { summary, readings } = annotateNodeImage(image, 'Testville')
  expect(summary.shapeless).toBe(1)
  const only = [...readings.values()][0]
  expect(only.degree).toBe(NODE_FUNCTION_DEGREE)
  expect(only.content).toBe(0)
  expect(only.verdict).toBe('shapeless')
})

test('a minor crossing surrounded by distinct things is memorable', () => {
  // Copley Square: "of less functional importance… very sharply imaged… in
  // terms of its unique individual buildings."
  const hub: LngLat = [100.50, 13.75]
  const image = build([
    { type: 'way', id: 900, tags: { highway: 'secondary', name: 'Minor Road' },
      geometry: [{ lat: hub[1], lon: hub[0] - 0.01 }, { lat: hub[1], lon: hub[0] + 0.01 }] },
    { type: 'way', id: 901, tags: { highway: 'secondary', name: 'Other Road' },
      geometry: [{ lat: hub[1] - 0.01, lon: hub[0] }, { lat: hub[1] + 0.01, lon: hub[0] }] },
    landmarkNode('Public Library', [hub[0] + 0.0005, hub[1]]),
    landmarkNode('Trinity Church', [hub[0] - 0.0005, hub[1]]),
  ])
  const { summary, readings } = annotateNodeImage(image, 'Testville')
  expect(summary.memorable).toBe(1)
  const only = [...readings.values()][0]
  expect(only.degree).toBe(2)
  expect(only.content).toBe(NODE_CONTENT_MIN)
  expect(only.contentNames).toContain('Public Library')
})

test('functional and imaged together is a real node', () => {
  const hub: LngLat = [100.50, 13.75]
  const image = build([
    ...star(hub, ['Alpha Road', 'Beta Road', 'Gamma Road']),
    landmarkNode('Old Terminal', [hub[0], hub[1] + 0.0006]),
    landmarkNode('Clock Tower', [hub[0] + 0.0006, hub[1]]),
  ])
  expect(annotateNodeImage(image, 'Testville').summary.anchored).toBe(1)
})

test('an ordinary crossing is not a node, however real it is', () => {
  // "In theory, even ordinary street intersections are nodes, but generally
  // they are not of sufficient prominence to be imaged as more than the
  // incidental crossing of paths."
  const hub: LngLat = [100.50, 13.75]
  const image = build([
    { type: 'way', id: 910, tags: { highway: 'secondary', name: 'Alpha Road' },
      geometry: [{ lat: hub[1], lon: hub[0] - 0.01 }, { lat: hub[1], lon: hub[0] + 0.01 }] },
    { type: 'way', id: 911, tags: { highway: 'secondary', name: 'Beta Road' },
      geometry: [{ lat: hub[1] - 0.01, lon: hub[0] }, { lat: hub[1] + 0.01, lon: hub[0] }] },
  ])
  const { summary, readings } = annotateNodeImage(image, 'Testville')
  expect(summary.quiet).toBe(1)
  expect([...readings.values()][0].verdict).toBe('quiet')
})

test('a building counts from its frontage, not an invented centre', () => {
  // 181 of 272 nameable features in central Bangkok are mapped as ways. A long
  // building facing a junction has no single point, and its centroid could be
  // metres inside a block — putting it on the map at an invented centre would
  // both invent a location and miss the frontage that a person actually sees.
  const hub: LngLat = [100.50, 13.75]
  // Spans 400m of frontage on the junction's own latitude, but its centre is
  // 400m away — far outside the radius.
  const longBuilding = landmark('Grand Facade', [
    [hub[0] - 0.002, hub[1]], [hub[0] + 0.002, hub[1]],
  ])
  const image = build([
    ...star(hub, ['Alpha Road', 'Beta Road', 'Gamma Road']),
    longBuilding,
    landmarkNode('Second Thing', [hub[0] + 0.0004, hub[1]]),
  ])
  const { summary } = annotateNodeImage(image, 'Testville')
  expect(summary.anchored).toBe(1)
})

test('the same thing mapped twice is not two things to recognise a place by', () => {
  const hub: LngLat = [100.50, 13.75]
  const image = build([
    ...star(hub, ['Alpha Road', 'Beta Road', 'Gamma Road']),
    landmarkNode('Royal Gate', [hub[0] + 0.0004, hub[1]]),
    landmark('Royal Gate', [[hub[0] - 0.0004, hub[1] - 0.0002], [hub[0] - 0.0004, hub[1] + 0.0002]]),
  ])
  const only = [...annotateNodeImage(image, 'Testville').readings.values()][0]
  expect(only.content).toBe(1)
  // One is a feature, not a place you could find again.
  expect(only.verdict).toBe('shapeless')
})

test('a name that cannot orient anyone is not image content', () => {
  expect(isNameable('Old Town Market', 'Bangkok')).toBe(true)
  // Memorial record identifiers, measured on central Bangkok.
  expect(isNameable('2480', 'Bangkok')).toBe(false)
  expect(isNameable(' 61 ', 'Bangkok')).toBe(false)
  // The city's own name distinguishes nothing — it says where you already are.
  expect(isNameable('Bangkok', 'Bangkok')).toBe(false)
  expect(isNameable('', 'Bangkok')).toBe(false)
  expect(isNameable('Mapped feature', 'Bangkok')).toBe(false)
})

test('too many nodal centres is itself a finding', () => {
  // "The image cannot carry too many nodal centres."
  const every: Record<NodeVerdict, number> = { anchored: 5, shapeless: 1, memorable: 6, quiet: 0 }
  const warning = nodeDensityWarning(every, every.anchored + every.memorable)
  expect(warning).toContain('cannot carry too many nodal centres')
  // A window with one clear focus is not warned about.
  expect(nodeDensityWarning({ anchored: 1, shapeless: 20, memorable: 0, quiet: 30 }, 1)).toBeNull()
  expect(nodeDensityWarning({ anchored: 0, shapeless: 0, memorable: 0, quiet: 0 }, 0)).toBeNull()
})

test('one street, two spellings, one path', () => {
  // Measured on central Chiang Mai: `Sri Poom Road` (15 ways) and `Sripoom
  // Road` (5) are one street. Split, it stops joining its own fragments and
  // reports half the junctions per kilometre it actually has.
  expect(pathKey('Sri Poom Road')).toBe(pathKey('Sripoom Road'))
  expect(pathKey('Wua Lai  Road')).toBe(pathKey('wualai road'))
  const image = build([
    path('Sri Poom Road', [[100.50, 13.75], [100.51, 13.75]]),
    path('Sripoom Road', [[100.51, 13.75], [100.52, 13.75]]),
  ])
  const groups = groupPaths(image)
  expect(groups).toHaveLength(1)
  expect(groups[0].osmIds).toHaveLength(2)
  // The reading keeps a spelling someone would actually use.
  expect(['Sri Poom Road', 'Sripoom Road']).toContain(groups[0].name)
})

test('transliteration variants stay separate rather than being fuzzily merged', () => {
  // `Changpuak Road` and `Chang Phueak Road` are also one street. They are not
  // merged, because a fuzzy match that eventually joins two genuinely different
  // roads is worse than a known gap — and the gap is documented rather than
  // hidden behind a heuristic.
  expect(pathKey('Changpuak Road')).not.toBe(pathKey('Chang Phueak Road'))
})