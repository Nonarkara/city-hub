import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl'
import type { CityConfig, BasemapId } from '../config/cities'
import {
  esriWorldImageryTiles,
  sentinel2CloudlessTiles,
  gibsTrueColorTiles,
} from '../data/nasa-gibs'

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

export interface BasemapDef {
  id: BasemapId
  label: string
  requiresToken: boolean
  style: StyleSpecification
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

/** Raster-only style for a single XYZ tile source. Used for tokenless basemaps. */
function rasterStyle(tileTemplate: string, attribution: string, name: string): StyleSpecification {
  return {
    version: 8,
    name,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [tileTemplate],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#04060b' } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
    ],
  }
}

export function getBasemapDef(id: BasemapId): BasemapDef {
  switch (id) {
    case 'dark-vector':
      return { id, label: 'Dark Vector', requiresToken: true, style: darkVectorStyle() }
    case 'mapbox-sat-streets':
      return { id, label: 'Satellite + Streets', requiresToken: true, style: mapboxSatStreetsStyle() }
    case 'esri-imagery':
      return {
        id,
        label: 'ESRI Satellite',
        requiresToken: false,
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
        style: rasterStyle(
          sentinel2CloudlessTiles(),
          '© EOX IT Services · Sentinel-2 cloudless 2023',
          'Sentinel-2 Cloudless 2023',
        ),
      }
    case 'nasa-true-color':
      return {
        id,
        label: 'NASA Today',
        requiresToken: false,
        style: rasterStyle(
          gibsTrueColorTiles(),
          '© NASA GIBS · MODIS Terra Corrected Reflectance',
          'NASA MODIS Terra (yesterday)',
        ),
      }
  }
}

/** All basemap defs in display order. */
export const BASEMAPS: BasemapId[] = [
  'esri-imagery',
  'sentinel-cloudless',
  'nasa-true-color',
  'dark-vector',
  'mapbox-sat-streets',
]

/** Default basemap — Dark Vector when token is available, ESRI imagery otherwise. */
export function defaultBasemap(): BasemapId {
  return hasMapboxToken() ? 'dark-vector' : 'esri-imagery'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MapViewProps {
  city: CityConfig
  basemap: BasemapId
  onMapReady?: (map: MapLibreMap) => void
}

export function MapView({ city, basemap, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const currentBasemapRef = useRef<BasemapId>(basemap)

  // Init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const def = getBasemapDef(basemap)
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

  // Fly to city when active city changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const fly = () =>
      map.flyTo({ center: city.center, zoom: city.zoom, duration: 1800, essential: true })
    if (map.isStyleLoaded()) {
      fly()
    } else {
      map.once('load', fly)
    }
  }, [city])

  // Swap basemap style when prop changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (currentBasemapRef.current === basemap) return
    currentBasemapRef.current = basemap
    const def = getBasemapDef(basemap)
    map.setStyle(def.style)
  }, [basemap])

  return <div ref={containerRef} className="map-container" />
}
