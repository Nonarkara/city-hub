import { memo, useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl'
import type { CityConfig, BasemapId } from '../config/cities'
import {
  esriWorldImageryTiles,
  sentinel2CloudlessTiles,
  gibsTrueColorTiles,
  gibsNightLightsTiles,
  gibsLstTiles,
  gibsNdviTiles,
  gibsCOTiles,
  gibsSO2Tiles,
} from '../data/nasa-gibs'
import { gibsAerosolTileTemplate } from '../data/nasa'

// Mapbox token — optional. Unlocks Mapbox vector + Satellite Streets basemaps.
// MapLibre doesn't need any token for the tokenless raster basemaps below.
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string) ?? ''

export function hasMapboxToken(): boolean {
  return !!MAPBOX_TOKEN && MAPBOX_TOKEN.length > 10
}

// ── Basemap registry ──────────────────────────────────────────────────────────
//
// Five variants. Three are tokenless rasters — the dashboard is never empty.
// Two require a Mapbox token (dark-vector + satellite-streets).

export type BasemapGroup = 'imagery' | 'spectral' | 'vector'

export interface BasemapDef {
  id: BasemapId
  label: string
  requiresToken: boolean
  group: BasemapGroup
  /** True if the tiles change with the selected date (drives the time machine). */
  temporal: boolean
  style: StyleSpecification
}

/** Spectral/imagery basemaps whose tiles are date-keyed — these enable the
 *  temporal scrubber. Pure imagery (ESRI, Sentinel-2) and vector are not. */
const TEMPORAL_BASEMAPS = new Set<BasemapId>([
  'nasa-true-color', 'nasa-aerosol', 'nasa-co', 'nasa-so2', 'nasa-ndvi', 'nasa-surface-temp', 'nasa-nightlights',
])

export function isTemporalBasemap(id: BasemapId): boolean {
  return TEMPORAL_BASEMAPS.has(id)
}

/** Mapbox vector tile URL with token query param (MapLibre-compatible). */
function mapboxVectorTiles(): string {
  return `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${MAPBOX_TOKEN}`
}

/** Mapbox satellite raster tiles with token. */
function mapboxSatelliteTiles(): string {
  return `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.webp?access_token=${MAPBOX_TOKEN}`
}

/** Dark vectorial — Mapbox composite with amber-warm paint. Token required. */
function darkVectorStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'City Hub Dark',
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${MAPBOX_TOKEN}`,
    sources: {
      composite: {
        type: 'vector',
        tiles: [mapboxVectorTiles()],
        maxzoom: 16,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#04060b' } },
      { id: 'water', type: 'fill', source: 'composite', 'source-layer': 'water', paint: { 'fill-color': '#071a2c' } },
      { id: 'water_outline', type: 'line', source: 'composite', 'source-layer': 'water', paint: { 'line-color': '#1a4a6e', 'line-width': 0.6, 'line-opacity': 0.6 } },
      { id: 'waterway', type: 'line', source: 'composite', 'source-layer': 'waterway', paint: { 'line-color': '#1a4a6e', 'line-width': 0.5, 'line-opacity': 0.55 } },
      { id: 'landuse_park', type: 'fill', source: 'composite', 'source-layer': 'landuse', filter: ['==', ['get', 'class'], 'park'], paint: { 'fill-color': '#0a1410', 'fill-opacity': 0.85 } },
      { id: 'admin_boundaries', type: 'line', source: 'composite', 'source-layer': 'admin', filter: ['<=', ['to-number', ['get', 'admin_level']], 2], paint: { 'line-color': '#244a6a', 'line-width': 0.5, 'line-opacity': 0.5, 'line-dasharray': [2, 2] } },
      { id: 'roads_minor', type: 'line', source: 'composite', 'source-layer': 'road', filter: ['in', ['get', 'class'], ['literal', ['street', 'street_limited', 'path', 'pedestrian', 'track', 'service']]], paint: { 'line-color': '#0f1626', 'line-width': 0.7 } },
      { id: 'roads_major_casing', type: 'line', source: 'composite', 'source-layer': 'road', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]], paint: { 'line-color': '#1a1206', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.6, 14, 6] } },
      { id: 'roads_major', type: 'line', source: 'composite', 'source-layer': 'road', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]], paint: { 'line-color': '#3d2a0f', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 14, 3.2] } },
      { id: 'buildings', type: 'fill', source: 'composite', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': '#0a1020', 'fill-opacity': 0.92 } },
      { id: 'buildings_outline', type: 'line', source: 'composite', 'source-layer': 'building', minzoom: 14, paint: { 'line-color': '#1a2540', 'line-width': 0.4, 'line-opacity': 0.7 } },
      { id: 'places', type: 'symbol', source: 'composite', 'source-layer': 'place_label', minzoom: 10, filter: ['in', ['get', 'type'], ['literal', ['city', 'town', 'suburb', 'neighbourhood']]], layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 13], 'text-letter-spacing': 0.16, 'text-transform': 'uppercase', 'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'] }, paint: { 'text-color': '#c87a14', 'text-halo-color': '#04060b', 'text-halo-width': 2 } },
    ],
  }
}

/** Mapbox satellite + streets composite. Token required. */
function mapboxSatStreetsStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Satellite Streets',
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${MAPBOX_TOKEN}`,
    sources: {
      'mapbox-sat': {
        type: 'raster',
        tiles: [mapboxSatelliteTiles()],
        tileSize: 256,
        attribution: '© Mapbox · DigitalGlobe',
      },
      composite: {
        type: 'vector',
        tiles: [mapboxVectorTiles()],
        maxzoom: 16,
      },
    },
    layers: [
      { id: 'sat', type: 'raster', source: 'mapbox-sat' },
      { id: 'roads', type: 'line', source: 'composite', 'source-layer': 'road', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]], paint: { 'line-color': 'rgba(245,158,11,0.6)', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 2] } },
      { id: 'places', type: 'symbol', source: 'composite', 'source-layer': 'place_label', minzoom: 8, filter: ['in', ['get', 'type'], ['literal', ['city', 'town']]], layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-size': 12, 'text-letter-spacing': 0.14, 'text-transform': 'uppercase', 'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'] }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } },
    ],
  }
}

