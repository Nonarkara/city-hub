/**
 * District Intelligence Panel — slides in when any khet is clicked on the map
 * or selected from the leaderboard.
 *
 * Shows: name TH+EN · risk chip · complaint count · top issue types (CSS bars)
 *        flood risk badge · AI summary of latest ticket · district draft action
 *
 * Data: filtered from cached Traffy GeoJSON — zero extra HTTP.
 * Uses buildDistrictProfiles() from intelligence.ts.
 */
import { useEffect, useState } from 'react'
import { fetchTraffyGeoJSON } from '../data/traffy'
import { buildDistrictProfiles, type DistrictProfile } from '../lib/intelligence'
import { RISK_COLOR, type RiskLevel } from '../lib/risk'
import { type DistrictSummary } from '../hooks/useDistrictData'
import { saveDraftAction } from '../lib/db'

// ── Types for Forecast ───────────────────────────────────────────────────
interface ForecastResponse {
  forecast: number[]
  lower?: number[]
  upper?: number[]
  model: string
  reasoning?: string
}

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787'

interface Props {
  district: DistrictSummary
  onClose: () => void
  onDraft: (text: string) => void
}

// Format name_en from CamelCase to spaced (e.g. "BangKapi" → "Bang Kapi")
function formatName(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim()
}

function RiskChip({ level }: { level: RiskLevel }) {
  return (
    <span
      className="district-risk-chip"
      style={{ color: RISK_COLOR[level], borderColor: RISK_COLOR[level] }}
    >
      {level.toUpperCase()}
    </span>
  )
}

function TypeBar({ type, count, total }: { type: string; count: number; total: number }) {
  const pct = total > 0 ? Math.max(4, (count / total) * 100) : 4
  return (
    <div className="district-type-row">
      <span className="district-type-label">{type}</span>
      <div className="district-type-bar-track">
        <div className="district-type-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="district-type-count">{count}</span>
    </div>
  )
}

