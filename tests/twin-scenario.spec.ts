import { test, expect } from '@playwright/test'
import { CITIES } from '../src/config/cities'
import { greenScenario } from '../src/lib/twin-scenario'

const city = CITIES.find((candidate) => candidate.id === 'bangkok')!

test('green scenario conserves area and accounts for population change', () => {
  const base = greenScenario(city, 0, 0)
  expect(base.scenarioM2PerPerson).toBeCloseTo(city.demographics!.greenSpaceM2PerPerson!)
  const more = greenScenario(city, 10, 20)
  expect(more.addedM2).toBe(100_000)
  expect(more.scenarioPopulation).toBeCloseTo(city.populationMillions * 1e6 * 1.2)
  expect(more.scenarioM2PerPerson).toBeCloseTo((base.baselineM2PerPerson! * city.populationMillions * 1e6 + 100_000) / more.scenarioPopulation)
})

test('missing reference stays unknown and impossible inputs are rejected', () => {
  expect(greenScenario({ ...city, demographics: undefined }, 10, 0).scenarioM2PerPerson).toBeNull()
  expect(() => greenScenario(city, Infinity, 0)).toThrow()
  expect(() => greenScenario(city, city.area_km2 * 100 + 1, 0)).toThrow()
  expect(() => greenScenario(city, 0, -100)).toThrow()
})
