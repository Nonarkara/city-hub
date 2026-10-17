import { test, expect } from '@playwright/test'
import { CITIES } from '../src/config/cities'
import { cityImageQuery, parseCityImage, studyBounds } from '../src/data/city-image'

test('city study windows use comparable ground distances at different latitudes', () => {
  for (const id of ['bangkok', 'kranj']) {
    const city = CITIES.find((value) => value.id === id)!
    const [w, s, e, n] = studyBounds(city)
    expect((n - s) * 111.32).toBeCloseTo(4)
    expect((e - w) * 111.32 * Math.cos(city.center[1] * Math.PI / 180)).toBeCloseTo(4)
    expect(cityImageQuery(city)).toContain('out geom 1200')
  }
})

test('mapped candidates preserve overlapping roles without inventing perceived boundaries', () => {
  const image = parseCityImage({ osm3s: { timestamp_osm_base: '2026-10-15T00:00:00Z' }, elements: [
    { type: 'way', id: 1, tags: { name: 'Main Street', highway: 'primary' }, geometry: [{lat: 13.75, lon: 100.5}, {lat: 13.76, lon: 100.51}] },
    { type: 'node', id: 2, tags: { name: 'Old Town', place: 'neighbourhood' }, lat: 13.75, lon: 100.5 },
    { type: 'node', id: 3, tags: { name: 'Historic station', railway: 'station', historic: 'building' }, lat: 13.75, lon: 100.5 },
    { type: 'relation', id: 4, tags: { name: 'No geometry', historic: 'building' } },
  ] }, 123)
  expect(image.collection.features.map((feature) => feature.properties?.kind)).toEqual(['paths', 'districts', 'nodes', 'landmarks'])
  expect(image.collection.features[1].geometry.type).toBe('Point')
  expect(image.fetchedAt).toBe(123)
  expect(image.sourceTime).toBe('2026-10-15T00:00:00Z')
  expect(image.truncated).toBe(false)
})

test('service errors cannot masquerade as empty or complete city maps', () => {
  expect(() => parseCityImage({ remark: 'timeout', elements: [] })).toThrow()
  expect(() => parseCityImage({})).toThrow()
  expect(parseCityImage({ elements: [] }).collection.features).toHaveLength(0)
  // Truncation is about the *drawn* set. The query returns two outputs with
  // separate caps, so a window with thousands of crossing witnesses and a
  // handful of Lynch elements is a complete image, not a truncated one.
  const drawn = Array.from({ length: 1200 }, (_, i) => ({
    type: 'way', id: i + 1, tags: { highway: 'primary', name: `Road ${i}` },
    geometry: [{ lat: 13.7 + i * 1e-5, lon: 100.5 }, { lat: 13.7 + (i + 1) * 1e-5, lon: 100.5 }],
  }))
  expect(parseCityImage({ elements: drawn }).truncated).toBe(true)
  const withCrossings = [...drawn.slice(0, 10), ...Array.from({ length: 2500 }, (_, i) => ({
    type: 'node', id: 50_000 + i, lat: 13.75 + i * 1e-5, lon: 100.5,
  }))]
  expect(parseCityImage({ elements: withCrossings }).truncated).toBe(false)
})

test('a full edge budget is not a truncated display set', () => {
  // The bug this locks: one combined counter was compared against the display
  // cap, so a window whose `.edges` output was merely *large* was reported as a
  // truncated display set — and every system in the panel inherited "limited
  // sample". Measured on central Bangkok: 1063 display elements against a cap of
  // 1200, flagged truncated anyway because 1284 combined elements crossed 1200.
  const paths = Array.from({ length: 1063 }, (_, i) => ({
    type: 'way', id: i + 1, tags: { highway: 'primary', name: `Road ${i}` },
    geometry: [{ lat: 13.70 + i * 1e-6, lon: 100.50 }, { lat: 13.70 + (i + 1) * 1e-6, lon: 100.50 }],
  }))
  const edges = Array.from({ length: 221 }, (_, i) => ({
    type: 'way', id: 900_000 + i, tags: { waterway: 'canal', name: `Khlong ${i}` },
    geometry: [{ lat: 13.72, lon: 100.50 + i * 1e-5 }, { lat: 13.73, lon: 100.50 + i * 1e-5 }],
  }))
  const image = parseCityImage({ elements: [...paths, ...edges] })
  expect(image.truncated).toBe(false)
  expect(image.edgeTruncated).toBe(false)
  // 1284 combined — comfortably over the display cap, which is the point.
  expect(paths.length + edges.length).toBeGreaterThan(1200)
})

test('dropped road-node witnesses are reported, because they skew the seam verdict', () => {
  // Seam vs barrier is decided entirely by how many road contacts an edge has.
  // Silently dropping witnesses does not shrink that count, it skews it toward
  // "barrier", so the cap has to be visible rather than assumed.
  const crossings = Array.from({ length: 8000 }, (_, i) => ({
    type: 'node', id: 500_000 + i, lat: 13.75 + i * 1e-6, lon: 100.5,
  }))
  expect(parseCityImage({ elements: crossings }).crossingsTruncated).toBe(true)
  expect(parseCityImage({ elements: crossings.slice(0, 5077) }).crossingsTruncated).toBe(false)
})

test('the query keeps crossing witnesses out of the drawn element budget', () => {
  const query = cityImageQuery(CITIES.find((c) => c.id === 'bangkok')!)
  // Two outputs, two limits — otherwise a road-dense window would push the
  // Lynch elements past the cap and silently truncate the city image.
  expect(query).toContain('.display out geom 1200')
  // 8000, not the 3000 this used to be: the central Bangkok window holds 5077
  // road contacts, so a 3000 cap was discarding 41% of the evidence that decides
  // every seam/barrier verdict, with no signal that it had.
  expect(query).toContain('.cross out body 8000')
})
