/**
 * CityFactsCard — the "introduce me to this city in 30 seconds" surface.
 *
 * Appears in the upper-left when a city tab is clicked. Shows the city's
 * static identity: name in local script, founding date, area, climate,
 * coordinates, the one-line distinctiveness sentence.
 *
 * Auto-dismisses on map interaction (the moment the user starts exploring).
 * Skippable via × button.
 *
 * The point: a tourist, journalist, or new analyst lands here and within
 * 30 seconds knows more about the city than 99% of visitors. UNL has
 * nothing analogous — they're a tile-reseller, not an onboarding product.
 */
import { useEffect, useState } from 'react'
import type { CityConfig } from '../config/cities'

interface Props {
  activeCity: CityConfig
}

export function CityFactsCard({ activeCity }: Props) {
  const [visible, setVisible] = useState(true)
  const [introCityId, setIntroCityId] = useState(activeCity.id)

  // Re-show on every city change
  useEffect(() => {
    if (introCityId !== activeCity.id) {
      setIntroCityId(activeCity.id)
      setVisible(true)
    }
  }, [activeCity.id, introCityId])

  // Auto-dismiss after 12s
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), 12_000)
    return () => clearTimeout(t)
  }, [visible, activeCity.id])

  if (!visible) return null

  const coordStr = `${Math.abs(activeCity.center[1]).toFixed(4)}°${activeCity.center[1] >= 0 ? 'N' : 'S'} · ${Math.abs(activeCity.center[0]).toFixed(4)}°${activeCity.center[0] >= 0 ? 'E' : 'W'}`

  return (
    <aside className="city-facts-card" role="complementary" aria-label={`Introduction to ${activeCity.name}`}>
      <header className="cfc-header">
        <div className="cfc-name-block">
          <span className="cfc-eyebrow">CITY INTRODUCTION</span>
          <h1 className="cfc-name">{activeCity.name}</h1>
          {activeCity.nameLocal && (
            <div className="cfc-name-local" lang="th">{activeCity.nameLocal}</div>
          )}
        </div>
        <button className="cfc-close" onClick={() => setVisible(false)} aria-label="Dismiss city introduction">✕</button>
      </header>

      <div className="cfc-facts">
        <div className="cfc-fact">
          <span className="cfc-label">FOUNDED</span>
          <span className="cfc-value">{activeCity.founded ?? '—'}</span>
        </div>
        <div className="cfc-fact">
          <span className="cfc-label">AREA</span>
          <span className="cfc-value">{activeCity.area_km2.toLocaleString()} km²</span>
        </div>
        <div className="cfc-fact">
          <span className="cfc-label">CLIMATE</span>
          <span className="cfc-value">{activeCity.climate}</span>
        </div>
        <div className="cfc-fact">
          <span className="cfc-label">LOCATION</span>
          <span className="cfc-value cfc-coord">{coordStr}</span>
        </div>
      </div>

      <p className="cfc-distinctiveness">{activeCity.distinctiveness}</p>

      <footer className="cfc-footer">
        <span className="cfc-foot-hint">click the map · scroll the panel · tap any layer to learn the city</span>
      </footer>
    </aside>
  )
}
