/**
 * Insight Cards Grid — auto-generated statistical insights from live data.
 *
 * Renders a browsable grid of insight cards. Cards can be:
 *   - Pinned (persist in selectionStore)
 *   - Expanded (show detail view)
 *   - Actioned (draft alert from insight)
 */
import { useEffect, useState, useCallback } from 'react'
import { useSelectionStore } from '../store/selectionStore'
import { useUIStore } from '../store/uiStore'
import { computeInsightCards, type InsightCard } from '../lib/insight-cards'
import type { DistrictSummary } from '../hooks/useDistrictData'
import type { CityAlert } from '../lib/risk'
import type { Anomaly } from '../lib/intelligence'
import { RISK_COLOR } from '../lib/risk'

interface InsightCardsGridProps {
  districts: DistrictSummary[]
  alerts: CityAlert[]
  anomalies: Anomaly[]
  pm25History: number[]
  aqiHistory: number[]
  traffyCounts: number[]
  currentPM25: number
  currentAQI: number
  weatherTemp: number
  weatherWind: number
  floodCount: number
  peerCities?: { name: string; pm25: number; aqi: number }[]
  onDraft?: (draft: string) => void
}

function InsightCardItem({
  card,
  pinned,
  onPin,
  onDraft,
}: {
  card: InsightCard
  pinned: boolean
  onPin: () => void
  onDraft?: (d: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const color = RISK_COLOR[card.severity === 'critical' ? 'critical' : card.severity === 'high' ? 'high' : card.severity === 'medium' ? 'moderate' : 'good']

  return (
    <div className={`insight-card insight-card--${card.severity} ${expanded ? 'insight-card--expanded' : ''}`}>
      <div className="insight-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="insight-card-type">{card.type.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
        <span className="insight-card-severity" style={{ color }}>●</span>
      </div>
      <div className="insight-card-headline">{card.headline}</div>
      <div className="insight-card-detail">{card.detail}</div>

      {card.deltaPct !== undefined && (
        <div className="insight-card-delta" style={{ color: card.deltaPct > 0 ? '#e53935' : '#8bc34a' }}>
          {card.deltaPct > 0 ? '+' : ''}{card.deltaPct.toFixed(0)}%
        </div>
      )}

      <div className="insight-card-meta">
        <span className="insight-card-confidence">{(card.confidence * 100).toFixed(0)}% confidence</span>
        <span className="insight-card-sources">{card.sources.join(' · ')}</span>
      </div>

      {expanded && (
        <div className="insight-card-actions">
          <button className="insight-card-btn" onClick={onPin}>
            {pinned ? 'UNPIN' : 'PIN'}
          </button>
          {card.actionDraft && onDraft && (
            <button className="insight-card-btn insight-card-btn--action" onClick={() => onDraft(card.actionDraft!)}>
              DRAFT ALERT
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function InsightCardsGrid({
  districts,
  alerts,
  anomalies,
  pm25History,
  aqiHistory,
  traffyCounts,
  currentPM25,
  currentAQI,
  weatherTemp,
  weatherWind,
  floodCount,
  peerCities,
  onDraft,
}: InsightCardsGridProps) {
  const [cards, setCards] = useState<InsightCard[]>([])
  const pinnedInsights = useSelectionStore((s) => s.pinnedInsights)
  const togglePinnedInsight = useSelectionStore((s) => s.togglePinnedInsight)
  const setAppDraft = useUIStore((s) => s.setAppDraft)

  useEffect(() => {
    const computed = computeInsightCards({
      districts,
      alerts,
      anomalies,
      pm25History,
      aqiHistory,
      traffyCounts,
      currentPM25,
      currentAQI,
      weatherTemp,
      weatherWind,
      floodCount,
      peerCities,
    })
    setCards(computed.slice(0, 8))
  }, [districts, alerts, anomalies, pm25History, aqiHistory, traffyCounts, currentPM25, currentAQI, weatherTemp, weatherWind, floodCount, peerCities])

  const handleDraft = useCallback((draft: string) => {
    if (onDraft) onDraft(draft)
    else setAppDraft(draft)
  }, [onDraft, setAppDraft])

  if (cards.length === 0) return null

  return (
    <div className="insight-cards-grid">
      <div className="insight-cards-header">
        <span className="insight-cards-title">LIVE INSIGHTS</span>
        <span className="insight-cards-count">{cards.length}</span>
      </div>
      <div className="insight-cards-list">
        {cards.map((card) => (
          <InsightCardItem
            key={card.id}
            card={card}
            pinned={pinnedInsights.includes(card.id)}
            onPin={() => togglePinnedInsight(card.id)}
            onDraft={card.actionDraft ? handleDraft : undefined}
          />
        ))}
      </div>
    </div>
  )
}
