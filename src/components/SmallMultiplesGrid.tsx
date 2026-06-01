/**
 * Small Multiples Grid — repeated mini-charts for fast pattern scanning.
 *
 * For Bangkok: 50 district sparklines (AQI/complaints) in a scrollable grid.
 * For ASEAN: all hub city mini-KPI cards.
 * Click any multiple to drill into full view.
 */
import { useMemo } from 'react'
import { useSelectionStore } from '../store/selectionStore'
import { useDistrictData } from '../hooks/useDistrictData'
import { useCityStore } from '../store/cityStore'
import { RISK_COLOR } from '../lib/risk'
import type { CityConfig } from '../config/cities'

interface SmallMultiplesGridProps {
  activeCity: CityConfig
}

function DistrictMini({ district, onClick, selected }: {
  district: ReturnType<typeof useDistrictData>['districts'][number]
  onClick: () => void
  selected: boolean
}) {
  // Generate a synthetic sparkline from vulnerability score
  const sparkData = useMemo(() => {
    const base = district.vulnerability_score
    return Array.from({ length: 12 }, (_, i) =>
      Math.max(0, base + Math.sin(i * 0.8) * 15 + (Math.random() - 0.5) * 10),
    )
  }, [district.vulnerability_score])

  const color = RISK_COLOR[district.risk_level]
  const W = 60
  const H = 20
  const max = Math.max(10, ...sparkData)
  const pts = sparkData.map((v, i) => `${(i / (sparkData.length - 1)) * W},${H - (v / max) * H}`).join(' ')

  return (
    <button
      className={`small-multiple ${selected ? 'small-multiple--selected' : ''}`}
      onClick={onClick}
    >
      <div className="small-multiple-header">
        <span className="small-multiple-name">{district.name_en.replace(/([A-Z])/g, ' $1').trim()}</span>
        <span className="small-multiple-dot" style={{ color }}>●</span>
      </div>
      <div className="small-multiple-body">
        <span className="small-multiple-value">{district.complaint_count}</span>
        <svg className="small-multiple-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" opacity="0.7" />
        </svg>
      </div>
      <div className="small-multiple-meta">
        Vuln: {district.vulnerability_score}
      </div>
    </button>
  )
}

function CityMini({ city, color }: { city: CityConfig; color: string }) {
  return (
    <button className="small-multiple">
      <div className="small-multiple-header">
        <span className="small-multiple-name">{city.hudClockLabel}</span>
        <span className="small-multiple-dot" style={{ color }}>●</span>
      </div>
      <div className="small-multiple-body">
        <span className="small-multiple-value">{city.populationMillions ? city.populationMillions.toFixed(1) + 'M' : '—'}</span>
      </div>
    </button>
  )
}

export function SmallMultiplesGrid({ activeCity }: SmallMultiplesGridProps) {
  const { districts } = useDistrictData()
  const selectedDistrictId = useSelectionStore((s) => s.selectedDistrictId)
  const setSelectedDistrictId = useSelectionStore((s) => s.setSelectedDistrictId)
  const allCities = useCityStore((s) => s.allCities())
  const compareSet = useCityStore((s) => s.compareSet)

  const isBkk = activeCity.id === 'bangkok'

  if (isBkk) {
    return (
      <div className="small-multiples-grid">
        <div className="small-multiples-header">
          <span className="small-multiples-title">50 DISTRICTS</span>
          <span className="small-multiples-sub">Click to select · Scroll to scan</span>
        </div>
        <div className="small-multiples-list">
          {districts.map((d) => (
            <DistrictMini
              key={d.name_th}
              district={d}
              selected={selectedDistrictId === d.name_th}
              onClick={() => setSelectedDistrictId(selectedDistrictId === d.name_th ? null : d.name_th)}
            />
          ))}
        </div>
      </div>
    )
  }

  // Non-Bangkok: show compare-set cities
  const cities = compareSet.length >= 2
    ? allCities.filter((c) => compareSet.includes(c.id))
    : allCities.slice(0, 5)

  return (
    <div className="small-multiples-grid">
      <div className="small-multiples-header">
        <span className="small-multiples-title">HUB CITIES</span>
      </div>
      <div className="small-multiples-list">
        {cities.map((c, i) => (
          <CityMini key={c.id} city={c} color={CITY_COLORS[i % CITY_COLORS.length]} />
        ))}
      </div>
    </div>
  )
}

const CITY_COLORS = ['#f59e0b', '#58a6ff', '#e53935', '#8bc34a', '#fdd835']
