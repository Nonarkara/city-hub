/**
 * plan — turn the model into a plan.
 *
 * A model tells you where the gap is. A plan tells you what to do about it,
 * in what order, and — critically — what you should measure first.
 *
 * The planning logic here is deliberately conservative in one specific way:
 * it will NOT invent a benefit. Every intervention carries an `effectBasis`
 * that says whether the projected improvement is measured, derived, or
 * assumed. When it is assumed, the plan says so and marks the item
 * "measure first". A plan that ranks itself by optimism is worse than
 * no plan.
 *
 * Ordering rule, in priority:
 *   1. Systems over capacity — there is no slack to spend.
 *   2. Measurement debt — assumptions that would change the ranking.
 *   3. Tight systems — the ones that go over next.
 *
 * Within a system, interventions that REMOVE demand rank above interventions
 * that ADD capacity. Adding capacity to an over-subscribed network is how
 * cities end up with a deficit that grows. This is a heuristic, not a law,
 * and it is flagged as one.
 */
import type { Basis, CityAssessment, SystemModel } from './city-model'

export type InterventionKind = 'remove-demand' | 'add-capacity' | 'measure' | 'sequence'

export interface Intervention {
  id: string
  systemId: string
  systemLabel: string
  title: string
  /** What this actually does, mechanically. */
  mechanism: string
  kind: InterventionKind
  /** Why it is placed here in the order. */
  because: string
  /** What must be true for this to work. The precondition, stated. */
  precondition: string
  /** How the projected effect is known. Never claim more than you have. */
  effectBasis: Basis
  /** Where measurement debt exists, this is true and the plan says so. */
  measureFirst: boolean
  /** Rough time to effect, in planning terms. Not a schedule. */
  horizon: 'immediate' | '1–3y' | '3–10y' | 'structural'
}

export interface PlanStep {
  rank: number
  system: SystemModel
  interventions: Intervention[]
}

export interface CityPlan {
  cityId: string
  cityName: string
  steps: PlanStep[]
  /** Systems whose projection rests on an assumption. This is the audit list. */
  measurementDebt: string[]
  /** One sentence: what a planner should do first, and why. */
  openingMove: string
}

const KIND_LABEL: Record<InterventionKind, string> = {
  'remove-demand': 'REMOVE DEMAND',
  'add-capacity':  'ADD CAPACITY',
  'measure':       'MEASURE FIRST',
  'sequence':      'SEQUENCE',
}

/** Interventions per system. Ordered: remove-demand before add-capacity. */
const LEVERS: Record<string, Array<{ title: string; mechanism: string; kind: InterventionKind; horizon: Intervention['horizon'] }>> = {
  housing: [
    { title: 'Convert existing floor area instead of demolishing for new stock', mechanism: 'Adds dwellings without adding footprint; fastest route when vacant or under-tenanted space exists.', kind: 'remove-demand', horizon: '1–3y' },
    { title: 'Lift occupancy in under-tenanted central stock', mechanism: 'Absorbs households in stock that already exists and is already serviced.', kind: 'remove-demand', horizon: 'immediate' },
    { title: 'Secure tenure on rental stock before new supply', mechanism: 'Prevents the vacancy a new-supply programme eventually produces being taken by price rather than by plan.', kind: 'sequence', horizon: 'structural' },
  ],
  water: [
    { title: 'Fix leakage before adding treatment', mechanism: 'In a network losing a third of output to leakage, recovered volume is cheaper than new capacity and arrives in months not years.', kind: 'remove-demand', horizon: '1–3y' },
    { title: 'Reuse treated wastewater for industry', mechanism: 'Diverts a potable-grade volume out of the potable system.', kind: 'remove-demand', horizon: '3–10y' },
    { title: 'Meter non-domestic supply properly', mechanism: 'Industrial demand is flat-rate in most cities, which hides the actual shape of the peak.', kind: 'add-capacity', horizon: '1–3y' },
  ],
  drainage: [
    { title: 'Put detention upstream, before the network', mechanism: 'Retention at the catchment head attenuates the hydrograph, which is cheaper than upsizing pipes for the same peak reduction.', kind: 'remove-demand', horizon: '3–10y' },
    { title: 'Restore canal storage volume', mechanism: 'Removing a canal cover converted a storage volume into a conveyance pipe; reopening it returns the volume.', kind: 'add-capacity', horizon: '3–10y' },
    { title: 'Measure the design return period first', mechanism: 'This row is a placeholder. Until the city states its own design storm, no drainage investment case can be checked.', kind: 'measure', horizon: 'immediate' },
  ],
  transit: [
    { title: 'Frequency before span', mechanism: 'A bus every 15 minutes is a different product from one every 5 at the same route length. Frequency wins riders; span does not.', kind: 'add-capacity', horizon: '1–3y' },
    { title: 'Land-use density around existing stations', mechanism: 'Ridership follows walkable density, not line reach. Density already near a station is the cheapest catchment there is.', kind: 'remove-demand', horizon: 'structural' },
    { title: 'Fare integration before new infrastructure', mechanism: 'The transfer penalty is often the binding constraint on a multimodal trip and costs a fraction of a line.', kind: 'remove-demand', horizon: '1–3y' },
  ],
  air: [
    { title: 'Control the source, not the exposure', mechanism: 'Emissions control moves the concentration; monitoring only measures it.', kind: 'remove-demand', horizon: '3–10y' },
    { title: 'Ventilation corridor policy on the worst streets', mechanism: 'Street geometry changes near-road concentration measurably and costs nothing once adopted.', kind: 'remove-demand', horizon: '1–3y' },
    { title: 'Filter at the buildings that matter', mechanism: 'Schools and clinics first — a HEPA unit in a classroom beats a monitor that only reports the problem.', kind: 'add-capacity', horizon: 'immediate' },
  ],
  heat: [
    { title: 'Canopy, not lawn', mechanism: 'Mature trees deliver more evapotranspiration and shade per square metre than turf.', kind: 'add-capacity', horizon: '3–10y' },
    { title: 'Cool roofs on the existing stock', mechanism: 'The cheapest measurable heat intervention in a dense, mostly low-rise fabric.', kind: 'remove-demand', horizon: '1–3y' },
    { title: 'Shade the routes people actually walk', mechanism: 'Route to school and to transit, not an even district-wide allocation.', kind: 'remove-demand', horizon: '1–3y' },
  ],
  health: [
    { title: 'Ambulatory capacity before inpatient beds', mechanism: 'Most demand is not an overnight stay; inpatient beds are the expensive and slow answer to it.', kind: 'add-capacity', horizon: '1–3y' },
    { title: 'Staff before buildings', mechanism: 'An unstaffed bed is not a bed. Occupancy is the number that matters under surge.', kind: 'add-capacity', horizon: '3–10y' },
    { title: 'Plan by travel time, not by ward line', mechanism: 'A ward that is near a hospital it cannot use is not served by it.', kind: 'sequence', horizon: '3–10y' },
  ],
  waste: [
    { title: 'Separate organics at source', mechanism: 'Heaviest and wettest fraction; diverting it removes the largest load from the collection route.', kind: 'remove-demand', horizon: '1–3y' },
    { title: 'Formalise the informal sector rather than displacing it', mechanism: 'The collection capacity and the route knowledge already exist in the informal sector.', kind: 'add-capacity', horizon: '1–3y' },
    { title: 'Waste-to-energy only after diversion', mechanism: 'It burns whatever the diversion programme failed to capture, which is a reason to build diversion first.', kind: 'sequence', horizon: 'structural' },
  ],
}

