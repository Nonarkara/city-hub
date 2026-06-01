import { useEffect, useState, useMemo } from 'react'
import type { CityConfig } from '../config/cities'
import { CITIES } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { useSelectionStore } from '../store/selectionStore'
import { KpiCard } from './KpiCard'
import { VitalsBar } from './VitalsBar'
import { bangkokPm25Live, type Pm25Live } from '../data/gistda'
import { bangkokAQI, type BangkokAQI } from '../data/openmeteo-aq'
import { PM25_COLORS, AQI_COLORS } from '../config/bangkok-layers'
import { useDistrictData, type DistrictSummary } from '../hooks/useDistrictData'
import { RISK_COLOR } from '../lib/risk'

// CamelCase name_en → spaced (e.g. "BangKapi" → "Bang Kapi")
function formatDistrictName(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim()
}

function DistrictLeaderboard({
  onSelect,
  selected,
}: {
  onSelect: (d: DistrictSummary) => void
  selected: DistrictSummary | null
}) {
  const { districts, loading } = useDistrictData()
  if (loading) return <div className="leaderboard-loading">LOADING…</div>
  return (
    <div className="leaderboard">
      {districts.slice(0, 10).map((d, i) => (
        <button
          key={d.name_th}
          className={`leaderboard-row ${selected?.name_th === d.name_th ? 'active' : ''}`}
          onClick={() => onSelect(d)}
        >
          <span className="leaderboard-rank">{i + 1}</span>
          <span className="leaderboard-name">{formatDistrictName(d.name_en)}</span>
          <span className="leaderboard-dot" style={{ color: RISK_COLOR[d.risk_level] }}>●</span>
          <span className="leaderboard-count">{d.complaint_count}</span>
        </button>
      ))}
    </div>
  )
}

const FLAG: Record<string, string> = {
  TH: 'TH',
  MY: 'MY',
  SG: 'SG',
  ID: 'ID',
}

interface CityRailProps {
  activeCity: CityConfig
  onDistrictSelect?: (d: DistrictSummary) => void
  selectedDistrict?: DistrictSummary | null
}

function CityList({
  activeCity,
  onSelect,
  onClose,
  cities,
}: {
  activeCity: CityConfig
  onSelect: (city: CityConfig) => void
  onClose?: () => void
  cities: CityConfig[]
}) {
  return (
    <div className="city-list">
      {cities.map((city) => (
        <button
          key={city.id}
          className={`city-item ${city.id === activeCity.id ? 'active' : ''}`}
          onClick={() => {
            onSelect(city)
            onClose?.()
          }}
        >
          <span className="city-item-name">
            {city.name}
            {city.nameLocal && (
              <span className="city-item-local" data-lang="th">
                {city.nameLocal}
              </span>
            )}
          </span>
          <span className="city-flag">{FLAG[city.country] ?? city.country}</span>
        </button>
      ))}
    </div>
  )
}

// Desktop left rail
export function CityRail({ activeCity, onDistrictSelect, selectedDistrict }: CityRailProps) {
  const isBkk = activeCity.id === 'bangkok'
  return (
    <aside className="rail">
      <div className="rail-active-city">
        <span className="rail-active-name">{activeCity.name}</span>
        {activeCity.nameLocal && (
          <span className="rail-active-local" lang="th">{activeCity.nameLocal}</span>
        )}
        <span className="rail-active-country">{activeCity.country}</span>
      </div>

      <div className="rail-rule" aria-hidden />

      <VitalsBar activeCity={activeCity} />

      {!isBkk && (
        <div className="kpi-grid">
          {activeCity.kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      )}

      {isBkk && onDistrictSelect && (
        <>
          <div className="rail-rule" aria-hidden />
          <DistrictLeaderboard onSelect={onDistrictSelect} selected={selectedDistrict ?? null} />
        </>
      )}

      <div className="rail-credit">
        <span lang="th" className="rail-credit-aphorism">ทุกอย่างเกิดขึ้นเพราะมีเหตุ</span>
        <span className="rail-credit-name">Non Arkaraprasertkul</span>
        <span className="rail-credit-org">DEPA Thailand</span>
      </div>
    </aside>
  )
}

// Mobile bottom strip + bottom sheet
export function MobileStrip({
  activeCity,
  onSelect,
}: {
  activeCity: CityConfig
  onSelect: (city: CityConfig) => void
}) {
  const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pm25, setPm25] = useState<Pm25Live | null>(null)
  const [aqi, setAqi] = useState<BangkokAQI | null>(null)
  const isBkk = activeCity.id === 'bangkok'

  useEffect(() => {
    if (!isBkk) return
    let cancelled = false
    const load = () => {
      bangkokPm25Live().then((d) => { if (!cancelled) setPm25(d) }).catch(() => {})
      bangkokAQI().then((d) => { if (!cancelled) setAqi(d) }).catch(() => {})
    }
    load()
    const t = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [isBkk])

  const airColor = aqi ? AQI_COLORS[aqi.level] : (pm25 ? PM25_COLORS[pm25.level] : undefined)

  return (
    <>
      {sheetOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setSheetOpen(false)} />
          <div className="sheet">
            <div className="sheet-header">
              <span className="sheet-title">Select City</span>
              <button className="sheet-close" onClick={() => setSheetOpen(false)}>
                ✕
              </button>
            </div>
            <CityList
              activeCity={activeCity}
              onSelect={onSelect}
              onClose={() => setSheetOpen(false)}
              cities={allCities}
            />
          </div>
        </>
      )}

      <div className="bottom-strip">
        {isBkk ? (
          <>
            <div className="strip-kpi">
              <span className="strip-label">{aqi ? 'AQI · LIVE' : 'PM2.5 · LIVE'}</span>
              <span className="strip-value" style={{ color: airColor }}>
                {aqi ? aqi.usAqi : (pm25 ? pm25.pm25.toFixed(1) : '…')}
                <span className="strip-unit">{aqi ? 'US AQI' : 'µg/m³'}</span>
              </span>
            </div>
            <div className="strip-kpi">
              <span className="strip-label">LEVEL</span>
              <span className="strip-value" style={{ color: airColor }}>
                {aqi ? aqi.level.toUpperCase() : (pm25 ? pm25.level.toUpperCase() : '—')}
              </span>
            </div>
            <div className="strip-kpi">
              <span className="strip-label">{aqi ? 'PM2.5' : '24H MAX'}</span>
              <span className="strip-value">
                {aqi ? aqi.pm25 : (pm25 ? pm25.max24h.toFixed(0) : '—')}
              </span>
            </div>
          </>
        ) : (
          activeCity.kpis.slice(0, 3).map((kpi) => (
            <div key={kpi.label} className="strip-kpi">
              <span className="strip-label">{kpi.label}</span>
              <span className="strip-value">
                {kpi.value}
                {kpi.unit && <span className="strip-unit">{kpi.unit}</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// Topbar city button (mobile)
export function TopbarCityButton({
  city,
  open,
  onClick,
}: {
  city: CityConfig
  open: boolean
  onClick: () => void
}) {
  return (
    <button className={`topbar-city-btn ${open ? 'open' : ''}`} onClick={onClick}>
      {city.name}
      <span className="chevron">▾</span>
    </button>
  )
}
