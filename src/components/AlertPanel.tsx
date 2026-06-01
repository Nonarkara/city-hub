/**
 * Governor's situation panel — the Bangkok Operating System command surface.
 *
 * SIT ROOM mode now shows:
 *   1. Morning Brief — auto-generated city narrative + recommended actions
 *   2. Anomaly Badges — automatic detection of unusual patterns
 *   3. Cross-Source Gaps — when citizen reports contradict official data
 *   4. Live Alerts — computed from sensors + weather + floods
 *   5. Narrative Layer — GDELT news + Reality Check
 */
import { useCallback, useEffect, useState } from 'react'
import { bangkokPm25Live, centralFloods, bangkokPm25Rank, type Pm25Live, type Pm25ProvinceRank } from '../data/gistda'
import { bangkokWeather, type BangkokWeather } from '../data/openmeteo'
import { bangkokAQI, type BangkokAQI } from '../data/openmeteo-aq'
import { bangkokAQIForecast, type AQIForecast } from '../data/openmeteo-forecast'
import { bangkokTMDForecast, type TMDForecast } from '../data/tmd'
import { fetchTraffyFloods, fetchTraffyGeoJSON, type TraffyTicket, type TraffyStats } from '../data/traffy'
import { fetchBangkokNews, type GdeltNewsResult } from '../data/gdelt'
import {
  generateMorningBrief,
  detectAnomalies,
  type MorningBrief,
  type Anomaly,
} from '../lib/intelligence'
import { computeAlerts, RISK_COLOR, type CityAlert, type RiskLevel } from '../lib/risk'
import { forecastSeries, type ForecastResult } from '../lib/forecast'
import { narrate, type NarrateResult } from '../lib/narrate'
import { computeCorrelations, type CorrelationInsight } from '../lib/correlations'
import { fetchBangkokTrafficFlow } from '../data/tomtom-traffic'
import { fetchThaiwaterLevels } from '../data/thaiwater'
import { fetchAirbnbBangkok } from '../data/airbnb'
import { fetchTmdEarthquakes } from '../data/tmd-earthquake'
import { SLICPanel } from './SLICPanel'
import { PatternsSection } from './PatternsSection'
import { OpenDataInventory } from './OpenDataInventory'
import { PrepareCard } from './PrepareCard'
import { InsightCardsGrid } from './InsightCardsGrid'
import { RealityCheckEngine } from './RealityCheckEngine'
import { useDistrictData } from '../hooks/useDistrictData'
import { CITIES } from '../config/cities'

// Bangkok city config — for SLIC lookup
const BANGKOK_CITY = CITIES.find((c) => c.id === 'bangkok')!

// ── Sub-components ────────────────────────────────────────────────────────────

function levelLabel(level: RiskLevel): string {
  if (level === 'critical') return 'CRITICAL'
  if (level === 'high')     return 'HIGH'
  if (level === 'moderate') return 'ADVISORY'
  return 'NORMAL'
}

