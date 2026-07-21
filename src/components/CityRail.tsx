import { useEffect, useState, useMemo } from 'react'
import type { CityConfig } from '../config/cities'
import { CITIES, groupCitiesByRegion } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import { useSelectionStore } from '../store/selectionStore'
import { KpiCard } from './KpiCard'
import { VitalsBar } from './VitalsBar'
import { bangkokPm25Live, type Pm25Live } from '../data/gistda'
import { bangkokAQI, type BangkokAQI } from '../data/openmeteo-aq'
import { PM25_COLORS, AQI_COLORS } from '../config/bangkok-layers'
import { useDistrictData, type DistrictSummary } from '../hooks/useDistrictData'
import { RISK_COLOR } from '../lib/risk'
import { prefetchCity } from '../lib/city-prefetch'
import { STRESS_COLOR, type StressMap } from '../hooks/useCityStress'
import { cityHasTwin } from './CityIntelligence'

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
  const selectedDistrictId = useSelectionStore((s) => s.selectedDistrictId)
  const setSelectedDistrictId = useSelectionStore((s) => s.setSelectedDistrictId)
  const districtComparePair = useSelectionStore((s) => s.districtComparePair)
  const setDistrictComparePair = useSelectionStore((s) => s.setDistrictComparePair)
  if (loading) return <div className="leaderboard-loading">LOADING…</div>
  return (
    <div className="leaderboard">
      {districts.slice(0, 10).map((d, i) => (
        <button
          key={d.name_th}
          className={`leaderboard-row ${selected?.name_th === d.name_th || selectedDistrictId === d.name_th ? 'active' : ''}`}
          onClick={(e) => {
            if (e.shiftKey) {
              // Shift-click: add to compare pair
              const current = districtComparePair
              if (!current) {
                if (selectedDistrictId) {
                  setDistrictComparePair([selectedDistrictId, d.name_th])
                } else {
                  setSelectedDistrictId(d.name_th)
                  onSelect(d)
                }
              } else if (current[0] === d.name_th || current[1] === d.name_th) {
                setDistrictComparePair(null)
                setSelectedDistrictId(d.name_th)
              } else {
                setDistrictComparePair([current[1], d.name_th])
              }
            } else {
              setSelectedDistrictId(d.name_th)
              setDistrictComparePair(null)
              onSelect(d)
            }
          }}
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
  const groups = groupCitiesByRegion(cities)

  return (
    <div className="city-list">
      {groups.map((g) => (
        <div key={g.region} className="city-region-group">
          <div className="city-region-label">{g.region.toUpperCase()}</div>
          {g.cities.map((city) => (
            <button
              key={city.id}
              className={`city-item ${city.id === activeCity.id ? 'active' : ''}`}
              onClick={() => {
                onSelect(city)
                onClose?.()
              }}
            >
              <span className="city-item-code">{city.hudClockLabel}</span>
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
  onAddCity,
  open,
  onOpenChange,
}: {
  activeCity: CityConfig
  onSelect: (city: CityConfig) => void
  onAddCity: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])
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
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => onOpenChange(false)} />
          <div className="sheet">
            <div className="sheet-header">
              <span className="sheet-title">Select City</span>
              <button className="sheet-close" onClick={() => onOpenChange(false)}>
                ✕
              </button>
            </div>
            <CityList
              activeCity={activeCity}
              onSelect={onSelect}
              onClose={() => onOpenChange(false)}
              cities={allCities}
            />
            <button
              className="sheet-add-city"
              onClick={() => {
                onOpenChange(false)
                onAddCity()
              }}
            >
              SEARCH ANY CITY
            </button>
          </div>
        </>
      )}

      <div
        className="bottom-strip"
        role="button"
        tabIndex={0}
        aria-label="Open city selector"
        onClick={() => onOpenChange(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenChange(true)
          }
        }}
      >
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

// Desktop topbar — region-grouped city dropdown (replaces flat tab strip)
export function TopbarCityDropdown({
  activeCity,
  cities,
  onSelect,
  compareSet,
  onTogglePin,
  onAddCity,
  cityStress,
}: {
  activeCity: CityConfig
  cities: CityConfig[]
  onSelect: (city: CityConfig) => void
  compareSet: string[]
  onTogglePin: (id: string) => void
  onAddCity: () => void
  cityStress: StressMap
}) {
  const [open, setOpen] = useState(false)
  const groups = groupCitiesByRegion(cities)
  const stress = cityStress[activeCity.id]

  return (
    <nav className="topbar-city-wrap topbar-tabs" aria-label="Switch city">
      <button
        type="button"
        className={`topbar-city-select-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={`${activeCity.name} — switch city`}
      >
        <span className="topbar-city-select-code">{activeCity.hudClockLabel}</span>
        <span className="topbar-city-select-name">{activeCity.name}</span>
        {stress && (
          <span
            className={`topbar-tab-stress topbar-tab-stress--${stress.level}`}
            style={{ color: STRESS_COLOR[stress.level] }}
            title={`City stress: ${stress.score}/100 · ${stress.level.toUpperCase()}`}
          >
            {stress.score}
          </span>
        )}
        <span className="chevron" aria-hidden>▾</span>
      </button>
      {open && (
        <>
          <div className="basemap-menu-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <ul className="topbar-city-menu basemap-menu" role="listbox" aria-label="Cities by region">
            {groups.map((g) => (
              <li key={g.region} role="presentation">
                <div className="basemap-menu-group">{g.region.toUpperCase()}</div>
                <ul className="basemap-menu-sublist" role="group" aria-label={g.region}>
                  {g.cities.map((city) => {
                    const pinned = compareSet.includes(city.id)
                    const active = city.id === activeCity.id
                    const cs = cityStress[city.id]
                    const hasTwin = cityHasTwin(city.id)
                    return (
                      <li key={city.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`basemap-menu-item topbar-city-menu-item ${active ? 'basemap-menu-item--active' : ''}`}
                          onClick={() => {
                            onSelect(city)
                            setOpen(false)
                          }}
                          onMouseEnter={() => prefetchCity(city)}
                          onFocus={() => prefetchCity(city)}
                        >
                          <span
                            className="basemap-menu-dot"
                            style={{ background: active ? 'var(--amber)' : 'transparent' }}
                            aria-hidden
                          />
                          <span className="topbar-city-menu-code">{city.hudClockLabel}</span>
                          <span className="basemap-menu-label">{city.name}</span>
                          {hasTwin && (
                            <span
                              className="topbar-city-menu-twin"
                              title={`${city.name} has a full digital twin — economic, civic, digital brief`}
                              aria-label={`${city.name} has a digital twin`}
                            >
                              TWIN
                            </span>
                          )}
                          {cs && (
                            <span
                              className={`topbar-tab-stress topbar-tab-stress--${cs.level}`}
                              style={{ color: STRESS_COLOR[cs.level] }}
                            >
                              {cs.score}
                            </span>
                          )}
                          <span
                            className={`topbar-city-menu-pin ${pinned ? 'topbar-city-menu-pin--on' : ''}`}
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation()
                              onTogglePin(city.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation()
                                e.preventDefault()
                                onTogglePin(city.id)
                              }
                            }}
                            title={pinned ? 'Unpin from comparison' : 'Pin for comparison'}
                            aria-label={pinned ? `Unpin ${city.name}` : `Pin ${city.name} for comparison`}
                          >
                            {pinned ? 'PIN' : '·'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
            <li role="presentation" className="topbar-city-menu-footer">
              <button
                type="button"
                className="topbar-city-menu-add"
                onClick={() => {
                  setOpen(false)
                  onAddCity()
                }}
              >
                SEARCH ANY CITY
              </button>
            </li>
          </ul>
        </>
      )}
    </nav>
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
