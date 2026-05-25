/**
 * Tactical HUD overlay — corner brackets, center reticle, live telemetry ribbon.
 * Sits above the map, below the topbar and panels. Pointer-events: none except
 * where the ribbon explicitly enables them.
 */
import { useEffect, useState } from 'react'
import type { Map as MapLibre } from 'maplibre-gl'

interface HUDProps {
  map: MapLibre | null
  activeLayerCount: number
  sourceCount: number
}

function fmtClock(date: Date, tz: 'utc' | 'bkk'): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz === 'utc' ? 'UTC' : 'Asia/Bangkok',
  }
  return new Intl.DateTimeFormat('en-GB', opts).format(date)
}

function fmtCoord(lng: number, lat: number): string {
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`
  return `${latStr}  ${lngStr}`
}

const SESSION_START = Date.now()

function fmtUptime(): string {
  const secs = Math.floor((Date.now() - SESSION_START) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function HUD({ map, activeLayerCount, sourceCount }: HUDProps) {
  const [now, setNow] = useState(new Date())
  const [center, setCenter] = useState<{ lng: number; lat: number; zoom: number }>({
    lng: 100.5018,
    lat: 13.7563,
    zoom: 11,
  })

  // Clock tick — every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Map center tracker
  useEffect(() => {
    if (!map) return
    const update = () => {
      const c = map.getCenter()
      setCenter({ lng: c.lng, lat: c.lat, zoom: map.getZoom() })
    }
    update()
    map.on('move', update)
    return () => { map.off('move', update) }
  }, [map])

  return (
    <>
      {/* Corner brackets — 4 tactical crosshairs at viewport corners */}
      <svg className="hud-bracket hud-bracket-tl" viewBox="0 0 32 32" aria-hidden>
        <path d="M0 12 L0 0 L12 0" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="hud-bracket hud-bracket-tr" viewBox="0 0 32 32" aria-hidden>
        <path d="M20 0 L32 0 L32 12" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="hud-bracket hud-bracket-bl" viewBox="0 0 32 32" aria-hidden>
        <path d="M0 20 L0 32 L12 32" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="hud-bracket hud-bracket-br" viewBox="0 0 32 32" aria-hidden>
        <path d="M20 32 L32 32 L32 20" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Center reticle — tiny crosshair at viewport center */}
      <svg className="hud-reticle" viewBox="0 0 24 24" aria-hidden>
        <line x1="12" y1="0" x2="12" y2="7" stroke="currentColor" strokeWidth="1" />
        <line x1="12" y1="17" x2="12" y2="24" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="12" x2="7" y2="12" stroke="currentColor" strokeWidth="1" />
        <line x1="17" y1="12" x2="24" y2="12" stroke="currentColor" strokeWidth="1" />
        <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="0.8" />
      </svg>

      {/* Telemetry ribbon — under topbar */}
      <div className="hud-ribbon">
        <span className="hud-pulse" aria-hidden />
        <span className="hud-cell hud-cell-strong">LIVE</span>
        <span className="hud-sep" />
        <span className="hud-cell">UTC {fmtClock(now, 'utc')}</span>
        <span className="hud-sep" />
        <span className="hud-cell">BKK {fmtClock(now, 'bkk')}</span>
        <span className="hud-sep" />
        <span className="hud-cell hud-cell-coord">{fmtCoord(center.lng, center.lat)}</span>
        <span className="hud-sep" />
        <span className="hud-cell">Z{center.zoom.toFixed(2)}</span>
        <span className="hud-sep" />
        <span className="hud-cell">LAYERS {activeLayerCount.toString().padStart(2, '0')}</span>
        <span className="hud-sep" />
        <span className="hud-cell">FEEDS {sourceCount.toString().padStart(2, '0')}</span>
        <span className="hud-sep" />
        <span className="hud-cell hud-cell-uptime">UP {fmtUptime()}</span>
      </div>

      {/* CRT scanlines — full viewport texture */}
      <div className="hud-scanlines" aria-hidden />
    </>
  )
}