const KIND_RANK: Record<InterventionKind, number> = {
  'measure': 0, 'remove-demand': 1, 'add-capacity': 2, 'sequence': 3,
}

export function kindLabel(k: InterventionKind): string { return KIND_LABEL[k] }

export function buildPlan(a: CityAssessment): CityPlan {
  const steps: PlanStep[] = []

  // 1. Systems under pressure, worst utilisation first.
  const underPressure = a.systems
    .filter((s) => s.id !== 'transit')
    .filter((s) => s.pressure === 'over' || s.pressure === 'tight')
    .slice()
    .sort((x, y) => y.utilisation - x.utilisation)

  // 2. Transit is special-cased: read downward, and it belongs in the plan
  //    whenever the city is below benchmark.
  const transit = a.systems.find((s) => s.id === 'transit')
  const transitShort = transit && transit.pressure === 'over' ? transit : null

  const ordered = transitShort ? [transitShort, ...underPressure] : underPressure

  ordered.forEach((system, i) => {
    const levers = LEVERS[system.id] ?? []
    const interventions: Intervention[] = levers
      .slice()
      .sort((x, y) => KIND_RANK[x.kind] - KIND_RANK[y.kind])
      .map((lv, j) => ({
        id: `${system.id}-${j}`,
        systemId: system.id,
        systemLabel: system.label,
        title: lv.title,
        mechanism: lv.mechanism,
        kind: lv.kind,
        because: j === 0
          ? (lv.kind === 'measure'
              ? 'The projection for this system rests on an assumption. Everything downstream of it is unverified.'
              : `This system is at ${Math.round(system.utilisation * 100)}% of capacity, so removing demand beats adding supply.`)
          : `Once the first move lands, this is the next thing that moves the same number.`,
        precondition: system.caveat,
        effectBasis: system.id === 'transit' ? 'assumed' : system.basis,
        measureFirst: lv.kind === 'measure' || system.basis === 'assumed',
        horizon: lv.horizon,
      }))
    steps.push({ rank: i + 1, system, interventions })
  })

  const measurementDebt = a.systems
    .filter((s) => s.capacity.basis === 'assumed' || s.demand.basis === 'assumed')
    .map((s) => `${s.label}: ${s.caveat.split('.')[0]}.`)

  const first = steps[0]
  const openingMove = first
    ? `${a.cityName}: start with ${first.system.label.toLowerCase()} — ${first.system.verdict}`
    : `${a.cityName}: no system is over capacity on the assumptions used. Fix the assumptions first; the quiet row is the one nobody measured.`

  return {
    cityId: a.cityId,
    cityName: a.cityName,
    steps,
    measurementDebt,
    openingMove,
  }
}