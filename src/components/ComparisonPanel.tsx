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
import { pm25ToRisk, aqiToRisk, RISK_COLOR, type RiskLevel } from '../lib/risk'
import { fetchAQIHistory, type AQIHistory } from '../lib/historical-aqi'
import { fetchCityNews } from '../data/gdelt'
import { CITY_NIGHT_LIGHTS, adjustedBrightness } from '../lib/night-lights-index'

const POLL_MS   = 5 * 60_000
const HIST_TTL  = 60 * 60_000
const NEWS_TTL  = 15 * 60_000

/** WHO PM2.5 daily guideline: 15 µg/m³ (2021 revision) */
const WHO_PM25 = 15

interface LiveSnapshot {
  aqi:      CityAQI     | null
  weather:  CityWeather | null
  forecast: AQIForecast | null
}

interface HistSnapshot {
  history:     AQIHistory | null
  whoViolDays: number      | null  // days in past 7 above WHO guideline
  weekVsPrev:  number      | null  // % change vs previous week
}

interface NewsSnapshot {
  articles:    number | null
  avgTone:     number | null
  sentimentPct: number | null  // 0–100 positivity score
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
// AQI sparkline — 24h path compressed to 56×20px
// ─────────────────────────────────────────────────────────────────────────────
function AqiSparkline({ hours, color }: { hours: { usAqi: number }[]; color: string }) {
  if (hours.length < 2) return null
  const vals  = hours.map((h) => h.usAqi)
  const lo    = Math.min(...vals)
  const hi    = Math.max(...vals) || 1
  const W = 56, H = 18
  const x = (i: number) => (i / (vals.length - 1)) * W
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H
  const d = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
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

  const [live, setLive]           = useState<Record<string, LiveSnapshot>>({})
  const [liveLoading, setLive2]   = useState(false)
  const [hist, setHist]           = useState<Record<string, HistSnapshot>>({})
  const [news, setNews]           = useState<Record<string, NewsSnapshot>>({})

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

    // Historical AQI + WHO compliance — slower, cached 1h
    Promise.allSettled(
      cities.map(async (city) => {
        const [lng, lat] = city.center
        const h = await cachedFetch(
          `cmp/hist/${city.id}`,
          () => fetchAQIHistory(lat, lng, city.timezone),
          HIST_TTL,
        ).catch(() => null)
        if (!h || cancelled) return
        // WHO violation days: hours above 15 µg/m³, grouped by day
        const days = Math.min(7, Math.floor(h.hours.length / 24))
        let violDays = 0
        for (let d = 0; d < days; d++) {
          const dayHours = h.hours.slice(d * 24, (d + 1) * 24)
          const dayAvg = dayHours.reduce((s, v) => s + v, 0) / dayHours.length
          if (dayAvg > WHO_PM25) violDays++
        }
        // Week-vs-prior-week comparison
        const thisWeek = h.hours.slice(-168).reduce((s, v) => s + v, 0) / Math.min(168, h.hours.length)
        const prevWeek = h.hours.slice(-336, -168)
        const prevAvg  = prevWeek.length > 0 ? prevWeek.reduce((s, v) => s + v, 0) / prevWeek.length : thisWeek
        const weekVsPrev = prevAvg > 0 ? Math.round(((thisWeek - prevAvg) / prevAvg) * 100) : 0
        setHist((prev) => ({ ...prev, [city.id]: { history: h, whoViolDays: violDays, weekVsPrev } }))
      })
    )

    // GDELT news intensity + sentiment — per city
    Promise.allSettled(
      cities.map(async (city) => {
        const n = await cachedFetch(
          `cmp/news/${city.id}`,
          () => fetchCityNews(city.gdeltQuery, 12),
          NEWS_TTL,
        ).catch(() => null)
        if (!n || cancelled) return
        const count = n.articles.length
        const tone  = n.avgTone
        // Sentiment: remap GDELT tone (typically -20..+20) to 0-100
        const sentimentPct = Math.round(Math.min(100, Math.max(0, 50 + tone * 2.5)))
        setNews((prev) => ({ ...prev, [city.id]: { articles: count, avgTone: tone, sentimentPct } }))
      })
    )

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
        <button className="compare-panel-clear" onClick={clearCompareSet} title="Clear all cities from comparison" aria-label="Clear all cities from comparison">CLEAR ALL</button>
      </div>

      <div className="cmp-body">

        {/* ── Cross-city risk summary ─────────────────────────────────────── */}
        {!liveLoading && Object.keys(live).length > 0 && (
          <div className="cmp-risk-summary">
            {cities.map((city) => {
              const snap = live[city.id]
              const pm25 = snap?.aqi?.pm25 ?? null
              const aqi  = snap?.aqi?.usAqi ?? null
              const risk: RiskLevel | null = pm25 !== null ? pm25ToRisk(pm25) : aqi !== null ? aqiToRisk(aqi) : null
              if (!risk) return null
              return (
                <span key={city.id} className={`cmp-risk-chip cmp-risk-chip--${risk}`}>
                  <span className="cmp-risk-dot" style={{ background: RISK_COLOR[risk] }} />
                  {city.hudClockLabel} · {risk.toUpperCase()}
                </span>
              )
            })}
          </div>
        )}

        {/* ── Live city header cards ──────────────────────────────────────── */}
        <div className="cmp-city-cards">
          {cities.map((city) => {
            const snap    = live[city.id]
            const aqi     = snap?.aqi?.usAqi ?? null
            const pm25    = snap?.aqi?.pm25  ?? null
            const temp    = snap?.weather?.temp ?? null
            const wind    = snap?.weather?.windSpeed ?? null
            const wDir    = snap?.weather?.windCardinal ?? null
            const risk    = pm25 !== null ? pm25ToRisk(pm25) : aqi !== null ? aqiToRisk(aqi) : null
            const riskCol = risk ? RISK_COLOR[risk] : 'var(--dim)'
            const densityPct = city.area_km2 > 0
              ? Math.round(city.populationMillions * 1_000_000 / city.area_km2)
              : null
            return (
              <div key={city.id} className="cmp-city-card">
                <div className="cmp-city-card-code">{city.hudClockLabel}</div>
                <div className="cmp-city-card-name">{city.name}</div>
                <div className="cmp-city-card-divider" />
                <div className="cmp-city-card-row">
                  <span className="cmp-city-card-label">AQI</span>
                  <span className="cmp-city-card-val" style={{ color: riskCol }}>
                    {aqi !== null ? aqi : liveLoading ? '…' : '—'}
                  </span>
                </div>
                <div className="cmp-city-card-row">
                  <span className="cmp-city-card-label">TEMP</span>
                  <span className="cmp-city-card-val">{temp !== null ? `${temp}°` : liveLoading ? '…' : '—'}</span>
                </div>
                <div className="cmp-city-card-row">
                  <span className="cmp-city-card-label">WIND</span>
                  <span className="cmp-city-card-val">
                    {wind !== null ? `${wind} km/h ${wDir ?? ''}` : liveLoading ? '…' : '—'}
                  </span>
                </div>
                <div className="cmp-city-card-row">
                  <span className="cmp-city-card-label">POP</span>
                  <span className="cmp-city-card-val">
                    {city.populationMillions >= 1
                      ? `${city.populationMillions.toFixed(1)}M`
                      : `${Math.round(city.populationMillions * 1000)}K`}
                  </span>
                </div>
                {densityPct !== null && (
                  <div className="cmp-city-card-row">
                    <span className="cmp-city-card-label">DENS</span>
                    <span className="cmp-city-card-val">{densityPct.toLocaleString()}/km²</span>
                  </div>
                )}
                {snap?.forecast?.hours && snap.forecast.hours.length > 1 && (
                  <div className="cmp-city-card-sparkline">
                    <AqiSparkline hours={snap.forecast.hours} color={riskCol} />
                    <span className="cmp-city-card-spark-label">24H AQI</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

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

        {/* ── City Scale ─────────────────────────────────────────────────── */}
        <section className="cmp-section">
          <div className="cmp-section-label">CITY SCALE</div>
          <MetricRows
            label="POPULATION"
            unit="millions"
            cities={cities}
            getValue={(c) => c.populationMillions}
            fmt={(v) => v >= 1 ? `${v.toFixed(1)}M` : `${Math.round(v * 1000)}K`}
          />
          <MetricRows
            label="CITY AREA"
            unit="km²"
            cities={cities}
            getValue={(c) => c.area_km2}
            fmt={(v) => `${v.toLocaleString()} km²`}
          />
          <MetricRows
            label="POPULATION DENSITY"
            unit="people/km²"
            cities={cities}
            getValue={(c) => c.area_km2 > 0 ? Math.round(c.populationMillions * 1_000_000 / c.area_km2) : null}
            fmt={(v) => `${v.toLocaleString()}/km²`}
          />
        </section>

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

          <MetricRows
            label="FEELS LIKE"
            unit="°C"
            cities={cities}
            noWinner
            getValue={(c) => live[c.id]?.weather?.feelsLike ?? null}
            fmt={(v) => `${v}°`}
          />

          <MetricRows
            label="WIND SPEED"
            unit="km/h"
            cities={cities}
            noWinner
            getValue={(c) => live[c.id]?.weather?.windSpeed ?? null}
            fmt={(v, city) => {
              const dir = live[city.id]?.weather?.windCardinal
              return dir ? `${v} ${dir}` : `${v}`
            }}
          />
        </section>

        {/* ── Night Lights Economic Index ────────────────────────────────── */}
        <section className="cmp-section">
          <div className="cmp-section-label">
            NIGHT LIGHTS INDEX
            <span className="cmp-section-sub"> · NASA VIIRS 2022–24 · ESTIMATE</span>
          </div>
          <MetricRows
            label="URBAN BRIGHTNESS"
            unit="relative index · 100 = brightest"
            cities={cities}
            maxOverride={100}
            getValue={(c) => CITY_NIGHT_LIGHTS[c.id]?.baseIndex ?? null}
            barColor={(v) => v >= 80 ? 'var(--amber)' : v >= 55 ? 'var(--cyan)' : 'var(--dim)'}
            fmt={(v) => `${v}/100`}
          />
          <MetricRows
            label="POLICY-ADJUSTED BRIGHTNESS"
            unit="corrected for dark-sky regulations"
            cities={cities}
            maxOverride={100}
            getValue={(c) => CITY_NIGHT_LIGHTS[c.id] ? adjustedBrightness(c.id) : null}
            barColor={(v) => v >= 80 ? 'var(--amber)' : 'var(--cyan)'}
            fmt={(v, c) => {
              const trend = CITY_NIGHT_LIGHTS[c.id]?.trend
              const arrow = trend === 'growing' ? ' ↑' : trend === 'declining' ? ' ↓' : ''
              return `${v}/100${arrow}`
            }}
          />
          {/* GDP per km² — economic density */}
          <MetricRows
            label="ECONOMIC DENSITY"
            unit="$M GDP per km²"
            cities={cities}
            getValue={(c) => {
              const gdp  = c.demographics?.gdpBillionUsd
              const area = c.area_km2
              if (!gdp || !area) return null
              return Math.round((gdp * 1000) / area)  // $M per km²
            }}
            fmt={(v) => `$${v}M/km²`}
          />
        </section>

        {/* ── Air Quality Intelligence ────────────────────────────────────── */}
        {Object.keys(hist).length > 0 && (
          <section className="cmp-section">
            <div className="cmp-section-label">
              AIR QUALITY INTELLIGENCE
              <span className="cmp-section-sub"> · WHO guideline: {WHO_PM25} µg/m³</span>
            </div>

            {/* 7-day average vs WHO */}
            <MetricRows
              label="7-DAY AVG PM2.5"
              unit="µg/m³ · WHO = 15"
              cities={cities}
              lowerIsBetter
              getValue={(c) => hist[c.id]?.history?.weekAvg ?? null}
              barColor={(v) => v <= WHO_PM25 ? 'var(--emerald)' : v <= 35 ? 'var(--amber)' : '#ef4444'}
              fmt={(v) => `${v} µg/m³`}
            />

            {/* WHO violation days */}
            <MetricRows
              label="WHO VIOLATIONS"
              unit="days above 15 µg/m³ (7d)"
              cities={cities}
              lowerIsBetter
              maxOverride={7}
              getValue={(c) => hist[c.id]?.whoViolDays ?? null}
              barColor={(v) => v === 0 ? 'var(--emerald)' : v <= 2 ? 'var(--amber)' : '#ef4444'}
              fmt={(v) => v === 0 ? '0 days ✓' : `${v} / 7 days`}
            />

            {/* Week trend */}
            <MetricRows
              label="WEEK-ON-WEEK TREND"
              unit="% vs previous 7 days"
              cities={cities}
              lowerIsBetter
              maxOverride={100}
              noWinner
              getValue={(c) => {
                const pct = hist[c.id]?.weekVsPrev
                return pct !== null && pct !== undefined ? Math.abs(pct) : null
              }}
              barColor={(_, c) => {
                const pct = hist[c.id]?.weekVsPrev ?? 0
                return pct > 10 ? '#ef4444' : pct < -10 ? 'var(--emerald)' : 'var(--amber)'
              }}
              fmt={(_, c) => {
                const pct = hist[c.id]?.weekVsPrev ?? 0
                return pct > 0 ? `+${pct}% worse` : pct < 0 ? `${pct}% better` : '→ stable'
              }}
            />

            {/* Productivity cost — WHO/World Bank formula:
                26.6 lost working hours/person/year per 1 µg/m³ above guideline
                × local daily wage ÷ 365 days = daily cost per person
                Source: PMC8657613 (China panel), WHO Global Health Cost 2016 */}
            <MetricRows
              label="EST. PRODUCTIVITY COST"
              unit="$M/day · WHO formula"
              cities={cities}
              lowerIsBetter
              getValue={(c) => {
                const pm25 = live[c.id]?.aqi?.pm25 ?? hist[c.id]?.history?.yesterday
                const pop  = c.populationMillions
                if (!pm25 || !pop || pm25 <= WHO_PM25) return 0
                const excess = pm25 - WHO_PM25
                // Daily wage proxy from GDP per capita: $gdpPerCapita / 250 working days
                const wage = (c.demographics?.gdpPerCapitaUsd ?? 10_000) / 250
                // 26.6 hrs/year/µg/m³ × (wage/$perHr) / 365 days × population
                const hoursPerDay = (26.6 * excess) / 365
                const costPerPerson = hoursPerDay * (wage / 8)  // 8-hour workday
                return Math.round(costPerPerson * pop * 1_000_000 / 1_000_000)  // in $M
              }}
              barColor={(v) => v === 0 ? 'var(--emerald)' : v < 3 ? 'var(--amber)' : '#ef4444'}
              fmt={(v) => v === 0 ? 'clean air' : `$${v}M/day`}
            />
          </section>
        )}

        {/* ── News Intelligence ───────────────────────────────────────────── */}
        {Object.keys(news).length > 0 && (
          <section className="cmp-section">
            <div className="cmp-section-label">
              NEWS INTELLIGENCE
              <span className="cmp-section-sub"> · GDELT · 15 min refresh</span>
            </div>

            {/* News volume */}
            <MetricRows
              label="NEWS COVERAGE"
              unit="recent articles"
              cities={cities}
              noWinner
              getValue={(c) => news[c.id]?.articles ?? null}
              barColor={() => 'var(--cyan)'}
              fmt={(v) => `${v} articles`}
            />

            {/* Sentiment score */}
            <MetricRows
              label="SENTIMENT SCORE"
              unit="0=negative · 100=positive"
              cities={cities}
              maxOverride={100}
              getValue={(c) => news[c.id]?.sentimentPct ?? null}
              barColor={(v) => v >= 55 ? 'var(--emerald)' : v >= 45 ? 'var(--amber)' : '#ef4444'}
              fmt={(v, c) => {
                const tone = news[c.id]?.avgTone?.toFixed(1) ?? '—'
                return `${v}/100 (${Number(tone) > 0 ? '+' : ''}${tone})`
              }}
            />

            {/* Civic stress proxy: high volume × negative sentiment */}
            <MetricRows
              label="MEDIA STRESS INDEX"
              unit="volume × negativity"
              cities={cities}
              lowerIsBetter
              getValue={(c) => {
                const n = news[c.id]
                if (!n?.articles || n.sentimentPct === null) return null
                const neg = 100 - (n.sentimentPct ?? 50)
                return Math.round((n.articles * neg) / 100)
              }}
              barColor={(v) => v < 5 ? 'var(--emerald)' : v < 15 ? 'var(--amber)' : '#ef4444'}
              fmt={(v) => `${v} pts`}
            />
          </section>
        )}

      </div>
    </aside>
  )
}
