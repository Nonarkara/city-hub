/**
 * The reading line under the title, plus the corner marks.
 * The line states the finding for this city, then what the current frame is.
 * Pointer-events stay off except on the reading itself, which opens Research.
 */
import { useEffect, useState } from 'react'
import type { Map as MapLibre } from 'maplibre-gl'
import type { CityConfig } from '../config/cities'
import { fetchWeather, type CityWeather } from '../data/openmeteo'
import { cachedFetch } from '../lib/cached-fetch'
import { useUIStore } from '../store/uiStore'
import { cityClaim, viewClause } from '../lib/city-reading'
import { frameFromBounds, type FrameStats } from '../lib/viewport-math'

interface HUDProps {
  map: MapLibre | null
  activeCity: CityConfig
  activeLayerCount: number
  sourceCount: number
}

function fmtClock(date: Date, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone,
  }
  return new Intl.DateTimeFormat('en-GB', opts).format(date)
}

function fmtCoord(lng: number, lat: number): string {
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`
  return `${latStr}  ${lngStr}`
}

export function HUD({ map, activeCity }: HUDProps) {
  const [now, setNow] = useState(new Date())
  const [center, setCenter] = useState<{ lng: number; lat: number; zoom: number }>({
    lng: activeCity.center[0],
    lat: activeCity.center[1],
    zoom: activeCity.zoom,
  })
  const [wx, setWx] = useState<CityWeather | null>(null)
  const [frame, setFrame] = useState<FrameStats | null>(null)
  const setResearchOpen = useUIStore((s) => s.setResearchOpen)

  // Fetch weather for the active city, refresh every 15 min
  useEffect(() => {
    let cancelled = false
    const [lng, lat] = activeCity.center
    cachedFetch(
      `hud/wx/${activeCity.id}`,
      () => fetchWeather(lng, lat, activeCity.timezone),
      15 * 60_000,
    ).then((w) => { if (!cancelled) setWx(w) }).catch(() => {})
    return () => { cancelled = true }
  }, [activeCity.id])

  // Clock tick — every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Map center + frame. The reading line updates while the camera moves.
  useEffect(() => {
    if (!map) return
    let raf = 0
    const update = () => {
      const c = map.getCenter()
      setCenter({ lng: c.lng, lat: c.lat, zoom: map.getZoom() })
      try {
        const b = map.getBounds()
        const next = frameFromBounds(
          b.getWest(), b.getSouth(), b.getEast(), b.getNorth(),
          map.getZoom(), map.getBearing(), c.lng, c.lat, activeCity,
        )
        setFrame((prev) => {
          if (!prev) return next
          const same =
            prev.peopleEst === next.peopleEst &&
            Math.abs(prev.areaKm2 - next.areaKm2) < Math.max(0.05, prev.areaKm2 * 0.02)
          return same ? prev : next
        })
      } catch { /* globe bounds can throw */ }
    }
    const onMove = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; update() })
    }
    update()
    map.on('move', onMove)
    return () => {
      map.off('move', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [map, activeCity])

  return (
    <>
      {/* Reading line — the finding, then what this frame is. Click opens Research. */}
      <div className="hud-ribbon">
        <span className="hud-pulse" aria-hidden />
        <button
          type="button"
          className="hud-reading"
          onClick={() => setResearchOpen(true)}
          title={`${cityClaim(activeCity)} ${viewClause(frame)}`}
        >
          <span className="hud-reading-k">Read</span>
          <span className="hud-reading-text">{cityClaim(activeCity)}</span>
        </button>
        <span className="hud-sep" />
        <span className="hud-cell">{viewClause(frame) || fmtCoord(center.lng, center.lat)}</span>
        {wx && (
          <>
            <span className="hud-sep" />
            <span className="hud-cell hud-cell-wx">{wx.temp}° {wx.condition}</span>
          </>
        )}
        <span className="hud-sep" />
        <span className="hud-cell">{activeCity.hudClockLabel} {fmtClock(now, activeCity.timezone)}</span>
      </div>
    </>
  )
}
