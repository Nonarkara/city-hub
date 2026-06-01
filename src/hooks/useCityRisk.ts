/**
 * useCityRisk — fetches live AQI for every city and returns a map of
 * city-id → RiskLevel. Used to colour the topbar tabs.
 *
 * Fetches once on mount, refreshes every 10 minutes. Failures are silently
 * swallowed so a dead API never breaks the tabs.
 */
import { useEffect, useState } from 'react'
import { CITIES } from '../config/cities'
import { fetchAQI } from '../data/openmeteo-aq'
import { cachedFetch } from '../lib/cached-fetch'
import { pm25ToRisk, aqiToRisk, type RiskLevel } from '../lib/risk'
import { useCityStore } from '../store/cityStore'
import { useMemo } from 'react'

const POLL_MS = 10 * 60_000

export type RiskMap = Record<string, RiskLevel>

export function useCityRisk(): RiskMap {
  const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])

  const [riskMap, setRiskMap] = useState<RiskMap>({})

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const results = await Promise.allSettled(
        allCities.map(async (city) => {
          const [lng, lat] = city.center
          const aqi = await cachedFetch(
            `tabRisk/${city.id}`,
            () => fetchAQI(lng, lat, city.timezone),
            POLL_MS,
          )
          const level: RiskLevel = aqi.pm25 != null
            ? pm25ToRisk(aqi.pm25)
            : aqiToRisk(aqi.usAqi)
          return { id: city.id, level }
        }),
      )
      if (cancelled) return
      const next: RiskMap = {}
      for (const r of results) {
        if (r.status === 'fulfilled') next[r.value.id] = r.value.level
      }
      setRiskMap(next)
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [allCities.map((c) => c.id).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return riskMap
}
