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
import { bangkokPm25Live, centralFloods, type Pm25Live } from '../data/gistda'
import { bangkokWeather, type BangkokWeather } from '../data/openmeteo'
import { bangkokAQI, type BangkokAQI } from '../data/openmeteo-aq'
import { bangkokAQIForecast, type AQIForecast } from '../data/openmeteo-forecast'
import { fetchTraffyFloods, fetchTraffyGeoJSON, type TraffyTicket, type TraffyStats } from '../data/traffy'
import { fetchBangkokNews, type GdeltNewsResult } from '../data/gdelt'
import {
  generateMorningBrief,
  detectAnomalies,
  type MorningBrief,
  type Anomaly,
} from '../lib/intelligence'
import { computeAlerts, RISK_COLOR, type CityAlert, type RiskLevel } from '../lib/risk'

// ── Sub-components ────────────────────────────────────────────────────────────

function levelLabel(level: RiskLevel): string {
  if (level === 'critical') return 'CRITICAL'
  if (level === 'high')     return 'HIGH'
  if (level === 'moderate') return 'ADVISORY'
  return 'NORMAL'
}

function BriefSection({ brief, onAction }: { brief: MorningBrief; onAction: (draft: string) => void }) {
  return (
    <div className="brief-section">
      <div className="brief-header">
        <span className="brief-status-dot" style={{ background: brief.statusColor }} />
        <span className="brief-title">MORNING BRIEF</span>
        <span className="brief-status" style={{ color: brief.statusColor }}>{brief.status}</span>
      </div>
      <div className="brief-body">
        {brief.paragraphs.map((p, i) => (
          <p key={i} className="brief-paragraph">{p}</p>
        ))}
      </div>
      {brief.gaps.length > 0 && (
        <div className="brief-gaps">
          {brief.gaps.map((g, i) => (
            <div key={i} className={`brief-gap brief-gap--${g.severity}`}>
              <span className="brief-gap-label">GAP</span>
              <span className="brief-gap-headline">{g.headline}</span>
              <span className="brief-gap-detail">{g.detail}</span>
            </div>
          ))}
        </div>
      )}
      {brief.actions.length > 0 && (
        <div className="brief-actions">
          <div className="brief-actions-label">RECOMMENDED ACTIONS</div>
          {brief.actions.slice(0, 3).map((a, i) => (
            <div key={i} className="brief-action">
              <span className="brief-action-num">{i + 1}</span>
              <div className="brief-action-body">
                <span className="brief-action-label">{a.label}</span>
                <span className="brief-action-detail">{a.detail}</span>
              </div>
              {a.draft && (
                <button className="brief-action-btn" onClick={() => onAction(a.draft!)}>
                  COPY
                </button>
              )}
            </div>
          ))}
        </div>
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
  return (
    <div className="alert-card" data-level={alert.level}>
      <div className="alert-card-header">
        <span
          className="alert-level-chip"
          style={{ color: RISK_COLOR[alert.level], borderColor: RISK_COLOR[alert.level] }}
        >
          {levelLabel(alert.level)}
        </span>
      </div>
      <div className="alert-headline">{alert.headline}</div>
      <p className="alert-detail">{alert.detail}</p>
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

function RealityCheck({ alerts, news }: { alerts: CityAlert[]; news: GdeltNewsResult | null }) {
  const worst = alerts[0]?.level ?? 'good'
  const tone = news?.avgTone ?? 0
  let verdict = 'CALM'
  let verdictColor = '#8bc34a'

  if (worst === 'critical' || worst === 'high') {
    if (tone > 0) { verdict = 'UNDERSTATED'; verdictColor = '#fb8c00'; }
    else { verdict = 'CONFIRMED'; verdictColor = '#e53935'; }
  } else if (worst === 'moderate') {
    if (tone < -3) { verdict = 'OVERSTATED'; verdictColor = '#fdd835'; }
    else { verdict = 'CALM'; verdictColor = '#8bc34a'; }
  } else {
    if (tone < -3) { verdict = 'OVERSTATED'; verdictColor = '#fdd835'; }
    else { verdict = 'CALM'; verdictColor = '#8bc34a'; }
  }

  if (!news || news.articles.length === 0) {
    return (
      <div className="news-section">
        <div className="news-header">NARRATIVE · GDELT</div>
        <div className="news-empty">NO NEWS DATA</div>
      </div>
    )
  }

  return (
    <div className="news-section">
      <div className="news-header">
        <span>NARRATIVE · GDELT</span>
        <span className="news-verdict" style={{ color: verdictColor }}>{verdict}</span>
      </div>
      <div className="news-tone-row">
        <span className="news-tone-label">TONE</span>
        <span className="news-tone-bar">
          <span
            className="news-tone-fill"
            style={{
              width: `${Math.min(100, Math.max(0, 50 + tone * 2))}%`,
              background: tone < -2 ? '#e53935' : tone > 2 ? '#8bc34a' : '#fdd835',
            }}
          />
        </span>
        <span className="news-tone-val">{tone > 0 ? '+' : ''}{tone.toFixed(1)}</span>
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

// ── Main component ────────────────────────────────────────────────────────────

export function AlertPanel() {
  const [pm25, setPm25] = useState<Pm25Live | null>(null)
  const [weather, setWeather] = useState<BangkokWeather | null>(null)
  const [floodCount, setFloodCount] = useState(0)
  const [aqi, setAqi] = useState<BangkokAQI | null>(null)
  const [forecast, setForecast] = useState<AQIForecast | null>(null)
  const [traffyFloods, setTraffyFloods] = useState<TraffyTicket[]>([])
  const [traffyGeo, setTraffyGeo] = useState<GeoJSON.FeatureCollection | null>(null)
  const [news, setNews] = useState<GdeltNewsResult | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [p, w, f, a, fc, tf, tg, n] = await Promise.all([
        bangkokPm25Live().catch((): null => null),
        bangkokWeather().catch((): null => null),
        centralFloods().catch((): null => null),
        bangkokAQI().catch((): null => null),
        bangkokAQIForecast().catch((): null => null),
        fetchTraffyFloods(50).catch((): TraffyTicket[] => []),
        fetchTraffyGeoJSON(300).catch((): GeoJSON.FeatureCollection | null => null),
        fetchBangkokNews(6).catch((): GdeltNewsResult | null => null),
      ])
      if (cancelled) return
      if (p) setPm25(p)
      if (w) setWeather(w)
      if (f) setFloodCount(Array.isArray(f.features) ? f.features.length : 0)
      if (a) setAqi(a)
      if (fc) setForecast(fc)
      setTraffyFloods(tf as TraffyTicket[])
      setTraffyGeo(tg as GeoJSON.FeatureCollection | null)
      setNews(n as GdeltNewsResult | null)
      setLastUpdate(new Date())
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
  const statusLabel = overallLevel === 'good' ? 'CITY NORMAL' : overallLevel === 'moderate' ? 'ADVISORY ACTIVE' : overallLevel === 'high' ? 'ELEVATED RISK' : 'CRITICAL'

  return (
    <>
      {draft && <DraftModal draft={draft} onClose={() => setDraft(null)} />}

      <aside className="alert-panel">
        <div className="alert-panel-header">
          <div className="alert-status-row">
            <span className="alert-status-dot" style={{ background: RISK_COLOR[overallLevel] }} />
            <span className="alert-panel-title">SITUATION · LIVE</span>
          </div>
          <div className="alert-panel-meta">
            <span className="alert-status-label" style={{ color: RISK_COLOR[overallLevel] }}>
              {statusLabel}
            </span>
            <span className="alert-panel-time">{timeStr}</span>
          </div>
        </div>

        <div className="alert-scroll">
          <BriefSection brief={brief} onAction={handleBriefAction} />
          <AnomalyBar anomalies={anomalies} />

          <div className="alert-list">
            {forecastAlert && <AlertCard key="forecast-aqi" alert={forecastAlert} onAction={handleAction} />}
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} onAction={handleAction} />
            ))}
          </div>

          <div className="alert-panel-divider" />
          <div className="alert-news-wrap">
            <RealityCheck alerts={alerts} news={news} />
          </div>

          {forecast && <ForecastStrip forecast={forecast} />}
        </div>

        <div className="alert-brief-row">
          <button className="alert-brief-btn" onClick={() => setDraft(formatBriefAsText(brief))}>
            EXPORT BRIEF →
          </button>
        </div>

        <div className="alert-panel-footer">
          LIVE: GISTDA · OPEN-METEO · TRAFFY FONDUE · GDELT
          <br />
          PREDICTIVE: 6H LINEAR TREND + WEATHER CORRELATION
        </div>
      </aside>
    </>
  )
}
