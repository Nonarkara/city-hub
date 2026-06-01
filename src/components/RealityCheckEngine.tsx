/**
 * Reality Check Engine — systematic narrative-vs-measurement for all topics.
 *
 * Shows verdict cards for Air, Traffic, Flood, Heat, and Civic issues.
 */
import { useState } from 'react'
import { generateRealityChecks, type RealityCheckResult } from '../lib/reality-check'

interface RealityCheckEngineProps {
  pm25: number
  aqi: number
  congestionAvg: number
  floodCount: number
  citizenFloodReports: number
  heatIndex: number
  activeComplaints: number
  newsTone: number
  newsCount: number
  headlines: string[]
}

function VerdictCard({ result }: { result: RealityCheckResult }) {
  return (
    <div className="verdict-card">
      <div className="verdict-header">
        <span className="verdict-topic">{result.topic.toUpperCase()}</span>
        <span className="verdict-label" style={{ color: result.verdictColor }}>{result.verdict}</span>
      </div>
      <div className="verdict-body">
        <div className="verdict-row">
          <span className="verdict-row-label">NARRATIVE</span>
          <span className="verdict-row-val">{result.narrative.storyCount} stories · tone {result.narrative.tone > 0 ? '+' : ''}{result.narrative.tone.toFixed(1)}</span>
        </div>
        <div className="verdict-row">
          <span className="verdict-row-label">MEASURED</span>
          <span className="verdict-row-val">{typeof result.measured.value === 'number' ? result.measured.value.toFixed(0) : result.measured.value} {result.measured.unit}</span>
        </div>
        <p className="verdict-explanation">{result.explanation}</p>
      </div>
    </div>
  )
}

export function RealityCheckEngine({
  pm25,
  aqi,
  congestionAvg,
  floodCount,
  citizenFloodReports,
  heatIndex,
  activeComplaints,
  newsTone,
  newsCount,
  headlines,
}: RealityCheckEngineProps) {
  const [activeTab, setActiveTab] = useState(0)

  const checks = generateRealityChecks({
    pm25,
    aqi,
    congestionAvg,
    floodCount,
    citizenFloodReports,
    heatIndex,
    activeComplaints,
    newsTone,
    newsCount,
    headlines,
  })

  if (checks.length === 0) {
    return (
      <div className="reality-check-engine">
        <div className="reality-check-header">REALITY CHECK</div>
        <div className="reality-check-calm">All systems calm — no narrative mismatch detected.</div>
      </div>
    )
  }

  return (
    <div className="reality-check-engine">
      <div className="reality-check-header">
        <span>REALITY CHECK</span>
        <span className="reality-check-count">{checks.length} topics</span>
      </div>
      <div className="reality-check-tabs">
        {checks.map((c, i) => (
          <button
            key={c.topic}
            className={`reality-check-tab ${i === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <span className="reality-check-tab-dot" style={{ color: c.verdictColor }}>●</span>
            {c.topic}
          </button>
        ))}
      </div>
      <VerdictCard result={checks[activeTab]} />
    </div>
  )
}
