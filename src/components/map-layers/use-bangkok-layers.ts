/**
 * Single hook that owns all Bangkok layer management.
 *
 * Pattern (per geopolitics map-engine.ts):
 *   - Layers are added lazily on first activation
 *   - Toggle = set visibility 'visible' | 'none'
 *   - Data fetchers go through cachedFetch (TTL + dedup)
 *
 * Adds layers via standard MapLibre addSource/addLayer.
 */
import { useEffect, useRef } from 'react'
import type { Map as MapLibre, Popup as MapLibrePopup } from 'maplibre-gl'
import { Popup } from 'maplibre-gl'
import { bangkokAQIStations, bangkokPm25Live, thailandFires24h, centralFloods } from '../../data/gistda'
import { pm25ToRisk, civicToRisk, RISK_FILL, RISK_BORDER, RISK_COLOR, type RiskLevel } from '../../lib/risk'
import { type DistrictSummary } from '../../hooks/useDistrictData'
import { firmsThailand24h, gibsAerosolTileTemplate } from '../../data/nasa'
import { loadBangkokRail, loadBangkokKhet } from '../../data/bma'
import { fetchTraffyGeoJSON } from '../../data/traffy'
import { bangkokAQI } from '../../data/openmeteo-aq'
import { PM25_COLORS, AQI_COLORS } from '../../config/bangkok-layers'

interface LayerLoadState {
  loaded: Set<string>
  loading: Set<string>
  popup?: MapLibrePopup
}

export function useBangkokLayers(
  map: MapLibre | null,
  activeIds: Set<string>,
  bangkokMode: boolean,
  onDistrictClick?: (d: DistrictSummary) => void,
) {
  const stateRef = useRef<LayerLoadState>({ loaded: new Set(), loading: new Set() })
  // Keep callback ref current so the once-wired listener always calls the latest handler
  const onDistrictClickRef = useRef<((d: DistrictSummary) => void) | undefined>(onDistrictClick)
  onDistrictClickRef.current = onDistrictClick

  // Cleanup when Bangkok mode deactivates
  useEffect(() => {
    if (bangkokMode || !map) return
    const state = stateRef.current
    state.loaded.forEach((id) => {
      LAYER_IDS_FOR_TOGGLE[id]?.forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
      })
      const srcId = SOURCE_ID_FOR_TOGGLE[id]
      if (srcId && map.getSource(srcId)) map.removeSource(srcId)
    })
    state.loaded.clear()
    state.popup?.remove()
    state.popup = undefined
  }, [bangkokMode, map])

  useEffect(() => {
    if (!map || !bangkokMode) return

    const ensureStyleLoaded = (fn: () => void) => {
      if (map.isStyleLoaded()) fn()
      else map.once('load', fn)
    }

    ensureStyleLoaded(() => {
      const state = stateRef.current
      // For each managed layer: load on first activation, set visibility
      for (const id of MANAGED_IDS) {
        const wanted = activeIds.has(id)
        if (wanted && !state.loaded.has(id) && !state.loading.has(id)) {
          state.loading.add(id)
          loadLayer(id, map).then(() => {
            state.loading.delete(id)
            state.loaded.add(id)
            setVisibility(map, id, activeIds.has(id))
            // wire popup once after first load (for PM2.5 stations)
            if (id === 'pm25-stations' && !state.popup) {
              state.popup = wirePm25Popup(map)
            }
            if (id === 'traffy-issues' && !state.popup) {
              state.popup = wireTraffyPopup(map)
            }
            if (id === 'districts' && !state.popup) {
              state.popup = wireDistrictPopup(map, onDistrictClickRef)
            }
          }).catch((err) => {
            state.loading.delete(id)
            console.warn(`[bangkok-layers] failed to load ${id}:`, err)
          })
        } else if (state.loaded.has(id)) {
          setVisibility(map, id, wanted)
        }
      }
    })
  }, [map, activeIds, bangkokMode])
}

