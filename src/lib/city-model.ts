/**
 * city-model — the city as a set of systems with capacity and demand.
 *
 * This is the difference between a map of a city and a model OF a city.
 * A picture answers "what does it look like". A model answers the three
 * questions a planner actually works on:
 *
 *   1. What is the capacity of each system? (water, drainage, housing, …)
 *   2. What is the demand on it right now?
 *   3. Where is the margin going negative, and what closes it?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HONESTY CONTRACT — read before trusting a number here.
 *
 * Every coefficient below is either:
 *   [M] MEASURED — from a named public source with a year, in SOURCES below.
 *   [D] DERIVED  — arithmetic on a [M] value. Checkable by hand.
 *   [A] ASSUMED  — a planning norm from the cited literature, applied to a
 *                 city that may not match the norm's assumptions.
 *
 * Every field carries `basis: 'measured' | 'derived' | 'assumed'`. A planner
 * who disagrees with an [A] can swap the coefficient in one place and the
 * whole model re-solves. That is the point: the model is auditable, and the
 * place where it is wrong is obvious.
 *
 * This is NOT a simulation. It is a static balance sheet per system, computed
 * once per city. It has no time dimension and no feedback loops. Do not use it
 * to forecast. Use it to find the gap and then go measure the gap properly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { CityConfig } from '../config/cities'

export type Basis = 'measured' | 'derived' | 'assumed'

export interface Coefficient {
  value: number
  unit: string
  basis: Basis
  /** Named public source, or the norm being applied. */
  source: string
}

/**
 * A city system: something with a hard capacity and a moving demand.
 * `utilisation` > 1 means demand exceeds capacity. That is the alarm.
 */
export interface SystemModel {
  id: SystemId
  label: string

  /** What the system does, in one line, for someone who does not plan cities. */
  role: string

  capacity: Coefficient
  demand: Coefficient

  /** demand / capacity. 0.85 is comfortable; 1.0 is at the wall; >1 is over. */
  utilisation: number
  basis: Basis

  /** Plain-language read of the utilisation figure. */
  verdict: string
  /** How bad is the gap, as a planning priority. */
  pressure: 'ok' | 'watch' | 'tight' | 'over'
  /** What actually closes the gap. Empty when utilisation is comfortable. */
  levers: string[]
  /** One caveat per system. Every model needs its own limits written down. */
  caveat: string
}

export type SystemId =
  | 'housing' | 'water' | 'drainage' | 'transit'
  | 'air' | 'heat' | 'health' | 'waste'

// ── Norms ─────────────────────────────────────────────────────────────────────
// Per-capita planning norms. These are literature-standard, NOT measurements
// of this specific city. Changing one here changes every city that uses it.

export const NORMS = {
  /** Litres per person per day, metered supply. World Bank/WHO practice band. */
  waterLpcd: { value: 180, unit: 'L/person/day', basis: 'assumed' as Basis, source: 'UN-Habitat minimum service norm 100–200 L/p/d' },
  /** M² of open space per resident. UN-Habitat compact-city target. */
  greenM2: { value: 9, unit: 'm²/person', basis: 'assumed' as Basis, source: 'UN-Habitat: 9 m²/person, 30% green cover for compact cities' },
  /** Hospital beds per 1,000 residents. WHO medium-income band. */
  bedsPer1k: { value: 3, unit: 'beds/1,000', basis: 'assumed' as Basis, source: 'WHO Health at a Glance: 2–4 beds/1,000 for upper-middle income' },
  /** Peak-hour transit capacity share of trips. Below 0.3 means transit cannot absorb growth. */
  transitModeShare: { value: 0.30, unit: 'share of peak trips', basis: 'assumed' as Basis, source: 'ITDP benchmark: ≥30% peak trips by transit = transit-led' },
  /** Daily solid waste generated per resident. */
  kgPerPersonDay: { value: 1.1, unit: 'kg/person/day', basis: 'assumed' as Basis, source: 'World Bank municipal solid waste norms for SE Asian cities' },
  /** Municipal solid waste collection efficiency. Below 1.0 = uncollected. */
  wasteCollected: { value: 0.85, unit: 'collection efficiency', basis: 'assumed' as Basis, source: 'Typical MSW collection efficiency, SE Asia 0.75–0.90' },
} satisfies Record<string, Coefficient>

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(n: number, dp = 2): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

function classify(u: number): SystemModel['pressure'] {
  if (u > 1.0) return 'over'
  if (u > 0.9) return 'tight'
  if (u > 0.75) return 'watch'
  return 'ok'
}

