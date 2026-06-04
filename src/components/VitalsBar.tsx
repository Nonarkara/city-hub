/**
 * Vital status strip for the left rail. Two variants:
 *
 *  - Full (Bangkok): five vitals — AIR (GISTDA + Open-Meteo), FLOOD (GISTDA),
 *    HEAT (Open-Meteo), CIVIC (Traffy), DISEASE placeholder.
 *  - Lite (other cities): two vitals — AIR (Open-Meteo + WAQI) and
 *    HEAT (Open-Meteo). All other rows are skipped (no source available).
 */
import { useEffect, useState } from 'react'
import type { CityConfig } from '../config/cities'
import { bangkokPm25Live, centralFloods, type Pm25Live } from '../data/gistda'
import { bangkokWeather, fetchWeather, type CityWeather } from '../data/openmeteo'
import { bangkokAQI, fetchAQI, type CityAQI } from '../data/openmeteo-aq'
import { fetchTraffyStats, type TraffyStats } from '../data/traffy'
import { fetchThaiwaterLevels, type WaterLevelStation } from '../data/thaiwater'
import { fetchAir4ThaiBangkok } from '../data/air4thai'
import { FloodCascadePanel } from './FloodCascadePanel'
import { useFloodComplaintCorrelation } from '../hooks/useFloodComplaintCorrelation'
import { fetchAllASEAN, type CityAQI as ASEANCityAQI } from '../data/asean-aqi'
import { computeVitals, pm25ToRisk, RISK_COLOR, type RiskLevel } from '../lib/risk'
import { getSeasonalHazards } from '../lib/seasonal-context'

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

interface Props {
  activeCity: CityConfig
}

export function VitalsBar({ activeCity }: Props) {
  if (activeCity.tier === 'full') {
    return <BangkokVitals />
  }
  return <LiteVitals city={activeCity} />
}

function BangkokVitals() {
  const [pm25, setPm25]       = useState<Pm25Live | null>(null)
  const [weather, setWeather] = useState<CityWeather | null>(null)
  const [floodCount, setFloodCount] = useState(0)
  const [aqi, setAqi]         = useState<CityAQI | null>(null)
  const [traffy, setTraffy]   = useState<TraffyStats | null>(null)
  const [worstWater, setWorstWater]   = useState<WaterLevelStation | null>(null)
  const [pcdPm25, setPcdPm25]         = useState<{ avg: number; stations: number; worst: string } | null>(null)
  const [aseanRank, setAseanRank]     = useState<{ rank: number; total: number; best: string; worst: string } | null>(null)
  const seasonalHazards     = getSeasonalHazards('bangkok')
  const floodCorrelation    = useFloodComplaintCorrelation()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [p, w, f, a, t, wl, air4, asean] = await Promise.all([
        bangkokPm25Live().catch((): null => null),
        bangkokWeather().catch((): null => null),
        centralFloods().catch((): null => null),
        bangkokAQI().catch((): null => null),
        fetchTraffyStats().catch((): null => null),
        fetchThaiwaterLevels().catch((): WaterLevelStation[] => []),
        fetchAir4ThaiBangkok().catch((): null => null),
        fetchAllASEAN().catch((): ASEANCityAQI[] => []),
      ])
      if (cancelled) return
      if (p) setPm25(p)
      if (w) setWeather(w)
      if (f) setFloodCount(Array.isArray(f.features) ? f.features.length : 0)
      if (a) setAqi(a)
      if (t) setTraffy(t)

      // PCD Air4Thai — official Thai government station average
      if (air4 && air4.stations.length > 0) {
        const valid = air4.stations.filter((s) => s.pm25 > 0)
        if (valid.length > 0) {
          const avg = Math.round(valid.reduce((s, x) => s + x.pm25, 0) / valid.length)
          const worst = [...valid].sort((a, b) => b.pm25 - a.pm25)[0]
          setPcdPm25({ avg, stations: valid.length, worst: worst.areaEN || worst.nameTH })
        }
      }

      // ASEAN peer rank
      if (asean.length >= 2) {
        const sorted = [...asean].sort((a, b) => a.usAqi - b.usAqi)
        const bkkIdx = sorted.findIndex((c) => c.city.id === 'bangkok')
        if (bkkIdx >= 0) {
          setAseanRank({
            rank: bkkIdx + 1,
            total: sorted.length,
            best:  sorted[0].city.name,
            worst: sorted[sorted.length - 1].city.name,
          })
        }
      }
      // Worst water level station (highest % of bank level)
      if (wl.length > 0) {
        const sorted = [...wl].sort((a, b) => {
          const pctA = a.bankLevelM > 0 ? a.waterLevelM / a.bankLevelM : 0
          const pctB = b.bankLevelM > 0 ? b.waterLevelM / b.bankLevelM : 0
          return pctB - pctA
        })
        setWorstWater(sorted[0])
      }
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const vitals = computeVitals(pm25, weather, floodCount, aqi, traffy)
  const airTrend = computeAirTrend(pm25)

  const waterPct = worstWater && worstWater.bankLevelM > 0
    ? Math.round((worstWater.waterLevelM / worstWater.bankLevelM) * 100)
    : null
  const waterLevel: RiskLevel = waterPct !== null
    ? (waterPct >= 90 ? 'critical' : waterPct >= 75 ? 'high' : waterPct >= 55 ? 'moderate' : 'good')
    : 'good'

  const primaryHazard = seasonalHazards[0] ?? null

  return (
    <div className="vitals-bar">
      <div className="panel-zone" aria-hidden>
        <span className="panel-zone-dot" style={{ background: 'var(--cyan)' }} />
        DATA · VITALS
      </div>

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

      {/* PCD official PM2.5 — government authoritative source */}
      {pcdPm25 && (
        <div className="vital-row vital-row--pcd">
          <RiskDot level={pm25ToRisk(pcdPm25.avg)} />
          <div className="vital-main">
            <span className="vital-label">PCD OFFICIAL</span>
            <span className="vital-value" style={{ color: RISK_COLOR[pm25ToRisk(pcdPm25.avg)] }}>
              {pcdPm25.avg} µg/m³
              <span className="vital-unit"> PM2.5</span>
            </span>
          </div>
          <span className="vital-sub">{pcdPm25.stations} stations</span>
        </div>
      )}

      {/* ASEAN peer rank */}
      {aseanRank && (
        <div className="vital-row">
          <div className="vital-main vital-main--full">
            <span className="vital-label">ASEAN RANK</span>
            <span className="vital-value">
              #{aseanRank.rank}
              <span className="vital-unit"> of {aseanRank.total} capitals</span>
            </span>
          </div>
          <span className="vital-sub">{aseanRank.rank === 1 ? '★ CLEANEST' : `best: ${aseanRank.best}`}</span>
        </div>
      )}

      {/* Canal / water level vital */}
      {worstWater && waterPct !== null && (
        <div className="vital-row">
          <RiskDot level={waterLevel} />
          <div className="vital-main">
            <span className="vital-label">WATER LEVEL</span>
            <span className="vital-value" style={{ color: RISK_COLOR[waterLevel] }}>
              {worstWater.waterLevelM.toFixed(2)}m
              <span className="vital-unit"> / {worstWater.bankLevelM.toFixed(2)}m bank</span>
            </span>
          </div>
          <span className="vital-sub">{worstWater.name} · {waterPct}%</span>
        </div>
      )}

      {/* GloFAS flood cascade — compact chip, only when risk > low */}
      <FloodCascadePanel compact />

      {/* Traffy × canal level correlation — shows when elevated */}
      {floodCorrelation?.isElevated && (
        <div className={`vital-seasonal vital-seasonal--active`}>
          <span className="vital-seasonal-label">FLOOD COMPLAINT FORECAST</span>
          <span className="vital-seasonal-detail">{floodCorrelation.insight}</span>
        </div>
      )}

      {/* Seasonal hazard context */}
      {primaryHazard && primaryHazard.urgency !== 'clear' && (
        <div className={`vital-seasonal vital-seasonal--${primaryHazard.urgency}`}>
          <span className="vital-seasonal-label">{primaryHazard.label}</span>
          <span className="vital-seasonal-detail">{primaryHazard.detail.slice(0, 80)}…</span>
        </div>
      )}
    </div>
  )
}

