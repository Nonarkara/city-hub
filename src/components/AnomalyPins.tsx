/**
 * AnomalyPins — pulsing markers on the map for active anomalies.
 *
 * Anomalies from intelligence.detectAnomalies() are city-aggregate events.
 * We anchor them around Bangkok center with angular spread so multiple
 * anomalies don't overlap, then project to screen pixels via map.project()
 * on every move/zoom. Click → opens a callout with the message.
 *
 * Renders as absolutely-positioned DOM rather than a MapLibre symbol layer
 * because: (1) DOM CSS animation is cheaper for ≤5 pins, (2) the callout
 * popup is regular HTML, (3) no source/layer cleanup needed.
 */
import { useEffect, useRef, useState } from 'react'
import type { Map as MapLibre } from 'mapbox-gl'
import type { Anomaly } from '../lib/intelligence'

interface Props {
  map: MapLibre | null
  anomalies: Anomaly[]
}

const BKK = { lat: 13.7563, lng: 100.5018 }
const RADIUS_DEG = 0.04   // ~4 km halo around center for default anchors

function anchorFor(a: Anomaly, idx: number, total: number): [number, number] {
  if (a.lat !== undefined && a.lng !== undefined) return [a.lng, a.lat]
  const angle = (idx / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2
  return [
    BKK.lng + Math.cos(angle) * RADIUS_DEG,
    BKK.lat + Math.sin(angle) * RADIUS_DEG,
  ]
}

const SEVERITY_COLOR: Record<Anomaly['severity'], string> = {
  high:   '#e53935',
  medium: '#fb8c00',
  low:    '#fdd835',
}

export function AnomalyPins({ map, anomalies }: Props) {
  const [, setTick] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)

  // Re-render on every map move so pins stick. Throttle via rAF.
  useEffect(() => {
    if (!map) return
    const onMove = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setTick((v) => v + 1)
      })
    }
    map.on('move', onMove)
    map.on('zoom', onMove)
    return () => {
      map.off('move', onMove)
      map.off('zoom', onMove)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [map])

  if (!map || anomalies.length === 0) return null

  return (
    <div className="anomaly-pins-root">
      {anomalies.map((a, i) => {
        const [lng, lat] = anchorFor(a, i, anomalies.length)
        const point = map.project([lng, lat])
        const isOpen = openId === a.id
        const color = SEVERITY_COLOR[a.severity]
        return (
          <div
            key={a.id}
            className="anomaly-pin-wrap"
            style={{ left: point.x, top: point.y }}
          >
            <button
              className={`anomaly-pin anomaly-pin--${a.severity}`}
              style={{ color }}
              onClick={() => setOpenId(isOpen ? null : a.id)}
              aria-label={`${a.metric} anomaly`}
            >
              <span className="anomaly-pin-dot" />
              <span className="anomaly-pin-ring" />
            </button>
            {isOpen && (
              <div className="anomaly-pin-callout" style={{ borderColor: color }}>
                <div className="anomaly-pin-callout-head">
                  <span className="anomaly-pin-callout-metric" style={{ color }}>
                    {a.metric}
                  </span>
                  <button
                    className="anomaly-pin-callout-close"
                    onClick={() => setOpenId(null)}
                    aria-label="Close"
                  >✕</button>
                </div>
                <div className="anomaly-pin-callout-body">{a.message}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
