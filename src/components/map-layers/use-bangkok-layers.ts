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
import { bangkokAQIStations, bangkokPm25Live, thailandFires24h, centralFloods, bangkokHistoricalFloods } from '../../data/gistda'
import { pm25ToRisk, civicToRisk, RISK_FILL, RISK_BORDER, RISK_COLOR, type RiskLevel } from '../../lib/risk'
import { type DistrictSummary } from '../../hooks/useDistrictData'
import { firmsThailand24h, gibsAerosolTileTemplate } from '../../data/nasa'
import { gibsTrueColorTiles, gibsNightLightsTiles, gibsLstTiles, gibsNdviTiles, esriWorldImageryTiles, sentinel2CloudlessTiles } from '../../data/nasa-gibs'
import { bangkokWAQIStations } from '../../data/waqi'
import { longdoBasemapTiles, longdoKeyAvailable } from '../../data/longdo'
import { fetchEETiles } from '../../data/alphaearth'
import { loadBangkokRail, loadBangkokKhet } from '../../data/bma'
import { fetchTraffyGeoJSON } from '../../data/traffy'
import { bangkokAQI } from '../../data/openmeteo-aq'
import { fetchAir4ThaiGeoJSON } from '../../data/air4thai'
import { fetchEarthquakeGeoJSON } from '../../data/tmd-earthquake'
import { fetchOsmEmergency, fetchOsmEducation } from '../../data/osm-pois'
import { fetchWaterQualityGeoJSON, fetchWaterLevelGeoJSON } from '../../data/thaiwater'
import { fetchTrafficIncidentGeoJSON, fetchBangkokTrafficFlow, tomtomKeyAvailable } from '../../data/tomtom-traffic'
import { fetchAirbnbGeoJSON } from '../../data/airbnb'
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

const MANAGED_IDS = ['pm25-stations', 'pm25-heatmap', 'aqi-live', 'air4thai-stations', 'waqi-stations', 'fires-gistda', 'fires-firms', 'floods-historical', 'floods', 'districts', 'rail', 'gibs-aod', 'sat-true-color', 'sat-night-lights', 'sat-surface-temp', 'sat-ndvi', 'sat-esri', 'sat-sentinel2', 'alphaearth-embeddings', 'sat-s5p-no2', 'sat-s5p-co', 'sat-s5p-so2', 'sat-ghsl-pop', 'longdo-basemap', 'traffy-issues', 'traffy-heatmap', 'buildings-3d', 'osm-emergency', 'osm-education', 'water-quality', 'water-level', 'earthquake-tmd', 'tomtom-traffic', 'tomtom-incidents', 'airbnb-density']

// MapLibre source IDs (one per toggle)
const SOURCE_ID_FOR_TOGGLE: Record<string, string> = {
  'pm25-stations':    'src-pm25',
  'pm25-heatmap':     'src-pm25-heatmap',
  'aqi-live':         'src-aqi',
  'air4thai-stations':'src-air4thai',
  'waqi-stations':    'src-waqi',
  'fires-gistda':     'src-fires-gistda',
  'fires-firms':      'src-fires-firms',
  'floods-historical':'src-floods-historical',
  'floods':           'src-floods',
  'districts':        'src-districts',
  'rail':             'src-rail',
  'gibs-aod':         'src-gibs-aod',
  'sat-true-color':   'src-sat-true-color',
  'sat-night-lights': 'src-sat-night-lights',
  'sat-surface-temp': 'src-sat-surface-temp',
  'sat-ndvi':         'src-sat-ndvi',
  'sat-esri':         'src-sat-esri',
  'sat-sentinel2':    'src-sat-sentinel2',
  'alphaearth-embeddings': 'src-alphaearth',
  'sat-s5p-no2':      'src-s5p-no2',
  'sat-s5p-co':       'src-s5p-co',
  'sat-s5p-so2':      'src-s5p-so2',
  'sat-ghsl-pop':     'src-ghsl-pop',
  'longdo-basemap':   'src-longdo',
  'traffy-issues':    'src-traffy',
  'traffy-heatmap':   'src-traffy-heatmap',
  'buildings-3d':     'omv',
  'osm-emergency':    'src-osm-emergency',
  'osm-education':    'src-osm-education',
  'water-quality':    'src-water-quality',
  'water-level':      'src-water-level',
  'earthquake-tmd':   'src-earthquake-tmd',
  'tomtom-traffic':   'src-tomtom-traffic',
  'tomtom-incidents': 'src-tomtom-incidents',
  'airbnb-density':   'src-airbnb',
}

