/**
 * ComparisonPanel — SLIC-driven city comparison.
 *
 * Layout: ranked horizontal bars per metric, cities sorted best-first.
 * The SLIC Index pillars are the structural backbone; live sensor data
 * (PM2.5, AQI, temperature) sits below as the current-conditions layer.
 *
 * "Longer bar = better city" holds for every metric:
 *  - SLIC scores: higher = better → standard bar fill
 *  - PM2.5/AQI:  lower = better  → inverted bar fill (best city = longest bar)
 *  - Temperature: no winner       → bars show relative magnitude only
 *
 * ★ marks the winner of each metric.
 */
import { useEffect, useState, useMemo } from 'react'
import { CITIES } from '../config/cities'
import type { CityConfig } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { fetchAQI, type CityAQI } from '../data/openmeteo-aq'
import { fetchWeather, type CityWeather } from '../data/openmeteo'
import { fetchAQIForecast, type AQIForecast } from '../data/openmeteo-forecast'
import { cachedFetch } from '../lib/cached-fetch'
import {
  getCityScore, getPillarBreakdown, globalRank,
  PILLAR_ORDER, PILLAR_LABELS, PILLAR_WEIGHTS,
  SLIC_VERSION, type CityScore, type PillarId,
} from '../lib/slic'
import { pm25ToRisk, aqiToRisk, RISK_COLOR } from '../lib/risk'

const POLL_MS = 5 * 60_000

interface LiveSnapshot {
  aqi:      CityAQI     | null
  weather:  CityWeather | null
  forecast: AQIForecast | null
}

// ─────────────────────────────────────────────────────────────────────────────
// MetricRows — ranked bar chart for one metric across all compare cities
// ─────────────────────────────────────────────────────────────────────────────
interface MetricRowsProps {
  label:         string
  unit?:         string
  cities:        CityConfig[]
  getValue:      (c: CityConfig) => number | null
  maxOverride?:  number
  lowerIsBetter?: boolean
  noWinner?:     boolean
  barColor?:     (val: number, city: CityConfig) => string
  fmt?:          (val: number, city: CityConfig) => string
}

