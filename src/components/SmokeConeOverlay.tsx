/**
 * SmokeConeOverlay — renders a projected smoke transport cone on the map.
 *
 * Uses FIRMS fire hotspots + ECMWF wind forecast to draw where smoke from
 * active fires is likely to be in 12, 24, and 48 hours. The cone widens
 * with time to represent increasing atmospheric dispersion.
 *
 * The overlay is a MapLibre GL custom layer using GeoJSON polygons:
 *   - Red circle at each active fire hotspot
 *   - Amber arrow showing wind direction
 *   - Semi-transparent cone polygon for each forecast horizon
 *
 * Research basis: AAQR 2022 transport analysis confirmed 500–700 km
 * smoke transport over 48h from Northern Thailand to Bangkok under
 * NE flow (typical burning season pattern).
 */
import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { firmsThailand24h } from '../data/nasa'
import { fetchWeather } from '../data/openmeteo'
import { estimateSmokeImpact, type SmokeForecast } from '../lib/smoke-trajectory'
import type { CityConfig } from '../config/cities'

interface Props {
  map:         MapLibreMap | null
  activeCity:  CityConfig
  visible:     boolean
}

const CONE_HOURS = [12, 24, 48]
const TRANSPORT  = 0.7            // boundary layer transport factor

function buildSmokeCone(
  lat: number, lng: number,
  windSpeedKmh: number, windDegrees: number,
  hours: number,
): GeoJSON.Polygon {
  // Direction smoke travels: downwind (windDegrees + 180)
  const dir = ((windDegrees + 180) % 360) * Math.PI / 180
  const dist = windSpeedKmh * TRANSPORT * hours / 111  // degrees approx
  const spread = dist * 0.35  // dispersion half-angle ≈ 20°

  // Cone apex at fire location, base center at projected position
  const tipLat = lat
  const tipLng = lng
  const centerLat = lat + dist * Math.cos(dir)
  const centerLng = lng + dist * Math.sin(dir)

  // Perpendicular for cone width
  const perpDir = (dir + Math.PI / 2)
  const leftLat  = centerLat + spread * Math.cos(perpDir)
  const leftLng  = centerLng + spread * Math.sin(perpDir)
  const rightLat = centerLat - spread * Math.cos(perpDir)
  const rightLng = centerLng - spread * Math.sin(perpDir)

  return {
    type: 'Polygon',
    coordinates: [[
      [tipLng, tipLat],
      [leftLng, leftLat],
      [rightLng, rightLat],
      [tipLng, tipLat],
    ]],
  }
}

export function SmokeConeOverlay({ map, activeCity, visible }: Props) {
  const [forecast, setForecast] = useState<SmokeForecast | null>(null)
  const layersAdded = useRef(false)

  useEffect(() => {
    if (!visible || !map) return
    let cancelled = false

    const load = async () => {
      const [firms, wx] = await Promise.allSettled([
        firmsThailand24h(),
        fetchWeather(activeCity.center[0], activeCity.center[1], activeCity.timezone),
      ])
      if (cancelled || !map.isStyleLoaded()) return

      const firmsData = firms.status === 'fulfilled' ? firms.value : null
      if (!firmsData || firmsData.features.length === 0) return

      const result = await estimateSmokeImpact(activeCity, firmsData.features)
      if (cancelled) return
      setForecast(result)

      // Clear old smoke layers
      for (const h of CONE_HOURS) {
        const id = `smoke-cone-${h}`
        if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(id)) map.removeSource(id)
      }
      if (map.getLayer('smoke-hotspots')) map.removeLayer('smoke-hotspots')
      if (map.getSource('smoke-hotspots')) map.removeSource('smoke-hotspots')

      if (result.sources.length === 0 || !wx || wx.status !== 'fulfilled') return

      const wind = (wx as PromiseFulfilledResult<typeof wx.value extends Promise<infer T> ? T : never>).value
      const windSpeed = (wind as {windSpeed: number}).windSpeed
      const windDir   = (wind as {windDir: number}).windDir

      // Fire hotspot dots
      const hotspotGeo: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: result.sources.slice(0, 10).map((s) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
          properties: { brightness: s.brightness },
        })),
      }
      map.addSource('smoke-hotspots', { type: 'geojson', data: hotspotGeo })
      map.addLayer({
        id:     'smoke-hotspots',
        type:   'circle',
        source: 'smoke-hotspots',
        paint: {
          'circle-radius':       5,
          'circle-color':        '#ef4444',
          'circle-opacity':      0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#7f1d1d',
        },
      })

      // Smoke cones for each time horizon
      const CONE_OPACITY = [0.15, 0.10, 0.06]
      result.sources.slice(0, 5).forEach((source) => {
        CONE_HOURS.forEach((hours, hi) => {
          const coneId = `smoke-cone-${hours}-${source.lat.toFixed(2)}`
          if (map.getSource(coneId)) return
          const cone = buildSmokeCone(source.lat, source.lng, windSpeed, windDir, hours)
          map.addSource(coneId, { type: 'geojson', data: { type: 'Feature', geometry: cone, properties: {} } })
          map.addLayer({
            id:     coneId,
            type:   'fill',
            source: coneId,
            paint: {
              'fill-color':   '#f97316',
              'fill-opacity': CONE_OPACITY[hi],
            },
          })
        })
      })

      layersAdded.current = true
    }

    load()
    return () => {
      cancelled = true
      // Clean up on unmount
      if (map && layersAdded.current) {
        for (const h of CONE_HOURS) {
          if (map.getLayer(`smoke-cone-${h}`)) map.removeLayer(`smoke-cone-${h}`)
          if (map.getSource(`smoke-cone-${h}`)) map.removeSource(`smoke-cone-${h}`)
        }
        if (map.getLayer('smoke-hotspots')) map.removeLayer('smoke-hotspots')
        if (map.getSource('smoke-hotspots')) map.removeSource('smoke-hotspots')
        layersAdded.current = false
      }
    }
  }, [map, visible, activeCity.id])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!forecast || !visible) return null

  return (
    <div className="smoke-overlay-legend">
      <div className="smoke-legend-title">
        🔥 SMOKE TRAJECTORY
        <span className={`smoke-impact smoke-impact--${forecast.impactLevel}`}>
          {forecast.impactLevel.toUpperCase()}
        </span>
      </div>
      <div className="smoke-legend-note">{forecast.impactNote}</div>
      <div className="smoke-legend-hours">
        {CONE_HOURS.map((h, i) => (
          <span key={h} className="smoke-hour-badge" style={{ opacity: 1 - i * 0.25 }}>
            {h}h
          </span>
        ))}
      </div>
    </div>
  )
}