// MapLibre layer IDs (one toggle may add multiple layers — e.g. rail = lines + dots + labels)
const LAYER_IDS_FOR_TOGGLE: Record<string, string[]> = {
  'pm25-stations':    ['ly-pm25'],
  'pm25-heatmap':     ['ly-pm25-heatmap'],
  'aqi-live':         ['ly-aqi'],
  'air4thai-stations':['ly-air4thai'],
  'waqi-stations':    ['ly-waqi-fill', 'ly-waqi-label'],
  'fires-gistda':     ['ly-fires-gistda'],
  'fires-firms':      ['ly-fires-firms'],
  'floods-historical':['ly-floods-historical'],
  'floods':           ['ly-floods'],
  'districts':        ['ly-districts-fill', 'ly-districts-line', 'ly-districts-label'],
  'rail':             ['ly-rail-line', 'ly-rail-dots', 'ly-rail-labels'],
  'gibs-aod':         ['ly-gibs-aod'],
  'sat-true-color':   ['ly-sat-true-color'],
  'sat-night-lights': ['ly-sat-night-lights'],
  'sat-surface-temp': ['ly-sat-surface-temp'],
  'sat-ndvi':         ['ly-sat-ndvi'],
  'sat-esri':         ['ly-sat-esri'],
  'sat-sentinel2':    ['ly-sat-sentinel2'],
  'alphaearth-embeddings': ['ly-alphaearth'],
  'sat-s5p-no2':      ['ly-s5p-no2'],
  'sat-s5p-co':       ['ly-s5p-co'],
  'sat-s5p-so2':      ['ly-s5p-so2'],
  'sat-ghsl-pop':     ['ly-ghsl-pop'],
  'longdo-basemap':   ['ly-longdo'],
  'traffy-issues':    ['ly-traffy-issues'],
  'traffy-heatmap':   ['ly-traffy-heatmap'],
  'buildings-3d':     ['ly-buildings-3d'],
  'osm-emergency':    ['ly-osm-emergency'],
  'osm-education':    ['ly-osm-education'],
  'water-quality':    ['ly-water-quality'],
  'water-level':      ['ly-water-level'],
  'earthquake-tmd':   ['ly-earthquake-tmd', 'ly-earthquake-tmd-pulse'],
  'tomtom-traffic':   ['ly-tomtom-traffic'],
  'tomtom-incidents': ['ly-tomtom-incidents'],
  'airbnb-density':   ['ly-airbnb-density'],
}

function setVisibility(map: MapLibre, toggleId: string, visible: boolean) {
  const layerIds = LAYER_IDS_FOR_TOGGLE[toggleId]
  if (!layerIds) return
  for (const lid of layerIds) {
    if (map.getLayer(lid)) {
      map.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none')
    }
  }
  // Side effect: 3D buildings toggle also drives the camera pitch + bearing
  // for the cinematic perspective effect.
  if (toggleId === 'buildings-3d') {
    if (visible) {
      map.easeTo({ pitch: 50, bearing: 25, duration: 800 })
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 })
    }
  }
}

// ── Layer loaders ─────────────────────────────────────────────────────────

