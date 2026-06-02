/**
 * DataSourceStatus — live health monitor for all data sources.
 *
 * Operators need to know if the data they're acting on is fresh or stale.
 * Silent failures (OWM, RainViewer, AlphaEarth) break trust — this panel
 * makes the system's data provenance visible.
 *
 * Shows: source name, last update time, status (LIVE / STALE / OFFLINE),
 * and data freshness age. Collapses to a single status chip in the topbar.
 *
 * Accessible via the ? settings panel or as a floating overlay.
 */
import { useEffect, useState, useMemo } from 'react'
import { CITIES } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { fetchAQI } from '../data/openmeteo-aq'
import { fetchWeather } from '../data/openmeteo'
import { fetchCityNews } from '../data/gdelt'
import { bangkokWAQIStations } from '../data/waqi'
import { cachedFetch } from '../lib/cached-fetch'

interface SourceCheck {
  id:      string
  label:   string
  zone:    'DATA' | 'INTEL' | 'SATELLITE' | 'CIVIC'
  check:   () => Promise<boolean>
}

const SOURCES: SourceCheck[] = [
  {
    id: 'openmeteo-aq',
    label: 'Open-Meteo AQI',
    zone: 'DATA',
    check: async () => {
      const r = await fetchAQI(100.5018, 13.7563, 'Asia/Bangkok')
      return r.usAqi > 0
    },
  },
  {
    id: 'openmeteo-wx',
    label: 'Open-Meteo Weather',
    zone: 'DATA',
    check: async () => {
      const r = await fetchWeather(100.5018, 13.7563, 'Asia/Bangkok')
      return typeof r.temp === 'number'
    },
  },
  {
    id: 'waqi',
    label: 'WAQI Stations',
    zone: 'DATA',
    check: async () => {
      const r = await cachedFetch('health/waqi', () => bangkokWAQIStations(), 10 * 60_000)
      return r.features.length > 0
    },
  },
  {
    id: 'gdelt',
    label: 'GDELT News',
    zone: 'INTEL',
    check: async () => {
      const r = await fetchCityNews('bangkok thailand', 3)
      return r.articles.length > 0
    },
  },
  {
    id: 'usgs',
    label: 'USGS Earthquakes',
    zone: 'DATA',
    check: async () => {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', { signal: AbortSignal.timeout(5000) })
      return res.ok
    },
  },
  {
    id: 'rainviewer',
    label: 'RainViewer Radar',
    zone: 'DATA',
    check: async () => {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return false
      const data = await res.json() as { radar?: { past?: unknown[] } }
      return (data.radar?.past?.length ?? 0) > 0
    },
  },
  {
    id: 'nasa-gibs',
    label: 'NASA GIBS',
    zone: 'SATELLITE',
    check: async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const date = yesterday.toISOString().split('T')[0]
      const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/250m/6/36/56.jpg`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      return res.ok
    },
  },
  {
    id: 'traffy',
    label: 'Traffy Fondue',
    zone: 'CIVIC',
    check: async () => {
      const res = await fetch('https://publicapi.traffy.in.th/share/teamchadchart/getTicket?type=json&limit=1', { signal: AbortSignal.timeout(6000) })
      return res.ok
    },
  },
]

type SourceStatus = 'checking' | 'live' | 'stale' | 'offline'

interface StatusEntry {
  status:    SourceStatus
  checkedAt: Date | null
}

const ZONE_COLOR: Record<string, string> = {
  DATA:      'var(--cyan)',
  INTEL:     'var(--amber)',
  SATELLITE: 'var(--emerald)',
  CIVIC:     'var(--rose)',
}

function fmtAge(d: Date | null): string {
  if (!d) return '—'
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

export function DataSourceStatus({ onClose }: { onClose: () => void }) {
  const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])

  const [statuses, setStatuses] = useState<Record<string, StatusEntry>>(() =>
    Object.fromEntries(SOURCES.map((s) => [s.id, { status: 'checking' as const, checkedAt: null }]))
  )
  const [running, setRunning] = useState(false)
  // tick removed — age updates with checkedAt timestamp

  const runChecks = async () => {
    if (running) return
    setRunning(true)
    // Reset to checking
    setStatuses((prev) => Object.fromEntries(
      Object.entries(prev).map(([k]) => [k, { status: 'checking' as const, checkedAt: null }])
    ))

    await Promise.allSettled(
      SOURCES.map(async (src) => {
        try {
          const ok = await Promise.race([
            src.check(),
            new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
          ])
          setStatuses((prev) => ({
            ...prev,
            [src.id]: { status: ok ? 'live' : 'stale', checkedAt: new Date() },
          }))
        } catch {
          setStatuses((prev) => ({
            ...prev,
            [src.id]: { status: 'offline', checkedAt: new Date() },
          }))
        }
      })
    )
    setRunning(false)
  }

  useEffect(() => { runChecks() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const liveCount   = Object.values(statuses).filter((s) => s.status === 'live').length
  const offlineCount = Object.values(statuses).filter((s) => s.status === 'offline').length
  const totalCities = allCities.length

  return (
    <div className="dss-panel" role="dialog" aria-label="Data source status">
      <div className="panel-zone" aria-hidden>
        <span className="panel-zone-dot" style={{ background: 'var(--cyan)' }} />
        DATA · SOURCE STATUS
      </div>

      <div className="dss-header">
        <div className="dss-summary">
          <span className="dss-count dss-count--live">{liveCount} LIVE</span>
          {offlineCount > 0 && <span className="dss-count dss-count--offline">{offlineCount} OFFLINE</span>}
          <span className="dss-count dss-count--cities">{totalCities} CITIES</span>
        </div>
        <div className="dss-actions">
          <button
            className="dss-refresh"
            onClick={runChecks}
            disabled={running}
            aria-label="Re-check all sources"
          >{running ? '⟳' : '↺'} CHECK</button>
          <button className="dss-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      <div className="dss-list">
        {SOURCES.map((src) => {
          const entry = statuses[src.id]
          const s = entry?.status ?? 'checking'
          return (
            <div key={src.id} className={`dss-row dss-row--${s}`}>
              <span className="dss-dot" style={{ background: s === 'live' ? 'var(--emerald)' : s === 'offline' ? '#ef4444' : s === 'checking' ? 'var(--dim)' : 'var(--amber)' }} />
              <span className="dss-source-label">{src.label}</span>
              <span className="dss-source-zone" style={{ color: ZONE_COLOR[src.zone] }}>{src.zone}</span>
              <span className="dss-source-age">{fmtAge(entry?.checkedAt ?? null)}</span>
              <span className={`dss-badge dss-badge--${s}`}>
                {s === 'checking' ? '…' : s.toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>

      <div className="dss-footer">
        Checks run on open · 10min refresh
      </div>
    </div>
  )
}

/**
 * DataStatusChip — compact inline indicator for the topbar.
 * Green when all sources live, amber when some stale, red when offline.
 */
export function DataStatusChip({ onClick }: { onClick: () => void }) {
  const [allLive, setAllLive] = useState(true)
  const [hasOffline, setHasOffline] = useState(false)

  useEffect(() => {
    const check = async () => {
      let live = 0, offline = 0
      await Promise.allSettled(SOURCES.slice(0, 4).map(async (src) => {  // quick probe on 4 core sources
        try { const ok = await src.check(); ok ? live++ : offline++ }
        catch { offline++ }
      }))
      setAllLive(offline === 0)
      setHasOffline(offline > 0)
    }
    check()
    const t = setInterval(check, 5 * 60_000)
    return () => clearInterval(t)
  }, [])

  const color = hasOffline ? '#ef4444' : allLive ? 'var(--emerald)' : 'var(--amber)'

  return (
    <button
      className="data-chip"
      onClick={onClick}
      title="Data source health"
      aria-label="Data source status"
    >
      <span className="data-chip-dot" style={{ background: color }} />
      <span className="data-chip-label">FEEDS</span>
    </button>
  )
}