/** Raster-only style for a single XYZ tile source. Used for tokenless basemaps.
 *  `maxzoom` caps the source's native zoom — beyond it MapLibre overzooms
 *  (upscales the last tile) instead of requesting nonexistent tiles. Critical
 *  for coarse spectral products (aerosol z6, surface-temp z7) viewed at city
 *  zoom (z11) — without it the layer goes blank when you zoom in. */
// Keyless place-name + road labels (OSM via CARTO), light text with a dark
// halo so it reads on both dark spectral lenses and bright satellite imagery.
// Baked into every raster lens → Google-Maps label parity on the whole stack.
const LABEL_TILES = [
  'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
  'https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
  'https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
]

function rasterStyle(
  tileTemplate: string,
  attribution: string,
  name: string,
  maxzoom?: number,
): StyleSpecification {
  return {
    version: 8,
    name,
    // Present so symbol/text layers added later (Bangkok overlays) validate
    // instead of throwing "requires a style glyphs property".
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: [tileTemplate],
        tileSize: 256,
        attribution,
        ...(maxzoom !== undefined ? { maxzoom } : {}),
      },
      labels: {
        type: 'raster',
        tiles: LABEL_TILES,
        tileSize: 256,
        attribution: '© OpenStreetMap · © CARTO',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#04060b' } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
      { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.92 } },
    ],
  }
}

export function getBasemapDef(id: BasemapId, activeDate?: string): BasemapDef {
  switch (id) {
    case 'dark-vector':
      return { id, label: 'Dark Vector', requiresToken: true, group: 'vector', temporal: false, style: darkVectorStyle() }
    case 'mapbox-sat-streets':
      return { id, label: 'Satellite + Streets', requiresToken: true, group: 'vector', temporal: false, style: mapboxSatStreetsStyle() }
    case 'esri-imagery':
      return {
        id,
        label: 'ESRI Satellite',
        requiresToken: false,
        group: 'imagery',
        temporal: false,
        style: rasterStyle(
          esriWorldImageryTiles(),
          '© Esri · Maxar · Earthstar Geographics',
          'ESRI World Imagery',
        ),
      }
    case 'sentinel-cloudless':
      return {
        id,
        label: 'Sentinel-2 Cloudless',
        requiresToken: false,
        group: 'imagery',
        temporal: false,
        style: rasterStyle(
          sentinel2CloudlessTiles(),
          '© EOX IT Services · Sentinel-2 cloudless 2023',
          'Sentinel-2 Cloudless 2023',
        ),
      }
    case 'nasa-true-color':
      return {
        id,
        label: 'MODIS True Color',
        requiresToken: false,
        group: 'imagery',
        temporal: true,
        style: rasterStyle(
          gibsTrueColorTiles(activeDate),
          '© NASA GIBS · MODIS Terra Corrected Reflectance',
          'NASA MODIS Terra true color',
          9,
        ),
      }
    case 'nasa-aerosol':
      return {
        id,
        label: 'Aerosol (AOD)',
        requiresToken: false,
        group: 'spectral',
        temporal: true,
        style: rasterStyle(
          gibsAerosolTileTemplate(activeDate),
          '© NASA GIBS · MODIS Combined Value-Added AOD',
          'NASA aerosol optical depth',
          6,
        ),
      }
    case 'nasa-co':
      return {
        id,
        label: 'Carbon Monoxide',
        requiresToken: false,
        group: 'spectral',
        temporal: true,
        style: rasterStyle(
          gibsCOTiles(activeDate),
          '© NASA GIBS · AIRS Carbon Monoxide',
          'NASA AIRS carbon monoxide',
          6,
        ),
      }
    case 'nasa-so2':
      return {
        id,
        label: 'Sulphur Dioxide',
        requiresToken: false,
        group: 'spectral',
        temporal: true,
        style: rasterStyle(
          gibsSO2Tiles(activeDate),
          '© NASA GIBS · OMPS Sulphur Dioxide',
          'NASA OMPS sulphur dioxide',
          6,
        ),
      }
    case 'nasa-ndvi':
      return {
        id,
        label: 'Vegetation (NDVI)',
        requiresToken: false,
        group: 'spectral',
        temporal: true,
        style: rasterStyle(
          gibsNdviTiles(activeDate),
          '© NASA GIBS · MODIS Terra NDVI 8-Day',
          'NASA NDVI vegetation index',
          9,
        ),
      }
    case 'nasa-surface-temp':
      return {
        id,
        label: 'Surface Heat',
        requiresToken: false,
        group: 'spectral',
        temporal: true,
        style: rasterStyle(
          gibsLstTiles(activeDate),
          '© NASA GIBS · MODIS Terra Land Surface Temp',
          'NASA land surface temperature',
          7,
        ),
      }
    case 'nasa-nightlights':
      return {
        id,
        label: 'Night Lights',
        requiresToken: false,
        group: 'spectral',
        temporal: true,
        style: rasterStyle(
          gibsNightLightsTiles(activeDate),
          '© NASA GIBS · VIIRS Black Marble',
          'NASA VIIRS night lights',
          8,
        ),
      }
  }
}

