/**
 * SLICPanel — proprietary 5-pillar AMPI scoring panel.
 *
 * Drops into any brief panel (Bangkok's AlertPanel + LiteCityPanel for the
 * other 4 cities). Shows:
 *
 *   - SLIC score (0–100) with peer ranking among the 5 City Hub cities
 *   - 5-pillar radar chart
 *   - Strongest + weakest pillar names
 *   - "WHERE TO FIX" recommendation grounded in the weak pillar
 *
 * This is the differentiator UNL fundamentally cannot match — they sell
 * basemap tiles, not structural intelligence.
 */
import { useMemo } from 'react'
import type { CityConfig } from '../config/cities'
import {
  getCityScore,
  getPillarBreakdown,
  weakestPillar,
  strongestPillar,
  globalRank,
  regionalRank,
  peerCities,
  scoreColor,
  PILLAR_DESCRIPTIONS,
  type CityScore,
} from '../lib/slic'

interface Props {
  activeCity: CityConfig
}

function polarPoint(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

function polygonPath(pts: { x: number; y: number }[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export function SLICPanel({ activeCity }: Props) {
  const score = useMemo(() => getCityScore(activeCity.id), [activeCity.id])

  if (!score) {
    return (
      <div className="slic-section">
        <div className="slic-header">SLIC INDEX</div>
        <div className="slic-no-data">No SLIC coverage for this city.</div>
      </div>
    )
  }

  const pillars = getPillarBreakdown(score)
  const weakest = weakestPillar(score)
  const strongest = strongestPillar(score)
  const g = globalRank(score)
  const r = regionalRank(score)
  const peers = peerCities(activeCity.id)

  // Radar chart geometry
  const W = 280, H = 220
  const cx = W / 2, cy = H / 2 - 4
  const maxR = 78
  const levels = [0.25, 0.5, 0.75, 1]
  const angles = pillars.map((_, i) => -Math.PI / 2 + (i * Math.PI * 2) / pillars.length)
  const levelPolygons = levels.map((lvl) =>
    polygonPath(angles.map((a) => polarPoint(cx, cy, maxR * lvl, a))),
  )
  const dataPolygon = polygonPath(
    pillars.map((p, i) => polarPoint(cx, cy, maxR * (p.value / 100), angles[i])),
  )

  const overallColor = scoreColor(score.slicScore)

  return (
    <div className="slic-section">
      <div className="slic-header">
        <span className="slic-title">SLIC INDEX · v3.4</span>
        <span className="slic-rank">#{g.rank} OF {g.total}</span>
      </div>

      {/* Hero score */}
      <div className="slic-hero">
        <div className="slic-score-block">
          <span className="slic-score-value" style={{ color: overallColor }}>{Math.round(score.slicScore)}</span>
          <span className="slic-score-unit">/100</span>
        </div>
        <div className="slic-score-meta">
          <div className="slic-score-label">AMPI SCORE</div>
          <div className="slic-region-rank">#{r.rank} in {r.region.toUpperCase()}</div>
          <div className="slic-coverage" title={`Methodology coverage: ${score.coverageGrade ?? '—'}`}>
            DATA {score.coverageGrade ?? '—'} · {Math.round((score.overallWeightedCoverage ?? 0) * 100)}%
          </div>
        </div>
      </div>

      {/* Radar */}
      <svg className="slic-radar" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="5-pillar SLIC breakdown">
        {/* Grid */}
        {levelPolygons.map((pts, i) => (
          <polygon
            key={`grid-${i}`}
            points={pts}
            fill="none"
            stroke="rgba(245,245,240,0.10)"
            strokeWidth="0.8"
          />
        ))}
        {/* Axes */}
        {angles.map((a, i) => {
          const edge = polarPoint(cx, cy, maxR, a)
          return (
            <line
              key={`axis-${i}`}
              x1={cx} y1={cy}
              x2={edge.x} y2={edge.y}
              stroke="rgba(245,245,240,0.10)"
              strokeWidth="0.8"
            />
          )
        })}
        {/* Data */}
        <polygon
          points={dataPolygon}
          fill={overallColor}
          fillOpacity="0.18"
          stroke={overallColor}
          strokeWidth="1.5"
        />
        {/* Pillar points */}
        {pillars.map((p, i) => {
          const pt = polarPoint(cx, cy, maxR * (p.value / 100), angles[i])
          const labelPt = polarPoint(cx, cy, maxR + 22, angles[i])
          return (
            <g key={p.pillar}>
              <circle cx={pt.x} cy={pt.y} r="2.5" fill={overallColor} />
              <text
                x={labelPt.x} y={labelPt.y}
                fill="rgba(245,245,240,0.7)"
                fontSize="9"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                dominantBaseline="middle"
                letterSpacing="0.10em"
              >
                {p.label}
              </text>
              <text
                x={labelPt.x} y={labelPt.y + 10}
                fill={scoreColor(p.value)}
                fontSize="10"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                fontWeight="500"
              >
                {p.value}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Strength / weakness */}
      <div className="slic-flags">
        {strongest && (
          <div className="slic-flag slic-flag--strong">
            <span className="slic-flag-label">STRONGEST</span>
            <span className="slic-flag-pillar">{strongest.label}</span>
            <span className="slic-flag-value">{strongest.value}</span>
          </div>
        )}
        {weakest && (
          <div className="slic-flag slic-flag--weak">
            <span className="slic-flag-label">WEAKEST</span>
            <span className="slic-flag-pillar">{weakest.label}</span>
            <span className="slic-flag-value">{weakest.value}</span>
          </div>
        )}
      </div>

      {/* Where to fix first */}
      {weakest && (
        <div className="slic-fix" title={PILLAR_DESCRIPTIONS[weakest.pillar]}>
          <span className="slic-fix-label">WHERE TO FIX FIRST</span>
          <p className="slic-fix-detail">{PILLAR_DESCRIPTIONS[weakest.pillar]}</p>
        </div>
      )}

      {/* Peer comparison — the other 4 City Hub cities */}
      {peers.length > 0 && (
        <div className="slic-peers">
          <div className="slic-peers-header">CITY HUB PEERS</div>
          <div className="slic-peers-list">
            {peers
              .sort((a, b) => b.slicScore - a.slicScore)
              .map((p) => (
                <div key={p.cityId} className="slic-peer-row">
                  <span className="slic-peer-name">{p.displayName}</span>
                  <span className="slic-peer-bar">
                    <span
                      className="slic-peer-fill"
                      style={{ width: `${p.slicScore}%`, background: scoreColor(p.slicScore) }}
                    />
                  </span>
                  <span className="slic-peer-score" style={{ color: scoreColor(p.slicScore) }}>
                    {Math.round(p.slicScore)}
                  </span>
                </div>
              ))}
            <div className="slic-peer-row slic-peer-row--self">
              <span className="slic-peer-name">{score.displayName}</span>
              <span className="slic-peer-bar">
                <span
                  className="slic-peer-fill"
                  style={{ width: `${score.slicScore}%`, background: overallColor }}
                />
              </span>
              <span className="slic-peer-score" style={{ color: overallColor }}>
                {Math.round(score.slicScore)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Stand-alone export for use in city brief generators (narrative grounding). */
export function slicSummaryText(activeCity: CityConfig): string {
  const score = getCityScore(activeCity.id)
  if (!score) return ''
  const w = weakestPillar(score)
  const r = regionalRank(score)
  if (!w) return ''
  return `SLIC ${Math.round(score.slicScore)}/100 (#${r.rank} in ${r.region}). Structural weak point: ${w.label.toLowerCase()} (${w.value}/100).`
}

export type { CityScore }
