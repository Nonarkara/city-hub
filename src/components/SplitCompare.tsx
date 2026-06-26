/**
 * SplitCompare — up to 8 independent satellite panes.
 *
 * Each pane has its own city + lens + date — so you can compare:
 *   - city vs city         (BKK NDVI | SIN NDVI | CNX true-color)
 *   - then vs now          (BKK aerosol today | BKK aerosol −30d)
 *   - lens vs lens         (BKK true-color | BKK surface-heat | BKK CO)
 *   - any combination of the above, up to 8-ways
 *
 * Grid layouts (presets 2 / 4 / 6 / 8):
 *   2 panes → side by side (or stacked on mobile)
 *   3 panes → 3 columns
 *   4 panes → 2 × 2 grid
 *   6 panes → 3 × 2 grid
 *   8 panes → 4 × 2 grid
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Map as MapLibreMap } from 'maplibre-gl'
import { CITIES, groupCitiesByRegion, type CityConfig, type BasemapId } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { useUIStore } from '../store/uiStore'
import {
  getBasemapDef, BASEMAP_GROUPS, isTemporalBasemap, hasMapboxToken,
} from './MapView'

const MS_DAY    = 86_400_000
const MAX_BACK  = 30
// MAX_PANES = 8 (enforced via panel-count button presets: 2 / 4 / 6 / 8)
const MIN_PANES = 2

// ── Live traffic overlay (global) ─────────────────────────────────────────────
// Mapbox Traffic v1 is a worldwide vector tileset — it drops onto any MapLibre
// map for ANY city using the existing Mapbox token. No Google billing, no rebuild.
const MAPBOX_TOKEN  = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string) ?? ''
const TRAFFIC_SRC   = 'mb-traffic'
const TRAFFIC_LAYER = 'mb-traffic-line'
const TRAFFIC_TILES = `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/{z}/{x}/{y}.vector.pbf?access_token=${MAPBOX_TOKEN}`

/** Add or remove the live-traffic overlay on a pane's map. Works for every city. */
function applyTraffic(map: MapLibreMap, on: boolean) {
  if (!map.isStyleLoaded()) return  // caller retries on 'idle' / 'styledata'
  const hasSrc = !!map.getSource(TRAFFIC_SRC)
  if (on && !hasSrc) {
    map.addSource(TRAFFIC_SRC, { type: 'vector', tiles: [TRAFFIC_TILES], maxzoom: 16 })
    map.addLayer({
      id: TRAFFIC_LAYER,
      type: 'line',
      source: TRAFFIC_SRC,
      'source-layer': 'traffic',
      paint: {
        // standard congestion ramp (green → amber → orange → red) — semantic, not decorative
        'line-color': [
          'match', ['get', 'congestion'],
          'low',      '#22c55e',
          'moderate', '#f59e0b',
          'heavy',    '#fb8c00',
          'severe',   '#e53935',
          '#22c55e',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 12, 2.6, 16, 5],
        'line-opacity': 0.85,
      },
    })
  } else if (!on && hasSrc) {
    if (map.getLayer(TRAFFIC_LAYER)) map.removeLayer(TRAFFIC_LAYER)
    map.removeSource(TRAFFIC_SRC)
  }
}

