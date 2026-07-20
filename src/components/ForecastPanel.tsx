/**
 * ForecastPanel — "the map shows tomorrow."
 *
 * A 48h hourly forecast for the active city: US-AQI (primary, against health
 * bands) + air temperature (secondary), drawn as an inline SVG chart with the
 * AQI peak called out and a plain-language read. Data from Open-Meteo (keyless,
 * already the dashboard's air/weather source) — no model hosting required.
 */
import { useEffect, useState, useMemo } from 'react'
import type { CityConfig } from '../config/cities'
import { useUIStore } from '../store/uiStore'
import {
  fetchAQIForecast, fetchTempForecast,
  type AQIForecast, type TempForecastHour,
} from '../data/openmeteo-forecast'
import { aqiToRisk, RISK_COLOR } from '../lib/risk'

const HOURS = 48
// chart geometry (SVG viewBox units)
const W = 360, H = 150, PL = 8, PR = 8, PT = 14, PB = 22
const PW = W - PL - PR, PH = H - PT - PB

export function ForecastPanel({ activeCity }: { activeCity: CityConfig }) {
  const setForecastOpen = useUIStore((s) => s.setForecastOpen)

  const [aqi, setAqi]     = useState<AQIForecast | null>(null)
  const [temps, setTemps] = useState<TempForecastHour[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false); setAqi(null); setTemps([])
    const [lng, lat] = activeCity.center
    Promise.all([
      fetchAQIForecast(lng, lat, activeCity.timezone, HOURS),
      fetchTempForecast(lng, lat, activeCity.timezone, HOURS).catch(() => [] as TempForecastHour[]),
    ]).then(([a, t]) => {
      if (cancelled) return
      setAqi(a); setTemps(t); setLoading(false)
    }).catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [activeCity.id, activeCity.center, activeCity.timezone])

  const chart = useMemo(() => {
    if (!aqi || aqi.hours.length === 0) return null
    const hrs = aqi.hours
    const n = hrs.length
    const aqiMax = Math.max(150, Math.ceil(aqi.peakAqi * 1.15))
    const x = (i: number) => PL + (i / (n - 1)) * PW
    const yA = (v: number) => PT + PH - (Math.min(v, aqiMax) / aqiMax) * PH

    const aqiPts = hrs.map((h, i) => `${x(i).toFixed(1)},${yA(h.usAqi).toFixed(1)}`).join(' ')

    // temperature, own scale
    const tVals = temps.slice(0, n).map((t) => t.temp)
    const tMin = tVals.length ? Math.min(...tVals) : 0
    const tMax = tVals.length ? Math.max(...tVals) : 1
    const tSpan = Math.max(1, tMax - tMin)
    const yT = (v: number) => PT + PH - ((v - tMin) / tSpan) * PH
    const tempPts = tVals.map((v, i) => `${x(i).toFixed(1)},${yT(v).toFixed(1)}`).join(' ')

    // health-band reference lines (AQI 50/100/150)
    const bands = [50, 100, 150].filter((b) => b <= aqiMax).map((b) => ({ v: b, y: yA(b) }))

    // day boundaries + tick labels — hour strings are UTC without a 'Z' suffix;
    // parse as UTC and label in the *city's* timezone, not the browser's.
    const tz = activeCity.timezone
    const hourFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz })
    const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz })
    const cityHour = (h: string) => {
      const d = new Date(h.endsWith('Z') ? h : h + 'Z')
      return Number(hourFmt.format(d))
    }
    const ticks: { x: number; label: string }[] = []
    hrs.forEach((h, i) => {
      const d = new Date(h.time.endsWith('Z') ? h.time : h.time + 'Z')
      const hr = cityHour(h.time)
      if (i === 0) ticks.push({ x: x(i), label: 'NOW' })
      else if (hr === 0) ticks.push({ x: x(i), label: dayFmt.format(d).toUpperCase() })
      else if (hr === 12) ticks.push({ x: x(i), label: '12:00' })
    })

    const peakIdx = hrs.findIndex((h) => h.usAqi === aqi.peakAqi)
    const peak = { x: x(Math.max(0, peakIdx)), y: yA(aqi.peakAqi) }

    return { aqiPts, tempPts, bands, ticks, peak, aqiColor: RISK_COLOR[aqiToRisk(aqi.peakAqi)], tMin, tMax }
  }, [aqi, temps, activeCity.timezone])

  const summary = useMemo(() => {
    if (!aqi) return ''
    const cur = aqi.currentAqi, peak = aqi.peakAqi
    const lvl = aqiToRisk(peak).toUpperCase()
    const tRange = temps.length ? ` Temp ${Math.round(Math.min(...temps.map((t) => t.temp)))}–${Math.round(Math.max(...temps.map((t) => t.temp)))}°C.` : ''
    if (peak - cur >= 15) return `Air worsens to ${lvl} (~${peak} AQI) around ${aqi.peakHour}.${tRange}`
    if (cur - peak >= 15) return `Air improves over the next two days (now ${cur} AQI).${tRange}`
    return `Air stays around ${cur} AQI (${aqiToRisk(cur).toUpperCase()}) through tomorrow.${tRange}`
  }, [aqi, temps])

  return (
    <div className="forecast-panel" role="dialog" aria-label="Forecast">
      <div className="forecast-header">
        <span className="forecast-title">FORECAST · 48H</span>
        <span className="forecast-city">{activeCity.hudClockLabel}</span>
        <button className="forecast-close" onClick={() => setForecastOpen(false)} aria-label="Close forecast">✕</button>
      </div>

      <div className="forecast-body">
        {loading && <div className="forecast-msg">Loading forecast…</div>}
        {error && <div className="forecast-msg">⚠ Forecast unavailable (Open-Meteo rate limit). Try again shortly.</div>}

        {chart && (
          <>
            <svg className="forecast-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="48-hour AQI and temperature forecast">
              {chart.bands.map((b) => (
                <g key={b.v}>
                  <line x1={PL} x2={W - PR} y1={b.y} y2={b.y} stroke="rgba(255,255,255,0.10)" strokeDasharray="2 3" />
                  <text x={W - PR} y={b.y - 2} textAnchor="end" className="forecast-band-label">{b.v}</text>
                </g>
              ))}
              {chart.ticks.map((t, i) => (
                <text key={i} x={t.x} y={H - 6} textAnchor="middle" className="forecast-tick">{t.label}</text>
              ))}
              {chart.tempPts && (
                <polyline points={chart.tempPts} fill="none" stroke="var(--amber)" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 2" />
              )}
              <polyline points={chart.aqiPts} fill="none" stroke={chart.aqiColor} strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx={chart.peak.x} cy={chart.peak.y} r="3" fill={chart.aqiColor} stroke="#04060b" strokeWidth="1" />
            </svg>

            <div className="forecast-legend">
              <span className="forecast-legend-item"><span className="forecast-swatch" style={{ background: chart.aqiColor }} />US AQI</span>
              <span className="forecast-legend-item"><span className="forecast-swatch forecast-swatch--temp" />Temp °C</span>
            </div>

            <p className="forecast-summary">{summary}</p>
          </>
        )}
      </div>
    </div>
  )
}
