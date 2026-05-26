/**
 * LiteCityPanel — governor brief for lite-tier cities (Chiang Mai, Phuket,
 * Singapore, Kuching). Uses only global data sources: Open-Meteo (weather +
 * AQI + forecast), GDELT (news), NASA FIRMS (fires, where applicable).
 *
 * Same right-panel chrome as AlertPanel so the mobile drawer + peek strip
 * from v0.5.1 keep working without modification.
 */
import { useCallback, useEffect, useState } from 'react'
import type { CityConfig } from '../config/cities'
import { fetchAQI, type CityAQI } from '../data/openmeteo-aq'
import { fetchAQIForecast, type AQIForecast } from '../data/openmeteo-forecast'
import { fetchWeather, type CityWeather } from '../data/openmeteo'
import { fetchCityNews, type GdeltNewsResult } from '../data/gdelt'
import { pm25ToRisk, aqiToRisk, RISK_COLOR, type RiskLevel } from '../lib/risk'
import { SLICPanel } from './SLICPanel'
import { slicSummaryText } from './SLICPanel'
import { PatternsSection } from './PatternsSection'
import { CitizenReportsSection } from './CitizenReportsSection'
import { OpenDataInventory } from './OpenDataInventory'
import { SingaporeDataSection } from './SingaporeDataSection'
import { PrepareCard } from './PrepareCard'

interface Props {
  activeCity: CityConfig
}

function levelLabel(level: RiskLevel): string {
  return level === 'critical' ? 'CRITICAL'
    : level === 'high'        ? 'HIGH'
    : level === 'moderate'    ? 'ADVISORY'
    :                           'NORMAL'
}

