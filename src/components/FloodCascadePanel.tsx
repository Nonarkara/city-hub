/**
 * FloodCascadePanel — Bangkok flood early warning timeline.
 *
 * Shows the physical causal chain from upstream river discharge to
 * Bangkok impact, with a GloFAS-powered 30-day forecast and countdown.
 *
 * The chain:
 *   Northern rain → dams fill → Bhumibol/Sirikit release water →
 *   confluence at Nakhon Sawan → 3.5 days downstream → Bangkok
 *
 * Source: ScienceDirect 2024, GloFAS v4 via Open-Meteo free API.
 *
 * Rendered in Bangkok VitalsBar when flood watch/warning conditions exist,
 * and as a standalone panel via the INSIGHT menu.
 */
import { useEffect, useState } from 'react'
import { fetchChaoPrayaForecast, type FloodForecast } from '../data/flood-forecast'

const RISK_COLOR: Record<string, string> = {
  low:       'var(--emerald)',
  watch:     'var(--amber)',
  warning:   '#f97316',
  emergency: '#ef4444',
}

const RISK_LABEL: Record<string, string> = {
  low:       'LOW',
  watch:     'WATCH',
  warning:   'WARNING',
  emergency: 'EMERGENCY',
}

/** Days until Bangkok impact from a given discharge date */
function etaDays(dischargeDate: string): number {
  const now   = new Date()
  const event = new Date(dischargeDate)
  event.setDate(event.getDate() + 4)  // +3.5 days transit, round to 4
  return Math.max(0, Math.ceil((event.getTime() - now.getTime()) / 86_400_000))
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  compact?: boolean
  onClose?: () => void
}

export function FloodCascadePanel({ compact, onClose }: Props) {
  const [forecast, setForecast] = useState<FloodForecast | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)

  useEffect(() => {
    fetchChaoPrayaForecast(30)
      .then((f) => { setForecast(f); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const peakRisk = forecast
    ? forecast.days.reduce((worst, d) => {
        const rank = ['low', 'watch', 'warning', 'emergency']
        return rank.indexOf(d.risk) > rank.indexOf(worst) ? d.risk : worst
      }, 'low' as string)
    : 'low'

  const warningDays = forecast?.days.filter((d) => d.risk !== 'low') ?? []
  const firstWarning = warningDays[0]
  const etaFromNow = firstWarning ? etaDays(firstWarning.date) : null

  if (compact) {
    // Compact: just a status chip for VitalsBar
    if (loading || error || !forecast || peakRisk === 'low') return null
    return (
      <div className="flood-cascade-chip" style={{ borderLeftColor: RISK_COLOR[peakRisk] }}>
        <span className="flood-cascade-chip-label">CHAO PHRAYA</span>
        <span className="flood-cascade-chip-val" style={{ color: RISK_COLOR[peakRisk] }}>
          {RISK_LABEL[peakRisk]}
          {etaFromNow !== null && ` · BKK in ${etaFromNow}d`}
        </span>
        <span className="flood-cascade-chip-q">{forecast.currentDischarge.toLocaleString()} m³/s</span>
      </div>
    )
  }

  return (
    <div className="flood-panel">
      <div className="panel-zone" aria-hidden>
        <span className="panel-zone-dot" style={{ background: RISK_COLOR[peakRisk] }} />
        INTELLIGENCE · FLOOD CASCADE
      </div>

      <div className="flood-panel-header">
        <div>
          <div className="flood-panel-title">CHAO PHRAYA FLOOD FORECAST</div>
          <div className="flood-panel-source">GloFAS v4 · Nakhon Sawan gauge · 30-day</div>
        </div>
        {onClose && (
          <button className="flood-panel-close" onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>

      {loading && <div className="flood-panel-loading">Loading GloFAS forecast…</div>}
      {error   && <div className="flood-panel-loading">GloFAS unavailable</div>}

      {forecast && (
        <>
          {/* Current status summary */}
          <div className="flood-cascade-chain">
            <div className={`flood-chain-step flood-chain-step--${peakRisk}`}>
              <div className="flood-chain-metric">
                {forecast.currentDischarge.toLocaleString()} m³/s
              </div>
              <div className="flood-chain-label">CURRENT DISCHARGE</div>
              <div className="flood-chain-sub">{forecast.gauge}</div>
            </div>
            <div className="flood-chain-arrow">→ 3.5 days →</div>
            <div className={`flood-chain-step flood-chain-step--${peakRisk}`}>
              <div className="flood-chain-metric">BANGKOK</div>
              <div className="flood-chain-label">
                {peakRisk === 'low' ? 'NO FLOOD RISK' : `${RISK_LABEL[peakRisk]} RISK`}
              </div>
              {etaFromNow !== null && (
                <div className="flood-chain-sub">
                  {etaFromNow === 0 ? 'IMMINENT' : `in ~${etaFromNow} days`}
                </div>
              )}
            </div>
          </div>

          {/* Trend indicator */}
          <div className="flood-trend">
            <span className="flood-trend-label">TREND</span>
            <span className={`flood-trend-val flood-trend--${forecast.trend}`}>
              {forecast.trend === 'rising' ? '↑ RISING' :
               forecast.trend === 'falling' ? '↓ FALLING' : '→ STABLE'}
            </span>
            <span className="flood-trend-peak">
              PEAK {forecast.peakDischarge.toLocaleString()} m³/s on {fmtDate(forecast.peakDate)}
            </span>
          </div>

          {/* 30-day bar chart */}
          <div className="flood-timeline">
            {forecast.days.map((d) => (
              <div
                key={d.date}
                className={`flood-bar flood-bar--${d.risk}`}
                style={{ height: `${Math.min(100, (d.discharge / 6000) * 100)}%` }}
                title={`${fmtDate(d.date)}: ${d.discharge.toLocaleString()} m³/s · ${RISK_LABEL[d.risk]}`}
              />
            ))}
          </div>
          <div className="flood-timeline-labels">
            <span>{fmtDate(forecast.days[0]?.date ?? '')}</span>
            <span>30 days</span>
          </div>

          {/* Thresholds legend */}
          <div className="flood-legend">
            {[
              { q: '2,000', risk: 'watch',     label: 'WATCH' },
              { q: '3,500', risk: 'warning',   label: 'WARNING' },
              { q: '5,000', risk: 'emergency', label: 'EMERGENCY' },
            ].map(({ q, risk, label }) => (
              <div key={risk} className="flood-legend-row">
                <span className="flood-legend-dot" style={{ background: RISK_COLOR[risk] }} />
                <span className="flood-legend-val">{q} m³/s</span>
                <span className="flood-legend-label">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