// ── Layer ID maps ─────────────────────────────────────────────────────────

const MANAGED_IDS = ['pm25-stations', 'aqi-live', 'fires-gistda', 'fires-firms', 'floods', 'districts', 'rail', 'gibs-aod', 'traffy-issues']

// MapLibre source IDs (one per toggle)
const SOURCE_ID_FOR_TOGGLE: Record<string, string> = {
  'pm25-stations': 'src-pm25',
  'aqi-live': 'src-aqi',
  'fires-gistda': 'src-fires-gistda',
  'fires-firms': 'src-fires-firms',
  'floods': 'src-floods',
  'districts': 'src-districts',
  'rail': 'src-rail',
  'gibs-aod': 'src-gibs-aod',
  'traffy-issues': 'src-traffy',
}

// MapLibre layer IDs (one toggle may add multiple layers — e.g. rail = lines + dots + labels)
const LAYER_IDS_FOR_TOGGLE: Record<string, string[]> = {
  'pm25-stations': ['ly-pm25'],
  'aqi-live': ['ly-aqi'],
  'fires-gistda':  ['ly-fires-gistda'],
  'fires-firms':   ['ly-fires-firms'],
  'floods':        ['ly-floods'],
  'districts':     ['ly-districts-fill', 'ly-districts-line', 'ly-districts-label'],
  'rail':          ['ly-rail-line', 'ly-rail-dots', 'ly-rail-labels'],
  'gibs-aod':      ['ly-gibs-aod'],
  'traffy-issues': ['ly-traffy-issues'],
}

function setVisibility(map: MapLibre, toggleId: string, visible: boolean) {
  const layerIds = LAYER_IDS_FOR_TOGGLE[toggleId]
  if (!layerIds) return
  for (const lid of layerIds) {
    if (map.getLayer(lid)) {
      map.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none')
    }
  }
}

// ── Layer loaders ─────────────────────────────────────────────────────────

async function loadLayer(id: string, map: MapLibre) {
  switch (id) {
    case 'pm25-stations':   return addPm25Stations(map)
    case 'aqi-live':        return addAQILive(map)
    case 'fires-gistda':    return addGistdaFires(map)
    case 'fires-firms':     return addFirmsFires(map)
    case 'floods':          return addFloods(map)
    case 'districts':       return addDistricts(map)
    case 'rail':            return addRail(map)
    case 'gibs-aod':        return addGibsAod(map)
    case 'traffy-issues':   return addTraffyIssues(map)
  }
}

async function addPm25Stations(map: MapLibre) {
  const data = await bangkokAQIStations()
  map.addSource('src-pm25', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-pm25',
    type: 'circle',
    source: 'src-pm25',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 14, 14],
      'circle-color': [
        'match', ['get', 'level'],
        'good', PM25_COLORS.good,
        'moderate', PM25_COLORS.moderate,
        'sensitive', PM25_COLORS.sensitive,
        'unhealthy', PM25_COLORS.unhealthy,
        'hazardous', PM25_COLORS.hazardous,
        PM25_COLORS['—'],
      ],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.92,
    },
  })
  map.getCanvas().style.cursor = ''
}

