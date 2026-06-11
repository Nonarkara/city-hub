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
import {
  CORE_SOURCE_IDS,
  SOURCE_REGISTRY,
  runSourceCheck,
  type SourceStatus,
} from '../data/source-registry'

interface StatusEntry {
  status:    SourceStatus
  checkedAt: Date | null
  note?:      string
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
    Object.fromEntries(SOURCE_REGISTRY.map((s) => [s.id, { status: 'checking' as const, checkedAt: null }]))
  )
  const [running, setRunning] = useState(false)
  const [, setTick] = useState(0)

  const runChecks = async () => {
    if (running) return
    setRunning(true)
    // Reset to checking
    setStatuses((prev) => Object.fromEntries(
      Object.entries(prev).map(([k]) => [k, { status: 'checking' as const, checkedAt: null }])
    ))

    for (const src of SOURCE_REGISTRY) {
      try {
        const result = await runSourceCheck(src)
        setStatuses((prev) => ({
          ...prev,
          [src.id]: { status: result.status, checkedAt: new Date(), note: result.note },
        }))
      } catch (err) {
        const note = err instanceof Error ? err.message : 'Check failed'
        const status: SourceStatus = /429|rate|too many/i.test(note) ? 'stale' : 'offline'
        setStatuses((prev) => ({
          ...prev,
          [src.id]: { status, checkedAt: new Date(), note },
        }))
      }
    }
    setRunning(false)
  }

  useEffect(() => { runChecks() }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const liveCount   = Object.values(statuses).filter((s) => s.status === 'live').length
  const staleCount  = Object.values(statuses).filter((s) => s.status === 'stale').length
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
          {staleCount > 0 && <span className="dss-count dss-count--stale">{staleCount} STALE</span>}
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
        {SOURCE_REGISTRY.map((src) => {
          const entry = statuses[src.id]
          const s = entry?.status ?? 'checking'
          return (
            <div key={src.id} className={`dss-row dss-row--${s}`} title={entry?.note}>
              <span className="dss-dot" style={{ background: s === 'live' ? 'var(--emerald)' : s === 'offline' ? '#ef4444' : s === 'checking' ? 'var(--dim)' : 'var(--amber)' }} />
              <span className="dss-source-main">
                <span className="dss-source-label">{src.label}</span>
                {entry?.note && <span className="dss-source-note">{entry.note}</span>}
              </span>
              <span className="dss-source-zone" style={{ color: ZONE_COLOR[src.zone] }}>{src.zone}</span>
              <span className="dss-source-age">{src.refreshLabel}</span>
              <span className="dss-source-age">{fmtAge(entry?.checkedAt ?? null)}</span>
              <span className={`dss-badge dss-badge--${s}`}>
                {s === 'checking' ? '…' : s.toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>

      <div className="dss-footer">
        Checks run on open · ages update every 30s · stale means reachable but degraded
      </div>
    </div>
  )
}

/**
 * DataStatusChip — compact inline indicator for the topbar.
 * Green when all sources live, amber when some stale, red when offline.
 */
export function DataStatusChip({ onClick }: { onClick: () => void }) {
  const [status, setStatus] = useState<SourceStatus>('checking')

  useEffect(() => {
    const check = async () => {
      const coreSources = SOURCE_REGISTRY.filter((source) => CORE_SOURCE_IDS.includes(source.id as typeof CORE_SOURCE_IDS[number]))
      const results = await Promise.allSettled(coreSources.map((source) => runSourceCheck(source)))
      if (results.some((r) => r.status === 'rejected' || r.value.status === 'offline')) {
        setStatus('offline')
      } else if (results.some((r) => r.status === 'fulfilled' && r.value.status === 'stale')) {
        setStatus('stale')
      } else {
        setStatus('live')
      }
    }
    check()
    const t = setInterval(check, 5 * 60_000)
    return () => clearInterval(t)
  }, [])

  const color = status === 'offline' ? '#ef4444' : status === 'live' ? 'var(--emerald)' : 'var(--amber)'

  return (
    <button
      className="data-chip"
      onClick={onClick}
      title={`Data source health: ${status}`}
      aria-label={`Data source status: ${status}`}
    >
      <span className="data-chip-dot" style={{ background: color }} />
      <span className="data-chip-label">FEEDS</span>
    </button>
  )
}
