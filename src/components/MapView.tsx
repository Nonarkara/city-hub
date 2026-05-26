import { useEffect, useRef } from 'react'
import mapboxgl, { Map as MapboxMap, type StyleSpecification } from 'mapbox-gl'
import type { CityConfig } from '../config/cities'

// Mapbox token — set once at module scope. Public pk.* token, URL-restricted
// in Mapbox account UI to *.pages.dev + *.nonarkara.org.
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string

// Dark vectorial style — inline so we own the paint. Mapbox Streets v8 schema.
// Aesthetic preserved from the prior UNL-OMV inline style: water dark navy,
// roads amber-warm, places amber, buildings dark blue-grey (3D extrusions
// applied separately via use-bangkok-layers.ts).
//
// Thai-first labels via coalesce(name_th, name_en, name). Glyphs hosted by
// Mapbox; font swapped from "Fira GO Regular" (not in Mapbox defaults) to
// "DIN Pro Regular" which is included.
const CITY_HUB_STYLE: StyleSpecification = {
  version: 8,
  name: 'City Hub Dark',
  metadata: {},
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  sources: {
    composite: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#04060b' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'composite',
      'source-layer': 'water',
      paint: { 'fill-color': '#071a2c' },
    },
    {
      id: 'water_outline',
      type: 'line',
      source: 'composite',
      'source-layer': 'water',
      paint: { 'line-color': '#1a4a6e', 'line-width': 0.6, 'line-opacity': 0.6 },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'composite',
      'source-layer': 'waterway',
      paint: { 'line-color': '#1a4a6e', 'line-width': 0.5, 'line-opacity': 0.55 },
    },
    {
      id: 'landuse_park',
      type: 'fill',
      source: 'composite',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'park'],
      paint: { 'fill-color': '#0a1410', 'fill-opacity': 0.85 },
    },
    {
      id: 'admin_boundaries',
      type: 'line',
      source: 'composite',
      'source-layer': 'admin',
      filter: ['<=', ['to-number', ['get', 'admin_level']], 2],
      paint: { 'line-color': '#244a6a', 'line-width': 0.5, 'line-opacity': 0.5, 'line-dasharray': [2, 2] },
    },
    {
      id: 'roads_minor',
      type: 'line',
      source: 'composite',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['street', 'street_limited', 'path', 'pedestrian', 'track', 'service']]],
      paint: { 'line-color': '#0f1626', 'line-width': 0.7 },
    },
    {
      id: 'roads_major_casing',
      type: 'line',
      source: 'composite',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      paint: {
        'line-color': '#1a1206',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.6, 14, 6],
      },
    },
    {
      id: 'roads_major',
      type: 'line',
      source: 'composite',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      paint: {
        'line-color': '#3d2a0f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 14, 3.2],
      },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'composite',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': '#0a1020', 'fill-opacity': 0.92 },
    },
    {
      id: 'buildings_outline',
      type: 'line',
      source: 'composite',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'line-color': '#1a2540', 'line-width': 0.4, 'line-opacity': 0.7 },
    },
    {
      id: 'roads_labels',
      type: 'symbol',
      source: 'composite',
      'source-layer': 'road',
      minzoom: 14,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'name_th'], ['get', 'name_en'], ['get', 'name']],
        'text-size': 10,
        'text-letter-spacing': 0.12,
        'text-transform': 'uppercase',
        'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
      },
      paint: { 'text-color': '#7a5a2a', 'text-halo-color': '#04060b', 'text-halo-width': 1.5 },
    },
    {
      id: 'places',
      type: 'symbol',
      source: 'composite',
      'source-layer': 'place_label',
      minzoom: 10,
      filter: ['in', ['get', 'type'], ['literal', ['city', 'town', 'suburb', 'neighbourhood']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name_th'], ['get', 'name_en'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 13],
        'text-letter-spacing': 0.16,
        'text-transform': 'uppercase',
        'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
      },
      paint: { 'text-color': '#c87a14', 'text-halo-color': '#04060b', 'text-halo-width': 2 },
    },
  ],
}

interface MapViewProps {
  city: CityConfig
  onMapReady?: (map: MapboxMap) => void
}

export function MapView({ city, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapboxMap({
      container: containerRef.current,
      style: CITY_HUB_STYLE,
      center: city.center,
      zoom: city.zoom,
      minZoom: 3,
      renderWorldCopies: false,
      attributionControl: true,
    })

    mapRef.current = map
    onMapReady?.(map)

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return <div ref={containerRef} className="map-container" />
}
