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
test('transit is exposed by detached paths — capacity the city does not join', () => {
  // Lynch p.56–61: a line can be long, straight and heavily used and still not
  // be in the city's image. The exposure is detachment, not length, so the
  // binding must name the detached band rather than every named path.
  // ~1.3km end to end, comfortably past DETACHED_MIN_KM: detachment is a claim
  // about a prominent path, and a 400m lane would only ever be "sparse".
  const long = Array.from({ length: 120 }, (_, i) => ({
    type: 'way', id: 2_000 + i, tags: { highway: 'secondary', name: 'Elevated Spine' },
    geometry: [{ lat: 42.30 + i * 1e-4, lon: -71.10 }, { lat: 42.30 + (i + 1) * 1e-4, lon: -71.10 }],
  }))
  // A well-connected street for contrast: crossed by four others, so `linked`.
  const linked: Record<string, unknown>[] = [
    { type: 'way', id: 5_000, tags: { highway: 'secondary', name: 'Main Street' },
      geometry: [{ lat: 42.40, lon: -71.10 }, { lat: 42.40, lon: -71.09 }] },
  ]
  // 82m apart, so eight distinct junction places rather than one merged blob,
  // and 8 over 0.82km is 9.7/km — past LINKED_THRESHOLD_PER_KM.
  for (let i = 0; i < 8; i += 1) {
    linked.push({
      type: 'way', id: 5_100 + i, tags: { highway: 'tertiary', name: `Cross ${i}` },
      geometry: [{ lat: 42.399, lon: -71.0995 + i * 1e-3 }, { lat: 42.401, lon: -71.0995 + i * 1e-3 }],
    })
  }
  const image = parseCityImage({ elements: [...long, ...linked] })
  expect(image.pathSummary.detached).toBe(1)
  expect(image.pathSummary.linked).toBeGreaterThan(0)

  const [transit] = projectSystems(image, ['transit'])
  expect(transit.line).toContain('detached path')
  // The connected street is in the image but is not the exposure.
  expect(transit.citations.map((c) => c.name)).toEqual(['Elevated Spine'])
})

test('health is exposed where a junction works but cannot be recognised', () => {
  // Lynch p.72–76: Scollay Square was the switch point at Beacon Hill and no
  // one could remember it beyond the subway station. Reach counted only at
  // junctions a patient could find would flatter the network.
  const hub = { lat: 42.30, lon: -71.10 }
  const star = [
    { type: 'way', id: 3_000, tags: { highway: 'secondary', name: 'Alpha Road' }, geometry: [{ lat: hub.lat, lon: hub.lon - 0.01 }, hub] },
    { type: 'way', id: 3_001, tags: { highway: 'secondary', name: 'Beta Road' }, geometry: [hub, { lat: hub.lat, lon: hub.lon + 0.01 }] },
    { type: 'way', id: 3_002, tags: { highway: 'tertiary', name: 'Gamma Road' }, geometry: [hub, { lat: hub.lat + 0.01, lon: hub.lon }] },
  ]
  const image = parseCityImage({ elements: star }, 0, 'Testville')
  expect(image.nodeSummary.shapeless).toBe(1)

  const [health] = projectSystems(image, ['health'])
  expect(health.line).toContain('shapeless junction')
  expect(health.line).toContain('Lynch p.72–76')
  // The citation is the junction, not a district it happens to sit in.
  expect(health.citations).toHaveLength(1)
  expect(health.citations[0].structure).toBe('shapeless')
})
