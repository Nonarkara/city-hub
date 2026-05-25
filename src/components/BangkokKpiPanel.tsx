import { useEffect, useState } from 'react'
import { bangkokPm25Live, type Pm25Live } from '../data/gistda'
import { Sparkline } from './Sparkline'
import { PM25_COLORS } from '../config/bangkok-layers'

/**
 * Bangkok-specific KPI panel: live PM2.5 with 24h sparkline + AQI level word.
 * Replaces the generic 3-card KPI grid in CityRail when activeCity.id === 'bangkok'.
 */
export function BangkokKpiPanel() {
  const [live, setLive] = useState<Pm25Live | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      bangkokPm25Live()
        .then((d) => { if (!cancelled) { setLive(d); setErr(false) } })
        .catch(() => { if (!cancelled) setErr(true) })
    }
    load()
    // Lightweight refresh — cachedFetch handles dedup
    const t = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const sparkValues = live?.history24h.map((p) => p[0]).reverse() ?? []
  const color = live ? PM25_COLORS[live.level] ?? PM25_COLORS['—'] : PM25_COLORS['—']

  return (
    <div className="bkk-kpi">
      <div className="bkk-kpi-hero">
        <div className="bkk-kpi-label">PM2.5 · LIVE</div>
        <div className="bkk-kpi-value-row">
          <span className="bkk-kpi-value">{live ? live.pm25.toFixed(1) : err ? '—' : '…'}</span>
          <span className="bkk-kpi-unit">µg/m³</span>
        </div>
        <div className="bkk-kpi-meta">
          <span className="bkk-kpi-level" style={{ color }}>
            {live ? live.level.toUpperCase() : '—'}
          </span>
          <Sparkline values={sparkValues} color={color} width={84} height={20} />
        </div>
        {live && live.max24h > live.pm25 && (
          <div className="bkk-kpi-worst">
            24H MAX <span className="mono">{live.max24h.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