async function loadLayer(id: string, map: MapLibre) {
  switch (id) {
    case 'pm25-stations':    return addPm25Stations(map)
    case 'pm25-heatmap':     return addPm25Heatmap(map)
    case 'aqi-live':         return addAQILive(map)
    case 'air4thai-stations':return addAir4ThaiStations(map)
    case 'waqi-stations':    return addWAQIStations(map)
    case 'fires-gistda':     return addGistdaFires(map)
    case 'fires-firms':      return addFirmsFires(map)
    case 'floods-historical':return addHistoricalFloods(map)
    case 'floods':           return addFloods(map)
    case 'districts':        return addDistricts(map)
    case 'rail':             return addRail(map)
    case 'gibs-aod':         return addGibsAod(map)
    case 'sat-true-color':   return addSatTrueColor(map)
    case 'sat-night-lights': return addSatNightLights(map)
    case 'sat-surface-temp': return addSatSurfaceTemp(map)
    case 'sat-ndvi':         return addSatNdvi(map)
    case 'sat-esri':         return addSatEsri(map)
    case 'sat-sentinel2':    return addSatSentinel2(map)
    case 'alphaearth-embeddings': return addAlphaEarth(map)
    case 'sat-s5p-no2':      return addS5P_NO2(map)
    case 'sat-s5p-co':       return addS5P_CO(map)
    case 'sat-s5p-so2':      return addS5P_SO2(map)
    case 'sat-ghsl-pop':     return addGHSL_Pop(map)
    case 'longdo-basemap':   return addLongdoBasemap(map)
    case 'traffy-issues':    return addTraffyIssues(map)
    case 'traffy-heatmap':   return addTraffyHeatmap(map)
    case 'buildings-3d':     return addBuildings3D(map)
    case 'osm-emergency':    return addOsmEmergency(map)
    case 'osm-education':    return addOsmEducation(map)
    case 'water-quality':    return addWaterQuality(map)
    case 'water-level':      return addWaterLevel(map)
    case 'earthquake-tmd':   return addEarthquakeTmd(map)
    case 'tomtom-traffic':   return addTomtomTraffic(map)
    case 'tomtom-incidents': return addTomtomIncidents(map)
    case 'airbnb-density':   return addAirbnbDensity(map)
  }
}

/** Helper for any NASA GIBS raster product. Inserts BELOW data layers when
 *  possible — satellite is ground truth, not annotation. */
function addRasterLayer(
  map: MapLibre,
  opts: { sourceId: string; layerId: string; tiles: string; maxzoom: number; opacity: number },
) {
  map.addSource(opts.sourceId, {
    type: 'raster',
    tiles: [opts.tiles],
    tileSize: 256,
    maxzoom: opts.maxzoom,
  })
  // Insert below the first data layer (districts/rail/etc.) so ground sits
  // beneath annotations. If none of those exist yet, append normally.
  const groundAnchor = ['ly-districts-fill', 'ly-rail-line', 'ly-pm25', 'ly-aqi'].find(
    (id) => map.getLayer(id),
  )
  map.addLayer(
    {
      id: opts.layerId,
      type: 'raster',
      source: opts.sourceId,
      paint: { 'raster-opacity': opts.opacity },
      layout: { 'visibility': 'none' },
    },
    groundAnchor,
  )
}

async function addSatTrueColor(map: MapLibre) {
  addRasterLayer(map, {
    sourceId: 'src-sat-true-color',
    layerId:  'ly-sat-true-color',
    tiles:    gibsTrueColorTiles(),
    maxzoom:  9,
    opacity:  0.85,
  })
}

async function addSatNightLights(map: MapLibre) {
  addRasterLayer(map, {
    sourceId: 'src-sat-night-lights',
    layerId:  'ly-sat-night-lights',
    tiles:    gibsNightLightsTiles(),
    maxzoom:  8,
    opacity:  0.95,
  })
}

async function addSatSurfaceTemp(map: MapLibre) {
  addRasterLayer(map, {
    sourceId: 'src-sat-surface-temp',
    layerId:  'ly-sat-surface-temp',
    tiles:    gibsLstTiles(),
    maxzoom:  7,
    opacity:  0.7,
  })
}

async function addSatNdvi(map: MapLibre) {
  addRasterLayer(map, {
    sourceId: 'src-sat-ndvi',
    layerId:  'ly-sat-ndvi',
    tiles:    gibsNdviTiles(),
    maxzoom:  9,
    opacity:  0.75,
  })
}

async function addSatEsri(map: MapLibre) {
  addRasterLayer(map, {
    sourceId: 'src-sat-esri',
    layerId:  'ly-sat-esri',
    tiles:    esriWorldImageryTiles(),
    maxzoom:  19,
    opacity:  1.0,
  })
}

async function addSatSentinel2(map: MapLibre) {
  addRasterLayer(map, {
    sourceId: 'src-sat-sentinel2',
    layerId:  'ly-sat-sentinel2',
    tiles:    sentinel2CloudlessTiles(),
    maxzoom:  16,
    opacity:  1.0,
  })
}

async function addAlphaEarth(map: MapLibre) {
  const ee = await fetchEETiles('alphaearth')
  if (!ee || !ee.tiles) return
  addRasterLayer(map, {
    sourceId: 'src-alphaearth',
    layerId:  'ly-alphaearth',
    tiles:    ee.tiles,
    maxzoom:  14,
    opacity:  0.9,
  })
}

