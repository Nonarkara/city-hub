import { test, expect } from '@playwright/test'
import {
  candidateToCityConfig,
  formatCityPopulation,
  formatPopulation,
  knownPopulation,
  populationDensityPerKm2,
  slugify,
  studyBbox,
  zoomForPopulation,
  type CityCandidate,
} from '../src/lib/city-facts'

function candidate(over: Partial<CityCandidate> = {}): CityCandidate {
  return {
    id: 'oslo-norway',
    name: 'Oslo',
    admin: 'Oslo',
    country: 'Norway',
    countryCode: 'NO',
    center: [10.7522, 59.9139],
    bbox: null,
    population: 709_000,
    timezone: 'Europe/Oslo',
    elevationM: 23,
    zoom: 12,
    sources: ['open-meteo'],
    ...over,
  }
}

/**
 * The regression this whole module exists for.
 *
 * `nominatimToCityConfig` used to emit `populationMillions: 1.0, // placeholder
 * — update after adding city`. Every consumer treated it as real: density per
 * km², the systems model, the twin, the comparison card. It shipped in the same
 * typeface as Bangkok's measured 5.455 with nothing to distinguish it.
 */
test('a city with no published population is unknown, never 1.0 million', () => {
  const config = candidateToCityConfig(candidate({ population: null }))
  expect(config.populationMillions).toBe(0)
  expect(config.populationSource).toBeUndefined()
  expect(formatCityPopulation(config)).toBe('—')
  expect(config.kpis.find((k) => k.label === 'POPULATION')?.value).toBe('Not published')
})

test('a real population is carried, scaled, and attributed to its source', () => {
  const config = candidateToCityConfig(candidate({ population: 709_000 }))
  expect(config.populationMillions).toBeCloseTo(0.709, 3)
  expect(config.populationSource).toBe('open-meteo')
  expect(config.elevationM).toBe(23)
  expect(config.adminRegion).toBe('Oslo')
  expect(formatPopulation(709_000)).toBe('709K')
  expect(formatPopulation(4_397_073)).toBe('4.40M')
  expect(formatPopulation(null)).toBe('Not published')
})

test('density is absent when either half is absent', () => {
  // population / area with an unknown population is a confident **0**, and "0
  // people per km²" is a measurement rather than an admission of ignorance.
  expect(populationDensityPerKm2({ populationMillions: 0, area_km2: 1564 })).toBeNull()
  expect(populationDensityPerKm2({ populationMillions: 5.455, area_km2: 0 })).toBeNull()
  // 5,455,000 / 1564 = 3488
  expect(populationDensityPerKm2({ populationMillions: 5.455, area_km2: 1564 })).toBe(3488)
})

test('a settlement figure is never dressed as a metro figure', () => {
  // Curated cities carry a metro / city-region number; Open-Meteo carries a
  // settlement. They are different quantities and the config says which.
  const generated = candidateToCityConfig(candidate({ population: 709_000 }))
  expect(generated.populationSource).toBe('open-meteo')
  // 709,000 people is the settlement, so it must not read as 709.00M.
  expect(generated.populationMillions).toBeLessThan(1)
})

test('zoom follows the size of the place, and stays inside a city image', () => {
  // A 4 km window is right for a capital. On a 800-person settlement the same
  // window is mostly fields and nothing reads.
  // A lower zoom is a wider view, so the bigger place gets the smaller number.
  expect(zoomForPopulation(5_900_000)).toBeLessThan(zoomForPopulation(800))
  expect(zoomForPopulation(800)).toBe(14)
  // Unknown population is not a reason to guess wider.
  expect(zoomForPopulation(null)).toBe(11)
  expect(zoomForPopulation(undefined)).toBe(11)
  // And it never widens into a regional read.
  expect(zoomForPopulation(50_000_000)).toBeGreaterThanOrEqual(11.5)
})

test('a derived study window matches the zoom the map will use', () => {
  // One question asked twice, not two different cities: the map must not be
  // showing one place while the city image quietly measures another.
  const widthOf = (zoom: number) => {
    const [w, , e] = studyBbox([10.7522, 59.9139], zoom)
    return e - w
  }
  expect(widthOf(11)).toBeGreaterThan(widthOf(14))
  const [w, s, e, n] = studyBbox([10.7522, 59.9139], 12)
  expect(w).toBeLessThan(10.7522)
  expect(e).toBeGreaterThan(10.7522)
  expect(s).toBeLessThan(59.9139)
  expect(n).toBeGreaterThan(59.9139)
})

test('a generated city is opened without a twin and says so', () => {
  const config = candidateToCityConfig(candidate())
  expect(config.tier).toBe('lite')
  expect(config.kpis.find((k) => k.label === 'SMART SCORE')?.value).toBe('NO TWIN')
  // Global feeds must still be available, or the city opens blank.
  expect(config.availableLayers.length).toBeGreaterThan(5)
  expect(config.availableLayers).toContain('sat-true-color')
  // The distinctiveness line promises what is actually true: the city image is
  // read from OSM and needs no curation.
  expect(config.distinctiveness).toContain('no local curation')
})

test('identity is stable across a search for the same place', () => {
  expect(slugify('San Salvador')).toBe('san-salvador')
  expect(slugify('São Paulo')).toBe('s-o-paulo')
  expect(candidate().id).toBe('oslo-norway')
  expect(knownPopulation(candidate({ population: 0 }))).toBeNull()
  expect(knownPopulation(candidate({ population: 1 }))).toBe(1)
})