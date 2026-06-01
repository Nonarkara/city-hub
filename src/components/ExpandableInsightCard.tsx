/**
 * Expandable Insight Card — progressive disclosure pattern.
 *
 * Level 1: Summary line + sparkline + delta
 * Level 2: Full chart + breakdown + confidence
 * Level 3: Narrative + raw data + export
 */
import { useState } from 'react'
import { RISK_COLOR } from '../lib/risk'

interface ExpandableInsightCardProps {
  title: string
  value: number | string
  unit?: string
  delta?: number
  deltaPct?: number
  sparklineData?: number[]
  severity?: 'good' | 'moderate' | 'high' | 'critical'
  detail?: string
  children?: React.ReactNode
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const W = 80
  const H = 24
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = Math.max(1, max - min)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ')
  return (
    <svg className="mini-sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function ExpandableInsightCard({
  title,
  value,
  unit,
  delta,
  deltaPct,
  sparklineData,
  severity = 'good',
  detail,
  children,
}: ExpandableInsightCardProps) {
  const [level, setLevel] = useState<1 | 2 | 3>(1)
  const color = RISK_COLOR[severity]
  const deltaColor = (delta ?? 0) > 0 ? '#e53935' : '#8bc34a'

  return (
    <div className={`expandable-card expandable-card--level-${level}`}>
      <div className="expandable-card-summary" onClick={() => setLevel(level === 1 ? 2 : 1)}>
        <div className="expandable-card-left">
          <span className="expandable-card-title">{title}</span>
          <span className="expandable-card-value" style={{ color }}>
            {typeof value === 'number' ? value.toFixed(1) : value}
            {unit && <span className="expandable-card-unit">{unit}</span>}
          </span>
          {delta !== undefined && (
            <span className="expandable-card-delta" style={{ color: deltaColor }}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              {deltaPct !== undefined && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(0)}%)`}
            </span>
          )}
        </div>
        {sparklineData && (
          <div className="expandable-card-sparkline">
            <MiniSparkline data={sparklineData} color={color} />
          </div>
        )}
        <button
          className="expandable-card-chevron"
          onClick={(e) => { e.stopPropagation(); setLevel(level === 3 ? 1 : (level + 1) as 1 | 2 | 3) }}
        >
          {level === 3 ? '▾' : '▸'}
        </button>
      </div>

      {level >= 2 && detail && (
        <div className="expandable-card-detail">
          {detail}
        </div>
      )}

      {level >= 2 && children && (
        <div className="expandable-card-children">
          {children}
        </div>
      )}
    </div>
  )
}
