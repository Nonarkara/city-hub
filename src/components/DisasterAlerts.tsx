/**
 * DisasterAlerts — GDACS real-time disaster feed for Southeast Asia.
 *
 * Surfaces Orange/Red level events (earthquakes, floods, tropical cyclones,
 * volcanic eruptions, wildfires) within the SEA region.
 *
 * Green = informational only — not shown (too noisy).
 * Orange = elevated risk — shown in compact strip.
 * Red = severe — shown prominently with affected population.
 *
 * Positioned alongside the Copernicus CEMS panel at the top-right.
 * Renders nothing when no Orange/Red events exist (most of the time).
 */
import { useEffect, useState } from 'react'
import { fetchGDACSAlerts, type GDACSEvent, type GDACSAlertLevel } from '../data/gdacs'

const REFRESH_MS = 30 * 60_000

const HAZARD_ICON: Record<string, string> = {
  EQ: '⚡', FL: '🌊', TC: '🌀', VO: '🌋', WF: '🔥', DR: '☀',
}

const ALERT_COLOR: Record<GDACSAlertLevel, string> = {
  Green: 'var(--emerald)', Orange: '#f97316', Red: '#ef4444',
}

function fmtDate(s: string): string {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
  catch { return s.slice(0, 10) }
}

export function DisasterAlerts() {
  const [events, setEvents]   = useState<GDACSEvent[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = () => {
      fetchGDACSAlerts().then(setEvents).catch(() => {})
    }
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  // Only show Orange/Red events that haven't been dismissed
  const visible = events.filter((e) =>
    e.alertLevel !== 'Green' && !dismissed.has(e.eventId)
  )
  if (visible.length === 0) return null

  const topLevel = visible.some((e) => e.alertLevel === 'Red') ? 'Red' : 'Orange'

  return (
    <div className="disaster-panel" style={{ borderTopColor: ALERT_COLOR[topLevel] }}>
      <div className="panel-zone" aria-hidden>
        <span className="panel-zone-dot" style={{ background: ALERT_COLOR[topLevel] }} />
        REGIONAL · GDACS ALERTS
      </div>

      <div className="disaster-header">
        <span className="disaster-title">
          SEA DISASTER ALERTS
        </span>
        <span className="disaster-count"
          style={{ color: ALERT_COLOR[topLevel], borderColor: `${ALERT_COLOR[topLevel]}44` }}>
          {visible.length}
        </span>
      </div>

      {visible.map((ev) => (
        <div key={ev.eventId} className={`disaster-row disaster-row--${ev.alertLevel.toLowerCase()}`}>
          <span className="disaster-icon">{HAZARD_ICON[ev.hazardType] ?? '⚠'}</span>
          <div className="disaster-body">
            <div className="disaster-row-header">
              <a
                className="disaster-event-title"
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ev.hazardLabel}
                {ev.country ? ` · ${ev.country}` : ''}
              </a>
              <span
                className="disaster-badge"
                style={{ color: ALERT_COLOR[ev.alertLevel], borderColor: `${ALERT_COLOR[ev.alertLevel]}44` }}
              >
                {ev.alertLevel.toUpperCase()}
              </span>
            </div>
            {ev.title && <div className="disaster-desc">{ev.title}</div>}
            <div className="disaster-meta">
              {ev.date && <span>{fmtDate(ev.date)}</span>}
              {ev.deaths != null && ev.deaths > 0 && (
                <span className="disaster-stat">{ev.deaths.toLocaleString()} deaths</span>
              )}
              {ev.affectedPop != null && ev.affectedPop > 0 && (
                <span className="disaster-stat">{(ev.affectedPop/1000).toFixed(0)}K affected</span>
              )}
            </div>
          </div>
          <button
            className="disaster-dismiss"
            onClick={() => setDismissed((s) => new Set([...s, ev.eventId]))}
            aria-label="Dismiss"
          >✕</button>
        </div>
      ))}

      <div className="disaster-footer">
        GDACS · Orange/Red only · 30 min refresh · {events.length} SEA events total
      </div>
    </div>
  )
}
