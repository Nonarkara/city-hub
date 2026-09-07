/**
 * SLIC Index V3 — published Smart and Liveable Cities scores
 * (Arkara & Thiengburanathum). Snapshot: src/data/slic-cityhub.ts
 * copied from the public ranked CSV (2026-07-04). Offline; no fetch.
 * Do not invent scores for cities absent from that board.
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

export const PILLAR_LABELS: Record<PillarId, string> = {
  pressure: 'GROWTH',
  viability: 'VIABILITY',
  capability: 'CAPABILITY',
  community: 'COMMUNITY',
  creative: 'CREATIVE',
}

/** What the pillar measures on the published V3 board. */
export const PILLAR_DESCRIPTIONS: Record<PillarId, string> = {
  pressure: 'Growth: disposable income after rent, housing burden, work time, economic stress.',
  viability: 'Viability: safety, transit, clean air, water/utilities, digital infrastructure.',
  capability: 'Capability: healthcare, education, equal-opportunity access.',
  community: 'Community: belonging, tolerance, cultural/public life, civic freedom.',
  creative: 'Creative: entrepreneurial dynamism, innovation/R&D, economic vitality.',
}

/** Operational "where to fix first" — acts on the weak pillar, not a slogan. */
export const PILLAR_ACTIONS: Record<PillarId, string> = {
  pressure: 'Cut household load first: housing cost, commute time, and debt sit in Growth. Do not add spectacle while disposable income is the weak metric.',
  viability: 'Fix the liveability stack: air, water, safety, and getting around. A high Growth city still fails if people cannot breathe or move.',
  capability: 'Invest in health and education access before the next landmark. Capability is the long-cycle constraint.',
  community: 'Repair civic space and public life. Rank will not rise if belonging and civic freedom are the hole.',
  creative: 'Unblock enterprise and R&D. Creative here is dynamism, not decoration.',
}

export type CityScore = CityHubSlicScore

const data = CITY_HUB_SLIC

/** City Hub id → published SLIC cityId. Only cities on the ranked board. */
const CITY_ID_MAP: Record<string, string> = {
  bangkok: 'th-bangkok',
  'chiang-mai': 'th-chiang-mai',
  phuket: 'th-phuket',
  singapore: 'sg-singapore',
  kuching: 'my-kuching',
  prague: 'cz-prague',
  tallinn: 'ee-tallinn',
  bucharest: 'ro-bucharest',
  ljubljana: 'si-ljubljana',
  budapest: 'hu-budapest',
  riga: 'lv-riga',
  vilnius: 'lt-vilnius',
  belgrade: 'rs-belgrade',
}

export function getCityScore(cityHubId: string): CityScore | null {
  const slicId = CITY_ID_MAP[cityHubId]
  if (!slicId) return null
  return data.cities.find((c) => c.cityId === slicId) ?? null
}

export function getPillarBreakdown(score: CityScore): Array<{ pillar: PillarId; label: string; value: number; weight: number }> {
  return PILLAR_ORDER.map((pillar) => ({
    pillar,
    label: PILLAR_LABELS[pillar],
    value: Math.round(score[`${pillar}Score` as keyof CityScore] as number),
    weight: PILLAR_WEIGHTS[pillar],
  }))
}

export function weakestPillar(score: CityScore): { pillar: PillarId; label: string; value: number } | null {
  const breakdown = getPillarBreakdown(score)
  const sorted = [...breakdown].sort((a, b) => a.value - b.value)
  return sorted[0] ? { pillar: sorted[0].pillar, label: sorted[0].label, value: sorted[0].value } : null
}

export function strongestPillar(score: CityScore): { pillar: PillarId; label: string; value: number } | null {
  const breakdown = getPillarBreakdown(score)
  const sorted = [...breakdown].sort((a, b) => b.value - a.value)
  return sorted[0] ? { pillar: sorted[0].pillar, label: sorted[0].label, value: sorted[0].value } : null
}

export function globalRank(cityScore: CityScore): { rank: number; total: number } {
  return { rank: cityScore.globalRank, total: data.globalTotal }
}

export function regionalRank(cityScore: CityScore): { rank: number; total: number; region: string } {
  return { rank: cityScore.regionalRank, total: cityScore.regionalTotal, region: cityScore.region }
}

/** Nearby hub cities by SLIC score — operational peers, not a vanity leaderboard. */
export function peerCities(currentCityId: string): CityScore[] {
  const score = getCityScore(currentCityId)
  if (!score) return []
  return data.cities
    .filter((c) => c.cityId !== score.cityId)
    .sort((a, b) => Math.abs(a.slicScore - score.slicScore) - Math.abs(b.slicScore - score.slicScore))
    .slice(0, 4)
}

export function scoreColor(value: number): string {
  if (value >= 80) return '#8bc34a'
  if (value >= 65) return '#f59e0b'
  if (value >= 50) return '#fb8c00'
  return '#e53935'
}

export const SLIC_VERSION = data.version
export const SLIC_UPDATED = data.updatedAt
export const SLIC_SOURCE = data.source