export function LiteCityPanel({ activeCity }: Props) {
  const [aqi, setAqi] = useState<CityAQI | null>(null)
  const [forecast, setForecast] = useState<AQIForecast | null>(null)
  const [weather, setWeather] = useState<CityWeather | null>(null)
  const [news, setNews] = useState<GdeltNewsResult | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [lng, lat] = activeCity.center

  useEffect(() => {
    let cancelled = false
    // Reset state on city change so the previous city's data doesn't flash
    setAqi(null); setForecast(null); setWeather(null); setNews(null); setLastUpdate(null)

    const load = async () => {
      const [a, f, w, n] = await Promise.all([
        fetchAQI(lng, lat, activeCity.timezone).catch((): null => null),
        fetchAQIForecast(lng, lat, activeCity.timezone).catch((): null => null),
        fetchWeather(lng, lat, activeCity.timezone).catch((): null => null),
        fetchCityNews(activeCity.gdeltQuery, 6).catch((): null => null),
      ])
      if (cancelled) return
      if (a) setAqi(a)
      if (f) setForecast(f)
      if (w) setWeather(w)
      if (n) setNews(n)
      setLastUpdate(new Date())
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeCity.id, lng, lat, activeCity.timezone, activeCity.gdeltQuery])

  const overallLevel: RiskLevel = aqi ? pm25ToRisk(aqi.pm25) : 'good'
  const overallColor = RISK_COLOR[overallLevel]
  const peakLevel: RiskLevel = forecast ? aqiToRisk(forecast.peakAqi) : 'good'

  const timeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: activeCity.timezone })
    : '—:—'

  const newsTone = news?.avgTone ?? 0

  const handleOpenPeek = useCallback(() => setMobileOpen(true), [])
  const handleClose = useCallback(() => setMobileOpen(false), [])

  // 1-paragraph narrative templated from real values, grounded with SLIC structural context
  const slicLine = slicSummaryText(activeCity)
  const narrative = aqi && weather
    ? `Air quality in ${activeCity.name} is ${levelLabel(overallLevel).toLowerCase()} at PM2.5 ${aqi.pm25.toFixed(1)} µg/m³ (US AQI ${aqi.usAqi}). ` +
      `Temperature ${weather.temp}°C, feels like ${weather.feelsLike}°C; wind ${weather.windCardinal} at ${weather.windSpeed} km/h. ` +
      (forecast ? `Forecast peaks at AQI ${forecast.peakAqi} around ${forecast.peakHour}. ` : '') +
      (slicLine ? `\n\n${slicLine}` : '')
    : aqi
    ? `Air quality at PM2.5 ${aqi.pm25.toFixed(1)} µg/m³. ${slicLine}`
    : `Loading live data… ${slicLine}`

  // Forecast sparkline
  const sparkline = forecast && forecast.hours.length > 0 ? (() => {
    const W = 280, H = 60
    const maxA = Math.max(...forecast.hours.map((h) => h.usAqi), 100)
    const pts = forecast.hours.map((h, i) => {
      const x = (i / Math.max(1, forecast.hours.length - 1)) * W
      const y = H - (h.usAqi / maxA) * H
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    const threshY = (H - (100 / maxA) * H).toFixed(1)
    return (
      <svg className="forecast-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1="0" y1={threshY} x2={W} y2={threshY} stroke="#444" strokeWidth="1" strokeDasharray="4,4" />
        <polyline points={pts} fill="none" stroke={RISK_COLOR[peakLevel]} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="0" cy={H - ((forecast.currentAqi) / maxA) * H} r="2.5" fill={RISK_COLOR[peakLevel]} />
      </svg>
    )
  })() : null

  return (
    <>
      <button
        className="alert-peek"
        onClick={handleOpenPeek}
        aria-label={`Open ${activeCity.name} brief`}
        aria-expanded={mobileOpen}
      >
        <span className="alert-peek-dot" style={{ background: overallColor }} aria-hidden />
        <span className="alert-peek-title">{activeCity.name.toUpperCase()} · {timeStr}</span>
        <span className="alert-peek-count" style={{ color: overallColor }}>
          {aqi ? `AQI ${aqi.usAqi}` : 'LOADING'}
        </span>
        <span className="alert-peek-chev" aria-hidden>▴</span>
      </button>

      {mobileOpen && (
        <div className="alert-drawer-backdrop" onClick={handleClose} aria-hidden />
      )}

      <aside className={`alert-panel lite-panel ${mobileOpen ? 'alert-panel--mobile-open' : ''}`}>
        <div className="alert-panel-thread" style={{ background: overallColor }} aria-label={`Status: ${overallLevel}`} />
        <div className="alert-panel-header">
          <span className="alert-panel-time">{timeStr} · {activeCity.hudClockLabel}</span>
          <button className="alert-drawer-close" onClick={handleClose} aria-label="Close brief">✕</button>
        </div>

        <div className="alert-scroll">
          <div className="brief-section">
            <div className="brief-open">
              <div className="brief-open-date">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: activeCity.timezone }).toLowerCase()}
              </div>
              <div className="brief-open-time">
                <span style={{ color: overallColor }}>●</span>
                <span>{timeStr} · {activeCity.hudClockLabel}</span>
              </div>
            </div>

            <div className="brief-body">
              <p className="brief-paragraph">{narrative}</p>
            </div>

            {aqi && (
              <div className="brief-gap brief-gap--low" style={{ borderLeftColor: overallColor }}>
                <span className="brief-gap-bullet">·</span>
                <span className="brief-gap-headline">PM2.5 {aqi.pm25.toFixed(1)} · PM10 {aqi.pm10.toFixed(1)} · NO₂ {aqi.no2.toFixed(1)}</span>
                <span className="brief-gap-detail">Source: Open-Meteo Air Quality · {activeCity.name} ({lat.toFixed(3)}, {lng.toFixed(3)})</span>
              </div>
            )}
          </div>

          <PrepareCard activeCity={activeCity} forecast={forecast} />

          <SLICPanel activeCity={activeCity} />

          <SingaporeDataSection activeCity={activeCity} />

          <PatternsSection activeCity={activeCity} />

          <CitizenReportsSection activeCity={activeCity} />

          <OpenDataInventory activeCity={activeCity} />

          {forecast && (
            <div className="forecast-strip">
              <div className="forecast-header">
                <span className="forecast-label">AQI FORECAST · 24H</span>
                <span className="forecast-peak" style={{ color: RISK_COLOR[peakLevel] }}>
                  PEAK {forecast.peakAqi} @ {forecast.peakHour}
                </span>
              </div>
              {sparkline}
              <div className="forecast-axis">
                <span>NOW</span>
                <span>+12H</span>
                <span>+24H</span>
              </div>
            </div>
          )}

          {news && news.articles.length > 0 && (
            <div className="news-section">
              <div className="news-header">
                <span>NARRATIVE · GDELT</span>
                <span className="news-verdict" style={{ color: newsTone < -2 ? '#e53935' : newsTone > 2 ? '#8bc34a' : '#fdd835' }}>
                  {newsTone < -2 ? 'NEGATIVE' : newsTone > 2 ? 'POSITIVE' : 'NEUTRAL'}
                </span>
              </div>
              <div className="news-tone-row">
                <span className="news-tone-label">TONE</span>
                <span className="news-tone-bar">
                  <span
                    className="news-tone-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, 50 + newsTone * 2))}%`,
                      background: newsTone < -2 ? '#e53935' : newsTone > 2 ? '#8bc34a' : '#fdd835',
                    }}
                  />
                </span>
                <span className="news-tone-val">{newsTone > 0 ? '+' : ''}{newsTone.toFixed(1)}</span>
              </div>
              <div className="news-list">
                {news.articles.slice(0, 4).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="news-item" title={a.domain}>
                    <span className="news-item-title">{a.title}</span>
                    <span
                      className="news-item-tone"
                      style={{ color: a.tone < -2 ? '#e53935' : a.tone > 2 ? '#8bc34a' : '#fdd835' }}
                    >
                      {a.tone > 0 ? '+' : ''}{a.tone.toFixed(0)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="alert-panel-footer">
          <div className="footer-aphorism">
            <span lang="th">ทุกอย่างเกิดขึ้นเพราะมีเหตุ</span>
            <span className="footer-aphorism-en">— every city has its own weather.</span>
          </div>
          <div className="footer-sources">
            live · open-meteo · gdelt
          </div>
          <div className="footer-signature">
            Non Arkaraprasertkul · DEPA Thailand
          </div>
        </div>
      </aside>
    </>
  )
}
