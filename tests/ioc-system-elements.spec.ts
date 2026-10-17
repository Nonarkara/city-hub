import { expect, test } from '@playwright/test'
import { projectSystems, citationLine, SYSTEM_BINDINGS } from '../src/lib/ioc/system-elements'
import { parseCityImage } from '../src/data/city-image'
import type { CityImage } from '../src/data/city-image'

/**
 * IoC 2.0 — systems pointing at elements.
 *
 * The whole point of this module is to join the capacity model to the city
 * image. The risk is not that it computes the wrong number; it is that it says
 * something stronger than the evidence supports. So most of these tests are
 * about the *boundary* — what it may claim, and what it must refuse to claim.
 */

const SYSTEM_IDS = ['housing', 'water', 'drainage', 'transit', 'air', 'heat', 'health', 'waste'] as const

function imageWithEdges(): CityImage {
  // One canal with roads meeting it (a seam) and one with none (a barrier).
  // The witnesses are untagged nodes, which is how `node(w.cw)` emits them.
  return parseCityImage({ elements: [
    { type: 'way', id: 1, tags: { waterway: 'canal', name: 'Barrier Canal' }, geometry: [{ lat: 42.35, lon: -71.06 }, { lat: 42.36, lon: -71.06 }] },
    { type: 'way', id: 2, tags: { waterway: 'canal', name: 'Seam Canal' }, geometry: [{ lat: 42.34, lon: -71.05 }, { lat: 42.35, lon: -71.05 }] },
    ...Array.from({ length: 12 }, (_, i) => ({ type: 'node', id: 500 + i, lat: 42.34 + i * 0.0008, lon: -71.05 })),
    { type: 'way', id: 3, tags: { highway: 'primary', name: 'Main Road' }, geometry: [{ lat: 42.33, lon: -71.04 }, { lat: 42.34, lon: -71.04 }] },
    { type: 'node', id: 4, tags: { place: 'neighbourhood', name: 'Old Quarter' }, lat: 42.34, lon: -71.05 },
    { type: 'node', id: 5, tags: { railway: 'station', name: 'Central' }, lat: 42.33, lon: -71.04 },
  ] })
}

test('every modelled system declares the elements it acts through', () => {
  for (const id of SYSTEM_IDS) {
    const binding = SYSTEM_BINDINGS[id]
    expect(binding, `${id} has no binding`).toBeTruthy()
    expect(binding.elements.length).toBeGreaterThan(0)
    // The risk class must be one of the elements the system actually uses,
    // otherwise the citation and the sentence would disagree.
    expect(binding.elements, `${id} risk is outside its own elements`).toContain(binding.risk.kind)
    expect(binding.risk.because.length).toBeGreaterThan(10)
  }
})

test('drainage is bound to barrier edges and water to seams — the same line, opposite jobs', () => {
  expect(SYSTEM_BINDINGS.drainage.risk.structure).toBe('barrier')
  expect(SYSTEM_BINDINGS.water.risk.structure).toBe('seam')
})

test('a system projects onto named elements of its risk class', () => {
  const image = imageWithEdges()
  const [drainage] = projectSystems(image, ['drainage'])
  expect(drainage.citations.length).toBeGreaterThan(0)
  // Every citation is a barrier edge, because that is drainage's risk class.
  expect(drainage.citations.every((c) => c.structure === 'barrier')).toBe(true)
  expect(drainage.citations.some((c) => c.name === 'Barrier Canal')).toBe(true)
  expect(drainage.citations.some((c) => c.name === 'Seam Canal')).toBe(false)
})

test('the same image gives water the opposite answer', () => {
  const image = imageWithEdges()
  const [water] = projectSystems(image, ['water'])
  expect(water.citations.every((c) => c.structure === 'seam')).toBe(true)
  expect(water.citations.some((c) => c.name === 'Seam Canal')).toBe(true)
})

// The claim boundary. This module may say where a system is *exposed*. It may
// never say a failure happened at a named place, because there is no data
// behind that and the phrase would read as an event report.
test('the projection states structural exposure and never an event attribution', () => {
  const image = imageWithEdges()
  const FORBIDDEN = [/failed at/i, /broke at/i, /incident/i, /occurred/i, /reported at/i]
  for (const projection of projectSystems(image, [...SYSTEM_IDS])) {
    for (const pattern of FORBIDDEN) {
      expect(projection.line, `${projection.system} line`).not.toMatch(pattern)
    }
  }
})

test('a failed image read says so instead of guessing at an element', () => {
  const [drainage] = projectSystems(null, ['drainage'])
  expect(drainage.citations).toEqual([])
  expect(drainage.line).toMatch(/unavailable/i)
  expect(citationLine(drainage)).toBeNull()
})

test('a truncated window is labelled, so counts never read as complete', () => {
  const elements = Array.from({ length: 1200 }, (_, i) => ({
    type: 'way', id: i + 1, tags: { highway: 'primary', name: `Road ${i}` },
    geometry: [{ lat: 42.3 + i * 1e-5, lon: -71.1 }, { lat: 42.3 + (i + 1) * 1e-5, lon: -71.1 }],
  }))
  const [transit] = projectSystems(parseCityImage({ elements }), ['transit'])
  expect(transit.limited).toBe(true)
})

test('an empty window yields an empty citation, not a fabricated element', () => {
  const empty = parseCityImage({ elements: [] })
  const [drainage] = projectSystems(empty, ['drainage'])
  expect(drainage.citations).toEqual([])
  expect(drainage.line).toMatch(/no edges of that kind/i)
})

test('every system projects, not just the ones with edges', () => {
  const image = imageWithEdges()
  const projections = projectSystems(image, [...SYSTEM_IDS])
  expect(projections.length).toBe(SYSTEM_IDS.length)
  for (const p of projections) {
    expect(p.line.length).toBeGreaterThan(20)
  }
})