function PredictiveSparkline({ districtName, baseValue }: { districtName: string, baseValue: number }) {
  const [data, setData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    
    // Generate a synthetic recent history for the sparkline that loosely scales with the district's issues
    const history = Array.from({ length: 24 }).map((_, i) => {
      const trend = i * (baseValue / 100)
      const noise = (Math.random() - 0.5) * (baseValue / 20)
      return Math.max(0, Math.floor(baseValue / 10 + trend + noise))
    })

    fetch(`${WORKER_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series: history, horizon: 12, domain: `hourly civic complaints in ${districtName}` })
    })
      .then(res => res.json())
      .then(res => {
        if (!cancelled && res.forecast) setData(res)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [districtName, baseValue])

  if (loading) return <div className="district-sparkline-loading">GENERATING PREDICTION...</div>
  if (!data) return null

  // Render SVG Sparkline
  const width = 280
  const height = 40
  const series = data.forecast
  const max = Math.max(...series, ...(data.upper || []))
  const min = Math.min(...series, ...(data.lower || []))
  const range = max - min || 1
  
  const dx = width / Math.max(1, series.length - 1)
  
  const points = series.map((val, i) => {
    const x = i * dx
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const upperPoints = data.upper?.map((val, i) => {
    const x = i * dx
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const lowerPoints = data.lower?.map((val, i) => {
    const x = (series.length - 1 - i) * dx
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).reverse().join(' ')

  return (
    <div className="district-sparkline">
      <div className="district-section-label">12HR ISSUE FORECAST 
        <span className="district-sparkline-model"> (VIA {data.model.toUpperCase()})</span>
      </div>
      <svg width={width} height={height} className="district-sparkline-svg">
        {data.upper && data.lower && (
          <polygon 
            points={`${upperPoints} ${lowerPoints}`} 
            fill="rgba(245, 158, 11, 0.15)" 
          />
        )}
        <polyline points={points} fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      {data.reasoning && <div className="district-sparkline-reasoning">{data.reasoning}</div>}
    </div>
  )
}

export function DistrictPanel({ district, onClose, onDraft }: Props) {
  const [profile, setProfile] = useState<DistrictProfile | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDrafting, setIsDrafting] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchTraffyGeoJSON(500).then((geo) => {
      if (cancelled) return

      // Filter features for this district
      const districtFeatures = geo.features.filter((f) => {
        const d = ((f.properties?.district as string) ?? '').replace(/^เขต/, '').trim()
        return d === district.name_th
      })

      // Build profile using intelligence engine
      const profiles = buildDistrictProfiles(districtFeatures)
      const p = profiles.find((pr) => pr.name === district.name_th) ?? profiles[0] ?? null
      setProfile(p)

      // Find first ticket with ai_summary
      const withSummary = districtFeatures.find(
        (f) => f.properties?.ai_summary && String(f.properties.ai_summary).length > 10
      )
      if (withSummary) setAiSummary(String(withSummary.properties!.ai_summary))

      setLoading(false)
    }).catch(() => setLoading(false))

    return () => { cancelled = true }
  }, [district.name_th])

  const draftText = `[BMA · เขต${district.name_th}]
ขณะนี้มีรายงานปัญหาจากประชาชน ${district.complaint_count.toLocaleString()} รายการ (ระดับ ${district.risk_level.toUpperCase()})
กรุณาตรวจสอบและดำเนินการแก้ไขโดยเร็ว`

  const handleDraft = async () => {
    setIsDrafting(true)
    try {
      await saveDraftAction(district.name_en, draftText)
      onDraft(draftText)
    } catch (e) {
      console.error(e)
    } finally {
      setIsDrafting(false)
    }
  }

  const topTypes = profile
    ? Object.entries(
        profile.topIssueTypes.reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1])
    : []

  return (
    <aside className="district-panel">
      {/* Header */}
      <div className="district-panel-header">
        <div className="district-panel-name">
          <span className="district-name-en">{formatName(district.name_en)}</span>
          <span className="district-name-th">เขต{district.name_th}</span>
        </div>
        <button className="district-panel-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* Risk + count row */}
      <div className="district-panel-summary">
        <RiskChip level={district.risk_level} />
        <span className="district-complaint-count">
          {district.complaint_count.toLocaleString()}
          <span className="district-complaint-unit"> OPEN ISSUES</span>
        </span>
      </div>

      {/* Vulnerability index */}
      <div className="district-vuln-row">
        <div className="district-vuln-header">
          <span className="district-vuln-label">VULNERABILITY INDEX</span>
          <span
            className="district-vuln-chip"
            style={{ color: RISK_COLOR[district.vulnerability_level], borderColor: RISK_COLOR[district.vulnerability_level] }}
          >
            {district.vulnerability_level.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="district-vuln-bar-bg">
            <div 
              className="district-vuln-bar-fill"
              style={{ 
                width: `${Math.max(4, district.vulnerability_score)}%`, 
                background: RISK_COLOR[district.vulnerability_level],
                color: RISK_COLOR[district.vulnerability_level]
              }} 
            />
          </div>
          <span
            className="district-vuln-score"
            style={{ color: RISK_COLOR[district.vulnerability_level], marginLeft: '12px' }}
          >
            {district.vulnerability_score}
          </span>
        </div>
      </div>

      <div className="district-panel-scroll">
        {loading ? (
          <div className="district-loading">LOADING DISTRICT DATA…</div>
        ) : (
          <>
            {/* Flood risk badge */}
            {profile?.floodRisk !== 'low' && (
              <div className={`district-flood-badge district-flood-badge--${profile?.floodRisk}`}>
                FLOOD RISK: {profile?.floodRisk?.toUpperCase()}
              </div>
            )}

            {/* Top issue types */}
            {profile && profile.topIssueTypes.length > 0 && (
              <div className="district-types">
                <div className="district-section-label">TOP ISSUES</div>
                {topTypes.slice(0, 5).map(([type, count]) => (
                  <TypeBar
                    key={type}
                    type={type}
                    count={count}
                    total={district.complaint_count}
                  />
                ))}
              </div>
            )}

            {/* Resolution rate */}
            {profile && (
              <div className="district-meta">
                <div className="district-meta-row">
                  <span className="district-meta-label">RESOLUTION RATE</span>
                  <span className="district-meta-val">
                    {(profile.resolutionRate * 100).toFixed(0)}%
                  </span>
                </div>
                {profile.avgResponseHours !== null && (
                  <div className="district-meta-row">
                    <span className="district-meta-label">AVG RESPONSE</span>
                    <span className="district-meta-val">
                      {profile.avgResponseHours.toFixed(1)}H
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* AI summary */}
            {aiSummary && (
              <div className="district-ai-section">
                <div className="district-section-label">AI SUMMARY · LATEST TICKET</div>
                <p className="district-ai-text">{aiSummary}</p>
              </div>
            )}

            {/* Predictive Sparkline */}
            <PredictiveSparkline districtName={district.name_en} baseValue={district.complaint_count} />
          </>
        )}
      </div>

      {/* Action footer */}
      <div className="district-panel-footer">
        <button className="district-draft-btn" onClick={handleDraft} disabled={isDrafting}>
          {isDrafting ? 'SAVING TO CLOUD...' : 'DRAFT DISTRICT ACTION →'}
        </button>
        <button className="district-back-btn" onClick={onClose}>
          ← BACK TO SIT ROOM
        </button>
      </div>
    </aside>
  )
}
