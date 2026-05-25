import { useEffect, useState } from 'react'
import { BANGKOK_LAYERS, ALL_SOURCES, type SourceKey, type LayerSpec } from '../config/bangkok-layers'
import { cacheTimestamp } from '../lib/cached-fetch'
import { freshnessLabel } from '../lib/freshness'

interface LayerRailProps {
  activeIds: Set<string>
  onToggle: (id: string) => void
}

// Map source → which cache key proves it's fresh (any one of its layers)
const SOURCE_CACHE_PROBE: Record<SourceKey, string | null> = {
  GISTDA: 'gistda/pm25-bkk-live',
  NASA: 'nasa/firms-th-24h',
  BMA: 'data-bma/recent',
  'data.go.th': 'datago/bkk',
  JAXA: null, // pending — needs Earth API registration
  Traffy: 'traffy/stats',
  'Open-Meteo': 'openmeteo/bkk-aqi',
  WAQI: 'waqi/bangkok-bbox',
  TMD: 'tmd/bangkok-forecast-7d',
  Longdo: null, // basemap is CDN-cached, no fetch-time tracking; layer enables when VITE_LONGDO_KEY is set
}

export function LayerRail({ activeIds, onToggle }: LayerRailProps) {
  const [open, setOpen] = useState(false) // mobile bottom sheet
  const [tick, setTick] = useState(0)

  // Refresh freshness labels every 30s without re-fetching anything
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  // tick keeps eslint quiet — it's the dependency that forces re-render
  void tick

  const activeCount = BANGKOK_LAYERS.filter((l) => activeIds.has(l.id) && l.status === 'live').length

  return (
    <>
      {/* Mobile FAB */}
      <button
        className="layer-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle data layers"
      >
        <span className="layer-fab-icon">▦</span>
        <span className="layer-fab-count">{activeCount}</span>
      </button>

      {open && <div className="sheet-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`layer-rail ${open ? 'layer-rail--open' : ''}`}>
        {/* Source status header */}
        <div className="rail-section-label">Sources</div>
        <div className="source-status-grid">
          {ALL_SOURCES.map((src) => {
            const probe = SOURCE_CACHE_PROBE[src]
            const ts = probe ? cacheTimestamp(probe) : 0
            const isPending = src === 'JAXA'
            return (
              <div key={src} className={`source-status ${isPending ? 'source-status--pending' : ''}`}>
                <span className="source-name">{src}</span>
                <span className="source-tick">{isPending ? 'PENDING' : ts ? freshnessLabel(ts) : '—'}</span>
              </div>
            )
          })}
        </div>

        {/* Layers */}
        <div className="rail-section-label">Layers</div>
        <div className="layer-list">
          {BANGKOK_LAYERS.map((spec) => (
            <LayerToggleItem
              key={spec.id}
              spec={spec}
              active={activeIds.has(spec.id)}
              onToggle={() => onToggle(spec.id)}
            />
          ))}
        </div>
      </aside>
    </>
  )
}

function LayerToggleItem({
  spec,
  active,
  onToggle,
}: {
  spec: LayerSpec
  active: boolean
  onToggle: () => void
}) {
  const isPending = spec.status === 'pending'
  return (
    <button
      className={`layer-item ${active ? 'layer-item--active' : ''} ${isPending ? 'layer-item--pending' : ''}`}
      onClick={() => !isPending && onToggle()}
      disabled={isPending}
      title={spec.description}
    >
      <span className="layer-dot" aria-hidden="true" />
      <span className="layer-label">{spec.label}</span>
      {isPending && <span className="layer-pending-chip">PENDING</span>}
      <span className="layer-source">{spec.source}</span>
    </button>
  )
}
