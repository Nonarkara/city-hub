/**
 * ASEANStrip — bottom ribbon comparing Bangkok's air quality against
 * peer ASEAN capitals in real time. Cities are sorted left-to-right by
 * AQI ascending so the cleanest air is on the left, dirtiest on the right.
 *
 * Bangkok cell is always highlighted regardless of position.
 */
import { useEffect, useState } from 'react'
import { fetchAllASEAN, type CityAQI } from '../data/asean-aqi'
import { AQI_COLORS } from '../config/bangkok-layers'

function aqiBand(aqi: number): keyof typeof AQI_COLORS {
  if (aqi >= 301) return 'hazardous'
  if (aqi >= 201) return 'very-unhealthy'
  if (aqi >= 151) return 'unhealthy'
  if (aqi >= 101) return 'unhealthy-sensitive'
  if (aqi >= 51)  return 'moderate'
  return 'good'
}

export function ASEANStrip() {
  const [cities, setCities] = useState<CityAQI[]>([])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetchAllASEAN()
        .then((r) => { if (!cancelled) setCities(r) })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 10 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  if (cities.length === 0) return null

  const sorted = [...cities].sort((a, b) => a.usAqi - b.usAqi)
  const cleanest = sorted[0]
  const dirtiest = sorted[sorted.length - 1]

  return (
    <div className="asean-strip">
      <div className="asean-strip-label">ASEAN · LIVE AQI</div>
      <div className="asean-strip-cells">
        {sorted.map((c) => {
          const color = AQI_COLORS[aqiBand(c.usAqi)]
          const isBkk = c.city.id === 'bangkok'
          const isClean = c.city.id === cleanest.city.id
          const isDirty = c.city.id === dirtiest.city.id
          return (
            <div
              key={c.city.id}
              className={`asean-cell ${isBkk ? 'is-bangkok' : ''}`}
              style={{ borderLeftColor: color }}
              title={`${c.city.name} · AQI ${c.usAqi} · PM2.5 ${c.pm25} μg/m³`}
            >
              <span className="asean-cell-flag">{c.city.flag}</span>
              <span className="asean-cell-name">{c.city.name}</span>
              <span className="asean-cell-aqi" style={{ color }}>{c.usAqi}</span>
              {isClean && <span className="asean-cell-tag">BEST</span>}
              {isDirty && <span className="asean-cell-tag">WORST</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
