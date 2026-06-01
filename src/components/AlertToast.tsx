/**
 * AlertToast — transient escalation notifications.
 *
 * Watches the cityRisk map from useCityRisk and fires a toast whenever any
 * city escalates (good→moderate, moderate→high, high→critical). Silent on
 * improvement — the dashboard data shows that. No toast spam.
 *
 * Max 3 toasts visible at once (oldest auto-dismissed). Each toast shows for
 * 6 seconds then fades out.
 */
import { useEffect, useRef, useState } from 'react'
import type { RiskMap } from '../hooks/useCityRisk'
import { RISK_COLOR, type RiskLevel } from '../lib/risk'
import type { CityConfig } from '../config/cities'

const RISK_RANK: Record<RiskLevel, number> = {
  good: 0, moderate: 1, high: 2, critical: 3,
}

const RISK_LABEL: Record<RiskLevel, string> = {
  good: 'GOOD', moderate: 'MODERATE', high: 'HIGH', critical: 'CRITICAL',
}

interface Toast {
  id: string
  cityCode: string
  cityName: string
  level: RiskLevel
  ts: number
}

interface Props {
  cityRisk: RiskMap
  allCities: CityConfig[]
}

export function AlertToast({ cityRisk, allCities }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const prevRef = useRef<RiskMap>({})

  useEffect(() => {
    const prev = prevRef.current
    const newToasts: Toast[] = []

    for (const [id, level] of Object.entries(cityRisk)) {
      if (!level) continue
      const prevLevel = prev[id]
      if (!prevLevel) continue  // first load — don't alert on init
      if (RISK_RANK[level] > RISK_RANK[prevLevel]) {
        const city = allCities.find((c) => c.id === id)
        if (!city) continue
        newToasts.push({
          id: `${id}-${Date.now()}`,
          cityCode: city.hudClockLabel,
          cityName: city.name,
          level,
          ts: Date.now(),
        })
      }
    }

    prevRef.current = { ...cityRisk }

    if (newToasts.length === 0) return
    setToasts((t) => [...t, ...newToasts].slice(-3))  // max 3
  }, [cityRisk, allCities])

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts((t) => t.slice(1))
    }, 6000)
    return () => clearTimeout(timer)
  }, [toasts.length, toasts[0]?.id])

  if (toasts.length === 0) return null

  return (
    <div className="alert-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="alert-toast"
          style={{ borderLeftColor: RISK_COLOR[t.level] }}
          onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
          role="alert"
        >
          <span className="alert-toast-code">{t.cityCode}</span>
          <span className="alert-toast-msg">
            {t.cityName} air quality escalated to{' '}
            <span style={{ color: RISK_COLOR[t.level] }}>{RISK_LABEL[t.level]}</span>
          </span>
          <span className="alert-toast-dismiss">✕</span>
        </div>
      ))}
    </div>
  )
}
