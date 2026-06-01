/**
 * useEscalationAlerts — watches cityRisk and fires toasts via toastStore
 * when any city escalates (good→moderate, moderate→high, high→critical).
 * Replaces the old AlertToast component.
 */
import { useEffect, useRef } from 'react'
import type { RiskMap } from './useCityRisk'
import type { RiskLevel } from '../lib/risk'
import type { CityConfig } from '../config/cities'
import { useToastStore } from '../store/toastStore'
import { useCityStore } from '../store/cityStore'

const RISK_RANK: Record<RiskLevel, number> = {
  good: 0, moderate: 1, high: 2, critical: 3,
}

export function useEscalationAlerts(cityRisk: RiskMap, allCities: CityConfig[]) {
  const prevRef   = useRef<RiskMap>({})
  const addToast  = useToastStore((s) => s.addToast)
  const setActiveCity = useCityStore((s) => s.setActiveCity)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { ...cityRisk }

    for (const [id, level] of Object.entries(cityRisk)) {
      if (!level) continue
      const prevLevel = prev[id]
      if (!prevLevel) continue          // first load — no alert
      if (RISK_RANK[level] <= RISK_RANK[prevLevel]) continue  // same or improved

      const city = allCities.find((c) => c.id === id)
      if (!city) continue

      const toastType = level === 'critical' ? 'critical' : level === 'high' ? 'warning' : 'info'

      addToast({
        type:        toastType,
        title:       `${city.hudClockLabel} · ${level.toUpperCase()}`,
        message:     `${city.name} air quality escalated from ${prevLevel} to ${level}.`,
        actionLabel: 'VIEW',
        action:      () => setActiveCity(city),
        duration:    8000,
      })
    }
  }, [cityRisk, allCities, addToast, setActiveCity])
}
