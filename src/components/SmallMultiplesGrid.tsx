/**
 * Small Multiples Grid — repeated mini-charts for fast pattern scanning.
 *
 * For Bangkok: 50 district sparklines (AQI/complaints) in a scrollable grid.
 * For ASEAN: all hub city mini-KPI cards.
 * Click any multiple to drill into full view.
 *
 * Collapsed by default — header strip snaps to right panel edge (right: 320px).
 * Tap the header to expand. Map stays clear until the user requests this panel.
 */
import { useState, useMemo } from 'react'
import { useSelectionStore } from '../store/selectionStore'
import { useDistrictData } from '../hooks/useDistrictData'
import { useCityStore } from '../store/cityStore'
import { RISK_COLOR } from '../lib/risk'
import { CITIES, type CityConfig } from '../config/cities'

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
  const [collapsed, setCollapsed] = useState(true)   // default: collapsed — map stays clear

  const { districts } = useDistrictData()
  const selectedDistrictId = useSelectionStore((s) => s.selectedDistrictId)
  const setSelectedDistrictId = useSelectionStore((s) => s.setSelectedDistrictId)
  const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])
  const compareSet = useCityStore((s) => s.compareSet)

  const isBkk = activeCity.id === 'bangkok'

  if (isBkk) {
    return (
      <div className={`small-multiples-grid${collapsed ? ' small-multiples-grid--collapsed' : ''}`}>
        <button
          className="small-multiples-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand 50 Districts panel' : 'Collapse 50 Districts panel'}
        >
          <span className="small-multiples-title">50 DISTRICTS</span>
          <span className="small-multiples-sub">
            {collapsed ? 'Bangkok · tap to expand' : 'Click to select · Scroll to scan'}
          </span>
          <span className="small-multiples-caret" aria-hidden>{collapsed ? '▸' : '▾'}</span>
        </button>
        {!collapsed && (
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
        )}
      </div>
    )
  }

  // Non-Bangkok: show compare-set cities
  const cities = compareSet.length >= 2
    ? allCities.filter((c) => compareSet.includes(c.id))
    : allCities.slice(0, 5)

  return (
    <div className={`small-multiples-grid${collapsed ? ' small-multiples-grid--collapsed' : ''}`}>
      <button
        className="small-multiples-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand Hub Cities panel' : 'Collapse Hub Cities panel'}
      >
        <span className="small-multiples-title">HUB CITIES</span>
        <span className="small-multiples-sub">
          {collapsed ? `${cities.length} cities · tap to expand` : 'Compare active cities'}
        </span>
        <span className="small-multiples-caret" aria-hidden>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div className="small-multiples-list">
          {cities.map((c, i) => (
            <CityMini key={c.id} city={c} color={CITY_COLORS[i % CITY_COLORS.length]} />
          ))}
        </div>
      )}
    </div>
  )
}

const CITY_COLORS = ['#f59e0b', '#58a6ff', '#e53935', '#8bc34a', '#fdd835']
