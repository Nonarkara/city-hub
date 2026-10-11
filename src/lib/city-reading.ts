/**
 * What the bar is allowed to say.
 *
 * A satellite compare answers "what does it look like?" The bar answers a
 * different question, in one line, or it says plainly that the question is
 * the same for every city. Specific lines exist only where this product
 * actually has a finding. Everything else stays the comparative question,
 * rather than a postcard.
 */
import type { BasemapId, CityConfig } from '../config/cities'
import { DOPA_SUMMARY } from '../data/dopa-bkk'
import type { FrameStats } from './viewport-math'
import { fmtKm2 } from './viewport-math'

export const PRODUCT_VERSION = 'v7'

const CLAIMS: Record<string, string> = {
  bangkok:
    `The civil registry says ${DOPA_SUMMARY.districtsShrinking} of ${DOPA_SUMMARY.totalDistricts} districts are shrinking. Night lights got brighter in every one of them.`,
  'chiang-mai':
    'The old city is in a valley that traps smoke from the fields every burning season. The photograph is not the air.',
  phuket:
    'Millions of visits a year sit on a few hundred thousand residents. The pressure is the subject, not the beach.',
  kranj:
    'A small city measuring the gap between the economy it has and the one it is trying to build.',
}

export function cityClaim(city: CityConfig): string {
  return CLAIMS[city.id]
    ?? `${city.name}: the same questions as the others — what it is doing now, where the records disagree, and how it compares.`
}

export function peopleWords(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)} million`
  }
  if (n >= 1000) return `${Math.round(n / 1000)} thousand`
  return String(n)
}

/** One clause for the strip under the title. Updates as the map moves. */
export function viewClause(frame: FrameStats | null): string {
  if (!frame) return ''
  if (frame.wide) return 'This view is too wide to estimate.'
  const area = fmtKm2(frame.areaKm2)
  if (frame.peopleEst === null) return `This view is ${area}, outside the city box.`
  return `This view is ${area}, about ${peopleWords(frame.peopleEst)} people.`
}

/** Short name for the Look control. The full product name stays in the menu. */
export function lookLabel(id: BasemapId): string {
  switch (id) {
    case 'esri-imagery':
    case 'sentinel-cloudless':
    case 'nasa-true-color':
    case 'mapbox-sat-streets':
      return 'Satellite'
    case 'nasa-nightlights': return 'Night lights'
    case 'nasa-surface-temp': return 'Heat'
    case 'nasa-ndvi': return 'Vegetation'
    case 'nasa-aerosol': return 'Haze'
    case 'nasa-co': return 'Carbon monoxide'
    case 'nasa-so2': return 'Sulphur dioxide'
    case 'dark-vector': return 'Streets'
    default: return 'Look'
  }
}
