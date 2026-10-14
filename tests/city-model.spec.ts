import { expect, test } from '@playwright/test'
import { modelCity, assessCity, fmtCoefficient, NORMS } from '../src/lib/city-model'
import { buildPlan } from '../src/lib/plan'
import { synthesizeBaseline } from '../src/lib/city-baseline'
import { CITIES } from '../src/config/cities'

const bangkok = CITIES.find((c) => c.id === 'bangkok')!
const kranj = CITIES.find((c) => c.id === 'kranj')!

test('every modelled system declares both sides with a basis and a caveat', () => {
  for (const city of [bangkok, kranj]) {
    const systems = modelCity(city)
    expect(systems.length).toBe(8)
    for (const s of systems) {
      expect(s.capacity.value).toBeGreaterThan(0)
      expect(s.demand.value).toBeGreaterThan(0)
      expect(['measured', 'derived', 'assumed']).toContain(s.capacity.basis)
      expect(['measured', 'derived', 'assumed']).toContain(s.demand.basis)
      expect(s.caveat.length).toBeGreaterThan(20)
      expect(s.levers.length).toBeGreaterThan(0)
      expect(Number.isFinite(s.utilisation)).toBe(true)
      expect(['ok', 'watch', 'tight', 'over']).toContain(s.pressure)
    }
  }
})

test('utilisation equals demand over capacity for every row', () => {
  const systems = modelCity(bangkok)
  for (const s of systems) {
    expect(s.utilisation).toBeCloseTo(s.demand.value / s.capacity.value, 2)
  }
})

test('pressure classification follows the thresholds', () => {
  const systems = modelCity(bangkok)
  for (const s of systems) {
    if (s.utilisation > 1.0) expect(s.pressure).toBe('over')
    else if (s.utilisation > 0.9) expect(s.pressure).toBe('tight')
    else if (s.utilisation > 0.75) expect(s.pressure).toBe('watch')
    else expect(s.pressure).toBe('ok')
  }
})

test('transit is excluded from the mean and from the ranked list', () => {
  const a = assessCity(bangkok)
  expect(a.ranked.find((s) => s.id === 'transit')).toBeUndefined()
  expect(a.ranked.length).toBe(7)
})

test('the ranked list is ordered by descending utilisation', () => {
  const a = assessCity(bangkok)
  for (let i = 1; i < a.ranked.length; i++) {
    expect(a.ranked[i - 1].utilisation).toBeGreaterThanOrEqual(a.ranked[i].utilisation)
  }
})

test('every step in the plan carries a mechanism, a precondition and a reason', () => {
  const plan = buildPlan(assessCity(bangkok))
  expect(plan.steps.length).toBeGreaterThan(0)
  for (const step of plan.steps) {
    expect(step.interventions.length).toBeGreaterThan(0)
    for (const iv of step.interventions) {
      expect(iv.mechanism.length).toBeGreaterThan(10)
      expect(iv.precondition.length).toBeGreaterThan(20)
      expect(iv.because.length).toBeGreaterThan(10)
      expect(['measure', 'remove-demand', 'add-capacity', 'sequence']).toContain(iv.kind)
    }
  }
})

test('measure-first interventions sort ahead of everything else inside a step', () => {
  const plan = buildPlan(assessCity(bangkok))
  const order = { measure: 0, 'remove-demand': 1, 'add-capacity': 2, sequence: 3 }
  for (const step of plan.steps) {
    const kinds = step.interventions.map((i) => order[i.kind])
    for (let i = 1; i < kinds.length; i++) expect(kinds[i - 1]).toBeLessThanOrEqual(kinds[i])
  }
})

test('any step resting on an assumption is marked measure-first', () => {
  const plan = buildPlan(assessCity(bangkok))
  for (const step of plan.steps) {
    if (step.system.capacity.basis === 'assumed') {
      expect(step.interventions.some((i) => i.measureFirst)).toBe(true)
    }
  }
})

test('measurement debt names every row that rests on an assumption', () => {
  const a = assessCity(bangkok)
  const plan = buildPlan(a)
  const expected = a.systems.filter(
    (s) => s.capacity.basis === 'assumed' || s.demand.basis === 'assumed',
  ).map((s) => s.label)
  expect(plan.measurementDebt.length).toBe(expected.length)
  for (const label of expected) {
    expect(plan.measurementDebt.some((d) => d.startsWith(`${label}:`))).toBe(true)
  }
})

test('heat is not inverted — a green city must not read as a heat crisis', () => {
  // Capacity is green on the ground, demand is the green the norm requires.
  // More green than required is headroom, so utilisation must fall below 1.
  const heat = modelCity(bangkok).find((s) => s.id === 'heat')!
  const greenPct = bangkok.demographics?.greenSpacePct ?? 0
  expect(heat.capacity.value).toBeCloseTo(bangkok.area_km2 * 1e6 * (greenPct / 100), -3)
  expect(heat.demand.value).toBeCloseTo(9 * bangkok.populationMillions * 1e6, -3)
  expect(heat.utilisation).toBeCloseTo(heat.demand.value / heat.capacity.value, 2)
  if (greenPct >= 9) {
    expect(heat.utilisation).toBeLessThan(1)
    expect(heat.pressure).not.toBe('over')
  }
})

test('the placeholder drainage row is not reported as over capacity', () => {
  const drainage = modelCity(bangkok).find((s) => s.id === 'drainage')!
  expect(drainage.pressure).not.toBe('over')
  expect(drainage.caveat.toLowerCase()).toContain('design storm')
})

test('no row claims to be measured when it is not', () => {
  for (const city of CITIES) {
    for (const s of modelCity(city)) {
      if (s.capacity.basis !== 'measured') {
        expect(s.caveat).not.toBe('')
        expect(s.role.length).toBeGreaterThan(0)
      }
    }
  }
})

test('the plan opens with a sentence naming a city and a move', () => {
  const plan = buildPlan(assessCity(kranj))
  expect(plan.openingMove).toContain('Kranj')
  expect(plan.openingMove.length).toBeGreaterThan(20)
})

test('coefficients render with their unit intact', () => {
  expect(fmtCoefficient({ value: 3, unit: 'beds/1,000', basis: 'assumed', source: 's' })).toBe('3 beds/1,000')
  expect(fmtCoefficient({ value: 1e6, unit: 'L/day', basis: 'derived', source: 's' })).toContain('L/day')
})

test('norms are all declared as assumptions, never measurements', () => {
  for (const norm of Object.values(NORMS)) {
    expect(norm.basis).toBe('assumed')
    expect(norm.source.length).toBeGreaterThan(5)
  }
})

test('the hazard baseline assigns every city at least one hazard', () => {
  for (const city of CITIES) {
    const b = synthesizeBaseline(city)
    expect(b.hazards.length).toBeGreaterThan(0)
    expect(b.primary).toBe(b.hazards[0].kind)
    expect(b.briefing).toContain(city.name)
    expect(b.current).toEqual({})
    expect(b.observedAt).toBeNull()
  }
})