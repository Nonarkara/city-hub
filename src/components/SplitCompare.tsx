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
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Map as MapLibreMap } from 'maplibre-gl'
import { CITIES, groupCitiesByRegion, type CityConfig, type BasemapId } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { useUIStore } from '../store/uiStore'
import { fetchAQI, type CityAQI } from '../data/openmeteo-aq'
import { fetchWeather, type CityWeather } from '../data/openmeteo'
import { cachedFetch } from '../lib/cached-fetch'
import { pearson } from '../lib/stats'
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

interface CompareSnapshot {
  aqi: CityAQI | null
  weather: CityWeather | null
}

type CompareMetricId =
  | 'green'
  | 'green-cover'
  | 'gdp-pc'
  | 'economic-density'
  | 'population-density'
  | 'walkability'
  | 'gini'
  | 'congestion'
  | 'aqi'
  | 'pm25'
  | 'temperature'

interface CompareMetric {
  id: CompareMetricId
  label: string
  shortLabel: string
  unit: string
  source: string
  value: (city: CityConfig, live: CompareSnapshot | null) => number | null
  format: (value: number) => string
}

const COMPARE_METRICS: CompareMetric[] = [
  {
    id: 'green', label: 'Green space / person', shortLabel: 'GREEN', unit: 'm²/person',
    source: 'Curated city dataset',
    value: (c) => c.demographics?.greenSpaceM2PerPerson ?? null,
    format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K m²` : `${v.toFixed(v < 10 ? 1 : 0)} m²`,
  },
  {
    id: 'green-cover', label: 'Green coverage', shortLabel: 'GREEN %', unit: '% city area',
    source: 'Curated city dataset',
    value: (c) => c.demographics?.greenSpacePct ?? null,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    id: 'gdp-pc', label: 'GDP per capita', shortLabel: 'GDP/PC', unit: 'USD/year',
    source: 'Curated city economic profile; output proxy, not household income',
    value: (c) => c.demographics?.gdpPerCapitaUsd ?? null,
    format: (v) => `$${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}K`,
  },
  {
    id: 'economic-density', label: 'Economic density', shortLabel: 'GDP/KM²', unit: '$M/km²',
    source: 'City GDP divided by administrative area',
    value: (c) => c.demographics?.gdpBillionUsd != null && c.area_km2 > 0
      ? (c.demographics.gdpBillionUsd * 1000) / c.area_km2
      : null,
    format: (v) => `$${v.toFixed(0)}M`,
  },
  {
    id: 'population-density', label: 'Population density', shortLabel: 'DENSITY', unit: 'people/km²',
    source: 'Population divided by administrative area',
    value: (c) => c.demographics && c.area_km2 > 0 ? (c.populationMillions * 1_000_000) / c.area_km2 : null,
    format: (v) => `${Math.round(v).toLocaleString()}`,
  },
  {
    id: 'walkability', label: 'Walkability', shortLabel: 'WALK', unit: '0-100',
    source: 'Curated city profile',
    value: (c) => c.demographics?.walkabilityScore ?? null,
    format: (v) => `${v.toFixed(0)}/100`,
  },
  {
    id: 'gini', label: 'Income inequality', shortLabel: 'GINI', unit: '0-1',
    source: 'Curated city profile; lower is more equal',
    value: (c) => c.demographics?.giniCoefficient ?? null,
    format: (v) => v.toFixed(2),
  },
  {
    id: 'congestion', label: 'Traffic congestion', shortLabel: 'TRAFFIC', unit: '% extra time',
    source: 'Curated TomTom-style city profile',
    value: (c) => c.demographics?.trafficCongestionPct ?? null,
    format: (v) => `${v.toFixed(0)}%`,
  },
  {
    id: 'aqi', label: 'Current US AQI', shortLabel: 'AQI', unit: 'index',
    source: 'Open-Meteo Air Quality; live',
    value: (_, live) => live?.aqi?.usAqi ?? null,
    format: (v) => `${v.toFixed(0)}`,
  },
  {
    id: 'pm25', label: 'Current PM2.5', shortLabel: 'PM2.5', unit: 'µg/m³',
    source: 'Open-Meteo Air Quality; live',
    value: (_, live) => live?.aqi?.pm25 ?? null,
    format: (v) => `${v.toFixed(1)}`,
  },
  {
    id: 'temperature', label: 'Current temperature', shortLabel: 'TEMP', unit: '°C',
    source: 'Open-Meteo Weather; live',
    value: (_, live) => live?.weather?.temp ?? null,
    format: (v) => `${v.toFixed(0)}°`,
  },
]

const METRIC_BY_ID = Object.fromEntries(COMPARE_METRICS.map((metric) => [metric.id, metric])) as Record<CompareMetricId, CompareMetric>
const PANE_METRICS: CompareMetricId[] = ['green', 'gdp-pc', 'aqi', 'temperature']

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

function relationshipLabel(r: number): string {
  const strength = Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : Math.abs(r) >= 0.2 ? 'weak' : 'little'
  if (Math.abs(r) < 0.2) return `${strength} linear relationship`
  return `${strength} ${r > 0 ? 'positive' : 'negative'} relationship`
}

function CorrelationPlot({ points }: { points: Array<{ city: CityConfig; x: number; y: number }> }) {
  const width = 118
  const height = 34
  const pad = 4
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const sx = (v: number) => pad + ((v - minX) / Math.max(1, maxX - minX)) * (width - pad * 2)
  const sy = (v: number) => height - pad - ((v - minY) / Math.max(1, maxY - minY)) * (height - pad * 2)

  return (
    <svg className="split-correlation-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Selected city correlation scatter plot">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
      {points.map((point) => (
        <circle key={point.city.id} cx={sx(point.x)} cy={sy(point.y)} r="2.6">
          <title>{point.city.name}: {point.x.toFixed(1)}, {point.y.toFixed(1)}</title>
        </circle>
      ))}
    </svg>
  )
}

function PaneMetricDock({ city, live, loading }: { city: CityConfig; live: CompareSnapshot | null; loading: boolean }) {
  return (
    <div className="split-pane-stats" aria-label={`${city.name} comparison metrics`}>
      {PANE_METRICS.map((id) => {
        const metric = METRIC_BY_ID[id]
        const value = metric.value(city, live)
        return (
          <div key={id} className="split-pane-stat" title={`${metric.label} · ${metric.source}`}>
            <span className="split-pane-stat-label">{metric.shortLabel}</span>
            <span className="split-pane-stat-value">
              {value != null ? metric.format(value) : loading && (id === 'aqi' || id === 'temperature') ? '…' : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single map pane
// ─────────────────────────────────────────────────────────────────────────────
function CompareMapPane({
  state, onChange, onRemove, cities, tokenAvailable, index, canRemove, trafficOn, live, liveLoading,
}: {
  state:          PaneState
  onChange:       (next: PaneState) => void
  onRemove:       () => void
  cities:         CityConfig[]
  tokenAvailable: boolean
  index:          number
  canRemove:      boolean
  trafficOn:      boolean
  live:           CompareSnapshot | null
  liveLoading:    boolean
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

      <PaneMetricDock city={city} live={live} loading={liveLoading} />

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

// Seeded lens presets — used when SYNC LENS is off so each new pane starts
// with a meaningfully different lens (with SYNC LENS on, panes copy pane 1).
const DEFAULT_LENSES: BasemapId[] = [
  'nasa-true-color', 'nasa-ndvi', 'nasa-surface-temp', 'nasa-aerosol',
  'esri-imagery', 'nasa-nightlights', 'sentinel-cloudless', 'nasa-co',
]

export function SplitCompare() {
  const customCities = useCityStore((s) => s.customCities)
  const activeCity   = useCityStore((s) => s.activeCity)
  const setSplitOpen = useUIStore((s) => s.setSplitOpen)
  const activeDate   = useUIStore((s) => s.activeDate)

  const cities         = useMemo(() => [...CITIES, ...customCities], [customCities])
  const tokenAvailable = hasMapboxToken()
  const today          = activeDate || todayStr()

  // Live traffic overlay — applied to every pane at once (needs the Mapbox token)
  const [trafficOn, setTrafficOn] = useState(false)
  const [syncLens, setSyncLens] = useState(true)
  const [liveByCity, setLiveByCity] = useState<Record<string, CompareSnapshot>>({})
  const [liveLoading, setLiveLoading] = useState(false)
  const [xMetric, setXMetric] = useState<CompareMetricId>('green')
  const [yMetric, setYMetric] = useState<CompareMetricId>('gdp-pc')

  // Start with two different cities on the same imagery for an apples-to-apples
  // urban-form comparison. Lens/time comparisons remain available via SYNC LENS.
  const [panes, setPanes] = useState<PaneState[]>(() => {
    const otherCity = cities.find((city) => city.id !== activeCity.id) ?? activeCity
    return [
      { cityId: activeCity.id, basemap: 'esri-imagery', date: today },
      { cityId: otherCity.id, basemap: 'esri-imagery', date: today },
    ]
  })

  const count = panes.length

  const selectedCities = useMemo(() => {
    const ids = [...new Set(panes.map((pane) => pane.cityId))]
    return ids.map((id) => cities.find((city) => city.id === id)).filter((city): city is CityConfig => !!city)
  }, [panes, cities])

  const selectedCityKey = selectedCities.map((city) => city.id).join('|')

  useEffect(() => {
    let cancelled = false
    let done = false
    // cachedFetch can resolve from cache almost immediately — only show the
    // loading dots when the fetch is still pending a macrotask later.
    const loadingTimer = setTimeout(() => { if (!cancelled && !done) setLiveLoading(true) }, 0)
    Promise.all(selectedCities.map(async (city) => {
      const [lng, lat] = city.center
      const [aqiResult, weatherResult] = await Promise.allSettled([
        cachedFetch(`split/aqi/${city.id}`, () => fetchAQI(lng, lat, city.timezone), 5 * 60_000),
        cachedFetch(`split/weather/${city.id}`, () => fetchWeather(lng, lat, city.timezone), 10 * 60_000),
      ])
      return {
        cityId: city.id,
        snapshot: {
          aqi: aqiResult.status === 'fulfilled' ? aqiResult.value : null,
          weather: weatherResult.status === 'fulfilled' ? weatherResult.value : null,
        } satisfies CompareSnapshot,
      }
    })).then((rows) => {
      if (cancelled) return
      done = true
      setLiveByCity((prev) => ({
        ...prev,
        ...Object.fromEntries(
          rows
            // Keep a previously good snapshot when both live fetches failed —
            // merging {aqi: null, weather: null} would wipe it.
            .filter((row) => !(row.snapshot.aqi == null && row.snapshot.weather == null && prev[row.cityId]))
            .map((row) => [row.cityId, row.snapshot]),
        ),
      }))
    }).finally(() => {
      done = true
      clearTimeout(loadingTimer)
      if (!cancelled) setLiveLoading(false)
    })
    return () => { cancelled = true; clearTimeout(loadingTimer) }
    // selectedCityKey is the stable identity of cities that require live data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCityKey])

  const correlationPoints = useMemo(() => {
    const xDef = METRIC_BY_ID[xMetric]
    const yDef = METRIC_BY_ID[yMetric]
    return selectedCities.flatMap((city) => {
      const live = liveByCity[city.id] ?? null
      const x = xDef.value(city, live)
      const y = yDef.value(city, live)
      return x != null && y != null && Number.isFinite(x) && Number.isFinite(y) ? [{ city, x, y }] : []
    })
  }, [selectedCities, liveByCity, xMetric, yMetric])

  const correlation = useMemo(() => {
    if (xMetric === yMetric || correlationPoints.length < 4) return null
    return pearson(correlationPoints.map((point) => point.x), correlationPoints.map((point) => point.y))
  }, [correlationPoints, xMetric, yMetric])

  const updatePane = useCallback((i: number, next: PaneState) => {
    setPanes((prev) => {
      const current = prev[i]
      const lensChanged = current.basemap !== next.basemap || current.date !== next.date
      if (syncLens && lensChanged) {
        return prev.map((pane, idx) => idx === i ? next : { ...pane, basemap: next.basemap, date: next.date })
      }
      return prev.map((pane, idx) => idx === i ? next : pane)
    })
  }, [syncLens])


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
            live={liveByCity[pane.cityId] ?? null}
            liveLoading={liveLoading}
          />
        ))}
      </div>

      <div className="split-analysis-bar" aria-label="City metric relationship model">
        <span className="split-analysis-title">RELATIONSHIP</span>
        <label className="split-analysis-field">
          <span>X</span>
          <select value={xMetric} onChange={(e) => setXMetric(e.target.value as CompareMetricId)} aria-label="Correlation X metric">
            {COMPARE_METRICS.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
          </select>
        </label>
        <span className="split-analysis-vs">↔</span>
        <label className="split-analysis-field">
          <span>Y</span>
          <select value={yMetric} onChange={(e) => setYMetric(e.target.value as CompareMetricId)} aria-label="Correlation Y metric">
            {COMPARE_METRICS.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
          </select>
        </label>

        {correlation ? (
          <>
            <CorrelationPlot points={correlationPoints} />
            <div className="split-analysis-result">
              <strong>r {correlation.r >= 0 ? '+' : ''}{correlation.r.toFixed(2)}</strong>
              <span>
                {relationshipLabel(correlation.r)} · n={correlation.n}
                {correlation.n >= 10 && ` · p≈${correlation.p < 0.001 ? '<0.001' : correlation.p.toFixed(3)}`}
              </span>
            </div>
          </>
        ) : (
          <div className="split-analysis-result split-analysis-result--empty">
            <strong>{correlationPoints.length}/4 comparable cities</strong>
            <span>{xMetric === yMetric ? 'Choose two different metrics' : 'Four cities with both values are required'}</span>
          </div>
        )}
        <span className="split-analysis-caveat">association only · static + live sources</span>
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
                      const usedCityIds = new Set(next.map((pane) => pane.cityId))
                      const nextCity = cities.find((city) => !usedCityIds.has(city.id)) ?? cities[next.length % cities.length]
                      const lens = syncLens ? next[0].basemap : DEFAULT_LENSES[next.length % DEFAULT_LENSES.length]
                      const date = syncLens ? next[0].date : today
                      next = [...next, { cityId: nextCity.id, basemap: lens, date }]
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

        <button
          className={`split-count-btn split-sync-btn ${syncLens ? 'split-count-btn--active' : ''}`}
          onClick={() => {
            const next = !syncLens
            setSyncLens(next)
            if (next) {
              setPanes((prev) => prev.map((pane) => ({ ...pane, basemap: prev[0].basemap, date: prev[0].date })))
            }
          }}
          title="Keep every city on the same satellite lens and date"
          aria-pressed={syncLens}
        >SYNC LENS</button>

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
