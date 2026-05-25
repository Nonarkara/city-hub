/**
 * Five-vital status strip for the governor's left rail.
 * Replaces the Bangkok KPI panel — same position, radically different purpose.
 * Each vital: coloured dot · label · live value · sub-label · trend arrow.
 *
 * Snapshots saved to localStorage every 5 min (288 max = 24h).
 * Trend arrows compare current value against 1h-ago snapshot.
 */
import { useEffect, useRef, useState } from 'react'
import { bangkokPm25Live, centralFloods, type Pm25Live } from '../data/gistda'
import { bangkokWeather, type BangkokWeather } from '../data/openmeteo'
import { bangkokAQI, type BangkokAQI } from '../data/openmeteo-aq'
import { fetchTraffyStats, type TraffyStats } from '../data/traffy'
import { computeVitals, RISK_COLOR, type RiskLevel } from '../lib/risk'

// ── localStorage history ───────────────────────────────────────────────────

const HISTORY_KEY = 'unl-vitals-history'
const MAX_ENTRIES = 288 // 24h at 5-min intervals

interface Snapshot {
  ts: number
  air: number   // PM2.5 or US AQI (whichever is primary)
  flood: number // GISTDA flood polygon count
  heat: number  // feels-like °C
  civic: number // active Traffy ticket count
}

function saveSnapshot(snap: Snapshot): Snapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history: Snapshot[] = raw ? JSON.parse(raw) : []
    history.push(snap)
    const cutoff = Date.now() - 24 * 60 * 60_000
    const pruned = history.filter((s) => s.ts > cutoff).slice(-MAX_ENTRIES)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(pruned))
    return pruned
  } catch {
    return []
  }
}

function loadHistory(): Snapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

type TrendArrow = '↑' | '↓' | '→'

function getTrend(
  history: Snapshot[],
  key: keyof Omit<Snapshot, 'ts'>,
  current: number,
  threshold: number,
): TrendArrow {
  const oneHourAgo = Date.now() - 60 * 60_000
  const ref = [...history].reverse().find((s) => s.ts < oneHourAgo)
  if (!ref) return '→'
  const delta = current - ref[key]
  if (delta > threshold) return '↑'
  if (delta < -threshold) return '↓'
  return '→'
}

function getPeak12h(history: Snapshot[], key: keyof Omit<Snapshot, 'ts'>): number | null {
  const cutoff = Date.now() - 12 * 60 * 60_000
  const slice = history.filter((s) => s.ts > cutoff)
  if (slice.length === 0) return null
  return Math.max(...slice.map((s) => s[key]))
}

// ── Component ──────────────────────────────────────────────────────────────

function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span
      className="vital-dot"
      style={{ background: RISK_COLOR[level] }}
      title={level}
    />
  )
}

function TrendChip({ arrow }: { arrow: TrendArrow }) {
  const color = arrow === '↑' ? '#e53935' : arrow === '↓' ? '#8bc34a' : '#616161'
  return (
    <span className="vital-trend" style={{ color }}>
      {arrow}
    </span>
  )
}

export function VitalsBar() {
  const [pm25, setPm25] = useState<Pm25Live | null>(null)
  const [weather, setWeather] = useState<BangkokWeather | null>(null)
  const [floodCount, setFloodCount] = useState(0)
  const [aqi, setAqi] = useState<BangkokAQI | null>(null)
  const [traffy, setTraffy] = useState<TraffyStats | null>(null)
  const [history, setHistory] = useState<Snapshot[]>(() => loadHistory())
  const historyRef = useRef<Snapshot[]>(history)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [p, w, f, a, t] = await Promise.all([
        bangkokPm25Live().catch((): null => null),
        bangkokWeather().catch((): null => null),
        centralFloods().catch((): null => null),
        bangkokAQI().catch((): null => null),
        fetchTraffyStats().catch((): null => null),
      ]) as [Pm25Live | null, BangkokWeather | null, { features?: unknown[] } | null, BangkokAQI | null, TraffyStats | null]

      if (cancelled) return
      if (p) setPm25(p)
      if (w) setWeather(w)
      if (f) setFloodCount(Array.isArray(f.features) ? f.features.length : 0)
      if (a) setAqi(a)
      if (t) setTraffy(t)

      // Save snapshot — use AQI as primary air metric if available, else PM2.5
      const airVal = a ? a.usAqi : (p ? p.pm25 : 0)
      const snap: Snapshot = {
        ts: Date.now(),
        air: airVal,
        flood: f && Array.isArray((f as { features?: unknown[] }).features) ? (f as { features: unknown[] }).features.length : 0,
        heat: w ? w.feelsLike : 0,
        civic: t ? (t.active ?? 0) : 0,
      }
      const updated = saveSnapshot(snap)
      historyRef.current = updated
      setHistory(updated)
    }

    load()
    const interval = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const vitals = computeVitals(pm25, weather, floodCount, aqi, traffy)

  // Derive trend arrows + 12h peak for air
  const airCurrent = aqi ? aqi.usAqi : (pm25 ? pm25.pm25 : 0)
  const airTrend = getTrend(history, 'air', airCurrent, aqi ? 10 : 5)
  const airPeak12h = getPeak12h(history, 'air')

  const floodTrend = getTrend(history, 'flood', floodCount, 1)
  const heatCurrent = weather ? weather.feelsLike : 0
  const heatTrend = getTrend(history, 'heat', heatCurrent, 1)
  const civicCurrent = traffy?.active ?? 0
  const civicTrend = getTrend(history, 'civic', civicCurrent, 50)

  const trendMap: Record<string, TrendArrow> = {
    air: airTrend,
    flood: floodTrend,
    heat: heatTrend,
    traffic: civicTrend, // vital id in risk.ts is 'traffic', label is 'CIVIC'
  }

  return (
    <div className="vitals-bar">
      {vitals.map((v) => {
        const arrow = trendMap[v.id] ?? '→'
        // For air: augment sub with 12h peak
        let sub = v.sub
        if (v.id === 'air' && airPeak12h !== null) {
          const peakLabel = aqi ? 'AQI' : 'µg'
          sub = `12H PEAK ${airPeak12h.toFixed(0)} ${peakLabel}`
        }
        return (
          <div key={v.id} className="vital-row">
            <RiskDot level={v.level} />
            <div className="vital-main">
              <span className="vital-label">{v.label}</span>
              <span className="vital-value" style={{ color: RISK_COLOR[v.level] }}>
                {v.value}
                {v.unit && <span className="vital-unit"> {v.unit}</span>}
              </span>
            </div>
            <div className="vital-right">
              {sub && <span className="vital-sub">{sub}</span>}
              <TrendChip arrow={arrow} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