async function addS5P_NO2(map: MapLibre) {
  const ee = await fetchEETiles('s5p-no2')
  if (!ee || !ee.tiles) return
  addRasterLayer(map, {
    sourceId: 'src-s5p-no2',
    layerId:  'ly-s5p-no2',
    tiles:    ee.tiles,
    maxzoom:  12,
    opacity:  0.85,
  })
}

async function addS5P_CO(map: MapLibre) {
  const ee = await fetchEETiles('s5p-co')
  if (!ee || !ee.tiles) return
  addRasterLayer(map, {
    sourceId: 'src-s5p-co',
    layerId:  'ly-s5p-co',
    tiles:    ee.tiles,
    maxzoom:  12,
    opacity:  0.85,
  })
}

async function addS5P_SO2(map: MapLibre) {
  const ee = await fetchEETiles('s5p-so2')
  if (!ee || !ee.tiles) return
  addRasterLayer(map, {
    sourceId: 'src-s5p-so2',
    layerId:  'ly-s5p-so2',
    tiles:    ee.tiles,
    maxzoom:  12,
    opacity:  0.85,
  })
}

async function addGHSL_Pop(map: MapLibre) {
  const ee = await fetchEETiles('ghsl-pop')
  if (!ee || !ee.tiles) return
  addRasterLayer(map, {
    sourceId: 'src-ghsl-pop',
    layerId:  'ly-ghsl-pop',
    tiles:    ee.tiles,
    maxzoom:  14,
    opacity:  0.75,
  })
}

async function addLongdoBasemap(map: MapLibre) {
  // Skip silently if no key — toggle is harmless rather than throwing
  if (!longdoKeyAvailable()) return
  addRasterLayer(map, {
    sourceId: 'src-longdo',
    layerId:  'ly-longdo',
    tiles:    longdoBasemapTiles(),
    maxzoom:  18,
    opacity:  1.0,   // full coverage — meant to replace UNL basemap visually
  })
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

async function addPm25Heatmap(map: MapLibre) {
  // Share the GISTDA stations data — interpolated continuous surface.
  // MapLibre's heatmap kernel does Gaussian density weighting; we feed pm25
  // values as the intensity so high-PM2.5 stations radiate stronger.
  const data = await bangkokAQIStations()
  map.addSource('src-pm25-heatmap', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-pm25-heatmap',
    type: 'heatmap',
    source: 'src-pm25-heatmap',
    paint: {
      // Weight per station — normalised so PM2.5=150 saturates the kernel
      'heatmap-weight': [
        'interpolate', ['linear'], ['get', 'pm25'],
        0, 0,
        25, 0.25,
        50, 0.55,
        90, 0.8,
        150, 1,
      ],
      // Kernel intensity grows with zoom so it stays readable city-wide and district-wide
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        8, 0.6,
        11, 1.0,
        14, 2.5,
      ],
      // Color ramp aligned with Thai PCD bands — transparent → green → yellow → orange → red → maroon
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.15, 'rgba(139,195,74,0.45)',
        0.35, 'rgba(253,216,53,0.55)',
        0.55, 'rgba(251,140,0,0.65)',
        0.75, 'rgba(229,57,53,0.75)',
        0.95, 'rgba(126,0,35,0.85)',
      ],
      // Radius widens with zoom so the kernel covers the right ground area
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        8, 18,
        11, 42,
        14, 80,
      ],
      'heatmap-opacity': [
        'interpolate', ['linear'], ['zoom'],
        8, 0.7,
        14, 0.55,
      ],
    },
  })
}

