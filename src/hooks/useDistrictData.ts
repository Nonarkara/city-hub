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

export interface DistrictSummary {
  name_th: string
  name_en: string
  risk_level: RiskLevel
  complaint_count: number
  civic_risk: RiskLevel
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

      // Build per-khet summaries
      const summaries: DistrictSummary[] = (khetResult?.features ?? []).map((f) => {
        const name_th = ((f.properties?.name_th as string) ?? '').trim()
        const name_en = ((f.properties?.name_en as string) ?? '').trim()
        const count = counts[name_th] ?? 0
        const civicScore = count >= 200 ? 3 : count >= 50 ? 2 : count >= 5 ? 1 : 0
        const score = Math.max(airScore, civicScore)
        return {
          name_th,
          name_en,
          risk_level: scoreToLevel(score),
          complaint_count: count,
          civic_risk: civicToRisk(count),
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