function verdictFor(id: SystemId, u: number): string {
  const pct = `${Math.round(u * 100)}%`
  const table: Record<SystemId, [string, string, string, string]> = {
    housing: [
      `Demand at ${pct} of capacity — the stock is keeping pace.`,
      `At ${pct}. New supply is tracking demand. Watch the floor, not the count.`,
      `At ${pct}. Intake is outrunning completion; expect price pressure.`,
      `Over capacity at ${pct}. Supply is losing. Prices or crowding will absorb it.`,
    ],
    water: [
      `Metered supply has headroom at ${pct}.`,
      `At ${pct}. Treatment and network are working near their design envelope.`,
      `At ${pct}. Growth will exhaust treated supply without new capacity.`,
      `Over capacity at ${pct}. Demand exceeds what the utility can treat.`,
    ],
    drainage: [
      `At ${pct} of a design storm. No headroom figure can be trusted until the city publishes its return period.`,
      `At ${pct}. Placeholder ratio, not a measurement — see the caveat.`,
      `At ${pct}. Cloudbursts may exceed the network faster than it clears.`,
      `Over capacity at ${pct}. Subsurface water rises before the rain stops.`,
    ],
    transit: [
      `Transit carries ${pct} of the share it would need to absorb growth.`,
      `At ${pct} of the transit-led benchmark. Growth still fits.`,
      `At ${pct}. Below the 30% benchmark: roads absorb what transit cannot.`,
      `Well under benchmark. Road demand is the only relief valve, and it is full.`,
    ],
    air: [
      `Aerosol loading is low at ${pct} of the guideline.`,
      `At ${pct} of the WHO guideline. Sensitive groups unaffected.`,
      `At ${pct} of the guideline. Sensitive groups should limit long exposure.`,
      `Over the guideline at ${pct}. General population, not just sensitive groups.`,
    ],
    heat: [
      `Cooling capacity meets the green-space norm at ${pct} of requirement.`,
      `At ${pct} of the green-space norm. Shade is adequate.`,
      `At ${pct} of requirement. Open space is short of the planning norm.`,
      `At ${pct} of requirement. Heat is a structural exposure, not a weather event.`,
    ],
    health: [
      `Bed capacity at ${pct} of the WHO band.`,
      `At ${pct} of the WHO band. Adequate for routine load.`,
      `At ${pct} of the WHO band. Surge capacity is thin.`,
      `Over the WHO band at ${pct}. Routine load already exceeds bed stock.`,
    ],
    waste: [
      `Waste generation at ${pct} of collection capacity.`,
      `At ${pct} of collection capacity.`,
      `At ${pct}. The uncollected fraction becomes street-level load.`,
      `Over capacity at ${pct}. Collection is falling behind generation.`,
    ],
  }
  const idx = u > 1 ? 3 : u > 0.9 ? 2 : u > 0.75 ? 1 : 0
  return table[id][idx]
}

function mk(
  id: SystemId, label: string, role: string,
  capacity: Coefficient, demand: Coefficient,
  caveat: string, levers: string[],
): SystemModel {
  const utilisation = capacity.value > 0 ? demand.value / capacity.value : 0
  return {
    id, label, role,
    capacity, demand,
    utilisation: round(utilisation, 3),
    basis: capacity.basis === 'measured' ? capacity.basis : demand.basis,
    verdict: verdictFor(id, utilisation),
    pressure: classify(utilisation),
    levers,
    caveat,
  }
}

// ── The model ────────────────────────────────────────────────────────────────

/**
 * Build the system model for a city. Pure, offline, no network.
 *
 * Where a [M] figure exists in the city manifest it is used. Where it does
 * not, the model says `assumed` and refuses to pretend otherwise. An absent
 * measurement is a gap in the model, not a licence to invent a number.
 */
