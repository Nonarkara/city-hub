/**
 * SplitCompare — "any vs any" satellite swipe-compare.
 *
 * Two independent MapLibre panes separated by a draggable divider. Each pane
 * sets its OWN city + satellite lens + date, so one control compares:
 *   - city vs city       (Bangkok NDVI | Singapore NDVI)
 *   - then vs now         (Bangkok aerosol today | Bangkok aerosol −30d)
 *   - lens vs lens        (Bangkok true-color | Bangkok surface-heat)
 *
 * This is the thing Google Maps can't do: side-by-side Earth observation across
 * place, time, and spectrum. Reuses the Satellite Stack registry (getBasemapDef)
 * and the temporal tile machinery from MapView — no new tile code.
 *
 * Desktop: panes sit left|right, divider drags horizontally.
 * Mobile (<768px): panes stack top/bottom, divider drags vertically.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Map as MapLibreMap } from 'maplibre-gl'
import { CITIES, type CityConfig, type BasemapId } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { useUIStore } from '../store/uiStore'
import {
  getBasemapDef, BASEMAP_GROUPS, isTemporalBasemap, hasMapboxToken,
} from './MapView'

const MS_DAY = 86_400_000
const MAX_BACK = 30

interface PaneState {
  cityId:  string
  basemap: BasemapId
  date:    string   // YYYY-MM-DD
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}
function daysAgo(date: string): number {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / MS_DAY)
  return Math.max(0, Math.min(MAX_BACK, d))
}
function dateFromDaysAgo(n: number): string {
  return new Date(Date.now() - n * MS_DAY).toISOString().split('T')[0]
}
function prettyDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// One self-contained map pane
// ─────────────────────────────────────────────────────────────────────────────
function CompareMapPane({
  state, onChange, cities, tokenAvailable, align,
}: {
  state:          PaneState
  onChange:       (next: PaneState) => void
  cities:         CityConfig[]
  tokenAvailable: boolean
  align:          'left' | 'right'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<MapLibreMap | null>(null)
  const curBasemap   = useRef(state.basemap)
  const curDate      = useRef(state.date)
  const curCity      = useRef(state.cityId)

  const city = cities.find((c) => c.id === state.cityId) ?? cities[0]

  // Init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const def = getBasemapDef(state.basemap, state.date)
    const map = new MapLibreMap({
      container: containerRef.current,
      style: def.style,
      center: city.center,
      zoom: city.zoom,
      minZoom: 3,
      renderWorldCopies: false,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    // Keep the GL canvas correct as the divider resizes the pane.
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lens / date → restyle (temporal lenses re-key tiles to the new day)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const bmChanged = curBasemap.current !== state.basemap
    const dtChanged = curDate.current !== state.date
    const temporal  = isTemporalBasemap(state.basemap)
    if (!bmChanged && !(temporal && dtChanged)) return
    curBasemap.current = state.basemap
    curDate.current = state.date
    map.setStyle(getBasemapDef(state.basemap, state.date).style)
  }, [state.basemap, state.date])

  // City → fly
  useEffect(() => {
    const map = mapRef.current
    if (!map || curCity.current === state.cityId) return
    curCity.current = state.cityId
    map.flyTo({ center: city.center, zoom: city.zoom, duration: 1100, essential: true })
  }, [state.cityId, city.center, city.zoom])

  const temporal = isTemporalBasemap(state.basemap)

  return (
    <div className="split-pane">
      <div className="split-pane-map" ref={containerRef} />

      <div className={`split-pane-controls split-pane-controls--${align}`}>
        <select
          className="split-select"
          value={state.cityId}
          onChange={(e) => onChange({ ...state, cityId: e.target.value })}
          aria-label="City"
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.hudClockLabel} · {c.name}</option>
          ))}
        </select>

        <select
          className="split-select"
          value={state.basemap}
          onChange={(e) => onChange({ ...state, basemap: e.target.value as BasemapId })}
          aria-label="Satellite lens"
        >
          {BASEMAP_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label.toUpperCase()}>
              {g.ids.map((id) => {
                const def = getBasemapDef(id)
                const disabled = def.requiresToken && !tokenAvailable
                return (
                  <option key={id} value={id} disabled={disabled}>
                    {def.label}{def.temporal ? ' ⧗' : ''}{disabled ? ' (token)' : ''}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>

        {temporal && (
          <div className="split-pane-date">
            <input
              className="split-date-range"
              type="range"
              min={0}
              max={MAX_BACK}
              value={MAX_BACK - daysAgo(state.date)}
              onChange={(e) => onChange({ ...state, date: dateFromDaysAgo(MAX_BACK - Number(e.target.value)) })}
              aria-label="Date"
            />
            <span className="split-date-label">{prettyDate(state.date)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SplitCompare overlay
// ─────────────────────────────────────────────────────────────────────────────
export function SplitCompare() {
  const customCities  = useCityStore((s) => s.customCities)
  const activeCity    = useCityStore((s) => s.activeCity)
  const setSplitOpen  = useUIStore((s) => s.setSplitOpen)
  const activeDate    = useUIStore((s) => s.activeDate)

  const cities = [...CITIES, ...customCities]
  const tokenAvailable = hasMapboxToken()

  // Seed a meaningful first comparison: current city, true-color | NDVI.
  const [left, setLeft]   = useState<PaneState>({ cityId: activeCity.id, basemap: 'nasa-true-color', date: activeDate || todayStr() })
  const [right, setRight] = useState<PaneState>({ cityId: activeCity.id, basemap: 'nasa-ndvi',       date: activeDate || todayStr() })

  const [ratio, setRatio] = useState(0.5)
  const [stacked, setStacked] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setStacked(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSplitOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSplitOpen])

  const startDrag = useCallback((e: ReactPointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      const r = stacked
        ? ev.clientY / window.innerHeight
        : ev.clientX / window.innerWidth
      setRatio(Math.min(0.8, Math.max(0.2, r)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [stacked])

  const swap = useCallback(() => { setLeft(right); setRight(left) }, [left, right])

  return (
    <div className={`split-compare ${stacked ? 'split-compare--stacked' : ''}`}>
      <div className="split-pane-wrap" style={{ flex: ratio }}>
        <CompareMapPane state={left} onChange={setLeft} cities={cities} tokenAvailable={tokenAvailable} align="left" />
      </div>

      <div
        className="split-divider"
        onPointerDown={startDrag}
        role="separator"
        aria-orientation={stacked ? 'horizontal' : 'vertical'}
        aria-label="Resize comparison"
      >
        <span className="split-divider-grip" aria-hidden>⋮⋮</span>
      </div>

      <div className="split-pane-wrap" style={{ flex: 1 - ratio }}>
        <CompareMapPane state={right} onChange={setRight} cities={cities} tokenAvailable={tokenAvailable} align="right" />
      </div>

      <div className="split-toolbar">
        <span className="split-toolbar-title">SPLIT COMPARE</span>
        <button className="split-toolbar-btn" onClick={swap} title="Swap sides">⇄ SWAP</button>
        <button className="split-toolbar-btn split-toolbar-btn--exit" onClick={() => setSplitOpen(false)} title="Exit split (Esc)">✕ EXIT</button>
      </div>
    </div>
  )
}