async function addAQILive(map: MapLibre) {
  const aqi = await bangkokAQI()
  // Render a single centered dot with AQI color
  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [100.5018, 13.7563] },
      properties: {
        usAqi: aqi.usAqi,
        level: aqi.level,
        pm25: aqi.pm25,
        pm10: aqi.pm10,
        no2: aqi.no2,
        o3: aqi.o3,
        so2: aqi.so2,
        co: aqi.co,
      },
    }],
  }
  map.addSource('src-aqi', { type: 'geojson', data: fc })
  map.addLayer({
    id: 'ly-aqi',
    type: 'circle',
    source: 'src-aqi',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 20, 14, 60],
      'circle-color': [
        'match', ['get', 'level'],
        'good', AQI_COLORS.good,
        'moderate', AQI_COLORS.moderate,
        'unhealthy-sensitive', AQI_COLORS['unhealthy-sensitive'],
        'unhealthy', AQI_COLORS.unhealthy,
        'very-unhealthy', AQI_COLORS['very-unhealthy'],
        'hazardous', AQI_COLORS.hazardous,
        AQI_COLORS['—'],
      ],
      'circle-opacity': 0.25,
      'circle-stroke-color': [
        'match', ['get', 'level'],
        'good', AQI_COLORS.good,
        'moderate', AQI_COLORS.moderate,
        'unhealthy-sensitive', AQI_COLORS['unhealthy-sensitive'],
        'unhealthy', AQI_COLORS.unhealthy,
        'very-unhealthy', AQI_COLORS['very-unhealthy'],
        'hazardous', AQI_COLORS.hazardous,
        AQI_COLORS['—'],
      ],
      'circle-stroke-width': 2,
    },
  })
}

async function addGistdaFires(map: MapLibre) {
  const data = await thailandFires24h()
  map.addSource('src-fires-gistda', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-fires-gistda',
    type: 'circle',
    source: 'src-fires-gistda',
    paint: {
      'circle-radius': 4,
      'circle-color': '#ff7043',
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 0.5,
      'circle-opacity': 0.85,
    },
    layout: { 'visibility': 'none' },
  })
}

async function addFirmsFires(map: MapLibre) {
  const data = await firmsThailand24h()
  map.addSource('src-fires-firms', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-fires-firms',
    type: 'circle',
    source: 'src-fires-firms',
    paint: {
      'circle-radius': 3,
      'circle-color': '#d32f2f',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 0.5,
      'circle-opacity': 0.9,
    },
    layout: { 'visibility': 'none' },
  })
}

async function addFloods(map: MapLibre) {
  const data = await centralFloods()
  map.addSource('src-floods', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-floods',
    type: 'fill',
    source: 'src-floods',
    paint: {
      'fill-color': '#2962ff',
      'fill-opacity': 0.3,
      'fill-outline-color': '#2962ff',
    },
    layout: { 'visibility': 'none' },
  })
}

async function addDistricts(map: MapLibre) {
  // Parallel fetch — all cached, no double-HTTP
  const [khetResult, traffyResult, pm25Result] = await Promise.all([
    loadBangkokKhet().catch((): null => null),
    fetchTraffyGeoJSON(500).catch((): null => null),
    bangkokPm25Live().catch((): null => null),
  ])

  // Count active Traffy tickets per district (Thai name key, strip เขต prefix)
  const counts: Record<string, number> = {}
  for (const f of (traffyResult?.features ?? [])) {
    const d = ((f.properties?.district as string) ?? '').replace(/^เขต/, '').trim()
    if (d) counts[d] = (counts[d] ?? 0) + 1
  }

  // City-wide air risk → numeric score
  const airRisk = pm25Result ? pm25ToRisk(pm25Result.pm25) : 'good'
  const airScore = ({ good: 0, moderate: 1, high: 2, critical: 3 } as Record<string, number>)[airRisk] ?? 0

  // Inject per-khet risk_level derived from max(air, civic complaint density)
  const LEVELS = ['good', 'moderate', 'high', 'critical'] as const
  const features = (khetResult?.features ?? []).map((f) => {
    const th = ((f.properties?.name_th as string) ?? '').trim()
    const count = counts[th] ?? 0
    const civicScore = count >= 200 ? 3 : count >= 50 ? 2 : count >= 5 ? 1 : 0
    const score = Math.max(airScore, civicScore)
    return {
      ...f,
      properties: {
        ...f.properties,
        risk_level: LEVELS[score],
        complaint_count: count,
      },
    }
  })

  const data = { type: 'FeatureCollection' as const, features }
  map.addSource('src-districts', { type: 'geojson', data })

  // Data-driven fill — each khet shows its own status colour
  map.addLayer({
    id: 'ly-districts-fill',
    type: 'fill',
    source: 'src-districts',
    paint: {
      'fill-color': [
        'match', ['get', 'risk_level'],
        'moderate', RISK_FILL.moderate,
        'high',     RISK_FILL.high,
        'critical', RISK_FILL.critical,
        RISK_FILL.good,
      ],
      'fill-opacity': 1,
    },
  })
  map.addLayer({
    id: 'ly-districts-line',
    type: 'line',
    source: 'src-districts',
    paint: {
      'line-color': [
        'match', ['get', 'risk_level'],
        'moderate', RISK_BORDER.moderate,
        'high',     RISK_BORDER.high,
        'critical', RISK_BORDER.critical,
        RISK_BORDER.good,
      ],
      'line-width': 1.2,
      'line-opacity': 0.85,
    },
  })
  map.addLayer({
    id: 'ly-districts-label',
    type: 'symbol',
    source: 'src-districts',
    minzoom: 11,
    layout: {
      'text-field': ['get', 'name_en'],
      'text-size': 11,
      'text-font': ['Fira GO Regular'],
      'text-letter-spacing': 0.08,
      'text-transform': 'uppercase',
    },
    paint: {
      'text-color': '#f59e0b',
      'text-halo-color': '#0a0a0a',
      'text-halo-width': 1.5,
      'text-opacity': 0.85,
    },
  })
}