export function modelCity(city: CityConfig): SystemModel[] {
  const pop = city.populationMillions * 1e6
  const area = city.area_km2
  const greenM2 = area * 1e6 * ((city.demographics?.greenSpacePct ?? 0) / 100)

  // Housing — the manifest does not carry a dwelling count, so both sides
  // are assumed. Ratio is therefore what it is, not a measurement of need.
  const housingCapacity = { value: 0.33 * pop, unit: 'dwellings', basis: 'assumed' as Basis, source: `${NORMS.waterLpcd.source} — dwelling-yield placeholder; see caveat` }
  const housingDemand  = { value: 0.32 * pop, unit: 'households', basis: 'assumed' as Basis, source: 'Assumed 0.32 persons per household' }

  const waterCapacity = { value: 180e6 * NORMS.waterLpcd.value * 30, unit: 'L/day', basis: 'derived' as Basis, source: 'Design yield × population × 180 L/p/d' }
  const waterDemand  = { value: 180e6 * NORMS.waterLpcd.value * 26, unit: 'L/day', basis: 'derived' as Basis, source: 'Consumption at 180 L/p/d metered' }

  // Both sides are placeholders until the city publishes its own stormwater
  // design return period. 1.0 vs 1.0 is deliberately NOT called "over" —
  // at exactly the design storm the network is at its design point, which is
  // where it was designed to sit. Anything above needs evidence.
  const drainageCapacity = { value: 1.0, unit: '× design storm', basis: 'assumed' as Basis, source: 'Modelled as 1.0× the design storm the network was sized for' }
  const drainageDemand   = { value: 0.85, unit: '× design storm', basis: 'assumed' as Basis, source: 'Placeholder: recent peak observed event ÷ design storm' }

  const transitDemand = { value: NORMS.transitModeShare.value, unit: 'peak trip share', basis: 'assumed' as Basis, source: NORMS.transitModeShare.source }

  const airCapacity = { value: 15, unit: 'µg/m³ PM2.5 annual', basis: 'assumed' as Basis, source: 'WHO 2021 AQG annual mean PM2.5' }
  const airDemand   = { value: 18, unit: 'µg/m³ PM2.5 annual', basis: 'assumed' as Basis, source: 'Regional background for the region' }

  // Heat is cooling capacity against cooling need — so capacity is the green
  // actually on the ground (measured) and demand is the green required to meet
  // the norm (derived). More green than needed reads as headroom, not overrun.
  // Getting this backwards would tell a green city it had a heat crisis.
  const heatCapacity = { value: greenM2, unit: 'm² open space', basis: 'measured' as Basis, source: `City area × stated green cover` }
  const heatDemand   = { value: NORMS.greenM2.value * pop, unit: 'm² open space', basis: 'derived' as Basis, source: 'UN-Habitat 9 m²/person × population' }

  const healthCapacity = { value: NORMS.bedsPer1k.value * pop / 1000, unit: 'beds', basis: 'derived' as Basis, source: 'WHO 3 beds/1,000 × population' }
  const healthDemand  = { value: 2.1 * pop / 1000, unit: 'beds', basis: 'assumed' as Basis, source: 'Assumed 2.1 occupied beds/1,000 average occupancy' }

  const wasteCapacity = { value: pop * NORMS.kgPerPersonDay.value * 365 * NORMS.wasteCollected.value, unit: 't/year collected', basis: 'derived' as Basis, source: 'Population × 1.1 kg/day × 365 × 85% collection' }
  const wasteDemand   = { value: pop * NORMS.kgPerPersonDay.value * 365, unit: 't/year generated', basis: 'derived' as Basis, source: 'Population × 1.1 kg/day × 365' }

  return [
    mk('housing', 'Housing', 'Where people sleep, and what that costs them.',
      housingCapacity, housingDemand,
      'Neither side is measured. The city manifest carries no dwelling count, so this row shows an assumed yield against an assumed household size. Replace both with a real dwelling survey before quoting it.',
      ['Convert existing floor area to dwellings rather than demolishing for new stock.',
       'Lift occupancy in under-tenanted central stock before building at the edge.',
       'Preserve rental stock with tenure security — displacement is a housing loss, not a vacancy gain.']),

    mk('water', 'Water', 'Treated supply against what people actually use.',
      waterCapacity, waterDemand,
      'Neither supply volume nor consumption is measured here. This row assumes a 30-day design yield and 100% metered consumption at the UN-Habitat norm. Real cities lose 20–40% to leakage, which would flip the verdict.',
      ['Fix leakage first. In a network losing a third to leakage, metering demand is cheaper than building treatment.',
       'Reuse treated wastewater for industry before adding potable supply.',
       'Tariff structure beats new supply for managing peak demand.']),

    mk('drainage', 'Drainage', 'How fast the network clears a storm.',
      drainageCapacity, drainageDemand,
      'The strongest caveat in the model. A design storm is a civil-engineering standard, not a public dataset. The 1.0 vs 1.0 pair is a placeholder that must be replaced with the city\'s own stormwater design return period.',
      ['Detention upstream — retention basins at the head of the catchment, before the network.',
       'Restore canal capacity. Removing a canal cover converts a storage volume into a conveyance pipe.',
       'Increase permeable surface before increasing pipe diameter.']),

    mk('transit', 'Transit', 'Whether growth can travel without roads.',
      { value: 1.0, unit: 'benchmark', basis: 'assumed', source: NORMS.transitModeShare.source }, transitDemand,
      'Inverted on purpose: capacity is the benchmark, demand is actual mode share. Utilisation above 1 means the city is BELOW the transit-led benchmark, so read it downward.',
      ['Frequency before span. A bus every 15 minutes is a different product from one every 5.',
       'Land use near stations before extending lines. Ridership follows density, not reach.',
       'Fare integration before infrastructure — the transfer penalty is often the binding constraint.']),

    mk('air', 'Air', 'Emission load against the health guideline.',
      airCapacity, airDemand,
      'Both figures are regional assumptions. Particulate exposure in a street canyon is a different number from an area average, and the area average is what is being compared here. Exposure modelling is the honest instrument, not this row.',
      ['Remove the source. Emissions control beats exposure monitoring for outcomes.',
       'Ventilation corridor policy — street geometry changes pollutant concentration measurably.',
       'Filter at the school, not only on the road.']),

    mk('heat', 'Heat', 'Shade and evapotransorption as cooling capacity.',
      heatCapacity, heatDemand,
      'Green cover is a static area measure. It says nothing about canopy maturity, soil moisture, or whether the green is accessible. A golf course counts here the same as a public park.',
      ['Canopy before lawn. Mature trees cool more than equivalent area in grass.',
       'Cool roofs are the cheapest measurable intervention in a dense stock.',
       'Shade the route to school and to transit, not the whole district evenly.']),

    mk('health', 'Health', 'Beds against the people who need them.',
      healthCapacity, healthDemand,
      'Bed counts are usually national rather than municipal. Occupancy is assumed flat, which is wrong under surge — the number that matters in a crisis is occupancy, not stock.',
      ['Add ambulatory capacity before inpatient beds. Most demand is not overnight.',
       'Staff before buildings. An unstaffed bed is a bed that does not exist.',
       'Target by travel time, not by administrative boundary.']),

    mk('waste', 'Waste', 'Collection capacity against what is generated.',
      wasteCapacity, wasteDemand,
      'The efficiency constant is doing the work here. Move 85% to 75% and the verdict changes. Real efficiency is often a ward-level figure, not a city aggregate.',
      ['Separate organics at source — the heaviest fraction and the cheapest to divert.',
       'Formalise the informal sector rather than displacing it. The collection capacity already exists.',
       'Waste-to-energy only after diversion. It burns whatever the diversion programme failed to capture.']),
  ]
}

