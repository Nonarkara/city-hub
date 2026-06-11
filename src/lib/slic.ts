/**
 * SLIC Index integration — proprietary 5-pillar AMPI scoring for 163 cities.
 *
 * Data source: src/data/slic-cityhub.ts, a compact publishable snapshot copied
 * from slic-index v3.4.0 on 2026-05-26. Re-runs offline; no fetch required.
 *
 * The AMPI formula is Dr Non Arkaraprasertkul's proprietary methodology.
 * UNL has no equivalent. This is the structural intelligence layer that
 * makes City Hub a brain, not a dashboard.
 */
import { CITY_HUB_SLIC, type CityHubSlicScore } from '../data/slic-cityhub'

export type PillarId = 'pressure' | 'viability' | 'capability' | 'community' | 'creative'

export const PILLAR_ORDER: PillarId[] = ['pressure', 'viability', 'capability', 'community', 'creative']

export const PILLAR_WEIGHTS: Record<PillarId, number> = {
  pressure: 25,
  viability: 22,
  capability: 18,
  community: 15,
  creative: 20,
}

/**
 * What each pillar actually means — for tooltips, narrative grounding.
 */
export const PILLAR_LABELS: Record<PillarId, string> = {
  pressure: 'GROWTH',
  viability: 'VIABILITY',
  capability: 'CAPABILITY',
  community: 'COMMUNITY',
  creative: 'CREATIVE',
}

export const PILLAR_DESCRIPTIONS: Record<PillarId, string> = {
  pressure: 'Affordability vs growth tradeoff. High = under pressure.',
  viability: 'Housing, climate, safety. Can people live here long-term?',
  capability: 'Transit, utilities, digital infra. Does the city work?',
  community: 'Healthcare, education, civic life. Does it care for people?',
  creative: 'Culture, diversity, meaning. Why be here at all?',
}

export type CityScore = CityHubSlicScore

const data = CITY_HUB_SLIC

// City ID mapping from our cities.ts to SLIC's cityId
const CITY_ID_MAP: Record<string, string> = {
  'bangkok': 'th-bangkok',
  'chiang-mai': 'th-chiang-mai',
  'phuket': 'th-phuket',
  'singapore': 'sg-singapore',
  'kuching': 'my-kuching',
}

/** Look up a city's SLIC score by City Hub's internal id. */
export function getCityScore(cityHubId: string): CityScore | null {
  const slicId = CITY_ID_MAP[cityHubId]
  if (!slicId) return null
  return data.cities.find((c) => c.cityId === slicId) ?? null
}

/** Get a 5-pillar array for radar visualization. */
export function getPillarBreakdown(score: CityScore): Array<{ pillar: PillarId; label: string; value: number; weight: number }> {
  return PILLAR_ORDER.map((pillar) => ({
    pillar,
    label: PILLAR_LABELS[pillar],
    value: Math.round(score[`${pillar}Score` as keyof CityScore] as number),
    weight: PILLAR_WEIGHTS[pillar],
  }))
}

/** Identify the weakest pillar (lowest score). Returns null if no scores. */
export function weakestPillar(score: CityScore): { pillar: PillarId; label: string; value: number } | null {
  const breakdown = getPillarBreakdown(score)
  const sorted = [...breakdown].sort((a, b) => a.value - b.value)
  return sorted[0] ? { pillar: sorted[0].pillar, label: sorted[0].label, value: sorted[0].value } : null
}

/** Identify the strongest pillar. */
export function strongestPillar(score: CityScore): { pillar: PillarId; label: string; value: number } | null {
  const breakdown = getPillarBreakdown(score)
  const sorted = [...breakdown].sort((a, b) => b.value - a.value)
  return sorted[0] ? { pillar: sorted[0].pillar, label: sorted[0].label, value: sorted[0].value } : null
}

/** Global rank — 1 = highest SLIC score in the dataset. */
export function globalRank(cityScore: CityScore): { rank: number; total: number } {
  return { rank: cityScore.globalRank, total: data.globalTotal }
}

/** Regional rank — 1 = highest SLIC score within the same region. */
export function regionalRank(cityScore: CityScore): { rank: number; total: number; region: string } {
  return { rank: cityScore.regionalRank, total: cityScore.regionalTotal, region: cityScore.region }
}

/** Peer comparison — return the 4 other City Hub cities for cross-comparison. */
export function peerCities(currentCityId: string): CityScore[] {
  return Object.entries(CITY_ID_MAP)
    .filter(([id]) => id !== currentCityId)
    .map(([, slicId]) => data.cities.find((c) => c.cityId === slicId))
    .filter((c): c is CityScore => !!c)
}

/** Color for a score (0–100) — amber gradient from dim to bright. */
export function scoreColor(value: number): string {
  if (value >= 80) return '#8bc34a'  // green — strong
  if (value >= 65) return '#f59e0b'  // amber — average
  if (value >= 50) return '#fb8c00'  // orange — concerning
  return '#e53935'                    // red — weak
}

export const SLIC_VERSION = data.version
export const SLIC_UPDATED = data.updatedAt
