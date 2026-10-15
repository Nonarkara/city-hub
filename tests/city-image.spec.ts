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
  expect(parseCityImage({ elements: new Array(1200).fill(null) }).truncated).toBe(true)
})
