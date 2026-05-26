/**
 * CitizenReportsSection — live citizen reports for the active city,
 * via Non's deployed city-reporter-v2 service.
 *
 * Scopes the global feed to the active city's bbox. Renders nothing
 * if no reports in this city.
 */
import { useEffect, useState } from 'react'
import type { CityConfig } from '../config/cities'
import {
  fetchCitizenReports,
  reportsInBbox,
  summarizeReports,
} from '../data/city-reporter'

interface Props {
  activeCity: CityConfig
}

const URGENCY_COLOR: Record<string, string> = {
  สูง: '#e53935',
  ปานกลาง: '#fb8c00',
  ต่ำ: '#fdd835',
}

const URGENCY_EN: Record<string, string> = {
  สูง: 'HIGH',
  ปานกลาง: 'MED',
  ต่ำ: 'LOW',
}

export function CitizenReportsSection({ activeCity }: Props) {
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const load = async () => {
      const all = await fetchCitizenReports().catch((): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] }))
      if (cancelled) return
      const scoped = reportsInBbox(all, activeCity.bbox)
      setFeatures(scoped.features.slice(0, 8))
      setLoading(false)
    }
    load()
    const t = setInterval(load, 2 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeCity.id, activeCity.bbox])

  if (loading && features.length === 0) return null
  if (features.length === 0) return null

  const stats = summarizeReports({ type: 'FeatureCollection', features })
  const high = stats.byUrgency['สูง'] ?? 0

  return (
    <div className="reports-section">
      <div className="reports-header">
        <span className="reports-title">CITIZEN REPORTS · LIVE</span>
        <span className="reports-count">
          {stats.total}
          {high > 0 && <span style={{ color: '#e53935', marginLeft: 4 }}>· {high} HIGH</span>}
        </span>
      </div>
      <div className="reports-list">
        {features.slice(0, 5).map((f) => {
          const p = (f.properties ?? {}) as Record<string, string>
          const ts = p.timestamp ? new Date(p.timestamp) : null
          const ago = ts ? Math.floor((Date.now() - ts.getTime()) / 60000) : null
          const urg = (p.urgency ?? '') as string
          return (
            <div key={p.id} className="report-row">
              <span
                className="report-urgency"
                style={{
                  color: URGENCY_COLOR[urg] ?? 'var(--fg-dim)',
                  borderColor: URGENCY_COLOR[urg] ?? 'var(--line)',
                }}
                title={urg}
              >
                {URGENCY_EN[urg] ?? '?'}
              </span>
              <span className="report-type">{p.type}</span>
              <span className="report-age" title={ts?.toLocaleString() ?? ''}>
                {ago !== null && ago < 60 ? `${ago}m` : ago !== null ? `${Math.floor(ago / 60)}h` : '—'}
              </span>
            </div>
          )
        })}
      </div>
      <div className="reports-source">
        via city-reporter-v2
      </div>
    </div>
  )
}
