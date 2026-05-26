/**
 * SingaporeDataSection — live data.gov.sg integration.
 *
 * Renders only when activeCity.id === 'singapore'. Pulls real-time PSI per
 * region, taxi count, UV index, rainfall network — straight from Singapore's
 * national open-data portal. No key, no auth.
 */
import { useEffect, useState } from 'react'
import type { CityConfig } from '../config/cities'
import {
  fetchSingaporePSI,
  fetchSingaporeUV,
  fetchSingaporeTaxis,
  fetchSingaporeRainfall,
  type PSIBundle,
} from '../data/datagov-sg'

interface Props {
  activeCity: CityConfig
}

function psiBand(value?: number): { label: string; color: string } {
  if (value === undefined) return { label: '—', color: 'var(--fg-dim)' }
  if (value <= 50)  return { label: 'GOOD',                color: '#8bc34a' }
  if (value <= 100) return { label: 'MODERATE',            color: '#fdd835' }
  if (value <= 200) return { label: 'UNHEALTHY',           color: '#fb8c00' }
  if (value <= 300) return { label: 'VERY UNHEALTHY',      color: '#e53935' }
  return                 { label: 'HAZARDOUS',             color: '#7e0023' }
}

function uvBand(value: number): { label: string; color: string } {
  if (value <= 2) return { label: 'LOW',       color: '#8bc34a' }
  if (value <= 5) return { label: 'MODERATE',  color: '#fdd835' }
  if (value <= 7) return { label: 'HIGH',      color: '#fb8c00' }
  if (value <= 10) return { label: 'V. HIGH',  color: '#e53935' }
  return              { label: 'EXTREME',     color: '#7e0023' }
}

export function SingaporeDataSection({ activeCity }: Props) {
  const [psi, setPsi] = useState<PSIBundle | null>(null)
  const [uv, setUv] = useState<{ current: number } | null>(null)
  const [taxis, setTaxis] = useState<{ count: number } | null>(null)
  const [rainStations, setRainStations] = useState<{ active: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)

  // Only mount for Singapore
  const isSingapore = activeCity.id === 'singapore'

  useEffect(() => {
    if (!isSingapore) return
    let cancelled = false
    setLoading(true)
    const load = async () => {
      const [p, u, t, r] = await Promise.all([
        fetchSingaporePSI().catch(() => null),
        fetchSingaporeUV().catch(() => null),
        fetchSingaporeTaxis().catch(() => null),
        fetchSingaporeRainfall().catch((): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] })),
      ])
      if (cancelled) return
      if (p) setPsi(p)
      if (u) setUv(u)
      if (t) setTaxis(t)
      const total = r.features.length
      const active = r.features.filter((f) => Number((f.properties as Record<string, number>).rainfall_mm ?? 0) > 0).length
      setRainStations({ active, total })
      setLoading(false)
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [isSingapore])

  if (!isSingapore) return null
  if (loading && !psi && !uv) return null

  const psiBands = psi ? psi.regions.map((r) => ({ region: r.region, band: psiBand(r.psi_24h), value: r.psi_24h })) : []
  const uvB = uv ? uvBand(uv.current) : null

  return (
    <div className="sg-section">
      <div className="sg-header">
        <span className="sg-title">data.gov.sg · LIVE</span>
        <span className="sg-source">Singapore National Open Data</span>
      </div>

      {/* PSI per region — 5 regions in a row */}
      {psi && (
        <div className="sg-psi-block">
          <div className="sg-block-label">PSI · 24H · BY REGION</div>
          <div className="sg-psi-row">
            {psiBands.map((r) => (
              <div key={r.region} className="sg-psi-cell" title={`${r.region.toUpperCase()} PSI ${r.value}`}>
                <span className="sg-psi-region">{r.region.slice(0, 1).toUpperCase()}</span>
                <span className="sg-psi-value" style={{ color: r.band.color }}>
                  {r.value ?? '—'}
                </span>
              </div>
            ))}
          </div>
          {psi.worst && (
            <div className="sg-psi-worst">
              WORST · {psi.worst.region.toUpperCase()} · {psi.worst.psi_24h} · {psiBand(psi.worst.psi_24h).label}
            </div>
          )}
        </div>
      )}

      {/* UV + Taxi count row */}
      <div className="sg-strip-row">
        {uv && uvB && (
          <div className="sg-strip-cell">
            <span className="sg-strip-label">UV INDEX</span>
            <span className="sg-strip-value" style={{ color: uvB.color }}>
              {uv.current}
              <span className="sg-strip-band">· {uvB.label}</span>
            </span>
          </div>
        )}
        {taxis && (
          <div className="sg-strip-cell">
            <span className="sg-strip-label">TAXIS · LIVE</span>
            <span className="sg-strip-value">{taxis.count.toLocaleString()}</span>
          </div>
        )}
        {rainStations && (
          <div className="sg-strip-cell">
            <span className="sg-strip-label">RAIN GAUGES</span>
            <span className="sg-strip-value">
              {rainStations.active}<span className="sg-strip-band">/{rainStations.total}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