async function addWAQIStations(map: MapLibre) {
  // Different sensor network from GISTDA — distinguished by hexagon-shaped
  // markers (square rotated) and AQI bands (US scale), not Thai PM2.5 bands.
  // Returns empty FC silently if VITE_WAQI_TOKEN not set; layer stays mounted.
  const data = await bangkokWAQIStations()
  map.addSource('src-waqi', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-waqi-fill',
    type: 'circle',
    source: 'src-waqi',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 14, 12],
      'circle-color': [
        'match', ['get', 'level'],
        'good',                AQI_COLORS.good,
        'moderate',            AQI_COLORS.moderate,
        'unhealthy-sensitive', AQI_COLORS['unhealthy-sensitive'],
        'unhealthy',           AQI_COLORS.unhealthy,
        'very-unhealthy',      AQI_COLORS['very-unhealthy'],
        'hazardous',           AQI_COLORS.hazardous,
        AQI_COLORS['—'],
      ],
      'circle-stroke-color': '#58a6ff',  // cyan ring to distinguish from GISTDA orange
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.85,
    },
    layout: { 'visibility': 'none' },
  })
  map.addLayer({
    id: 'ly-waqi-label',
    type: 'symbol',
    source: 'src-waqi',
    minzoom: 11,
    layout: {
      'text-field': ['to-string', ['get', 'aqi']],
      'text-size': 10,
      'text-font': ['Fira GO Regular'],
      'text-offset': [0, -1.3],
      'visibility': 'none',
    },
    paint: {
      'text-color': '#58a6ff',
      'text-halo-color': '#04060b',
      'text-halo-width': 1.5,
    },
  })
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

async function addHistoricalFloods(map: MapLibre) {
  const data = await bangkokHistoricalFloods()
  map.addSource('src-floods-historical', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-floods-historical',
    type: 'fill',
    source: 'src-floods-historical',
    paint: {
      'fill-color': 'rgba(25, 50, 180, 0.14)',
      'fill-outline-color': 'rgba(80, 110, 230, 0.4)',
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
  const pm25Value = pm25Result?.pm25 ?? 0

  // Compute vulnerability scores per district
  const maxCount = Math.max(1, ...Object.values(counts))

  // Inject per-khet risk_level + vulnerability score
  const LEVELS = ['good', 'moderate', 'high', 'critical'] as const
  const features = (khetResult?.features ?? []).map((f) => {
    const th = ((f.properties?.name_th as string) ?? '').trim()
    const count = counts[th] ?? 0
    const civicScore = count >= 200 ? 3 : count >= 50 ? 2 : count >= 5 ? 1 : 0
    const score = Math.max(airScore, civicScore)

    // Vulnerability Index: composite of multiple stressors (0-100)
    const civicDensity = Math.min(25, (count / Math.max(maxCount, 50)) * 25)
    const airQuality = Math.min(25, (pm25Value / 100) * 25)
    const heatExposure = pm25Value > 50 ? 15 : pm25Value > 25 ? 8 : 3
    const floodRisk = count >= 50 ? 15 : count >= 10 ? 8 : 3
    const emergencyAccess = 10 // baseline; would need OSM POI count per district
    const vulnScore = Math.round(civicDensity + airQuality + heatExposure + floodRisk + emergencyAccess)

    return {
      ...f,
      properties: {
        ...f.properties,
        risk_level: LEVELS[score],
        complaint_count: count,
        vulnerability_score: vulnScore,
        vulnerability_level: vulnScore >= 70 ? 'critical' : vulnScore >= 50 ? 'high' : vulnScore >= 30 ? 'moderate' : 'good',
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

async function addBuildings3D(map: MapLibre) {
  // Re-uses UNL's omv vector source — no new fetch. Extrudes the buildings
  // source-layer using whichever height field UNL exposes; defensive
  // coalescing handles missing/null fields gracefully.
  if (!map.getSource('omv')) return  // belt + suspenders
  map.addLayer({
    id: 'ly-buildings-3d',
    type: 'fill-extrusion',
    source: 'omv',
    'source-layer': 'buildings',
    minzoom: 14,
    paint: {
      // Try height → render_height → levels*3 → 6m fallback
      'fill-extrusion-height': [
        'coalesce',
        ['get', 'height'],
        ['get', 'render_height'],
        ['*', ['coalesce', ['get', 'levels'], 2], 3],
        6,
      ],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      // Color graded by height — short = dark blue-grey, tall = amber-warm
      'fill-extrusion-color': [
        'interpolate', ['linear'],
        ['coalesce', ['get', 'height'], ['*', ['coalesce', ['get', 'levels'], 2], 3], 6],
        0,   '#0d1424',
        20,  '#1f2a40',
        50,  '#3d3018',
        120, '#5a4220',
        250, '#8a5a14',  // top of class — Mahanakhon, IconSiam levels
      ],
      'fill-extrusion-opacity': 0.92,
    },
    layout: { 'visibility': 'none' },
  })
}

async function addTraffyHeatmap(map: MapLibre) {
  // Continuous density field over Traffy citizen reports — companion to
  // PM2.5 heatmap. Magenta/red palette to read distinctly from the
  // air-quality green→red ramp. Active tickets weight stronger than
  // resolved ones (state==='เสร็จสิ้น' is "completed" in Thai).
  const data = await fetchTraffyGeoJSON(500)
  map.addSource('src-traffy-heatmap', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-traffy-heatmap',
    type: 'heatmap',
    source: 'src-traffy-heatmap',
    paint: {
      'heatmap-weight': [
        'case',
        ['==', ['get', 'state'], 'เสร็จสิ้น'], 0.3,  // resolved — light weight
        1.0,                                          // active — full weight
      ],
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        9, 0.7,
        12, 1.2,
        15, 3.0,
      ],
      // Magenta→amber→cyan ramp — distinct from PM2.5's green→red
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.2,  'rgba(88,166,255,0.4)',     // cyan low
        0.45, 'rgba(168, 100, 220, 0.55)', // violet mid
        0.7,  'rgba(245, 158, 11, 0.75)',  // amber high
        0.95, 'rgba(229, 57, 53, 0.85)',   // red peak
      ],
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        9, 14,
        12, 36,
        15, 70,
      ],
      'heatmap-opacity': [
        'interpolate', ['linear'], ['zoom'],
        9, 0.7,
        15, 0.5,
      ],
    },
  })
}

// ── New layer loaders (Air4Thai, OSM, Thaiwater, Earthquake) ─────────────

async function addAir4ThaiStations(map: MapLibre) {
  const data = await fetchAir4ThaiGeoJSON()
  map.addSource('src-air4thai', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-air4thai',
    type: 'circle',
    source: 'src-air4thai',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 7, 14, 16],
      'circle-color': [
        'match', ['get', 'level'],
        'good',                AQI_COLORS.good,
        'moderate',            AQI_COLORS.moderate,
        'unhealthy-sensitive', AQI_COLORS['unhealthy-sensitive'],
        'unhealthy',           AQI_COLORS.unhealthy,
        'hazardous',           AQI_COLORS.hazardous,
        AQI_COLORS['—'],
      ],
      'circle-stroke-color': '#00e5ff', // cyan ring to distinguish from GISTDA
      'circle-stroke-width': 2,
      'circle-opacity': 0.9,
    },
  })
}