/** All basemap defs in display order, grouped for the Satellite Stack menu. */
export const BASEMAP_GROUPS: { label: BasemapGroup; ids: BasemapId[] }[] = [
  { label: 'imagery',  ids: ['esri-imagery', 'sentinel-cloudless', 'nasa-true-color'] },
  { label: 'spectral', ids: ['nasa-aerosol', 'nasa-co', 'nasa-so2', 'nasa-ndvi', 'nasa-surface-temp', 'nasa-nightlights'] },
  { label: 'vector',   ids: ['dark-vector', 'mapbox-sat-streets'] },
]

/** Flat list of all basemap IDs, in display order. */
export const BASEMAPS: BasemapId[] = BASEMAP_GROUPS.flatMap((g) => g.ids)

/** Default basemap — Dark Vector when token is available, ESRI imagery otherwise. */
export function defaultBasemap(): BasemapId {
  return hasMapboxToken() ? 'dark-vector' : 'esri-imagery'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MapViewProps {
  city: CityConfig
  basemap: BasemapId
  /** Active date (YYYY-MM-DD) — drives the temporal satellite tiles. */
  activeDate?: string
  onMapReady?: (map: MapLibreMap) => void
}

export const MapView = memo(function MapView({ city, basemap, activeDate, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const currentBasemapRef = useRef<BasemapId>(basemap)
  const currentDateRef = useRef<string | undefined>(activeDate)

  // Init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const def = getBasemapDef(basemap, activeDate)
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
    onMapReady?.(map)

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly to city when active city changes — cinematic 2-stage motion.
  // Stage 1: zoom out a bit (so the user sees they're moving across the map).
  // Stage 2: fly across at the lower zoom, then zoom into the target.
  // Skipped on first mount because the map is already at the start city.
  const firstFlyRef = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const flyCinematic = () => {
      if (firstFlyRef.current) {
        firstFlyRef.current = false
        return
      }
      // Distance-aware easing: bigger jumps get a wider arc and longer duration
      const from = map.getCenter()
      const to = city.center
      const dx = to[0] - from.lng
      const dy = to[1] - from.lat
      const distDeg = Math.sqrt(dx * dx + dy * dy)
      // For nearby cities (Bangkok ↔ Chiang Mai = ~5°) keep it quick; for
      // far jumps (Bangkok ↔ Singapore = ~13°) sweep wider.
      const duration = Math.min(3200, Math.max(1400, distDeg * 200))
      map.flyTo({
        center: to,
        zoom: city.zoom,
        duration,
        essential: true,
        curve: distDeg > 3 ? 1.6 : 1.2,   // bigger arc for longer hauls
        speed: 0.9,
      })
    }
    if (map.isStyleLoaded()) {
      flyCinematic()
    } else {
      map.once('load', flyCinematic)
    }
  }, [city])

  // Swap basemap style when the basemap changes, or when the date changes on a
  // temporal basemap (the time machine — re-keys the NASA tiles to the new day).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const basemapChanged = currentBasemapRef.current !== basemap
    const dateChanged = currentDateRef.current !== activeDate
    const temporal = isTemporalBasemap(basemap)
    if (!basemapChanged && !(temporal && dateChanged)) return
    currentBasemapRef.current = basemap
    currentDateRef.current = activeDate
    const def = getBasemapDef(basemap, activeDate)
    map.setStyle(def.style)
  }, [basemap, activeDate])

  return <div ref={containerRef} className="map-container" />
})