async function addRail(map: MapLibre) {
  const data = await loadBangkokRail()
  map.addSource('src-rail', { type: 'geojson', data })
  // Lines (filter to LineString features)
  map.addLayer({
    id: 'ly-rail-line',
    type: 'line',
    source: 'src-rail',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['coalesce', ['get', 'color'], '#888'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 14, 4],
      'line-opacity': 0.85,
    },
  })
  // Station dots
  map.addLayer({
    id: 'ly-rail-dots',
    type: 'circle',
    source: 'src-rail',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': ['case', ['get', 'interchange'], 5, 3],
      'circle-color': ['case', ['get', 'interchange'], '#f59e0b', '#f5f5f0'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1.5,
    },
  })
  // Labels
  map.addLayer({
    id: 'ly-rail-labels',
    type: 'symbol',
    source: 'src-rail',
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'interchange'], true]],
    minzoom: 12,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-font': ['Fira GO Regular'],
      'text-offset': [0, 1],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#f5f5f0',
      'text-halo-color': '#0a0a0a',
      'text-halo-width': 1.5,
    },
  })
}

async function addGibsAod(map: MapLibre) {
  const template = gibsAerosolTileTemplate()
  map.addSource('src-gibs-aod', {
    type: 'raster',
    tiles: [template],
    tileSize: 256,
    maxzoom: 6,
  })
  map.addLayer({
    id: 'ly-gibs-aod',
    type: 'raster',
    source: 'src-gibs-aod',
    paint: { 'raster-opacity': 0.5 },
    layout: { 'visibility': 'none' },
  })
}

async function addTraffyIssues(map: MapLibre) {
  const data = await fetchTraffyGeoJSON(500)
  map.addSource('src-traffy', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-traffy-issues',
    type: 'circle',
    source: 'src-traffy',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 7],
      'circle-color': ['coalesce', ['get', 'color'], '#9e9e9e'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1,
      'circle-opacity': 0.88,
    },
  })
}

// ── Popup wiring ──────────────────────────────────────────────────────────

