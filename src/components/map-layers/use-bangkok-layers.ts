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
import { bangkokAQIStations, thailandFires24h, centralFloods } from '../../data/gistda'
import { firmsThailand24h, gibsAerosolTileTemplate } from '../../data/nasa'
import { loadBangkokRail, loadBangkokDistricts } from '../../data/bma'
import { PM25_COLORS } from '../../config/bangkok-layers'

interface LayerLoadState {
  loaded: Set<string>
  loading: Set<string>
  popup?: MapLibrePopup
}

export function useBangkokLayers(
  map: MapLibre | null,
  activeIds: Set<string>,
  bangkokMode: boolean,
) {
  const stateRef = useRef<LayerLoadState>({ loaded: new Set(), loading: new Set() })

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

const MANAGED_IDS = ['pm25-stations', 'fires-gistda', 'fires-firms', 'floods', 'districts', 'rail', 'gibs-aod']

// MapLibre source IDs (one per toggle)
const SOURCE_ID_FOR_TOGGLE: Record<string, string> = {
  'pm25-stations': 'src-pm25',
  'fires-gistda': 'src-fires-gistda',
  'fires-firms': 'src-fires-firms',
  'floods': 'src-floods',
  'districts': 'src-districts',
  'rail': 'src-rail',
  'gibs-aod': 'src-gibs-aod',
}

// MapLibre layer IDs (one toggle may add multiple layers — e.g. rail = lines + dots + labels)
const LAYER_IDS_FOR_TOGGLE: Record<string, string[]> = {
  'pm25-stations': ['ly-pm25'],
  'fires-gistda':  ['ly-fires-gistda'],
  'fires-firms':   ['ly-fires-firms'],
  'floods':        ['ly-floods'],
  'districts':     ['ly-districts-fill', 'ly-districts-line', 'ly-districts-label'],
  'rail':          ['ly-rail-line', 'ly-rail-dots', 'ly-rail-labels'],
  'gibs-aod':      ['ly-gibs-aod'],
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
    case 'fires-gistda':    return addGistdaFires(map)
    case 'fires-firms':     return addFirmsFires(map)
    case 'floods':          return addFloods(map)
    case 'districts':       return addDistricts(map)
    case 'rail':            return addRail(map)
    case 'gibs-aod':        return addGibsAod(map)
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
  const data = await loadBangkokDistricts()
  map.addSource('src-districts', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-districts-fill',
    type: 'fill',
    source: 'src-districts',
    paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.04 },
  })
  map.addLayer({
    id: 'ly-districts-line',
    type: 'line',
    source: 'src-districts',
    paint: { 'line-color': '#f59e0b', 'line-width': 1, 'line-opacity': 0.7 },
  })
  map.addLayer({
    id: 'ly-districts-label',
    type: 'symbol',
    source: 'src-districts',
    minzoom: 11,
    layout: {
      'text-field': ['get', 'nameEn'],
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

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}