function MetricRows({
  label, unit, cities, getValue,
  maxOverride, lowerIsBetter, noWinner, barColor, fmt,
}: MetricRowsProps) {
  const rows = cities
    .map((city) => ({ city, val: getValue(city) }))
    .filter((r): r is { city: CityConfig; val: number } => r.val !== null)

  if (rows.length === 0) return null

  rows.sort((a, b) => lowerIsBetter ? a.val - b.val : b.val - a.val)

  const rawMax = Math.max(...rows.map((r) => r.val))
  const bestId = rows[0]?.city.id

  const pct = (val: number) => {
    if (lowerIsBetter) {
      // Invert: lowest value → longest bar ("cleanest air" = longest clean-air bar)
      return rawMax > 0 ? Math.max(4, (1 - val / rawMax) * 100) : 4
    }
    const m = maxOverride ?? rawMax
    return m > 0 ? (val / m) * 100 : 0
  }

  return (
    <div className="cmp-metric-group">
      <div className="cmp-metric-label">
        {label}
        {unit && <span className="cmp-unit"> · {unit}</span>}
      </div>
      {rows.map(({ city, val }) => {
        const isBest = !noWinner && city.id === bestId
        const fill   = barColor
          ? barColor(val, city)
          : isBest ? 'var(--amber)' : 'rgba(255,255,255,0.20)'
        return (
          <div key={city.id} className="cmp-bar-row">
            <span className="cmp-bar-city" style={{ color: isBest ? 'var(--amber)' : undefined }}>
              {city.hudClockLabel}
            </span>
            <div className="cmp-bar-track">
              <div className="cmp-bar-fill" style={{ width: `${pct(val)}%`, background: fill }} />
            </div>
            <span className="cmp-bar-val" style={{ color: isBest ? 'var(--amber)' : 'var(--dim)' }}>
              {fmt ? fmt(val, city) : val}
            </span>
            <span className="cmp-bar-star">{isBest && !noWinner ? '★' : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ComparisonPanel
// ─────────────────────────────────────────────────────────────────────────────
export function ComparisonPanel() {
  const customCities    = useCityStore((s) => s.customCities)
  const compareSet      = useCityStore((s) => s.compareSet)
  const clearCompareSet = useCityStore((s) => s.clearCompareSet)

  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])
  const cities    = useMemo(
    () => allCities.filter((c) => compareSet.includes(c.id)),
    [allCities, compareSet],
  )

  const [live, setLive]         = useState<Record<string, LiveSnapshot>>({})
  const [liveLoading, setLive2] = useState(false)

  const compareKey = compareSet.join(',')
  useEffect(() => {
    if (cities.length === 0) return
    let cancelled = false
    setLive2(true)

    const fetchAll = async () => {
      const results = await Promise.all(
        cities.map(async (city) => {
          const [lng, lat] = city.center
          const [aqi, weather, forecast] = await Promise.all([
            cachedFetch(`cmp/aqi/${city.id}`,     () => fetchAQI(lng, lat, city.timezone).catch(() => null),          POLL_MS),
            cachedFetch(`cmp/weather/${city.id}`,  () => fetchWeather(lng, lat, city.timezone).catch(() => null),      POLL_MS),
            cachedFetch(`cmp/forecast/${city.id}`, () => fetchAQIForecast(lng, lat, city.timezone).catch(() => null),  POLL_MS),
          ])
          return { id: city.id, snapshot: { aqi, weather, forecast } as LiveSnapshot }
        }),
      )
      if (cancelled) return
      const next: Record<string, LiveSnapshot> = {}
      for (const r of results) next[r.id] = r.snapshot
      setLive(next)
      setLive2(false)
    }

    fetchAll()
    const timer = setInterval(fetchAll, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [compareKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Empty state ──────────────────────────────────────────────────────────
  if (cities.length === 0) {
    return (
      <aside className="compare-panel compare-panel--empty">
        <div className="compare-empty">
          <div className="compare-empty-icon">◐</div>
          <div className="compare-empty-title">NO CITIES PINNED</div>
          <div className="compare-empty-hint">
            Click · on any city tab to pin it for comparison.
          </div>
        </div>
      </aside>
    )
  }

  // ── SLIC data (synchronous from bundled JSON) ────────────────────────────
  const slicScores = Object.fromEntries(cities.map((c) => [c.id, getCityScore(c.id)]))
  const breakdowns = Object.fromEntries(
    cities.map((c) => {
      const s = slicScores[c.id]
      return [c.id, s ? getPillarBreakdown(s) : []]
    }),
  )
  const anyHasSlic  = cities.some((c) => slicScores[c.id] !== null)
  const noSlicCities = cities.filter((c) => !slicScores[c.id])

  const pillarVal = (c: CityConfig, pillar: PillarId): number | null =>
    breakdowns[c.id]?.find((b) => b.pillar === pillar)?.value ?? null

  return (
    <aside className="compare-panel">
      <div className="compare-panel-header">
        <span className="compare-panel-title">CITY COMPARISON</span>
        <span className="compare-panel-count">
          {cities.length} {cities.length === 1 ? 'CITY' : 'CITIES'}
        </span>
        <button className="compare-panel-clear" onClick={clearCompareSet}>CLEAR ALL</button>
      </div>

      <div className="cmp-body">

        {/* ── SLIC Index ─────────────────────────────────────────────────── */}
        {anyHasSlic && (
          <section className="cmp-section">
            <div className="cmp-section-label">SLIC INDEX · {SLIC_VERSION}</div>

            {/* Global rank summary row */}
            <div className="cmp-rank-row">
              {cities.map((c) => {
                const s = slicScores[c.id] as CityScore | null
                if (!s) return null
                const { rank, total } = globalRank(s)
                return (
                  <div key={c.id} className="cmp-rank-chip">
                    <span className="cmp-rank-label">{c.hudClockLabel}</span>
                    <span className="cmp-rank-val">#{rank}</span>
                    <span className="cmp-rank-total">/{total}</span>
                  </div>
                )
              })}
            </div>

            {/* Overall AMPI score */}
            <MetricRows
              label="OVERALL AMPI SCORE"
              unit="/100"
              cities={cities}
              maxOverride={100}
              getValue={(c) => {
                const s = slicScores[c.id] as CityScore | null
                return s ? Math.round(s.slicScore) : null
              }}
            />

            {/* 5 pillars */}
            {PILLAR_ORDER.map((pillar) => (
              <MetricRows
                key={pillar}
                label={PILLAR_LABELS[pillar]}
                unit={`WT ${PILLAR_WEIGHTS[pillar]}%`}
                cities={cities}
                maxOverride={100}
                getValue={(c) => pillarVal(c, pillar)}
              />
            ))}

            {/* Cities without SLIC coverage */}
            {noSlicCities.length > 0 && (
              <div className="cmp-no-slic">
                {noSlicCities.map((c) => (
                  <span key={c.id} className="cmp-no-slic-city">
                    {c.hudClockLabel} · NO SLIC DATA
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Socio-Economics & Environment ─────────────────────────────── */}
        <section className="cmp-section">
          <div className="cmp-section-label">SOCIO-ECONOMICS & ENVIRONMENT</div>
          
          <MetricRows
            label="CITY GDP"
            unit="$B USD"
            cities={cities}
            getValue={(c) => c.demographics?.gdpBillionUsd ?? null}
            fmt={(v) => `$${v}B`}
            barColor={(_, c) => (c.id === 'singapore' ? 'var(--amber)' : 'var(--indigo)')}
          />
          
          <MetricRows
            label="GDP PER CAPITA"
            unit="$ USD"
            cities={cities}
            getValue={(c) => c.demographics?.gdpPerCapitaUsd ?? null}
            fmt={(v) => `$${v.toLocaleString()}`}
            barColor={() => 'var(--blue)'}
          />
          
          <MetricRows
            label="GREEN SPACE"
            unit="% of city area"
            cities={cities}
            getValue={(c) => c.demographics?.greenSpacePct ?? null}
            fmt={(v) => `${v}%`}
            barColor={() => 'var(--emerald)'}
          />
          
          <MetricRows
            label="LIFE EXPECTANCY"
            unit="years"
            cities={cities}
            getValue={(c) => c.demographics?.lifeExpectancyYears ?? null}
            fmt={(v) => `${v} yrs`}
            barColor={() => 'var(--cyan)'}
          />
          
          <MetricRows
            label="BIRTH RATE"
            unit="per 1k"
            cities={cities}
            noWinner
            getValue={(c) => c.demographics?.birthRatePer1k ?? null}
            fmt={(v) => `${v}`}
            barColor={() => 'var(--rose)'}
          />
        </section>

        {/* ── Live Today ─────────────────────────────────────────────────── */}
        <section className="cmp-section">
          <div className="cmp-section-label">
            LIVE TODAY
            {liveLoading && <span className="cmp-loading"> · FETCHING</span>}
          </div>

          <MetricRows
            label="PM2.5"
            unit="µg/m³ · lower = cleaner"
            cities={cities}
            lowerIsBetter
            getValue={(c) => live[c.id]?.aqi?.pm25 ?? null}
            barColor={(v) => RISK_COLOR[pm25ToRisk(v)]}
            fmt={(v) => v.toFixed(1)}
          />

          <MetricRows
            label="AIR QUALITY INDEX"
            unit="lower = cleaner"
            cities={cities}
            lowerIsBetter
            getValue={(c) => live[c.id]?.aqi?.usAqi ?? null}
            barColor={(v) => RISK_COLOR[aqiToRisk(v)]}
          />

          <MetricRows
            label="24H PEAK AQI"
            cities={cities}
            lowerIsBetter
            getValue={(c) => live[c.id]?.forecast?.peakAqi ?? null}
            barColor={(v) => RISK_COLOR[aqiToRisk(v)]}
            fmt={(v, city) => {
              const hour = live[city.id]?.forecast?.peakHour
              return hour ? `${v} @ ${hour}` : String(v)
            }}
          />

          <MetricRows
            label="TEMPERATURE"
            unit="°C"
            cities={cities}
            noWinner
            getValue={(c) => live[c.id]?.weather?.temp ?? null}
            fmt={(v) => `${v}°`}
          />
        </section>

      </div>
    </aside>
  )
}