interface PaneState {
  cityId:  string
  basemap: BasemapId
  date:    string
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
// Single map pane
// ─────────────────────────────────────────────────────────────────────────────
function CompareMapPane({
  state, onChange, onRemove, cities, tokenAvailable, index, canRemove, trafficOn,
}: {
  state:          PaneState
  onChange:       (next: PaneState) => void
  onRemove:       () => void
  cities:         CityConfig[]
  tokenAvailable: boolean
  index:          number
  canRemove:      boolean
  trafficOn:      boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<MapLibreMap | null>(null)
  const curBasemap   = useRef(state.basemap)
  const curDate      = useRef(state.date)
  const curCity      = useRef(state.cityId)
  const trafficOnRef = useRef(trafficOn)

  const city = cities.find((c) => c.id === state.cityId) ?? cities[0]

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
    // Re-apply the traffic overlay after every basemap/lens swap (setStyle wipes
    // added layers). 'styledata' fires when the new style settles; applyTraffic
    // self-guards on isStyleLoaded() and is idempotent, so repeat calls are safe.
    map.on('styledata', () => applyTraffic(map, trafficOnRef.current))
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle traffic without changing the basemap
  useEffect(() => {
    trafficOnRef.current = trafficOn
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded()) applyTraffic(map, trafficOn)
    else map.once('idle', () => applyTraffic(map, trafficOnRef.current))
  }, [trafficOn])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const bmChanged = curBasemap.current !== state.basemap
    const dtChanged = curDate.current !== state.date
    const temporal  = isTemporalBasemap(state.basemap)
    if (!bmChanged && !(temporal && dtChanged)) return
    curBasemap.current = state.basemap
    curDate.current    = state.date
    map.setStyle(getBasemapDef(state.basemap, state.date).style)
  }, [state.basemap, state.date])

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

      {/* Pane index badge */}
      <div className="split-pane-badge">{index + 1}</div>

      {city.demographics && (
        <div className="split-pane-stats" aria-label={`${city.name} comparison stats`}>
          {city.demographics.greenSpaceM2PerPerson != null && (
            <span className="split-pane-stat">
              GRN {city.demographics.greenSpaceM2PerPerson >= 1000
                ? `${(city.demographics.greenSpaceM2PerPerson / 1000).toFixed(1)}K`
                : city.demographics.greenSpaceM2PerPerson} m²/p
            </span>
          )}
          {city.demographics.trafficCongestionPct != null && (
            <span className="split-pane-stat">TRF {city.demographics.trafficCongestionPct}%</span>
          )}
          {city.demographics.giniCoefficient != null && (
            <span className="split-pane-stat">GINI {city.demographics.giniCoefficient.toFixed(2)}</span>
          )}
        </div>
      )}

      {/* Close button — only shown when canRemove */}
      {canRemove && (
        <button
          className="split-pane-remove"
          onClick={onRemove}
          aria-label={`Remove pane ${index + 1}`}
          title="Remove this pane"
        >✕</button>
      )}

      <div className="split-pane-controls">
        <select
          className="split-select"
          value={state.cityId}
          onChange={(e) => onChange({ ...state, cityId: e.target.value })}
          aria-label="City"
        >
          {groupCitiesByRegion(cities).map((g) => (
            <optgroup key={g.region} label={g.region.toUpperCase()}>
              {g.cities.map((c) => (
                <option key={c.id} value={c.id}>{c.hudClockLabel} · {c.name}</option>
              ))}
            </optgroup>
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

// Seeded lens presets so each new pane starts with something meaningfully different
const DEFAULT_LENSES: BasemapId[] = [
  'nasa-true-color', 'nasa-ndvi', 'nasa-surface-temp', 'nasa-aerosol',
  'esri-imagery', 'nasa-nightlights', 'sentinel-cloudless', 'nasa-co',
]

export function SplitCompare() {
  const customCities = useCityStore((s) => s.customCities)
  const activeCity   = useCityStore((s) => s.activeCity)
  const setSplitOpen = useUIStore((s) => s.setSplitOpen)
  const activeDate   = useUIStore((s) => s.activeDate)

  const cities         = [...CITIES, ...customCities]
  const tokenAvailable = hasMapboxToken()
  const today          = activeDate || todayStr()

  // Live traffic overlay — applied to every pane at once (needs the Mapbox token)
  const [trafficOn, setTrafficOn] = useState(false)

  // Start with 2 panes, seeded with different lenses on the same city
  const [panes, setPanes] = useState<PaneState[]>([
    { cityId: activeCity.id, basemap: DEFAULT_LENSES[0], date: today },
    { cityId: activeCity.id, basemap: DEFAULT_LENSES[1], date: today },
  ])

  const count = panes.length

  const updatePane = useCallback((i: number, next: PaneState) => {
    setPanes((prev) => prev.map((p, idx) => idx === i ? next : p))
  }, [])


  const removePane = useCallback((i: number) => {
    setPanes((prev) => {
      if (prev.length <= MIN_PANES) return prev
      return prev.filter((_, idx) => idx !== i)
    })
  }, [])

  // Esc → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSplitOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSplitOpen])

  // Grid class based on count. Odd counts (from removing a pane) bucket up to the
  // next even grid; the trailing empty cell just shows the gap colour.
  const bucket = count <= 2 ? 2 : count === 3 ? 3 : count <= 4 ? 4 : count <= 6 ? 6 : 8
  const gridClass = `split-grid split-grid--${bucket}`

  return (
    <div className="split-compare">
      <div className={gridClass}>
        {panes.map((pane, i) => (
          <CompareMapPane
            key={i}
            state={pane}
            onChange={(next) => updatePane(i, next)}
            onRemove={() => removePane(i)}
            cities={cities}
            tokenAvailable={tokenAvailable}
            index={i}
            canRemove={count > MIN_PANES}
            trafficOn={trafficOn}
          />
        ))}
      </div>

      <div className="split-toolbar">
        <span className="split-toolbar-title">SPLIT COMPARE</span>

        <div className="split-panel-count" role="group" aria-label="Panel count">
          {[2, 4, 6, 8].map((n) => (
            <button
              key={n}
              className={`split-count-btn ${count === n ? 'split-count-btn--active' : ''}`}
              onClick={() => {
                if (n > count) {
                  // Add panes up to n
                  setPanes((prev) => {
                    let next = [...prev]
                    while (next.length < n) {
                      const lens = DEFAULT_LENSES[next.length % DEFAULT_LENSES.length]
                      const lastCityId = next[next.length - 1].cityId
                      const nextCity   = cities.find((c) => c.id !== lastCityId) ?? cities[0]
                      next = [...next, { cityId: nextCity.id, basemap: lens, date: today }]
                    }
                    return next
                  })
                } else if (n < count) {
                  setPanes((prev) => prev.slice(0, n))
                }
              }}
              title={`${n} panels`}
            >
              {n}×
            </button>
          ))}
        </div>

        {tokenAvailable && (
          <button
            className={`split-count-btn split-traffic-btn ${trafficOn ? 'split-count-btn--active' : ''}`}
            onClick={() => setTrafficOn((v) => !v)}
            title="Live traffic overlay — Mapbox, shown across every pane / city"
            aria-pressed={trafficOn}
          >▦ TRAFFIC</button>
        )}

        <button
          className="split-toolbar-btn split-toolbar-btn--exit"
          onClick={() => setSplitOpen(false)}
          title="Exit split (Esc)"
        >✕ EXIT</button>
      </div>
    </div>
  )
}
