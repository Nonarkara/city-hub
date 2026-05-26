/**
 * PatternsSection — surfaces cross-city pattern detection in any brief panel.
 *
 * Self-contained: takes only activeCity, fetches its own data, refreshes
 * on a 10-minute interval. Renders nothing if no patterns detected.
 */
import { useEffect, useState } from 'react'
import type { CityConfig } from '../config/cities'
import { detectCrossCityPatterns, type CrossCityPattern } from '../lib/cross-city-patterns'

interface Props {
  activeCity: CityConfig
}

export function PatternsSection({ activeCity }: Props) {
  const [patterns, setPatterns] = useState<CrossCityPattern[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setPatterns([])
    setLoading(true)
    const load = async () => {
      const result = await detectCrossCityPatterns(activeCity).catch((): CrossCityPattern[] => [])
      if (cancelled) return
      setPatterns(result)
      setLoading(false)
    }
    load()
    const t = setInterval(load, 10 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeCity.id])

  if (loading && patterns.length === 0) return null
  if (patterns.length === 0) return null

  return (
    <div className="patterns-section">
      <div className="patterns-header">
        <span className="patterns-title">CROSS-CITY PATTERNS</span>
        <span className="patterns-count">{patterns.length}</span>
      </div>
      <div className="patterns-list">
        {patterns.map((p, i) => {
          const tone = p.similarity > 0.85 ? 'high' : p.similarity > 0.75 ? 'medium' : 'low'
          return (
            <div key={`${p.fromCityId}-${i}`} className={`pattern-card pattern-card--${tone}`}>
              <div className="pattern-row">
                <span className="pattern-from">{p.fromCity.toUpperCase()}</span>
                <span className="pattern-sim">{Math.round(p.similarity * 100)}%</span>
              </div>
              <p className="pattern-msg">{p.message}</p>
              <p className="pattern-pred">→ {p.prediction}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
