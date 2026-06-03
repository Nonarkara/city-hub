/**
 * Computes per-khet risk scores in React — mirrors addDistricts() logic
 * but runs in React land so leaderboard + DistrictPanel can read the data.
 *
 * All three fetches go through cachedFetch → instant cache hits after the
 * map layers have loaded (no duplicate HTTP requests).
 */
import { useEffect, useState } from 'react'
import { loadBangkokKhet } from '../data/bma'
import { fetchTraffyGeoJSON } from '../data/traffy'
import { bangkokPm25Live } from '../data/gistda'
import { pm25ToRisk, civicToRisk, RISK_COLOR, type RiskLevel } from '../lib/risk'
import { getDistrictPop } from '../data/district-populations'

export interface DistrictSummary {
  name_th: string
  name_en: string
  risk_level: RiskLevel
  complaint_count: number
  civic_risk: RiskLevel
  vulnerability_score: number
  vulnerability_level: RiskLevel
  population: number     // NSO 2020 census, registered residents
}

/** Districts at or above a given risk level — sorted worst-first. */
export function districtsAtRisk(districts: DistrictSummary[], level: RiskLevel): DistrictSummary[] {
  const RANK: Record<RiskLevel, number> = { good: 0, moderate: 1, high: 2, critical: 3 }
  return districts
    .filter((d) => RANK[d.risk_level] >= RANK[level])
    .sort((a, b) => RANK[b.risk_level] - RANK[a.risk_level])
}

/** Total population across a list of districts. */
export function populationAtRisk(districts: DistrictSummary[]): number {
  return districts.reduce((s, d) => s + d.population, 0)
}

const LEVELS: readonly RiskLevel[] = ['good', 'moderate', 'high', 'critical']

function scoreToLevel(score: number): RiskLevel {
  return LEVELS[Math.min(3, Math.max(0, score))]
}

export function useDistrictData(): { districts: DistrictSummary[]; loading: boolean } {
  const [districts, setDistricts] = useState<DistrictSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      loadBangkokKhet().catch((): null => null),
      fetchTraffyGeoJSON(500).catch((): null => null),
      bangkokPm25Live().catch((): null => null),
    ]).then(([khetResult, traffyResult, pm25Result]) => {
      if (cancelled) return

      // Count Traffy complaints per district (strip เขต prefix)
      const counts: Record<string, number> = {}
      for (const f of (traffyResult?.features ?? [])) {
        const d = ((f.properties?.district as string) ?? '').replace(/^เขต/, '').trim()
        if (d) counts[d] = (counts[d] ?? 0) + 1
      }

      // City-wide air score
      const airRisk = pm25Result ? pm25ToRisk(pm25Result.pm25) : 'good'
      const airScore = ({ good: 0, moderate: 1, high: 2, critical: 3 } as Record<string, number>)[airRisk] ?? 0
      const pm25Value = pm25Result?.pm25 ?? 0
      const maxCount = Math.max(1, ...Object.values(counts))

      // Build per-khet summaries
      const summaries: DistrictSummary[] = (khetResult?.features ?? []).map((f) => {
        const name_th = ((f.properties?.name_th as string) ?? '').trim()
        const name_en = ((f.properties?.name_en as string) ?? '').trim()
        const count = counts[name_th] ?? 0
        const civicScore = count >= 200 ? 3 : count >= 50 ? 2 : count >= 5 ? 1 : 0
        const score = Math.max(airScore, civicScore)

        // Vulnerability Index
        const civicDensity = Math.min(25, (count / Math.max(maxCount, 50)) * 25)
        const airQuality = Math.min(25, (pm25Value / 100) * 25)
        const heatExposure = pm25Value > 50 ? 15 : pm25Value > 25 ? 8 : 3
        const floodRisk = count >= 50 ? 15 : count >= 10 ? 8 : 3
        const emergencyAccess = 10
        const vulnScore = Math.round(civicDensity + airQuality + heatExposure + floodRisk + emergencyAccess)

        return {
          name_th,
          name_en,
          risk_level: scoreToLevel(score),
          complaint_count: count,
          civic_risk: civicToRisk(count),
          vulnerability_score: vulnScore,
          vulnerability_level: vulnScore >= 70 ? 'critical' : vulnScore >= 50 ? 'high' : vulnScore >= 30 ? 'moderate' : 'good',
          population: getDistrictPop(name_en) || getDistrictPop(name_th),
        }
      })

      summaries.sort((a, b) => b.complaint_count - a.complaint_count)
      setDistricts(summaries)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return { districts, loading }
}

export { RISK_COLOR }
