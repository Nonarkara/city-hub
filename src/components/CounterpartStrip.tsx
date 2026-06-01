/**
 * Counterpart Scale Strip — God-Mode requirement.
 *
 * The operator is always at one zoom level. This strip always shows
 * the *other* scale so they never lose wider context or closer detail.
 *
 * City view → top 3 districts by signal + delta vs city average
 * District view → city aggregate + peer comparison
 */
import { useMemo } from 'react'
import { useCityStore } from '../store/cityStore'
import { useSelectionStore } from '../store/selectionStore'
import { useDistrictData } from '../hooks/useDistrictData'
import { RISK_COLOR } from '../lib/risk'
import { CITIES } from '../config/cities'
import type { CityConfig } from '../config/cities'

interface CounterpartStripProps {
  activeCity: CityConfig
}

function formatDelta(value: number, avg: number): string {
  const diff = value - avg
  const pct = avg > 0 ? (diff / avg) * 100 : 0
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff.toFixed(0)} (${sign}${pct.toFixed(0)}%)`
}

export function CounterpartStrip({ activeCity }: CounterpartStripProps) {
  const selectedDistrictId = useSelectionStore((s) => s.selectedDistrictId)
  const { districts } = useDistrictData()
  const compareSet = useCityStore((s) => s.compareSet)
    const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])

  const isDistrictView = selectedDistrictId !== null

  // City view: show top districts
  const topDistricts = useMemo(() => {
    if (isDistrictView || districts.length === 0) return []
    const avgComplaints = districts.reduce((s, d) => s + d.complaint_count, 0) / districts.length
    return districts
      .slice(0, 3)
      .map((d) => ({
        ...d,
        delta: formatDelta(d.complaint_count, avgComplaints),
      }))
  }, [districts, isDistrictView])

  // District view: show city aggregate + peers
  const cityContext = useMemo(() => {
    if (!isDistrictView) return null
    const selected = districts.find((d) => d.name_th === selectedDistrictId)
    if (!selected) return null

    const avgVuln = districts.reduce((s, d) => s + d.vulnerability_score, 0) / districts.length
    const peerDistricts = districts
      .filter((d) => d.name_th !== selectedDistrictId)
      .slice(0, 2)

    return { selected, avgVuln, peerDistricts }
  }, [districts, selectedDistrictId, isDistrictView])

  if (!activeCity.tier || activeCity.tier !== 'full') {
    // Lite city: show ASEAN peers from compare set
    if (compareSet.length < 2) return null
    const peers = allCities.filter((c) => compareSet.includes(c.id) && c.id !== activeCity.id).slice(0, 3)
    return (
      <div className="counterpart-strip">
        <span className="counterpart-label">PEERS</span>
        {peers.map((c) => (
          <span key={c.id} className="counterpart-peer">
            {c.hudClockLabel}
          </span>
        ))}
      </div>
    )
  }

  if (isDistrictView && cityContext) {
    return (
      <div className="counterpart-strip counterpart-strip--district">
        <span className="counterpart-label">CITY CONTEXT</span>
        <span className="counterpart-aggregate">
          City avg vulnerability: {cityContext.avgVuln.toFixed(0)}/100
        </span>
        {cityContext.peerDistricts.map((d) => (
          <span key={d.name_th} className="counterpart-peer">
            <span style={{ color: RISK_COLOR[d.risk_level] }}>●</span>
            {' '}{d.name_en.replace(/([A-Z])/g, ' $1').trim()}
            {' '}({d.vulnerability_score})
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="counterpart-strip">
      <span className="counterpart-label">TOP DISTRICTS</span>
      {topDistricts.map((d, i) => (
        <span key={d.name_th} className="counterpart-item">
          <span className="counterpart-rank">{i + 1}</span>
          <span style={{ color: RISK_COLOR[d.risk_level] }}>●</span>
          {' '}{d.name_en.replace(/([A-Z])/g, ' $1').trim()}
          <span className="counterpart-delta">{d.delta}</span>
        </span>
      ))}
    </div>
  )
}
