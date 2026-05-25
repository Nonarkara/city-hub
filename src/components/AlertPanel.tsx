/**
 * Governor's situation panel — replaces LayerRail + DataFeedPanel in SIT ROOM mode.
 *
 * Each alert:
 *   - Computes from live GISTDA PM2.5 + Open-Meteo weather + flood polygon count + Traffy civic data + AQI
 *   - Shows risk level chip · headline · one-line detail
 *   - Action button opens a draft message ready to copy to LINE / BMA system
 *
 * cachedFetch deduplicates HTTP requests vs VitalsBar (same cache keys).
 */
import { useCallback, useEffect, useState } from 'react'
import { bangkokPm25Live, centralFloods, type Pm25Live } from '../data/gistda'
import { bangkokWeather, type BangkokWeather } from '../data/openmeteo'
import { bangkokAQI, type BangkokAQI } from '../data/openmeteo-aq'
import { fetchTraffyFloods, type TraffyTicket } from '../data/traffy'
import { fetchBangkokNews, type GdeltNewsResult } from '../data/gdelt'
import { computeAlerts, RISK_COLOR, type CityAlert, type RiskLevel } from '../lib/risk'

// ── Sub-components ────────────────────────────────────────────────────────────

function levelLabel(level: RiskLevel): string {
  if (level === 'critical') return 'CRITICAL'
  if (level === 'high')     return 'HIGH'
  if (level === 'moderate') return 'ADVISORY'
  return 'NORMAL'
}

function AlertCard({
  alert,
  onAction,
}: {
  alert: CityAlert
  onAction: (a: CityAlert) => void
}) {
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

function DraftModal({ draft, onClose }: { draft: string; onClose: () => void }) {
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

function RealityCheck({
  alerts,
  news,
}: {
  alerts: CityAlert[]
  news: GdeltNewsResult | null
}) {
  const worst = alerts[0]?.level ?? 'good'
  const tone = news?.avgTone ?? 0
  // Tone: negative = alarmist/dire, positive = calm/optimistic
  // Reality check: compare sensor severity to news tone
  let verdict = 'CALM'
  let verdictColor = '#8bc34a'

  if (worst === 'critical' || worst === 'high') {
    if (tone > 0) { verdict = 'UNDERSTATED'; verdictColor = '#fb8c00'; }
    else if (tone < -2) { verdict = 'CONFIRMED'; verdictColor = '#e53935'; }
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
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-item"
            title={a.domain}
          >
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

// ── Main component ────────────────────────────────────────────────────────────

export function AlertPanel() {
  const [pm25, setPm25] = useState<Pm25Live | null>(null)
  const [weather, setWeather] = useState<BangkokWeather | null>(null)
  const [floodCount, setFloodCount] = useState(0)
  const [aqi, setAqi] = useState<BangkokAQI | null>(null)
  const [traffyFloods, setTraffyFloods] = useState<TraffyTicket[]>([])
  const [news, setNews] = useState<GdeltNewsResult | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [p, w, f, a, tf, n] = await Promise.all([
        bangkokPm25Live().catch((): null => null),
        bangkokWeather().catch((): null => null),
        centralFloods().catch((): null => null),
        bangkokAQI().catch((): null => null),
        fetchTraffyFloods(50).catch((): TraffyTicket[] => []),
        fetchBangkokNews(6).catch((): GdeltNewsResult | null => null),
      ]) as [Pm25Live | null, BangkokWeather | null, { features?: unknown[] } | null, BangkokAQI | null, TraffyTicket[], GdeltNewsResult | null]

      if (cancelled) return
      if (p) setPm25(p)
      if (w) setWeather(w)
      if (f) setFloodCount(Array.isArray(f.features) ? f.features.length : 0)
      if (a) setAqi(a)
      setTraffyFloods(tf)
      setNews(n)
      setLastUpdate(new Date())
    }

    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const alerts = computeAlerts(pm25, weather, floodCount, aqi, traffyFloods.length)

  const handleAction = useCallback((alert: CityAlert) => {
    if (alert.draft) setDraft(alert.draft)
  }, [])

  const timeStr = lastUpdate
    ? lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—:—'

  // Overall city status = worst alert level
  const overallLevel = alerts[0]?.level ?? 'good'
  const statusLabel = overallLevel === 'good'
    ? 'CITY NORMAL'
    : overallLevel === 'moderate'
    ? 'ADVISORY ACTIVE'
    : overallLevel === 'high'
    ? 'ELEVATED RISK'
    : 'CRITICAL'

  return (
    <>
      {draft && <DraftModal draft={draft} onClose={() => setDraft(null)} />}

      <aside className="alert-panel">
        <div className="alert-panel-header">
          <div className="alert-status-row">
            <span
              className="alert-status-dot"
              style={{ background: RISK_COLOR[overallLevel] }}
            />
            <span className="alert-panel-title">SITUATION · LIVE</span>
          </div>
          <div className="alert-panel-meta">
            <span
              className="alert-status-label"
              style={{ color: RISK_COLOR[overallLevel] }}
            >
              {statusLabel}
            </span>
            <span className="alert-panel-time">{timeStr}</span>
          </div>
        </div>

        <div className="alert-list">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} onAction={handleAction} />
          ))}
        </div>

        <div className="alert-panel-divider" />

        <div className="alert-news-wrap">
          <RealityCheck alerts={alerts} news={news} />
        </div>

        <div className="alert-panel-footer">
          LIVE: GISTDA · OPEN-METEO · TRAFFY FONDUE · GDELT
          <br />
          PENDING: DISEASE · EGAT
        </div>
      </aside>
    </>
  )
}
