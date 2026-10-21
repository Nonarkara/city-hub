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
import { cacheTimestamp } from '../lib/cached-fetch'
import { CityTwinWorkbench } from './CityTwinWorkbench'
import { CityFormPanel } from './CityFormPanel'
import { CITY_ELEMENTS, fetchCityImage, studyBounds, type CityElement, type CityImage } from '../data/city-image'
import { freshnessLabel } from '../lib/freshness'
import { pearson } from '../lib/stats'
import { populationDensityPerKm2 } from '../lib/city-facts'
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
  aqiFetchedAt: number | null
  weatherFetchedAt: number | null
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
    value: (c) => c.demographics ? populationDensityPerKm2(c) : null,
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
    source: 'Open-Meteo Air Quality feed',
    value: (_, live) => live?.aqi?.usAqi ?? null,
    format: (v) => `${v.toFixed(0)}`,
  },
  {
    id: 'pm25', label: 'Current PM2.5', shortLabel: 'PM2.5', unit: 'µg/m³',
    source: 'Open-Meteo Air Quality feed',
    value: (_, live) => live?.aqi?.pm25 ?? null,
    format: (v) => `${v.toFixed(1)}`,
  },
  {
    id: 'temperature', label: 'Current temperature', shortLabel: 'TEMP', unit: '°C',
    source: 'Open-Meteo Weather feed',
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
  const feedEnvelope = (fetchedAt: number | null | undefined, ttlMs: number): string => {
    if (!fetchedAt) return 'OPEN-METEO · NO DATA'
    const tier = Date.now() - fetchedAt <= ttlMs ? 'FEED' : 'CACHE'
    return `OPEN-METEO · ${tier} · ${freshnessLabel(fetchedAt)}`
  }
  const envelopeFor = (id: CompareMetricId): string => {
    if (id === 'aqi' || id === 'pm25') {
      return feedEnvelope(live?.aqiFetchedAt, 10 * 60_000)
    }
    if (id === 'temperature') {
      return feedEnvelope(live?.weatherFetchedAt, 10 * 60_000)
    }
    return 'REFERENCE · MIXED YEARS'
  }

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
            <span className="split-pane-stat-envelope">{envelopeFor(id)}</span>
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
  state, onChange, onRemove, onExplore, cities, tokenAvailable, index, canRemove, trafficOn, live, liveLoading, cityElement,
}: {
  state:          PaneState
  onChange:       (next: PaneState) => void
  onRemove:       () => void
  onExplore:      () => void
  cities:         CityConfig[]
  tokenAvailable: boolean
  index:          number
  canRemove:      boolean
  trafficOn:      boolean
  live:           CompareSnapshot | null
  liveLoading:    boolean
  cityElement:    CityElement | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<MapLibreMap | null>(null)
  const curBasemap   = useRef(state.basemap)
  const curDate      = useRef(state.date)
  const curCity      = useRef(state.cityId)
  const trafficOnRef = useRef(trafficOn)
  // Whether the pane is currently zoomed into a study window rather than the
  // city view. Used to put the camera back when City image is switched off.
  const wasCityElement = useRef(false)
  const [image, setImage] = useState<CityImage | null>(null)
  const [imageError, setImageError] = useState(false)
  // The city-image query is a real 40–60 seconds of upstream work the first time
  // a city is asked for, then cached for 24h. Show elapsed time so a long wait
  // reads as work in progress rather than a hang — and so a user who does not
  // want to wait can go and use the satellite view instead.
  const [imageWaitMs, setImageWaitMs] = useState(0)
  const [retryImage, setRetryImage] = useState(0)
  const [captionOpen, setCaptionOpen] = useState(true)

  const city = cities.find((c) => c.id === state.cityId) ?? cities[0]
  const imageFeatures = image?.collection.features.filter((feature) => feature.properties?.kind === cityElement) ?? []

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

  useEffect(() => {
    if (!cityElement) return
    let cancelled = false
    setImage(null)
    setImageError(false)
    setImageWaitMs(0)
    // Tick while waiting so the elapsed figure is honest rather than frozen.
    const startedAt = Date.now()
    const tick = setInterval(() => {
      if (!cancelled) setImageWaitMs(Date.now() - startedAt)
    }, 1000)
    fetchCityImage(city).then((result) => { if (!cancelled) { setImage(result); setImageWaitMs(0) } })
      .catch(() => { if (!cancelled) { setImageError(true); setImageWaitMs(0) } })
    return () => { cancelled = true; clearInterval(tick) }
  }, [city.id, !!cityElement, retryImage])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !cityElement) return
    const draw = () => {
      if (!map.isStyleLoaded()) return
      if (!map.getSource('city-image')) map.addSource('city-image', {
        type: 'geojson', data: image?.collection ?? { type: 'FeatureCollection', features: [] },
        attribution: '© OpenStreetMap contributors',
      })
      else (map.getSource('city-image') as import('maplibre-gl').GeoJSONSource).setData(image?.collection ?? { type: 'FeatureCollection', features: [] })
      if (!map.getLayer('city-image-context')) map.addLayer({ id: 'city-image-context', source: 'city-image', type: 'line', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#cfd6d8', 'line-width': 1, 'line-opacity': 0.7 } })
      const filter: import('maplibre-gl').FilterSpecification = ['==', ['get', 'kind'], cityElement]

      // ── Barrier vs seam (Lynch p.63–64) ──────────────────────────────────
      // An edge the city uses and an edge the city works around are the same
      // line on a map. Splitting them here is the whole point of this lens: a
      // seam is drawn solid and stitched with the roads that meet it; a barrier
      // is dashed and severed, because nothing meets it.
      const NEVER: import('maplibre-gl').FilterSpecification = ['==', ['get', 'kind'], '__never__']
      const edgesLens = cityElement === 'edges'
      const pathsLens = cityElement === 'paths'
      // Seams keep the highlight layer; barriers move to their own. Everything
      // that is not the Edges lens keeps the original single-layer behaviour.
      const seamFilter: import('maplibre-gl').FilterSpecification = edgesLens
        ? ['all', filter, ['!=', ['get', 'structure'], 'barrier']]
        : pathsLens
          ? ['all', filter, ['==', ['get', 'structure'], 'linked']]
          : filter
      const barrierFilter: import('maplibre-gl').FilterSpecification = edgesLens
        ? ['all', filter, ['==', ['get', 'structure'], 'barrier']]
        : pathsLens
          ? ['all', filter, ['!=', ['get', 'structure'], 'linked']]
          : NEVER

      // ── Path detachment (Lynch p.56–61) ───────────────────────────────────
      // A path can be the longest line in the window and still not be in the
      // city: prominent, and cut off. Those are drawn severest of all, because
      // "high capacity, low image value" is the finding — a long detached
      // street is the thing a planner is looking for, not a defect.
      const detachedFilter: import('maplibre-gl').FilterSpecification = pathsLens
        ? ['all', filter, ['==', ['get', 'structure'], 'detached']]
        : NEVER

      // Casing under the highlighted element. Without it a 3px brown line
      // disappears into satellite and street tiles; the casing is what makes
      // the same overlay readable over imagery and over a pale basemap.
      if (!map.getLayer('city-image-casing')) map.addLayer({ id: 'city-image-casing', source: 'city-image', type: 'line', filter: seamFilter, paint: { 'line-color': '#f7f5f0', 'line-width': 6, 'line-opacity': 0.85 } })
      else map.setFilter('city-image-casing', seamFilter)
      if (!map.getLayer('city-image-lines')) map.addLayer({ id: 'city-image-lines', source: 'city-image', type: 'line', filter: seamFilter, paint: { 'line-color': '#8a4b08', 'line-width': 3.4, 'line-opacity': 0.95 } })
      else { map.setFilter('city-image-lines', seamFilter); map.setPaintProperty('city-image-lines', 'line-width', edgesLens ? 3.4 : 3) }

      if (!map.getLayer('city-image-barrier')) map.addLayer({ id: 'city-image-barrier', source: 'city-image', type: 'line', filter: barrierFilter, paint: { 'line-color': '#243138', 'line-width': 2.4, 'line-dasharray': [1.2, 2.6], 'line-opacity': 0.95 } })
      else map.setFilter('city-image-barrier', barrierFilter)

      // Detached paths sit on top of the severed band, heavier and more open,
      // so "long and unjoined" reads differently from "short and unjoined"
      // without needing a legend to tell them apart.
      if (!map.getLayer('city-image-detached')) map.addLayer({ id: 'city-image-detached', source: 'city-image', type: 'line', filter: detachedFilter, paint: { 'line-color': '#141b20', 'line-width': 3.6, 'line-dasharray': [3.2, 3.2], 'line-opacity': 0.95 } })
      else map.setFilter('city-image-detached', detachedFilter)

      // The roads that meet each edge, so a seam reads as stitching. Without
      // them the distinction is a label; with them it is the evidence.
      const crossingFilter: import('maplibre-gl').FilterSpecification = edgesLens
        ? ['==', ['get', 'kind'], 'crossings']
        : NEVER
      if (!map.getLayer('city-image-crossings')) map.addLayer({ id: 'city-image-crossings', source: 'city-image', type: 'circle', filter: crossingFilter, paint: { 'circle-color': '#c9761f', 'circle-radius': 2.2, 'circle-stroke-color': '#f7f5f0', 'circle-stroke-width': 0.8, 'circle-opacity': 0.9 } })
      else map.setFilter('city-image-crossings', crossingFilter)

      // Junction places. A detachment verdict with no visible crossing is a
      // claim; a long street with nothing meeting it on screen is a picture of
      // one. Junctions of four or more branches are drawn larger, because
      // Lynch's own rule is that those are the ones that give people trouble.
      const junctionFilter: import('maplibre-gl').FilterSpecification = pathsLens
        ? ['==', ['get', 'kind'], 'junctions']
        : NEVER
      if (!map.getLayer('city-image-junctions')) map.addLayer({ id: 'city-image-junctions', source: 'city-image', type: 'circle', filter: junctionFilter, paint: { 'circle-color': '#c9761f', 'circle-radius': 2.2, 'circle-stroke-color': '#f7f5f0', 'circle-stroke-width': 0.8, 'circle-opacity': 0.85 } })
      else map.setFilter('city-image-junctions', junctionFilter)
      const busyJunctionFilter: import('maplibre-gl').FilterSpecification = pathsLens
        ? ['all', junctionFilter, ['>=', ['get', 'degree'], 4]]
        : NEVER
      if (!map.getLayer('city-image-junctions-busy')) map.addLayer({ id: 'city-image-junctions-busy', source: 'city-image', type: 'circle', filter: busyJunctionFilter, paint: { 'circle-color': '#b3341f', 'circle-radius': 4.6, 'circle-stroke-color': '#f7f5f0', 'circle-stroke-width': 1.2, 'circle-opacity': 0.95 } })
      else map.setFilter('city-image-junctions-busy', busyJunctionFilter)

      // ── Node image against node function (Lynch p.72–76) ────────────────────
      // Scollay Square was the switch point at Beacon Hill and could not be
      // remembered in any concrete way; Copley Square was less important and
      // very sharply imaged. Drawn here so the two are different colours:
      // function without anything to recognise is the one worth stopping for.
      const nodesLens = cityElement === 'nodes'
      const verdictFilter: import('maplibre-gl').FilterSpecification = nodesLens
        ? ['==', ['get', 'kind'], 'junctions']
        : NEVER
      if (!map.getLayer('city-image-node-verdict')) map.addLayer({
        id: 'city-image-node-verdict', source: 'city-image', type: 'circle', filter: verdictFilter,
        paint: {
          'circle-color': ['match', ['get', 'verdict'],
            'shapeless', '#b3341f',      // works hard, nothing to recognise
            'anchored', '#8a4b08',       // works hard and you can see it
            'memorable', '#c9761f',      // seen clearly, does less
            '#5a6a72'],                  // quiet: an ordinary crossing
          'circle-radius': ['match', ['get', 'verdict'], 'shapeless', 6.5, 'anchored', 5, 'memorable', 4.5, 3],
          'circle-stroke-color': '#f7f5f0', 'circle-stroke-width': 1.4, 'circle-opacity': 0.95,
        },
      })
      else map.setFilter('city-image-node-verdict', verdictFilter)
      if (!map.getLayer('city-image-points')) map.addLayer({ id: 'city-image-points', source: 'city-image', type: 'circle', filter: ['all', filter, ['==', ['geometry-type'], 'Point']], paint: { 'circle-color': '#8a4b08', 'circle-radius': cityElement === 'districts' ? 9 : 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } })
      else map.setFilter('city-image-points', ['all', filter, ['==', ['geometry-type'], 'Point']])
    }
    draw()
    map.on('style.load', draw)
    return () => { map.off('style.load', draw) }
  }, [image, cityElement])

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
    if (cityElement) {
      // Keep the basemap. This used to replace the whole style with a flat
      // background so the OSM proxies stood alone as evidence. That bought
      // nothing legible — and when a read failed it left half the screen as an
      // empty void while the caption claimed "the satellite view underneath is
      // unaffected". The proxies still need somewhere to sit, and the basemap
      // is real, labelled context rather than a claim about the city image.
      wasCityElement.current = true
      const [w, s, e, n] = studyBounds(city)
      map.fitBounds([[w, s], [e, n]], { padding: 28, duration: 0 })
      return
    }
    const leavingStudyWindow = wasCityElement.current
    wasCityElement.current = false
    const bmChanged = curBasemap.current !== state.basemap
    const dtChanged = curDate.current !== state.date
    const temporal  = isTemporalBasemap(state.basemap)
    // Reload the basemap only when it actually changed. Leaving a study window
    // is just a camera move — the style never left.
    if (bmChanged || (temporal && dtChanged)) {
      curBasemap.current = state.basemap
      curDate.current    = state.date
      map.setStyle(getBasemapDef(state.basemap, state.date).style)
    }
    if (leavingStudyWindow || bmChanged || (temporal && dtChanged)) {
      map.jumpTo({ center: city.center, zoom: city.zoom })
    }
  }, [state.basemap, state.date, cityElement, city.id])

  useEffect(() => {
    const map = mapRef.current
    if (!map || curCity.current === state.cityId) return
    curCity.current = state.cityId
    if (cityElement) return
    map.flyTo({ center: city.center, zoom: city.zoom, duration: 1100, essential: true })
  }, [state.cityId, city.center, city.zoom])

  const temporal = isTemporalBasemap(state.basemap)

  return (
    <div className="split-pane">
      <div className="split-pane-map" ref={containerRef} />

      {/* Pane index badge */}
      <div className="split-pane-badge">{index + 1}</div>

      {!cityElement && <PaneMetricDock city={city} live={live} loading={liveLoading} />}
      {cityElement && <div className={`city-image-caption ${captionOpen ? '' : 'city-image-caption--collapsed'}`} aria-live="polite">
        <strong>{city.name}</strong>
        <button type="button" className="city-image-caption-toggle" onClick={() => setCaptionOpen((v) => !v)} aria-expanded={captionOpen} aria-label={captionOpen ? `Collapse ${city.name} notes` : `Expand ${city.name} notes`}>{captionOpen ? '−' : '+'}</button>
        <span>{imageError
          ? 'Public map data unavailable — basemap unchanged'
          : !image
            ? `Reading OpenStreetMap… ${imageWaitMs > 3000 ? `${Math.round(imageWaitMs / 1000)}s` : ''}`.trim()
            : cityElement === 'edges'
              ? `${image.edgeSummary.seam + image.edgeSummary.partial + image.edgeSummary.barrier} edge${image.edgeSummary.seam + image.edgeSummary.partial + image.edgeSummary.barrier === 1 ? '' : 's'} · ${image.edgeSummary.seam} seam${image.edgeSummary.seam === 1 ? '' : 's'}, ${image.edgeSummary.barrier} barrier${image.edgeSummary.barrier === 1 ? '' : 's'}${image.crossingsTruncated ? ' · incomplete road contacts, reads toward barrier' : image.truncated || image.edgeTruncated ? ' · limited sample' : ''}`
              : cityElement === 'paths'
              ? `${image.pathSummary.linked + image.pathSummary.sparse + image.pathSummary.detached} named path${image.pathSummary.linked + image.pathSummary.sparse + image.pathSummary.detached === 1 ? '' : 's'} · ${image.pathSummary.linked} linked, ${image.pathSummary.sparse} sparse, ${image.pathSummary.detached} detached${image.truncated ? ' · limited sample' : ''}`
              : cityElement === 'nodes'
                ? `${image.nodeSummary.anchored + image.nodeSummary.shapeless + image.nodeSummary.memorable + image.nodeSummary.quiet} junctions · ${image.nodeSummary.shapeless} do work with nothing to recognise${image.truncated ? ' · limited sample' : ''}`
                : `${imageFeatures.length} mapped ${cityElement === 'districts' ? 'place location' : 'feature'}${imageFeatures.length === 1 ? '' : 's'}${image.truncated ? ' · limited sample' : ''}`}</span>
        {image && cityElement === 'edges' && (
          <small>
            Solid where the city meets the edge and keeps going — a seam. Dashed where nothing meets it and the city works around it — a barrier. Lynch 1960, p.63–64.
            {/* Say so when the distinction is not discriminating. An all-seam
                window is a real result, and reporting it as though the split had
                been decided would overstate what was measured. */}
            {image.edgeSummary.barrier === 0
              ? ' No edge in this window is unjoined enough to read as a barrier, so every measured edge comes back a seam.'
              : image.edgeSummary.partial === 0
                ? ' Nothing sits between the two bands in this window.'
                : ''}
          </small>
        )}
        {image && cityElement === 'paths' && (
          <small>
            Solid where other streets join this one; dashed where they do not. A long street nothing meets is detached — prominent, and outside the image.
            {image.pathGrain.grained
              ? ` Alignment runs ${Math.round(image.pathGrain.concentration * 100)}% along one direction.`
              : ' The named network has no dominant direction here, so there is nothing for a path to align to.'}
            {' '}Junctions of four branches or more are marked in red — Lynch found those give people trouble. Lynch 1960, p.56–61.
          </small>
        )}
        {image && cityElement === 'nodes' && (
          <small>
            Red junctions are doing real work with nothing around them a person could name — Scollay Square, the switch point at Beacon Hill, which no one could remember beyond the subway station. Amber junctions are seen clearly whatever they do — Copley Square, less important, remembered by its buildings. Functional importance and image strength are different quantities. Lynch 1960, p.72–76.
          </small>
        )}
        {imageError && <button type="button" onClick={() => setRetryImage((value) => value + 1)}>Retry</button>}
        {!imageError && !image && <small>First read of a city takes up to a minute. It is then kept for a day. The basemap stays live underneath while you wait.</small>}
        {image && (
          <small>
            {[...new Set(imageFeatures.map((feature) => feature.properties?.name))]
              .filter((name): name is string => typeof name === 'string' && name.length > 0)
              .slice(0, 3)
              .join(' / ') || (
                // A truncated fetch that found nothing is NOT evidence that the
                // city lacks this element — it is evidence the sample stopped
                // before reaching it. Say which one this is.
                image.truncated
                  ? 'No match inside the retrieved sample. The read was cut off before covering the whole study window, so absence here is not absence in the city.'
                  : 'No matching features in this study window.'
              )}
          </small>
        )}
        {image && <small>OSM reference · retrieved {freshnessLabel(image.fetchedAt)}{image.sourceTime ? ` · source ${image.sourceTime.slice(0, 10)}` : ' · source date unavailable'}</small>}
      </div>}

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
        <button type="button" className="split-select twin-explore" onClick={onExplore} aria-label={`Explore ${city.name}`}>Explore {city.name}</button>
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

        {!cityElement && <select
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
        </select>}

        {temporal && !cityElement && (
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
  const compareSet   = useCityStore((s) => s.compareSet)
  const setSplitOpen = useUIStore((s) => s.setSplitOpen)
  const activeDate   = useUIStore((s) => s.activeDate)

  // Includes the active city, not only the atlas and the saved custom ones. A
  // city found through search lives ephemerally in `activeCity` and is in
  // neither list, so a pane holding its id resolved to `cities[0]` — the pane
  // silently became Bangkok and the button that opened it kept saying "View
  // city" over a map of somewhere else entirely.
  const cities         = useMemo(
    () => (customCities.some((c) => c.id === activeCity.id) || CITIES.some((c) => c.id === activeCity.id)
      ? [...CITIES, ...customCities]
      : [...CITIES, ...customCities, activeCity]),
    [customCities, activeCity],
  )
  const tokenAvailable = hasMapboxToken()
  const today          = activeDate || todayStr()

  // Live traffic overlay — applied to every pane at once (needs the Mapbox token)
  const [trafficOn, setTrafficOn] = useState(false)
  const [syncLens, setSyncLens] = useState(true)
  // Map-first: the notes rail is open on wide screens, tucked away on phones.
  const [notesOpen, setNotesOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768)
  const [liveByCity, setLiveByCity] = useState<Record<string, CompareSnapshot>>({})
  const [liveLoading, setLiveLoading] = useState(false)
  const [xMetric, setXMetric] = useState<CompareMetricId>('green')
  const [yMetric, setYMetric] = useState<CompareMetricId>('gdp-pc')
  const [explorerCityId, setExplorerCityId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [cityElement, setCityElement] = useState<CityElement | null>(null)
  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((tick) => tick + 1), 10 * 60_000)
    return () => clearInterval(timer)
  }, [])

  // Start from the user's pinned comparison when one exists. Otherwise pair
  // the active city with Kranj, the project's established second-city case,
  // then fall back to the next available city.
  const [panes, setPanes] = useState<PaneState[]>(() => {
    const pinned = compareSet
      .map((id) => cities.find((city) => city.id === id))
      .filter((city): city is CityConfig => !!city)
      .slice(0, 8)
    const seeded = pinned.length >= MIN_PANES
      ? pinned
      : [
          activeCity,
          cities.find((city) => city.id === 'kranj' && city.id !== activeCity.id)
            ?? cities.find((city) => city.id !== activeCity.id)
            ?? activeCity,
        ]
    return seeded.map((city) => ({ cityId: city.id, basemap: 'esri-imagery', date: today }))
  })

  const previousActiveCityId = useRef(activeCity.id)
  useEffect(() => {
    if (previousActiveCityId.current === activeCity.id) return
    previousActiveCityId.current = activeCity.id
    if (compareSet.length >= MIN_PANES) return
    setPanes((prev) => prev.map((pane, index) => (
      index === 0 ? { ...pane, cityId: activeCity.id } : pane
    )))
  }, [activeCity.id, compareSet.length])

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
      const aqiKey = `openmeteo/aqi/${lat.toFixed(3)},${lng.toFixed(3)}`
      const weatherKey = `openmeteo/weather/${lat.toFixed(3)},${lng.toFixed(3)}`
      const [aqiResult, weatherResult] = await Promise.allSettled([
        fetchAQI(lng, lat, city.timezone),
        fetchWeather(lng, lat, city.timezone),
      ])
      return {
        cityId: city.id,
        snapshot: {
          aqi: aqiResult.status === 'fulfilled' ? aqiResult.value : null,
          weather: weatherResult.status === 'fulfilled' ? weatherResult.value : null,
          aqiFetchedAt: aqiResult.status === 'fulfilled' ? cacheTimestamp(aqiKey) || null : null,
          weatherFetchedAt: weatherResult.status === 'fulfilled' ? cacheTimestamp(weatherKey) || null : null,
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
  }, [selectedCityKey, refreshTick])

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSplitOpen(false)
      const target = e.target as HTMLElement | null
      const typing = !!target && /INPUT|SELECT|TEXTAREA/.test(target.tagName)
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) setNotesOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSplitOpen])

  // Grid class based on count. Odd counts (from removing a pane) bucket up to the
  // next even grid; the trailing empty cell just shows the gap colour.
  const bucket = count <= 2 ? 2 : count === 3 ? 3 : count <= 4 ? 4 : count <= 6 ? 6 : 8
  const gridClass = `split-grid split-grid--${bucket}`
  const explorerCity = selectedCities.find((city) => city.id === explorerCityId)

  // One city image for the form readout, at the surface rather than per pane.
  // `fetchCityImage` caches per city centre, so this resolves from the primary
  // pane's in-flight read rather than issuing a second query.
  const primaryCity = panes[0]
    ? (cities.find((c) => c.id === panes[0].cityId) ?? CITIES[0])
    : CITIES[0]
  const [formImage, setFormImage] = useState<import('../data/city-image').CityImage | null>(null)
  const [formError, setFormError] = useState(false)

  useEffect(() => {
    if (!cityElement) return
    let cancelled = false
    setFormImage(null)
    setFormError(false)
    fetchCityImage(primaryCity)
      .then((result) => { if (!cancelled) setFormImage(result) })
      .catch(() => { if (!cancelled) setFormError(true) })
    return () => { cancelled = true }
  }, [primaryCity.id, !!cityElement])

  return (
    <div className="split-compare">
      <div className="city-image-nav">
        <button type="button" className="city-image-mode" aria-pressed={cityElement !== null} onClick={() => setCityElement(cityElement ? null : 'paths')}>City image</button>
        {cityElement ? <>
          <nav aria-label="Lynch city elements">{CITY_ELEMENTS.map((element) => <button type="button" key={element.id} aria-pressed={cityElement === element.id} onClick={() => setCityElement(element.id)}>{element.label}</button>)}</nav>
          <span className="city-image-scale">Approx. 4 × 4 km study windows</span>
        </> : <span className="city-image-intro">Compare the places people move through, recognise and remember.</span>}
      </div>
      {cityElement && <CityFormPanel city={primaryCity} image={formImage} error={formError} />}
      <div className="twin-map-workspace">
      <div className={gridClass}>
        {panes.map((pane, i) => (
          <CompareMapPane
            key={i}
            state={pane}
            onChange={(next) => updatePane(i, next)}
            onRemove={() => removePane(i)}
            onExplore={() => setExplorerCityId(pane.cityId)}
            cities={cities}
            tokenAvailable={tokenAvailable}
            index={i}
            canRemove={count > MIN_PANES}
            trafficOn={trafficOn}
            live={liveByCity[pane.cityId] ?? null}
            liveLoading={liveLoading}
            cityElement={cityElement}
          />
        ))}
      </div>
      {explorerCity && <CityTwinWorkbench key={explorerCity.id} city={explorerCity} snapshot={liveByCity[explorerCity.id] ?? null} onClose={() => setExplorerCityId(null)} onPlan={() => {
        useCityStore.getState().setActiveCity(explorerCity)
        setSplitOpen(false)
        useUIStore.getState().setPlanOpen(true)
      }} />}
      {/* Provenance, not chrome. This line says what the overlay is and how far
          to trust it ("OSM proxies; coverage varies"), so it must not depend on a
          panel being opened — a reader who never finds the notes toggle would
          never learn the data is partial. It sits outside the notes panel so the
          map stays first without the caveat going with it. */}
      {cityElement && !explorerCity && <div className="city-image-reading"><strong>{CITY_ELEMENTS.find((element) => element.id === cityElement)?.question}</strong><span>{CITY_ELEMENTS.find((element) => element.id === cityElement)?.proxy}. OSM proxies; coverage varies. <a href="https://mitpress.mit.edu/9780262620017/the-image-of-the-city/" target="_blank" rel="noreferrer">Kevin Lynch, 1960</a></span></div>}
      {!explorerCity && notesOpen && (
        <aside className="split-notes" aria-label="Comparison notes">
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
            <span className="split-analysis-caveat">association only · reference profiles use mixed years · feeds show fetch age</span>
          </div>
        </aside>
      )}
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
          type="button"
          className={`split-count-btn split-notes-btn ${notesOpen ? 'split-count-btn--active' : ''}`}
          onClick={() => setNotesOpen((v) => !v)}
          aria-pressed={notesOpen}
          title="Show or hide the comparison notes (N) · บันทึก · 注释"
        >NOTES</button>

        <button
          className="split-toolbar-btn split-toolbar-btn--exit"
          onClick={() => setSplitOpen(false)}
          title="Exit split (Esc)"
        >✕ EXIT</button>
      </div>
    </div>
  )
}
