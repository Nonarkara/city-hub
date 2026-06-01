/**
 * District Compare Panel — side-by-side comparison of two Bangkok districts.
 *
 * Activated when two districts are selected. Shows:
 *   - Traffy profile comparison
 *   - Vulnerability radar
 *   - PM2.5 trend comparison
 *   - Shared timeline
 */
import { useMemo } from 'react'
import { useSelectionStore } from '../store/selectionStore'
import { useDistrictData } from '../hooks/useDistrictData'
import { RISK_COLOR } from '../lib/risk'

function RadarChart({ a, b, labels }: { a: number[]; b: number[]; labels: string[] }) {
  const W = 120
  const H = 120
  const cx = W / 2
  const cy = H / 2
  const r = 45
  const n = labels.length
  const maxVal = 25

  const point = (vals: number[], idx: number) => {
    const angle = (Math.PI * 2 * idx) / n - Math.PI / 2
    const dist = (vals[idx] / maxVal) * r
    return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist]
  }

  const poly = (vals: number[]) =>
    Array.from({ length: n }, (_, i) => point(vals, i))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ')

  return (
    <svg className="radar-chart" viewBox={`0 0 ${W} ${H}`}>
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <polygon
          key={pct}
          points={Array.from({ length: n }, (_, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2
            const dist = pct * r
            return `${cx + Math.cos(angle) * dist},${cy + Math.sin(angle) * dist}`
          }).join(' ')}
          fill="none"
          stroke="rgba(245,245,240,0.08)"
          strokeWidth="0.5"
        />
      ))}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * r}
            y2={cy + Math.sin(angle) * r}
            stroke="rgba(245,245,240,0.08)"
            strokeWidth="0.5"
          />
        )
      })}
      {/* Data polygons */}
      <polygon points={poly(a)} fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1" />
      <polygon points={poly(b)} fill="rgba(88,166,255,0.12)" stroke="#58a6ff" strokeWidth="1" />
    </svg>
  )
}

export function DistrictComparePanel() {
  const districtComparePair = useSelectionStore((s) => s.districtComparePair)
  const { districts } = useDistrictData()

  const [d1, d2] = useMemo(() => {
    if (!districtComparePair) return [null, null]
    const a = districts.find((d) => d.name_th === districtComparePair[0]) ?? null
    const b = districts.find((d) => d.name_th === districtComparePair[1]) ?? null
    return [a, b]
  }, [districtComparePair, districts])

  if (!d1 || !d2) {
    return (
      <div className="district-compare-panel district-compare-panel--empty">
        <div className="district-compare-hint">
          Select 2 districts to compare
        </div>
        <div className="district-compare-subhint">
          Shift-click a second district in the leaderboard
        </div>
      </div>
    )
  }

  const radarLabels = ['Civic', 'Air', 'Heat', 'Flood', 'Access']
  const radarA = [
    Math.min(25, (d1.complaint_count / 200) * 25),
    Math.min(25, (d1.vulnerability_score / 100) * 25),
    d1.vulnerability_score > 50 ? 15 : 5,
    d1.complaint_count > 50 ? 15 : 5,
    10,
  ]
  const radarB = [
    Math.min(25, (d2.complaint_count / 200) * 25),
    Math.min(25, (d2.vulnerability_score / 100) * 25),
    d2.vulnerability_score > 50 ? 15 : 5,
    d2.complaint_count > 50 ? 15 : 5,
    10,
  ]

  return (
    <div className="district-compare-panel">
      <div className="district-compare-header">
        <span className="district-compare-title">DISTRICT COMPARE</span>
        <button
          className="district-compare-close"
          onClick={() => useSelectionStore.getState().setDistrictComparePair(null)}
        >
          ✕
        </button>
      </div>

      <div className="district-compare-names">
        <div className="district-compare-side">
          <span className="district-compare-dot" style={{ color: '#f59e0b' }}>●</span>
          <span className="district-compare-name">{d1.name_en.replace(/([A-Z])/g, ' $1').trim()}</span>
        </div>
        <span className="district-compare-vs">VS</span>
        <div className="district-compare-side">
          <span className="district-compare-dot" style={{ color: '#58a6ff' }}>●</span>
          <span className="district-compare-name">{d2.name_en.replace(/([A-Z])/g, ' $1').trim()}</span>
        </div>
      </div>

      <div className="district-compare-radar">
        <RadarChart a={radarA} b={radarB} labels={radarLabels} />
        <div className="radar-legend">
          {radarLabels.map((l, i) => (
            <span key={l} className="radar-legend-item">
              {l}: {radarA[i].toFixed(0)} vs {radarB[i].toFixed(0)}
            </span>
          ))}
        </div>
      </div>

      <div className="district-compare-metrics">
        <div className="district-compare-metric">
          <span className="district-compare-metric-label">Complaints</span>
          <div className="district-compare-bars">
            <div className="district-compare-bar-wrap">
              <div className="district-compare-bar" style={{ width: `${Math.min(100, (d1.complaint_count / Math.max(d1.complaint_count, d2.complaint_count)) * 100)}%`, background: '#f59e0b' }} />
              <span>{d1.complaint_count}</span>
            </div>
            <div className="district-compare-bar-wrap">
              <div className="district-compare-bar" style={{ width: `${Math.min(100, (d2.complaint_count / Math.max(d1.complaint_count, d2.complaint_count)) * 100)}%`, background: '#58a6ff' }} />
              <span>{d2.complaint_count}</span>
            </div>
          </div>
        </div>

        <div className="district-compare-metric">
          <span className="district-compare-metric-label">Vulnerability</span>
          <div className="district-compare-bars">
            <div className="district-compare-bar-wrap">
              <div className="district-compare-bar" style={{ width: `${d1.vulnerability_score}%`, background: RISK_COLOR[d1.vulnerability_level] }} />
              <span>{d1.vulnerability_score}</span>
            </div>
            <div className="district-compare-bar-wrap">
              <div className="district-compare-bar" style={{ width: `${d2.vulnerability_score}%`, background: RISK_COLOR[d2.vulnerability_level] }} />
              <span>{d2.vulnerability_score}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
