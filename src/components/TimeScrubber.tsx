/**
 * TimeScrubber — drag through the next 24 hours of forecast and see what
 * the city PM2.5 will be at each future hour. Sits at top-center of the
 * map below the telemetry ribbon.
 *
 * The "show the future" surface: most dashboards show NOW only; this one
 * lets you walk forward.
 */
import { useEffect, useMemo, useState } from 'react'
import { bangkokPm25Live } from '../data/gistda'
import { forecastSeries, type ForecastResult } from '../lib/forecast'
import { pm25ToRisk, RISK_COLOR, type RiskLevel } from '../lib/risk'

interface TimeScrubberProps {
  visible: boolean
}

function levelLabel(level: RiskLevel): string {
  return level === 'critical' ? 'CRITICAL' :
         level === 'high'     ? 'HIGH'     :
         level === 'moderate' ? 'ADVISORY' :
                                'NORMAL'
}

export function TimeScrubber({ visible }: TimeScrubberProps) {
  const [hour, setHour] = useState(0)           // 0..24
  const [now, setNow] = useState<number | null>(null)
  const [forecast, setForecast] = useState<ForecastResult | null>(null)

  // Fetch current PM2.5 + 24h forecast once on mount
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    ;(async () => {
      const pm = await bangkokPm25Live().catch(() => null)
      if (!pm || cancelled) return
      setNow(pm.pm25)
      const history = pm.history24h.map(([v]) => v)
      if (history.length >= 12) {
        const fc = await forecastSeries(history, 24, 24).catch(() => null)
        if (fc && !cancelled) setForecast(fc)
      }
    })()
    return () => { cancelled = true }
  }, [visible])

  // Projected PM2.5 at the scrubbed hour
  const projected = useMemo(() => {
    if (hour === 0) return now
    if (!forecast || hour > forecast.forecast.length) return null
    return forecast.forecast[hour - 1]
  }, [hour, now, forecast])

  const level: RiskLevel = projected !== null ? pm25ToRisk(projected) : 'good'
  const labelTime = hour === 0 ? 'NOW' : `+${hour}H`
  const trendChar = forecast && projected !== null && now !== null
    ? (projected > now + 5 ? '▲' : projected < now - 5 ? '▼' : '·')
    : ''

  if (!visible) return null

  return (
    <div className="time-scrubber">
      <div className="ts-row">
        <span className="ts-label">TIMELINE</span>
        <span className="ts-time">{labelTime}</span>
        <input
          className="ts-slider"
          type="range"
          min={0}
          max={24}
          step={1}
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          aria-label="Forecast time"
        />
        <span className="ts-trend" style={{ color: RISK_COLOR[level] }}>{trendChar}</span>
        <span className="ts-projected" style={{ color: RISK_COLOR[level] }}>
          {projected !== null ? `${projected.toFixed(0)} μg/m³` : '—'}
        </span>
        <span className="ts-status" style={{ color: RISK_COLOR[level] }}>
          {levelLabel(level)}
        </span>
      </div>
      <div className="ts-ticks">
        {[0, 6, 12, 18, 24].map((h) => (
          <button
            key={h}
            className={`ts-tick ${h === hour ? 'active' : ''}`}
            onClick={() => setHour(h)}
          >
            {h === 0 ? 'NOW' : `+${h}H`}
          </button>
        ))}
      </div>
    </div>
  )
}
