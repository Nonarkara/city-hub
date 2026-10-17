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
    // The sentence reads "...where <because>.", so `because` must be a clause.
    expect(binding.risk.because, `${id} because must fit after "where "`).toMatch(/^(it |the |a |runoff |supply |dense |mass |collection |reach |who )/)
    expect(binding.noun.one, `${id} needs a singular noun`).toBeTruthy()
    expect(binding.noun.many).toBeTruthy()
  }
})

test('the sentence is grammatical — no "where it who lives where"', () => {
  const image = imageWithEdges()
  for (const p of projectSystems(image, [...SYSTEM_IDS])) {
    expect(p.line, `${p.system} reads badly`).not.toMatch(/where it who|where it supply|where it dense|where it reach|where it collection|where it a line|where it runoff/)
    expect(p.line, `${p.system} reads badly`).not.toMatch(/\b(districts|paths|nodes|edges) elements\b/)
    // "...where <clause>." — nothing may follow the clause but a full stop.
    expect(p.line.endsWith('.')).toBe(true)
  }
})

// OSM draws one place as many ways. Measured on central Bangkok: 28 ways, 7
// edge groups. Counting features reported "89 edges" where the Edges lens
// correctly said 37, and printed the same canal three times.
test('counts and citations are distinct places, not OSM way fragments', () => {
  const image = parseCityImage({ elements: [
    // One canal, drawn as five separate ways — as OSM actually delivers it.
    ...Array.from({ length: 5 }, (_, i) => ({
      type: 'way', id: 10 + i, tags: { waterway: 'canal', name: 'Long Canal' },
      geometry: [{ lat: 42.35 + i * 0.001, lon: -71.06 }, { lat: 42.351 + i * 0.001, lon: -71.06 }],
    })),
    { type: 'node', id: 30, tags: { place: 'neighbourhood', name: 'Quarter' }, lat: 42.34, lon: -71.05 },
  ] })
  const [housing] = projectSystems(image, ['housing'])
  expect(housing.line).toMatch(/Risk sits on 1 district\b/)
  const [drainage] = projectSystems(image, ['drainage'])
  expect(drainage.line).toMatch(/Risk sits on 1 barrier edge\b/)
  // The same name must not be cited three times.
  expect(drainage.citations.filter((c) => c.name === 'Long Canal')).toHaveLength(1)
  expect(new Set(drainage.citations.map((c) => c.name)).size).toBe(drainage.citations.length)
})

test('plural and singular nouns both read correctly', () => {
  const one = parseCityImage({ elements: [
    { type: 'node', id: 1, tags: { place: 'neighbourhood', name: 'Only' }, lat: 42.34, lon: -71.05 }] })
  const [housing] = projectSystems(one, ['housing'])
  expect(housing.line).toMatch(/Risk sits on 1 district /)
  expect(housing.line).not.toMatch(/1 districts/)

  const many = parseCityImage({ elements: [
    { type: 'node', id: 1, tags: { place: 'neighbourhood', name: 'A' }, lat: 42.34, lon: -71.05 },
    { type: 'node', id: 2, tags: { place: 'neighbourhood', name: 'B' }, lat: 42.33, lon: -71.05 }] })
  const [housingMany] = projectSystems(many, ['housing'])
  expect(housingMany.line).toMatch(/Risk sits on 2 districts /)
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
  // Caught live: the panel showed "limited sample" while also saying the image
  // was unavailable. A limited sample is a subset of something we read; here
  // there is nothing, and the two claims contradict each other.
  expect(drainage.limited).toBe(false)
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
  expect(drainage.line).toMatch(/no barrier edges were found in this window/i)
})

test('every system projects, not just the ones with edges', () => {
  const image = imageWithEdges()
  const projections = projectSystems(image, [...SYSTEM_IDS])
  expect(projections.length).toBe(SYSTEM_IDS.length)
  for (const p of projections) {
    expect(p.line.length).toBeGreaterThan(20)
  }
})