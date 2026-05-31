/**
 * useGlobalOverlays — real-time planetary layers that ride on top of ANY
 * basemap lens, for ANY city. Independent of the Bangkok layer engine.
 *
 *   - quakes : USGS earthquakes, last 24h, magnitude-scaled, click for detail
 *   - radar  : RainViewer precipitation radar, latest frame
 *
 * Survives lens switches by re-adding on 'style.load' (setStyle wipes sources).
 * Popup handlers are wired once; layer-scoped map.on() is a no-op when the
 * layer is absent, so re-adds never duplicate listeners.
 */
import { useEffect, useRef } from 'react'
import type { Map as MapLibre, GeoJSONSource, ExpressionSpecification } from 'maplibre-gl'
import { Popup } from 'maplibre-gl'
import { fetchEarthquakes24h } from '../../data/usgs'
import { fetchRadarTileTemplate } from '../../data/rainviewer'

const OVERLAY_IDS = ['quakes', 'radar'] as const

const SOURCE: Record<string, string> = { quakes: 'src-quakes', radar: 'src-radar' }
const LAYERS: Record<string, string[]> = {
  quakes: ['ly-quakes-halo', 'ly-quakes-core'],
  radar:  ['ly-radar'],
}

// Magnitude → colour ramp (green calm → maroon severe)
const MAG_COLOR: ExpressionSpecification = [
  'interpolate', ['linear'], ['get', 'mag'],
  1, '#8bc34a', 3, '#fdd835', 4.5, '#fb8c00', 6, '#e53935', 7, '#7e0023',
]

export function useGlobalOverlays(map: MapLibre | null, active: Set<string>) {
  const wiredRef = useRef(false)

  useEffect(() => {
    if (!map) return

    if (!wiredRef.current) {
      wiredRef.current = true
      wireQuakePopup(map)
    }

    const reconcile = async () => {
      for (const id of OVERLAY_IDS) {
        const wanted = active.has(id)
        const present = !!map.getSource(SOURCE[id])
        if (wanted && !present) {
          if (id === 'quakes') await addQuakes(map)
          else if (id === 'radar') await addRadar(map)
        } else if (!wanted && present) {
          for (const lid of LAYERS[id]) if (map.getLayer(lid)) map.removeLayer(lid)
          if (map.getSource(SOURCE[id])) map.removeSource(SOURCE[id])
        }
      }
    }

    const run = () => { if (map.isStyleLoaded()) reconcile(); else map.once('load', reconcile) }
    run()

    const onStyleLoad = () => reconcile()
    map.on('style.load', onStyleLoad)

    // Keep the quake layer live — refresh the feed every 5 min via setData.
    const timer = window.setInterval(async () => {
      if (!active.has('quakes')) return
      const src = map.getSource('src-quakes') as GeoJSONSource | undefined
      if (!src) return
      const data = await fetchEarthquakes24h().catch(() => null)
      if (data) src.setData(data as GeoJSON.FeatureCollection)
    }, 5 * 60 * 1000)

    return () => { map.off('style.load', onStyleLoad); window.clearInterval(timer) }
  }, [map, active])
}

async function addQuakes(map: MapLibre) {
  const data = await fetchEarthquakes24h().catch(() => null)
  if (!data || map.getSource('src-quakes')) return
  map.addSource('src-quakes', { type: 'geojson', data })

  // Soft halo sized by magnitude
  map.addLayer({
    id: 'ly-quakes-halo',
    type: 'circle',
    source: 'src-quakes',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 1, 4, 3, 10, 5, 22, 7, 42],
      'circle-color': MAG_COLOR,
      'circle-opacity': 0.18,
      'circle-stroke-width': 1,
      'circle-stroke-color': MAG_COLOR,
      'circle-stroke-opacity': 0.6,
    },
  })
  // Bright core
  map.addLayer({
    id: 'ly-quakes-core',
    type: 'circle',
    source: 'src-quakes',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 1, 1.5, 4, 4, 7, 8],
      'circle-color': MAG_COLOR,
      'circle-stroke-width': 0.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.95,
    },
  })
}

async function addRadar(map: MapLibre) {
  const tiles = await fetchRadarTileTemplate().catch(() => null)
  if (!tiles || map.getSource('src-radar')) return
  map.addSource('src-radar', {
    type: 'raster',
    tiles: [tiles],
    tileSize: 256,
    attribution: '© RainViewer',
  })
  // Insert below labels (if the raster style has them) so place names stay on top.
  const beforeId = map.getLayer('labels') ? 'labels' : undefined
  map.addLayer({
    id: 'ly-radar',
    type: 'raster',
    source: 'src-radar',
    paint: { 'raster-opacity': 0.6 },
  }, beforeId)
}

function wireQuakePopup(map: MapLibre) {
  const popup = new Popup({ closeButton: true, closeOnClick: true, className: 'city-popup' })
  map.on('click', 'ly-quakes-core', (e) => {
    const f = e.features?.[0]
    if (!f || f.geometry.type !== 'Point') return
    const p = f.properties ?? {}
    const coords = (f.geometry.coordinates as number[]).slice(0, 2) as [number, number]
    const depth = (f.geometry.coordinates as number[])[2]
    const when = p.time ? new Date(Number(p.time)).toUTCString() : '—'
    const safe = (s: unknown) => String(s ?? '—').replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`)
    const html = `
      <div class="popup-quake">
        <div class="popup-quake-mag">M ${Number(p.mag ?? 0).toFixed(1)}</div>
        <div class="popup-quake-place">${safe(p.place)}</div>
        <div class="popup-quake-meta">DEPTH ${typeof depth === 'number' ? depth.toFixed(0) : '—'} km · ${safe(when)}</div>
      </div>`
    popup.setLngLat(coords).setHTML(html).addTo(map)
  })
  map.on('mouseenter', 'ly-quakes-core', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'ly-quakes-core', () => { map.getCanvas().style.cursor = '' })
}
