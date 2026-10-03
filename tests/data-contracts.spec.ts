import { expect, test } from '@playwright/test'
import { BANGKOK_LAYERS, layerDataTier } from '../src/config/bangkok-layers'
import { CITIES } from '../src/config/cities'

test('layer catalog has unique ids and an honest data tier', () => {
  const ids = BANGKOK_LAYERS.map((layer) => layer.id)
  expect(new Set(ids).size).toBe(ids.length)

  for (const layer of BANGKOK_LAYERS) {
    const tier = layerDataTier(layer)
    expect(['feed', 'reference', 'simulation', 'configured', 'pending']).toContain(tier)
    if (layer.status === 'pending') expect(tier).toBe('pending')
    if (tier !== 'feed') expect(layer.label).not.toMatch(/\bLIVE\b/i)
  }
})

test('city manifests use valid coordinates and non-negative comparison values', () => {
  expect(new Set(CITIES.map((city) => city.id)).size).toBe(CITIES.length)

  for (const city of CITIES) {
    const [lng, lat] = city.center
    const [west, south, east, north] = city.bbox
    expect(lng).toBeGreaterThanOrEqual(-180)
    expect(lng).toBeLessThanOrEqual(180)
    expect(lat).toBeGreaterThanOrEqual(-90)
    expect(lat).toBeLessThanOrEqual(90)
    expect(west).toBeLessThan(east)
    expect(south).toBeLessThan(north)
    expect(city.area_km2).toBeGreaterThan(0)
    expect(city.populationMillions).toBeGreaterThan(0)
    if (city.demographics) {
      for (const value of Object.values(city.demographics)) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
      }
    }
  }
})

test('static city KPI values do not claim runtime liveness', () => {
  for (const city of CITIES) {
    for (const kpi of city.kpis) {
      expect(`${kpi.label} ${kpi.value}`).not.toMatch(/\bLIVE\b/i)
    }
  }
})