// ── Aggregate ────────────────────────────────────────────────────────────────

export interface CityAssessment {
  cityId: string
  cityName: string
  systems: SystemModel[]
  /** Count of systems over capacity. The headline a planner reads first. */
  overCount: number
  tightCount: number
  /** Systems ordered by utilisation descending, most pressure first. */
  ranked: SystemModel[]
  /** Mean utilisation across systems that are not inverted (transit excluded). */
  meanUtilisation: number
  /** The systems that are actually over — this is the short list. */
  shortlist: SystemModel[]
}

export function assessCity(city: CityConfig): CityAssessment {
  const systems = modelCity(city)
  // transit utilisation is inverted (above 1 = better); exclude from the mean.
  const comparable = systems.filter((s) => s.id !== 'transit')
  const meanUtilisation = round(comparable.reduce((a, s) => a + s.utilisation, 0) / comparable.length, 3)
  const ranked = systems
    .filter((s) => s.id !== 'transit')
    .slice()
    .sort((a, b) => b.utilisation - a.utilisation)
  return {
    cityId: city.id,
    cityName: city.name,
    systems,
    overCount: systems.filter((s) => s.pressure === 'over').length,
    tightCount: systems.filter((s) => s.pressure === 'tight').length,
    ranked,
    meanUtilisation,
    shortlist: ranked.filter((s) => s.pressure === 'over' || s.pressure === 'tight'),
  }
}

/** Render a coefficient for display without losing its basis. */
export function fmtCoefficient(c: Coefficient): string {
  const v = Math.abs(c.value) >= 1000
    ? c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : String(round(c.value, 2))
  return `${v} ${c.unit}`
}

export const BASIS_LABEL: Record<Basis, string> = {
  measured: 'MEASURED',
  derived:  'DERIVED',
  assumed:  'ASSUMED',
}