function wirePm25Popup(map: MapLibre): MapLibrePopup {
  const popup = new Popup({ closeButton: true, closeOnClick: true, className: 'unl-popup' })
  map.on('click', 'ly-pm25', (e) => {
    const f = e.features?.[0]
    if (!f || f.geometry.type !== 'Point') return
    const props = f.properties ?? {}
    const coords = (f.geometry.coordinates as [number, number]).slice() as [number, number]
    const html = `
      <div class="popup-pm25">
        <div class="popup-station">${escape(String(props.st_name ?? 'Station'))}</div>
        <div class="popup-row"><span class="popup-label">PM2.5</span><span class="popup-val">${Number(props.pm25 ?? 0).toFixed(1)} <span class="popup-unit">µg/m³</span></span></div>
        <div class="popup-row"><span class="popup-label">LEVEL</span><span class="popup-val">${String(props.level ?? '—').toUpperCase()}</span></div>
        <div class="popup-row popup-meta"><span class="popup-label">AS OF</span><span>${String(props.acq_date ?? '—')} ${String(props.acq_time ?? '')}</span></div>
      </div>`
    popup.setLngLat(coords).setHTML(html).addTo(map)
  })
  map.on('mouseenter', 'ly-pm25', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'ly-pm25', () => { map.getCanvas().style.cursor = '' })
  return popup
}

function wireTraffyPopup(map: MapLibre): MapLibrePopup {
  const popup = new Popup({ closeButton: true, closeOnClick: true, className: 'unl-popup' })
  map.on('click', 'ly-traffy-issues', (e) => {
    const f = e.features?.[0]
    if (!f || f.geometry.type !== 'Point') return
    const props = f.properties ?? {}
    const coords = (f.geometry.coordinates as [number, number]).slice() as [number, number]
    const state = String(props.state ?? '—')
    const type = String(props.type ?? '—')
    const addr = String(props.address ?? '—')
    const ts = String(props.timestamp ?? '').slice(0, 16).replace('T', ' ')
    const summary = String(props.ai_summary ?? '')
    const html = `
      <div class="popup-traffy">
        <div class="popup-traffy-type">${escape(type)}</div>
        <div class="popup-traffy-state" data-state="${escape(state)}">${escape(state)}</div>
        <div class="popup-traffy-addr">${escape(addr)}</div>
        ${summary ? `<div class="popup-traffy-summary">${escape(summary)}</div>` : ''}
        <div class="popup-row popup-meta"><span class="popup-label">REPORTED</span><span>${escape(ts)}</span></div>
      </div>`
    popup.setLngLat(coords).setHTML(html).addTo(map)
  })
  map.on('mouseenter', 'ly-traffy-issues', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'ly-traffy-issues', () => { map.getCanvas().style.cursor = '' })
  return popup
}

function wireDistrictPopup(
  map: MapLibre,
  onClickRef: { current: ((d: DistrictSummary) => void) | undefined },
): MapLibrePopup {
  const popup = new Popup({ closeButton: true, closeOnClick: true, className: 'unl-popup' })
  map.on('click', 'ly-districts-fill', (e) => {
    const f = e.features?.[0]
    if (!f) return
    const props = f.properties ?? {}
    const nameTh = String(props.name_th ?? '—')
    const nameEn = String(props.name_en ?? '—')
    const riskLevel = String(props.risk_level ?? 'good') as RiskLevel
    const count = Number(props.complaint_count ?? 0)
    const html = `
      <div class="popup-district">
        <div class="popup-district-name">${escape(nameEn)}</div>
        <div class="popup-district-local">${escape(nameTh)}</div>
        <div class="popup-row">
          <span class="popup-label">RISK LEVEL</span>
          <span class="popup-val" style="color: ${RISK_COLOR[riskLevel] ?? '#888'}">${riskLevel.toUpperCase()}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">CIVIC ISSUES</span>
          <span class="popup-val">${count.toLocaleString()}</span>
        </div>
      </div>`
    popup.setLngLat(e.lngLat).setHTML(html).addTo(map)
    // Fire React callback so App.tsx can open the full DistrictPanel
    onClickRef.current?.({
      name_th: nameTh,
      name_en: nameEn,
      risk_level: riskLevel,
      complaint_count: count,
      civic_risk: civicToRisk(count),
    })
  })
  map.on('mouseenter', 'ly-districts-fill', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'ly-districts-fill', () => { map.getCanvas().style.cursor = '' })
  return popup
}

function escape(s: string): string {
  return s.replace(/[&<"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}
