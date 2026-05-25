import { useEffect, useRef } from 'react'
import { Map as MapLibre, type StyleSpecification } from 'maplibre-gl'
import type { CityConfig } from '../config/cities'

// UNL vectorial style — same JSON that unl-map-js/getStyle('vectorial') produces.
// We apply auth via transformRequest so no wrapper dependency needed.
const UNL_STYLE: StyleSpecification = {
  version: 8,
  name: 'UNL Vectorial',
  metadata: {},
  glyphs: 'https://assets.vector.hereapi.com/fonts/{fontstack}/{range}.pbf',
  sources: {
    omv: {
      type: 'vector',
      maxzoom: 17,
      tiles: ['https://tiles.unl.global/v1/vector/1/{z}/{x}/{y}'],
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0d1117' },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omv',
      'source-layer': 'water',
      paint: { 'fill-color': '#151d2e' },
    },
    {
      id: 'landuse_park',
      type: 'fill',
      source: 'omv',
      'source-layer': 'landuse',
      filter: ['==', 'kind', 'park'],
      paint: { 'fill-color': '#111a16', 'fill-opacity': 0.8 },
    },
    {
      id: 'roads_minor',
      type: 'line',
      source: 'omv',
      'source-layer': 'roads',
      filter: ['in', 'kind', 'minor_road', 'path', 'pedestrian'],
      paint: { 'line-color': '#1e2838', 'line-width': 1 },
    },
    {
      id: 'roads_major',
      type: 'line',
      source: 'omv',
      'source-layer': 'roads',
      filter: ['in', 'kind', 'highway', 'major_road', 'secondary_road'],
      paint: {
        'line-color': '#253048',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 14, 4],
      },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'omv',
      'source-layer': 'buildings',
      minzoom: 13,
      paint: { 'fill-color': '#161d2b', 'fill-opacity': 0.9 },
    },
    {
      id: 'roads_labels',
      type: 'symbol',
      source: 'omv',
      'source-layer': 'roads',
      minzoom: 14,
      filter: ['in', 'kind', 'major_road', 'secondary_road', 'highway'],
      layout: {
        'symbol-placement': 'line',
        'text-field': '{name}',
        'text-size': 11,
        'text-font': ['Fira GO Regular'],
      },
      paint: { 'text-color': '#566177', 'text-halo-color': '#0d1117', 'text-halo-width': 1 },
    },
    {
      id: 'places',
      type: 'symbol',
      source: 'omv',
      'source-layer': 'places',
      minzoom: 10,
      filter: ['in', 'kind', 'city', 'town', 'suburb', 'neighbourhood'],
      layout: {
        'text-field': '{name}',
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 14, 14],
        'text-font': ['Fira GO Regular'],
      },
      paint: { 'text-color': '#8899bb', 'text-halo-color': '#0d1117', 'text-halo-width': 1.5 },
    },
  ],
}

interface MapViewProps {
  city: CityConfig
  vpmId: string
  apiKey: string
  onMapReady?: (map: MapLibre) => void
}

export function MapView({ city, vpmId, apiKey, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibre({
      container: containerRef.current,
      style: UNL_STYLE,
      center: city.center,
      zoom: city.zoom,
      minZoom: 3,
      renderWorldCopies: false,
      attributionControl: true,
      transformRequest: (url) => {
        if (url.includes('tiles.unl.global')) {
          return {
            url,
            headers: {
              'x-unl-api-key': apiKey,
              'x-unl-vpm-id': vpmId,
            },
          }
        }
        return { url }
      },
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
