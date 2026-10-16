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

test('the query keeps crossing witnesses out of the drawn element budget', () => {
  const query = cityImageQuery(CITIES.find((c) => c.id === 'bangkok')!)
  // Two outputs, two limits — otherwise a road-dense window would push the
  // Lynch elements past the cap and silently truncate the city image.
  expect(query).toContain('.display out geom 1200')
  expect(query).toContain('.cross out body 3000')
})
