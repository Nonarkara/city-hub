import type { CityConfig } from '../config/cities'

/** Land accounting only: no inferred cooling, health, income or accessibility effect. */
export function greenScenario(city: CityConfig, addedHectares: number, populationChangePct: number) {
  if (!Number.isFinite(addedHectares) || addedHectares < 0 || addedHectares > city.area_km2 * 100) {
    throw new Error('Added green area must fit inside the city boundary')
  }
  if (!Number.isFinite(populationChangePct) || populationChangePct < -50 || populationChangePct > 100) {
    throw new Error('Population change must be between -50% and 100%')
  }
  const population = city.populationMillions * 1e6
  const baseline = city.demographics?.greenSpaceM2PerPerson ?? null
  const scenarioPopulation = population * (1 + populationChangePct / 100)
  const addedM2 = addedHectares * 10_000
  return {
    baselineM2PerPerson: baseline,
    scenarioPopulation,
    addedM2,
    addedM2PerPerson: addedM2 / scenarioPopulation,
    scenarioM2PerPerson: baseline == null ? null : (baseline * population + addedM2) / scenarioPopulation,
    landSharePct: addedM2 / (city.area_km2 * 1e6) * 100,
  }
}
