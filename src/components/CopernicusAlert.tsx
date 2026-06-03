/**
 * CopernicusAlert — monitors Copernicus CEMS for active SE Asia activations.
 *
 * When Copernicus activates emergency satellite mapping for Thailand or a
 * neighbouring country, this component surfaces it as a prominent alert.
 * This is the highest-quality disaster signal available — official EU
 * satellite-derived maps produced within 12–24h of a major event.
 *
 * Renders nothing unless there is an active or recently completed activation
 * relevant to SE Asia. Checks every hour.
 */
import { useEffect, useState } from 'react'
import { fetchCEMSActivations, type CEMSActivation } from '../data/copernicus-cems'

const REFRESH_MS = 60 * 60_000

const TYPE_ICON: Record<string, string> = {
  FLOOD:      '🌊',
  WILDFIRE:   '🔥',
  EARTHQUAKE: '⚡',
  STORM:      '🌪',
  LANDSLIDE:  '⛰',
  DEFAULT:    '🛰',
}

export function CopernicusAlert() {
  const [activations, setActivations] = useState<CEMSActivation[]>([])
  const [dismissed, setDismissed]     = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = () => {
      fetchCEMSActivations()
        .then((a) => setActivations(a))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  const visible = activations.filter((a) => !dismissed.has(a.id) && a.status !== 'COMPLETED')
  if (visible.length === 0) return null

  return (
    <div className="cems-panel" role="alert">
      <div className="panel-zone" aria-hidden>
        <span className="panel-zone-dot" style={{ background: '#ef4444' }} />
        SATELLITE · COPERNICUS CEMS
      </div>

      <div className="cems-header">
        <span className="cems-title">EMERGENCY MAPPING ACTIVE</span>
        <span className="cems-badge">{visible.length}</span>
      </div>

      {visible.map((act) => {
        const icon = TYPE_ICON[act.type.toUpperCase()] ?? TYPE_ICON.DEFAULT
        return (
          <div key={act.id} className="cems-row">
            <span className="cems-icon">{icon}</span>
            <div className="cems-body">
              <a
                className="cems-title-link"
                href={act.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {act.title || `${act.type} · ${act.country}`}
              </a>
              <div className="cems-meta">
                {act.date && <span className="cems-date">{act.date}</span>}
                <span className={`cems-status cems-status--${act.status.toLowerCase()}`}>
                  {act.status}
                </span>
              </div>
            </div>
            <button
              className="cems-dismiss"
              onClick={() => setDismissed((s) => new Set([...s, act.id]))}
              aria-label="Dismiss"
            >✕</button>
          </div>
        )
      })}

      <div className="cems-footer">
        Copernicus Emergency Management Service · EU Satellite · {activations.length} SE Asia activations checked
      </div>
    </div>
  )
}