function LiteVitals({ city }: { city: CityConfig }) {
  const [aqi, setAqi] = useState<CityAQI | null>(null)
  const [weather, setWeather] = useState<CityWeather | null>(null)
  const [lng, lat] = city.center

  useEffect(() => {
    let cancelled = false
    setAqi(null)
    setWeather(null)
    const load = async () => {
      const [a, w] = await Promise.all([
        fetchAQI(lng, lat, city.timezone).catch((): null => null),
        fetchWeather(lng, lat, city.timezone).catch((): null => null),
      ])
      if (cancelled) return
      if (a) setAqi(a)
      if (w) setWeather(w)
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [lng, lat, city.timezone])

  // Map AQI's PM2.5 reading to a risk level using the canonical helper.
  const airLevel: RiskLevel = aqi ? pm25ToRisk(aqi.pm25) : 'good'
  const heatLevel: RiskLevel = weather
    ? weather.feelsLike >= 41 ? 'high'
      : weather.feelsLike >= 37 ? 'moderate'
      : 'good'
    : 'good'

  return (
    <div className="vitals-bar">
      <div className="vital-row">
        <RiskDot level={airLevel} />
        <div className="vital-main">
          <span className="vital-label">AIR</span>
          <span className="vital-value" style={{ color: RISK_COLOR[airLevel] }}>
            {aqi ? aqi.pm25.toFixed(0) : '—'}
            {aqi && <span className="vital-unit"> µg/m³</span>}
          </span>
        </div>
        {aqi && <span className="vital-sub">AQI {aqi.usAqi}</span>}
      </div>

      <div className="vital-row">
        <RiskDot level={heatLevel} />
        <div className="vital-main">
          <span className="vital-label">HEAT</span>
          <span className="vital-value" style={{ color: RISK_COLOR[heatLevel] }}>
            {weather ? weather.feelsLike : '—'}
            {weather && <span className="vital-unit"> °C feels</span>}
          </span>
        </div>
        {weather && <span className="vital-sub">{weather.windCardinal} {weather.windSpeed}km/h</span>}
      </div>
    </div>
  )
}