function BriefSection({ brief, onAction }: { brief: MorningBrief; onAction: (draft: string) => void }) {
  const [aiParagraphs, setAiParagraphs] = useState<string[] | null>(null)
  const [aiSource, setAiSource] = useState<'gemini-2.5' | 'template'>('template')

  // Try Gemini narration once when the brief data settles. Falls back to
  // template silently when key absent.
  useEffect(() => {
    let cancelled = false
    const ctx = {
      status: brief.status,
      facts: brief.paragraphs.join(' '),
      anomalies: brief.gaps.map((g) => g.headline),
      actions: brief.actions.slice(0, 3).map((a) => a.label),
    }
    narrate(
      'Write a 2-paragraph governor situational brief for Bangkok using these live facts. ' +
      'Lead with the most pressing concern. Cite specific numbers. End with the highest-priority action.',
      ctx,
      { style: 'paragraph', maxWords: 120 },
    ).then((r) => {
      if (cancelled) return
      if (r.model === 'gemini-2.5' && r.narration && r.narration.length > 40) {
        // Split into paragraphs on double-newline (or single, fallback)
        const paras = r.narration.split(/\n\n+/).filter((p) => p.trim().length > 0)
        setAiParagraphs(paras.length > 0 ? paras : [r.narration])
        setAiSource('gemini-2.5')
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [brief.status, brief.paragraphs.length])  // re-narrate when situation shifts

  const paragraphs = aiParagraphs ?? brief.paragraphs

  // Mundane opening — the time and place, plainly stated. No "MORNING BRIEF" chip.
  const now = new Date()
  const dateLine = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const timeLine = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  return (
    <div className="brief-section">
      <div className="brief-open">
        <div className="brief-open-date">{dateLine.toLowerCase()}</div>
        <div className="brief-open-time">
          <span style={{ color: brief.statusColor }}>●</span>
          <span>{timeLine} · ICT</span>
          {aiSource === 'gemini-2.5' && (
            <span className="brief-ai-tag" title="Narrated by Gemini 2.5">ai</span>
          )}
        </div>
      </div>

      <div className="brief-body">
        {paragraphs.map((p, i) => (
          <p key={i} className="brief-paragraph">{p}</p>
        ))}
      </div>

      {brief.gaps.length > 0 && (
        <>
          <div className="brief-sep">—</div>
          <div className="brief-gaps">
            <div className="brief-aside">the data has gaps</div>
            {brief.gaps.map((g, i) => (
              <div key={i} className={`brief-gap brief-gap--${g.severity}`}>
                <span className="brief-gap-bullet">·</span>
                <span className="brief-gap-headline">{g.headline}</span>
                <span className="brief-gap-detail">{g.detail}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {brief.exposure && (
        <>
          <div className="brief-sep">—</div>
          <div className="brief-exposure">
            <span className="brief-aside">population at risk</span>
            <span className="brief-exposure-val">{brief.exposure}</span>
          </div>
        </>
      )}

      {brief.benchmarks && brief.benchmarks.length > 0 && (
        <>
          <div className="brief-sep">—</div>
          <div className="brief-benchmarks">
            <div className="brief-aside">benchmarks</div>
            {brief.benchmarks.map((b, i) => (
              <div key={i} className="brief-benchmark">
                <span className="brief-benchmark-label">{b.label}</span>
                <span className="brief-benchmark-val">{b.value}</span>
                <span className="brief-benchmark-comp">{b.comparison}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {brief.actions.length > 0 && (
        <>
          <div className="brief-sep">—</div>
          <div className="brief-actions">
            <div className="brief-aside">hands that can move</div>
            {brief.actions.slice(0, 3).map((a, i) => (
              <div key={i} className="brief-action">
                <span className="brief-action-num">{i + 1}</span>
                <div className="brief-action-body">
                  <span className="brief-action-label">{a.label}</span>
                  <span className="brief-action-detail">{a.detail}</span>
                </div>
                {a.draft && (
                  <button className="brief-action-btn" onClick={() => onAction(a.draft!)}>
                    copy
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AnomalyBar({ anomalies }: { anomalies: Anomaly[] }) {
  if (anomalies.length === 0) return null
  return (
    <div className="anomaly-bar">
      <span className="anomaly-label">ANOMALIES</span>
      <div className="anomaly-list">
        {anomalies.map((a) => (
          <span key={a.id} className={`anomaly-chip anomaly-chip--${a.severity}`}>
            {a.metric}: {a.message}
          </span>
        ))}
      </div>
    </div>
  )
}

function AlertCard({ alert, onAction }: { alert: CityAlert; onAction: (a: CityAlert) => void }) {
  const hasAction = alert.action !== 'NO ACTION REQUIRED' && alert.action !== 'MONITOR'
  const [explain, setExplain] = useState<NarrateResult | null>(null)
  const [loading, setLoading] = useState(false)

  const askWhy = useCallback(async () => {
    if (explain || loading) return
    setLoading(true)
    const r = await narrate(
      `Why is this alert active? What does it mean for Bangkok right now?`,
      {
        level: alert.level,
        headline: alert.headline,
        detail: alert.detail,
        recommendedAction: alert.action,
        time: new Date().toISOString(),
      },
      { style: 'brief', maxWords: 50 },
    )
    setExplain(r)
    setLoading(false)
  }, [alert, explain, loading])

  return (
    <div className="alert-card" data-level={alert.level}>
      <div className="alert-card-header">
        <span
          className="alert-level-chip"
          style={{ color: RISK_COLOR[alert.level], borderColor: RISK_COLOR[alert.level] }}
        >
          {levelLabel(alert.level)}
        </span>
        <button
          className="alert-why-btn"
          onClick={askWhy}
          disabled={loading}
          title="Ask Gemini why this is happening"
        >
          {loading ? '…' : explain ? '✓ AI' : 'WHY?'}
        </button>
      </div>
      <div className="alert-headline">{alert.headline}</div>
      <p className="alert-detail">{alert.detail}</p>
      {explain && (
        <div className={`alert-explain ${explain.model === 'gemini-2.5' ? 'ai' : ''}`}>
          <span className="alert-explain-tag">
            {explain.model === 'gemini-2.5' ? 'GEMINI 2.5' : 'TEMPLATE'}
          </span>
          {explain.narration}
        </div>
      )}
      {hasAction ? (
        <button className="alert-action-btn" onClick={() => onAction(alert)}>
          {alert.action} →
        </button>
      ) : alert.action === 'MONITOR' ? (
        <span className="alert-action-monitor">● MONITORING</span>
      ) : null}
    </div>
  )
}

export function DraftModal({ draft, onClose }: { draft: string; onClose: () => void }) {
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(draft) } catch { /* silent */ }
    onClose()
  }, [draft, onClose])

  return (
    <div className="draft-overlay" onClick={onClose}>
      <div className="draft-modal" onClick={(e) => e.stopPropagation()}>
        <div className="draft-header">
          <span className="draft-label">DRAFT MESSAGE · READY TO SEND</span>
          <button className="draft-close" onClick={onClose}>✕</button>
        </div>
        <div className="draft-body">{draft}</div>
        <div className="draft-footer">
          <button className="draft-copy-btn" onClick={copy}>
            COPY TO CLIPBOARD
          </button>
        </div>
      </div>
    </div>
  )
}



function RankSection({ rank }: { rank: Pm25ProvinceRank | null }) {
  if (!rank || rank.rank > 20) return null
  const color = rank.rank <= 5 ? '#e53935' : rank.rank <= 10 ? '#fb8c00' : '#fdd835'
  const label = rank.rank <= 5 ? 'AMONG WORST NATIONALLY' : rank.rank <= 10 ? 'TOP 10 NATIONALLY' : 'ABOVE NATIONAL AVERAGE'
  return (
    <div className="rank-section">
      <div className="rank-header">PM2.5 PROVINCIAL RANK</div>
      <div className="rank-row">
        <span className="rank-num" style={{ color }}>#{rank.rank}</span>
        <span className="rank-of">/ {rank.total} PROVINCES</span>
      </div>
      <div className="rank-label" style={{ color }}>{label}</div>
    </div>
  )
}

/**
 * TimeFM forecast block — renders history + 24h forecast with confidence band.
 * Calls /forecast/timefm via Worker; falls back to Holt-Winters with honest
 * model labelling. The architecture is identical regardless of which model
 * answered.
 */
function TimeFMSection({ history }: { history: number[] }) {
  const [result, setResult] = useState<ForecastResult | null>(null)

  useEffect(() => {
    if (history.length < 12) return
    let cancelled = false
    forecastSeries(history, 24, 24)
      .then((r) => { if (!cancelled) setResult(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [history])

  if (history.length < 12 || !result) return null

  const W = 280, H = 70
  const all = [...history, ...result.forecast, ...(result.upper ?? []), ...(result.lower ?? [])]
  const minV = Math.min(...all)
  const maxV = Math.max(...all)
  const range = Math.max(1, maxV - minV)
  const padTop = 4, padBot = 4
  const usableH = H - padTop - padBot
  const totalN = history.length + result.forecast.length
  const x = (i: number) => (i / Math.max(1, totalN - 1)) * W
  const y = (v: number) => padTop + (1 - (v - minV) / range) * usableH

  const histPts = history.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const fcPts = result.forecast.map((v, i) =>
    `${x(history.length + i).toFixed(1)},${y(v).toFixed(1)}`,
  ).join(' ')

  // Confidence band as a polygon (upper forward, lower backward)
  let bandPath = ''
  if (result.upper && result.lower) {
    const upperPts = result.upper.map((v, i) =>
      `${x(history.length + i).toFixed(1)},${y(v).toFixed(1)}`,
    )
    const lowerPts = result.lower.map((v, i) =>
      `${x(history.length + i).toFixed(1)},${y(v).toFixed(1)}`,
    ).reverse()
    bandPath = [...upperPts, ...lowerPts].join(' ')
  }

  const splitX = x(history.length - 0.5)
  const peakIdx = result.forecast.indexOf(Math.max(...result.forecast))
  const peakV = result.forecast[peakIdx]
  const peakLevel: RiskLevel =
    peakV >= 91 ? 'critical' : peakV >= 51 ? 'high' : peakV >= 26 ? 'moderate' : 'good'
  const modelTag =
    result.model === 'gemini-2.5'  ? 'GEMINI 2.5' :
    result.model === 'timefm-2.0' ? 'TIMEFM 2.0' :
                                     'HOLT-WINTERS'

  return (
    <div className="timefm-section">
      <div className="timefm-header">
        <span className="timefm-label">PM2.5 · NEXT 24H</span>
        <span className="timefm-model">{modelTag}</span>
      </div>
      <svg className="timefm-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {bandPath && (
          <polygon points={bandPath} fill="rgba(245,158,11,0.10)" stroke="none" />
        )}
        {/* Vertical NOW separator */}
        <line x1={splitX} y1="0" x2={splitX} y2={H} stroke="#444" strokeWidth="1" strokeDasharray="2,3" />
        {/* History (solid) */}
        <polyline points={histPts} fill="none" stroke="rgba(245,245,240,0.55)" strokeWidth="1.2" />
        {/* Forecast (amber dashed) */}
        <polyline points={fcPts} fill="none" stroke="#f59e0b" strokeWidth="1.4" strokeDasharray="3,2" />
        {/* Peak marker */}
        <circle
          cx={x(history.length + peakIdx).toFixed(1)}
          cy={y(peakV).toFixed(1)}
          r="2.5"
          fill={RISK_COLOR[peakLevel]}
        />
      </svg>
      <div className="timefm-axis">
        <span>−24H</span>
        <span>NOW</span>
        <span>+24H</span>
      </div>
      <div className="timefm-footer">
        <span style={{ color: RISK_COLOR[peakLevel] }}>
          PEAK FORECAST {peakV.toFixed(0)} μg/m³ · +{peakIdx + 1}H
        </span>
      </div>
      {result.reasoning && (
        <div className="timefm-reasoning">{result.reasoning}</div>
      )}
    </div>
  )
}

/**
 * TMD 7-day forecast — Thai Meteorological Department, official Thai gov.
 * Distinct from Open-Meteo (global model) — shows the local-authoritative
 * forecast that citizens trust. Compact row of 5 day-cards.
 */
function TMDSection({ tmd }: { tmd: TMDForecast | null }) {
  if (!tmd || tmd.days.length === 0) return null
  const days = tmd.days.slice(0, 5)
  return (
    <div className="tmd-section">
      <div className="tmd-header">
        <span className="tmd-label">TMD · OFFICIAL FORECAST</span>
        <span className="tmd-source">กรมอุตุนิยมวิทยา</span>
      </div>
      <div className="tmd-days">
        {days.map((d, i) => {
          const [, mm, yyyy] = d.date.split('/')
          const dateObj = new Date(`${yyyy}-${mm}-${d.date.split('/')[0]}`)
          const dayLabel = i === 0
            ? 'TODAY'
            : dateObj.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()
          const rainColor = d.rainCoverPct >= 60 ? '#58a6ff'
                          : d.rainCoverPct >= 30 ? '#fdd835'
                          : 'rgba(245,245,240,0.4)'
          return (
            <div key={d.date} className="tmd-day" title={d.descriptionEnglish}>
              <div className="tmd-day-name">{dayLabel}</div>
              <div className="tmd-day-temp">
                <span className="tmd-day-max">{Math.round(d.tempMaxC)}°</span>
                <span className="tmd-day-min">{Math.round(d.tempMinC)}°</span>
              </div>
              <div className="tmd-day-rain" style={{ color: rainColor }}>
                {d.rainCoverPct}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ForecastStrip({ forecast }: { forecast: AQIForecast }) {
  const W = 240, H = 48
  const maxScale = Math.max(200, forecast.peakAqi)
  const pts = forecast.hours.map((h, i) => {
    const x = (i / Math.max(1, forecast.hours.length - 1)) * W
    const y = H - (h.usAqi / maxScale) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const threshY = (H - (100 / maxScale) * H).toFixed(1)
  const curY = (H - (forecast.currentAqi / maxScale) * H).toFixed(1)
  return (
    <div className="forecast-strip">
      <div className="forecast-header">
        <span className="forecast-label">AQI FORECAST · 24H</span>
        <span className="forecast-peak" style={{ color: RISK_COLOR[forecast.peakLevel] }}>
          PEAK {forecast.peakAqi} @ {forecast.peakHour}
        </span>
      </div>
      <svg className="forecast-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1="0" y1={threshY} x2={W} y2={threshY} stroke="#444" strokeWidth="1" strokeDasharray="4,4" />
        <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="0" cy={curY} r="2.5" fill="#f59e0b" />
      </svg>
      <div className="forecast-axis">
        <span>NOW</span>
        <span>+12H</span>
        <span>+24H</span>
      </div>
    </div>
  )
}

function formatBriefAsText(brief: MorningBrief): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
  let out = `BANGKOK CITY BRIEF — ${dateStr.toUpperCase()} ${timeStr}\n`
  out += `STATUS: ${brief.status}\n\n`
  out += brief.paragraphs.join('\n\n')
  if (brief.actions.length > 0) {
    out += '\n\nRECOMMENDED ACTIONS:\n'
    brief.actions.slice(0, 3).forEach((a, i) => {
      out += `${i + 1}. ${a.label} — ${a.detail}\n`
      if (a.draft) out += `   Draft: ${a.draft}\n`
    })
  }
  if (brief.gaps.length > 0) {
    out += '\nDATA GAPS:\n'
    brief.gaps.forEach((g) => { out += `• ${g.headline} (${g.severity.toUpperCase()})\n` })
  }
  out += '\nSource: GISTDA · Open-Meteo · Traffy Fondue · GDELT'
  return out
}

function CorrelationBar({ insights }: { insights: CorrelationInsight[] }) {
  if (insights.length === 0) return null
  return (
    <div className="correlation-bar">
      <span className="correlation-label">INTELLIGENCE</span>
      <div className="correlation-list">
        {insights.slice(0, 3).map((insight) => (
          <div key={insight.id} className={`correlation-chip correlation-chip--${insight.severity}`}>
            <span className="correlation-confidence">{Math.round(insight.confidence * 100)}%</span>
            <span className="correlation-headline">{insight.headline}</span>
            <span className="correlation-detail">{insight.detail}</span>
            <span className="correlation-sources">{insight.sources.join(' · ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AlertPanel() {
  const [pm25, setPm25] = useState<Pm25Live | null>(null)
  const [weather, setWeather] = useState<BangkokWeather | null>(null)
  const [floodCount, setFloodCount] = useState(0)
  const [aqi, setAqi] = useState<BangkokAQI | null>(null)
  const [forecast, setForecast] = useState<AQIForecast | null>(null)
  const [pm25Rank, setPm25Rank] = useState<Pm25ProvinceRank | null>(null)
  const [tmd, setTmd] = useState<TMDForecast | null>(null)
  const [traffyFloods, setTraffyFloods] = useState<TraffyTicket[]>([])
  const [traffyGeo, setTraffyGeo] = useState<GeoJSON.FeatureCollection | null>(null)
  const [news, setNews] = useState<GdeltNewsResult | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [correlations, setCorrelations] = useState<CorrelationInsight[]>([])
  // Mobile drawer — desktop ignores this; ::media queries hide the peek + backdrop
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [p, w, f, a, fc, rank, tf, tg, n, tm] = await Promise.all([
        bangkokPm25Live().catch((): null => null),
        bangkokWeather().catch((): null => null),
        centralFloods().catch((): null => null),
        bangkokAQI().catch((): null => null),
        bangkokAQIForecast().catch((): null => null),
        bangkokPm25Rank().catch((): null => null),
        fetchTraffyFloods(50).catch((): TraffyTicket[] => []),
        fetchTraffyGeoJSON(300).catch((): GeoJSON.FeatureCollection | null => null),
        fetchBangkokNews(6).catch((): GdeltNewsResult | null => null),
        bangkokTMDForecast().catch((): null => null),
      ])
      if (cancelled) return
      if (p) setPm25(p)
      if (w) setWeather(w)
      if (f) setFloodCount(Array.isArray(f.features) ? f.features.length : 0)
      if (a) setAqi(a)
      if (fc) setForecast(fc)
      if (rank) setPm25Rank(rank)
      if (tm) setTmd(tm)
      setTraffyFloods(tf as TraffyTicket[])
      setTraffyGeo(tg as GeoJSON.FeatureCollection | null)
      setNews(n as GdeltNewsResult | null)
      setLastUpdate(new Date())

      // Compute correlations asynchronously — non-blocking
      Promise.all([
        fetchBangkokTrafficFlow().catch((): [] => []),
        fetchThaiwaterLevels().catch((): [] => []),
        fetchAirbnbBangkok().catch((): [] => []),
        fetchTmdEarthquakes().catch((): [] => []),
      ]).then(([trafficFlow, waterLevels, airbnbListings, earthquakes]) => {
        if (cancelled) return
        const pm25Value = p?.pm25 ?? 0
        const civicActive = tg ? (tg.features.filter((f) => {
          const state = String((f.properties as Record<string, unknown>)?.state ?? '')
          return state !== 'เสร็จสิ้น'
        }).length) : 0
        const floodCnt = Array.isArray(f?.features) ? f.features.length : 0
        const insights = computeCorrelations(trafficFlow, waterLevels, airbnbListings, earthquakes, pm25Value, civicActive, floodCnt)
        setCorrelations(insights)
      }).catch(() => {})
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // Derive TraffyStats from geo features for the brief
  const traffyStats: TraffyStats | null = traffyGeo ? (() => {
    const byType: Record<string, number> = {}
    let active = 0
    for (const f of traffyGeo.features) {
      const props = (f.properties ?? {}) as Record<string, unknown>
      const types = (props.problem_type_fondue as string[]) ?? []
      const state = String(props.state ?? '')
      if (state !== 'เสร็จสิ้น') active++
      for (const t of types) byType[t] = (byType[t] ?? 0) + 1
    }
    return { total: traffyGeo.features.length, active, finished: traffyGeo.features.length - active, byType }
  })() : null

  const { districts } = useDistrictData()

  const brief = generateMorningBrief(pm25, weather, floodCount, aqi, traffyStats, traffyFloods, news)
  const anomalies = detectAnomalies(pm25, weather, floodCount, aqi, traffyStats)
  const alerts = computeAlerts(pm25, weather, floodCount, aqi, traffyFloods.length)

  // Synthetic forecast alert card when peak AQI > 100
  const forecastAlert: CityAlert | null = (forecast && forecast.peakAqi > 100) ? {
    id: 'forecast-aqi',
    level: forecast.peakLevel,
    headline: `FORECAST: AQI PEAKS AT ${forecast.peakAqi} — ${forecast.peakHour}`,
    detail: `24-hour model shows PM2.5 reaching ${forecast.peakLevel.toUpperCase()} levels at ${forecast.peakHour}. Pre-emptive advisory recommended for sensitive groups.`,
    action: 'DRAFT ADVISORY',
    draft: `[BMA AIR QUALITY FORECAST]\nPredicted AQI: ${forecast.peakAqi} (${forecast.peakLevel.toUpperCase()}) at ${forecast.peakHour}\nRecommend issuing outdoor activity advisory for sensitive groups and schools.\n\nSource: Open-Meteo Air Quality Forecast API`,
  } : null

  const handleAction = useCallback((alert: CityAlert) => {
    if (alert.draft) setDraft(alert.draft)
  }, [])

  const handleBriefAction = useCallback((draftText: string) => {
    setDraft(draftText)
  }, [])

  const timeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—:—'

  const overallLevel = alerts[0]?.level ?? 'good'

  const alertCount = alerts.length + (forecastAlert ? 1 : 0)
  const overallColor = RISK_COLOR[overallLevel]

  return (
    <>
      {draft && <DraftModal draft={draft} onClose={() => setDraft(null)} />}

      {/* Mobile peek handle — only visible on phones via CSS. Shows current
          status colour + tap-to-open affordance. Desktop hides it. */}
      <button
        className="alert-peek"
        onClick={() => setMobileOpen(true)}
        aria-label="Open city brief"
        aria-expanded={mobileOpen}
      >
        <span className="alert-peek-dot" style={{ background: overallColor }} aria-hidden />
        <span className="alert-peek-title">CITY BRIEF · {timeStr}</span>
        <span className="alert-peek-count" style={{ color: overallColor }}>
          {alertCount > 0 ? `${alertCount} ALERT${alertCount === 1 ? '' : 'S'}` : 'CALM'}
        </span>
        <span className="alert-peek-chev" aria-hidden>▴</span>
      </button>

      {/* Mobile drawer backdrop — only renders when open; CSS scopes to phones */}
      {mobileOpen && (
        <div
          className="alert-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside className={`alert-panel ${mobileOpen ? 'alert-panel--mobile-open' : ''}`}>
        {/* Raw status: a single colored line at the top edge. No pill text,
            no "SITUATION · LIVE" — the color is the verdict. */}
        <div
          className="alert-panel-thread"
          style={{ background: overallColor }}
          aria-label={`Status: ${overallLevel}`}
        />
        <div className="alert-panel-header">
          <span className="alert-panel-time">{timeStr} · ICT</span>
          {/* Mobile-only close button inside the drawer header */}
          <button
            className="alert-drawer-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close brief"
          >
            ✕
          </button>
        </div>

        <div className="alert-scroll">
          <BriefSection brief={brief} onAction={handleBriefAction} />
          <PrepareCard activeCity={BANGKOK_CITY} forecast={forecast} />
          <SLICPanel activeCity={BANGKOK_CITY} />
          <PatternsSection activeCity={BANGKOK_CITY} />
          <RankSection rank={pm25Rank} />
          <TMDSection tmd={tmd} />
          {pm25 && <TimeFMSection history={[]} />}
          <AnomalyBar anomalies={anomalies} />
          <CorrelationBar insights={correlations} />

          <InsightCardsGrid
            districts={districts}
            alerts={alerts}
            anomalies={anomalies}
            pm25History={[]}
            aqiHistory={[]}
            traffyCounts={traffyGeo?.features?.map((f) => (f.properties as Record<string, unknown>)?.complaint_count as number ?? 0) ?? []}
            currentPM25={pm25?.pm25 ?? 0}
            currentAQI={aqi?.usAqi ?? 0}
            weatherTemp={weather?.feelsLike ?? 0}
            weatherWind={weather?.windSpeed ?? 0}
            floodCount={floodCount}
            onDraft={(d) => setDraft(d)}
          />

          <div className="alert-list">
            {forecastAlert && <AlertCard key="forecast-aqi" alert={forecastAlert} onAction={handleAction} />}
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} onAction={handleAction} />
            ))}
          </div>

          <div className="alert-panel-divider" />
          <div className="alert-news-wrap">
            <RealityCheckEngine
              pm25={pm25?.pm25 ?? 0}
              aqi={aqi?.usAqi ?? 0}
              congestionAvg={0.4}
              floodCount={floodCount}
              citizenFloodReports={traffyFloods.length}
              heatIndex={weather?.feelsLike ?? 0}
              activeComplaints={traffyStats?.active ?? 0}
              newsTone={news?.avgTone ?? 0}
              newsCount={news?.articles.length ?? 0}
              headlines={news?.articles.map((a) => a.title) ?? []}
            />
          </div>

          {forecast && <ForecastStrip forecast={forecast} />}

          <OpenDataInventory activeCity={BANGKOK_CITY} />
        </div>

        <div className="alert-brief-row">
          <button className="alert-brief-btn" onClick={() => setDraft(formatBriefAsText(brief))}>
            copy the brief →
          </button>
        </div>

        <div className="alert-panel-footer">
          <div className="footer-aphorism">
            <span lang="th">ทุกอย่างเกิดขึ้นเพราะมีเหตุ</span>
            <span className="footer-aphorism-en">— the data has gaps. the city still moves.</span>
          </div>
          <div className="footer-sources">
            live · gistda · tmd · open-meteo · traffy · gdelt · nasa · bma · air4thai · thaiwater · tomtom · osm
          </div>
          <div className="footer-sources">
            predictive · gemini 2.5 · holt-winters · correlation engine
          </div>
          <div className="footer-signature">
            Non Arkaraprasertkul · DEPA Thailand
          </div>
        </div>
      </aside>
    </>
  )
}