async function addOsmEmergency(map: MapLibre) {
  const data = await fetchOsmEmergency()
  map.addSource('src-osm-emergency', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-osm-emergency',
    type: 'circle',
    source: 'src-osm-emergency',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 10],
      'circle-color': ['coalesce', ['get', 'color'], '#9e9e9e'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9,
    },
  })
  // Labels at higher zoom
  map.addLayer({
    id: 'ly-osm-emergency-label',
    type: 'symbol',
    source: 'src-osm-emergency',
    minzoom: 13,
    layout: {
      'text-field': ['get', 'icon'],
      'text-size': 9,
      'text-font': ['Fira GO Regular'],
      'text-offset': [0, -1.2],
    },
    paint: {
      'text-color': '#f5f5f0',
      'text-halo-color': '#0a0a0a',
      'text-halo-width': 1.5,
    },
  })
}

async function addOsmEducation(map: MapLibre) {
  const data = await fetchOsmEducation()
  map.addSource('src-osm-education', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-osm-education',
    type: 'circle',
    source: 'src-osm-education',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 14, 8],
      'circle-color': '#4caf50',
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1,
      'circle-opacity': 0.85,
    },
  })
}

async function addWaterQuality(map: MapLibre) {
  const data = await fetchWaterQualityGeoJSON()
  map.addSource('src-water-quality', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-water-quality',
    type: 'circle',
    source: 'src-water-quality',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 14],
      'circle-color': ['coalesce', ['get', 'color'], '#9e9e9e'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9,
    },
  })
}

async function addWaterLevel(map: MapLibre) {
  const data = await fetchWaterLevelGeoJSON()
  map.addSource('src-water-level', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-water-level',
    type: 'circle',
    source: 'src-water-level',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 12],
      'circle-color': ['coalesce', ['get', 'color'], '#4caf50'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9,
    },
  })
}

