/**
 * Multi-City Time-Series Chart — overlay all pinned cities on shared axes.
 *
 * Shows AQI or PM2.5 history + forecast for up to 4 cities simultaneously.
 * Hover crosshair reads all values at a given timestamp.
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useCityStore } from '../store/cityStore'
import { cachedFetch } from '../lib/cached-fetch'
import { fetchAQIForecast } from '../data/openmeteo-forecast'
import { CITIES } from '../config/cities'
import { bangkokPm25Live } from '../data/gistda'

interface CitySeries {
  cityId: string
  cityName: string
  color: string
  history: number[]
  forecast: number[]
  peakLevel: string
}

const CITY_COLORS = ['#f59e0b', '#58a6ff', '#e53935', '#8bc34a']

export function MultiCityChart() {
  const compareSet = useCityStore((s) => s.compareSet)
    const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])
  const activeCity = useCityStore((s) => s.activeCity)

  const cities = useMemo(() => {
    const ids = compareSet.length >= 2 ? compareSet : [activeCity.id]
    return allCities.filter((c) => ids.includes(c.id)).slice(0, 4)
  }, [compareSet, allCities, activeCity])

  const [series, setSeries] = useState<CitySeries[]>([])
  const [loading, setLoading] = useState(true)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all(
      cities.map(async (city, idx) => {
        const [pm25Data, fc] = await Promise.all([
          city.id === 'bangkok'
            ? bangkokPm25Live().catch(() => null)
            : cachedFetch(`mc/pm25/${city.id}`, () => fetchAQIForecast(city.center[0], city.center[1], city.timezone), 5 * 60_000).catch(() => null),
          cachedFetch(`mc/fc/${city.id}`, () => fetchAQIForecast(city.center[0], city.center[1], city.timezone), 5 * 60_000).catch(() => null),
        ])

        const history = (pm25Data as { history24h?: [number, string][] } | null)?.history24h?.map(([v]) => Number(v)) ?? []
        const forecast = fc?.hours?.map((h: { usAqi: number }) => h.usAqi) ?? []
        const peak = forecast.length > 0 ? Math.max(...forecast) : 0
        const peakLevel = peak >= 151 ? 'critical' : peak >= 101 ? 'high' : peak >= 51 ? 'moderate' : 'good'

        return {
          cityId: city.id,
          cityName: city.hudClockLabel,
          color: CITY_COLORS[idx % CITY_COLORS.length],
          history,
          forecast,
          peakLevel,
        }
      }),
    ).then((results) => {
      if (cancelled) return
      setSeries(results)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [cities])

  const allValues = useMemo(() => {
    const vals: number[] = []
    for (const s of series) {
      vals.push(...s.history, ...s.forecast)
    }
    return vals
  }, [series])

  const maxVal = useMemo(() => Math.max(200, ...allValues), [allValues])
  const maxLen = useMemo(() => Math.max(1, ...series.map((s) => s.history.length + s.forecast.length)), [series])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const idx = Math.round((x / rect.width) * (maxLen - 1))
    setHoverIndex(Math.max(0, Math.min(maxLen - 1, idx)))
  }, [maxLen])

  const handleMouseLeave = useCallback(() => setHoverIndex(null), [])

  if (loading) return <div className="multicity-chart loading">Loading multi-city data…</div>
  if (series.length === 0) return null

  const W = 320
  const H = 120
  const padTop = 6
  const padBot = 18
  const usableH = H - padTop - padBot

  const xScale = (i: number) => (i / Math.max(1, maxLen - 1)) * W
  const yScale = (v: number) => padTop + (1 - v / maxVal) * usableH

  const splitX = series[0] ? xScale(series[0].history.length - 0.5) : 0

  return (
    <div className="multicity-chart">
      <div className="multicity-header">
        <span className="multicity-title">MULTI-CITY AQI</span>
        <div className="multicity-legend">
          {series.map((s) => (
            <span key={s.cityId} className="multicity-legend-item">
              <span className="multicity-dot" style={{ background: s.color }} />
              {s.cityName}
            </span>
          ))}
        </div>
      </div>
      <svg
        className="multicity-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {[50, 100, 150].map((v) => (
          <line
            key={v}
            x1="0"
            y1={yScale(v)}
            x2={W}
            y2={yScale(v)}
            stroke="rgba(245,245,240,0.06)"
            strokeWidth="1"
          />
        ))}

        {/* History/forecast for each city */}
        {series.map((s) => {
          // const allPts = [...s.history, ...s.forecast]
          // const pts = allPts.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ')
          const histPts = s.history.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ')
          const fcPts = s.forecast.map((v, i) => `${xScale(s.history.length + i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ')
          return (
            <g key={s.cityId}>
              {histPts && (
                <polyline points={histPts} fill="none" stroke={s.color} strokeWidth="1.2" opacity="0.6" />
              )}
              {fcPts && (
                <polyline points={fcPts} fill="none" stroke={s.color} strokeWidth="1.4" strokeDasharray="3,2" />
              )}
            </g>
          )
        })}

        {/* NOW separator */}
        <line x1={splitX} y1="0" x2={splitX} y2={H - padBot} stroke="#444" strokeWidth="1" strokeDasharray="2,3" />

        {/* Hover crosshair */}
        {hoverIndex !== null && (
          <>
            <line
              x1={xScale(hoverIndex)}
              y1={padTop}
              x2={xScale(hoverIndex)}
              y2={usableH + padTop}
              stroke="rgba(245,245,240,0.15)"
              strokeWidth="1"
            />
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoverIndex !== null && (
        <div className="multicity-tooltip">
          {series.map((s) => {
            const all = [...s.history, ...s.forecast]
            const val = all[hoverIndex]
            if (val === undefined) return null
            const isHistory = hoverIndex < s.history.length
            return (
              <div key={s.cityId} className="multicity-tooltip-row">
                <span className="multicity-dot" style={{ background: s.color }} />
                <span className="multicity-tooltip-name">{s.cityName}</span>
                <span className="multicity-tooltip-val">{val.toFixed(0)}</span>
                <span className="multicity-tooltip-hint">{isHistory ? 'H' : 'F'}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="multicity-axis">
        <span>−24H</span>
        <span>NOW</span>
        <span>+24H</span>
      </div>
    </div>
  )
}
