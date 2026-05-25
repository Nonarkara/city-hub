/**
 * Five-vital status strip for the governor's left rail.
 * Now with trend arrows and anomaly indicators.
 */
import { useEffect, useState } from 'react'
import { bangkokPm25Live, centralFloods, type Pm25Live } from '../data/gistda'
import { bangkokWeather, type BangkokWeather } from '../data/openmeteo'
import { bangkokAQI, type BangkokAQI } from '../data/openmeteo-aq'
import { fetchTraffyStats, type TraffyStats } from '../data/traffy'
import { computeVitals, RISK_COLOR, type RiskLevel } from '../lib/risk'

function RiskDot({ level }: { level: RiskLevel }) {
  return <span className="vital-dot" style={{ background: RISK_COLOR[level] }} title={level} />
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  const arrows = { up: '↗', down: '↘', flat: '→' }
  const colors = { up: '#e53935', down: '#8bc34a', flat: '#888' }
  return <span className="vital-trend" style={{ color: colors[trend] }}>{arrows[trend]}</span>
}

function computeAirTrend(pm25: Pm25Live | null): 'up' | 'down' | 'flat' {
  if (!pm25 || pm25.history24h.length < 4) return 'flat'
  const recent = pm25.history24h.slice(-4).map((h) => h[0])
  const first = recent[0]
  const last = recent[recent.length - 1]
  if (last > first * 1.15) return 'up'
  if (last < first * 0.85) return 'down'
  return 'flat'
}

export function VitalsBar() {
  const [pm25, setPm25] = useState<Pm25Live | null>(null)
  const [weather, setWeather] = useState<BangkokWeather | null>(null)
  const [floodCount, setFloodCount] = useState(0)
  const [aqi, setAqi] = useState<BangkokAQI | null>(null)
  const [traffy, setTraffy] = useState<TraffyStats | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [p, w, f, a, t] = await Promise.all([
        bangkokPm25Live().catch((): null => null),
        bangkokWeather().catch((): null => null),
        centralFloods().catch((): null => null),
        bangkokAQI().catch((): null => null),
        fetchTraffyStats().catch((): null => null),
      ])
      if (cancelled) return
      if (p) setPm25(p)
      if (w) setWeather(w)
      if (f) setFloodCount(Array.isArray(f.features) ? f.features.length : 0)
      if (a) setAqi(a)
      if (t) setTraffy(t)
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const vitals = computeVitals(pm25, weather, floodCount, aqi, traffy)
  const airTrend = computeAirTrend(pm25)

  return (
    <div className="vitals-bar">
      {vitals.map((v) => (
        <div key={v.id} className="vital-row">
          <RiskDot level={v.level} />
          <div className="vital-main">
            <span className="vital-label">{v.label}</span>
            <span className="vital-value" style={{ color: RISK_COLOR[v.level] }}>
              {v.value}
              {v.unit && <span className="vital-unit"> {v.unit}</span>}
              {v.id === 'air' && <TrendArrow trend={airTrend} />}
            </span>
          </div>
          {v.sub && <span className="vital-sub">{v.sub}</span>}
        </div>
      ))}
    </div>
  )
}