async function addEarthquakeTmd(map: MapLibre) {
  const data = await fetchEarthquakeGeoJSON()
  map.addSource('src-earthquake-tmd', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-earthquake-tmd',
    type: 'circle',
    source: 'src-earthquake-tmd',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'magnitude'],
        3, 4,
        4, 8,
        5, 14,
        6, 22,
        7, 34,
      ],
      'circle-color': ['coalesce', ['get', 'color'], '#9e9e9e'],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1,
      'circle-opacity': 0.9,
    },
    layout: { 'visibility': 'none' },
  })
  // Pulse animation for events felt in Bangkok
  map.addLayer({
    id: 'ly-earthquake-tmd-pulse',
    type: 'circle',
    source: 'src-earthquake-tmd',
    filter: ['==', ['get', 'feltInBangkok'], true],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'magnitude'],
        3, 8,
        4, 16,
        5, 28,
        6, 42,
        7, 60,
      ],
      'circle-color': 'transparent',
      'circle-stroke-color': '#e53935',
      'circle-stroke-width': 1,
      'circle-stroke-opacity': 0.4,
    },
    layout: { 'visibility': 'none' },
  })
}

async function addTomtomTraffic(map: MapLibre) {
  const flow = await fetchBangkokTrafficFlow()
  if (flow.length === 0 && !tomtomKeyAvailable()) return
  const fc: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: flow.map((f) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] as [number, number] },
      properties: {
        currentSpeed: f.currentSpeed,
        freeFlowSpeed: f.freeFlowSpeed,
        congestionLevel: f.congestionLevel,
        confidence: f.confidence,
        roadClosure: f.roadClosure,
        // Color by congestion: green (free) → yellow → red (jammed)
        color: f.roadClosure ? '#7e0023'
          : f.congestionLevel > 0.7 ? '#e53935'
          : f.congestionLevel > 0.4 ? '#fb8c00'
          : f.congestionLevel > 0.2 ? '#fdd835'
          : '#8bc34a',
      },
    })),
  }
  map.addSource('src-tomtom-traffic', { type: 'geojson', data: fc })
  map.addLayer({
    id: 'ly-tomtom-traffic',
    type: 'circle',
    source: 'src-tomtom-traffic',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 8, 14, 20],
      'circle-color': ['coalesce', ['get', 'color'], '#9e9e9e'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.85,
    },
  })
}

async function addTomtomIncidents(map: MapLibre) {
  const data = await fetchTrafficIncidentGeoJSON()
  map.addSource('src-tomtom-incidents', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-tomtom-incidents',
    type: 'circle',
    source: 'src-tomtom-incidents',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 12],
      'circle-color': ['coalesce', ['get', 'color'], '#9e9e9e'],
      'circle-stroke-color': '#0a0a0a',
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9,
    },
  })
}

async function addAirbnbDensity(map: MapLibre) {
  const data = await fetchAirbnbGeoJSON()
  map.addSource('src-airbnb', { type: 'geojson', data })
  map.addLayer({
    id: 'ly-airbnb-density',
    type: 'heatmap',
    source: 'src-airbnb',
    paint: {
      'heatmap-weight': [
        'interpolate', ['linear'], ['get', 'pressure'],
        0, 0.1,
        100, 0.3,
        300, 0.6,
        600, 1,
      ],
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        10, 0.8,
        13, 1.5,
        16, 3,
      ],
      // Red → orange → amber — tourism heat
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.15, 'rgba(253,216,53,0.4)',
        0.4,  'rgba(251,140,0,0.55)',
        0.65, 'rgba(229,57,53,0.7)',
        0.9,  'rgba(126,0,35,0.85)',
      ],
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 12,
        13, 30,
        16, 60,
      ],
      'heatmap-opacity': [
        'interpolate', ['linear'], ['zoom'],
        10, 0.7,
        16, 0.5,
      ],
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
    const vulnScore = Number(props.vulnerability_score ?? 0)
    const vulnLevel = String(props.vulnerability_level ?? 'low') as RiskLevel
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
        <div class="popup-row">
          <span class="popup-label">VULNERABILITY</span>
          <span class="popup-val" style="color: ${RISK_COLOR[vulnLevel] ?? '#888'}">${vulnScore}/100</span>
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
      vulnerability_score: vulnScore,
      vulnerability_level: vulnLevel,
    })
  })
  map.on('mouseenter', 'ly-districts-fill', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'ly-districts-fill', () => { map.getCanvas().style.cursor = '' })
  return popup
}

function escape(s: string): string {
  return s.replace(/[&<"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}
