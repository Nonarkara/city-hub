import { useState, useCallback, useMemo } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { CITIES, type CityConfig, type BasemapId } from './config/cities'
import { BANGKOK_LAYERS } from './config/bangkok-layers'
import { MapView, defaultBasemap, getBasemapDef, BASEMAPS, hasMapboxToken } from './components/MapView'
import { CityRail, MobileStrip, TopbarCityButton } from './components/CityRail'
import { LayerRail } from './components/LayerRail'
import { DataFeedPanel } from './components/DataFeedPanel'
import { AlertPanel, DraftModal } from './components/AlertPanel'
import { LiteCityPanel } from './components/LiteCityPanel'
import { DistrictPanel } from './components/DistrictPanel'
import { HUD } from './components/HUD'
import { CommandPalette } from './components/CommandPalette'
import { FreshnessPanel } from './components/FreshnessPanel'
import { TimeScrubber } from './components/TimeScrubber'
import { AnomalyPins } from './components/AnomalyPins'
import { useAnomalies } from './hooks/useAnomalies'
import { ASEANStrip } from './components/ASEANStrip'
import { useBangkokLayers } from './components/map-layers/use-bangkok-layers'
import { type DistrictSummary } from './hooks/useDistrictData'
import { InsightPanel, type InsightTemplate } from './components/InsightPanel'
import { CityFactsCard } from './components/CityFactsCard'
import { ActiveInsightBanner } from './components/ActiveInsightBanner'
import { prefetchCity } from './lib/city-prefetch'

const DEFAULT_ACTIVE_LAYERS = new Set(
  BANGKOK_LAYERS.filter((l) => l.defaultOn && l.status === 'live').map((l) => l.id),
)

export default function App() {
  const [activeCity, setActiveCity] = useState<CityConfig>(CITIES[0])
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [activeLayers, setActiveLayers] = useState<Set<string>>(DEFAULT_ACTIVE_LAYERS)
  const [governorMode, setGovernorMode] = useState(true)
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictSummary | null>(null)
  const [appDraft, setAppDraft] = useState<string | null>(null)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [basemap, setBasemap] = useState<BasemapId>(defaultBasemap())
  const [basemapMenuOpen, setBasemapMenuOpen] = useState(false)
  const [insightOpen, setInsightOpen] = useState(false)
  const [activeInsight, setActiveInsight] = useState<InsightTemplate | null>(null)

  // Apply an insight template — activate its layers, optional basemap + zoom,
  // switch to analyst mode so the map is uncovered.
  //
  // Sequence the side effects so they don't race:
  //  - immediately: switch mode + basemap (basemap triggers map.setStyle)
  //  - +800ms (after setStyle + style.load + reconcile): set the layer stack
  //  - +1050ms: flyTo the right zoom
  // Less elegant than promises but robust against React batching variance.
  const applyInsight = useCallback((t: InsightTemplate) => {
    setGovernorMode(false)
    setActiveInsight(t)
    if (t.basemap && t.basemap !== basemap) {
      setBasemap(t.basemap)
    }
    setTimeout(() => {
      setActiveLayers(new Set(t.layers))
      if (t.zoom && map) {
        setTimeout(() => {
          map.flyTo({
            center: activeCity.center,
            zoom: t.zoom!,
            duration: 1600,
            essential: true,
          })
        }, 250)
      }
    }, 800)
  }, [map, activeCity, basemap])

  // Reset back to defaults — turn off the active insight, restore default layers + basemap.
  const clearInsight = useCallback(() => {
    setActiveInsight(null)
    setActiveLayers(DEFAULT_ACTIVE_LAYERS)
    setBasemap(defaultBasemap())
    setGovernorMode(true)
  }, [])

  if (typeof window !== 'undefined') {
    (window as unknown as { __openCmdK?: () => void }).__openCmdK = () => setCmdkOpen(true)
  }

  const bangkokMode = activeCity.tier === 'full'

  useBangkokLayers(map, activeLayers, bangkokMode, bangkokMode ? setSelectedDistrict : undefined)

  const anomalies = useAnomalies(bangkokMode)

  const toggleLayer = useCallback((id: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const cityHandler = useMemo(() => (c: CityConfig) => {
    setActiveCity(c)
    setSelectedDistrict(null)
  }, [])

  const tokenAvailable = hasMapboxToken()

  return (
    <>
      <MapView city={activeCity} basemap={basemap} onMapReady={setMap} />

      <HUD
        map={map}
        activeCity={activeCity}
        activeLayerCount={bangkokMode ? activeLayers.size : 0}
        sourceCount={bangkokMode ? 7 : 3}
      />

      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        activeLayers={activeLayers}
        onToggleLayer={toggleLayer}
        onSelectDistrict={(d) => setSelectedDistrict(d)}
        governorMode={governorMode}
        onSetGovernorMode={setGovernorMode}
      />

      {bangkokMode && <FreshnessPanel />}
      <TimeScrubber visible={bangkokMode && governorMode && !selectedDistrict} />
      {bangkokMode && governorMode && (
        <AnomalyPins map={map} anomalies={anomalies} cityCenter={activeCity.center} />
      )}
      {bangkokMode && <ASEANStrip />}

      {appDraft && <DraftModal draft={appDraft} onClose={() => setAppDraft(null)} />}

      <CityFactsCard activeCity={activeCity} />

      <ActiveInsightBanner active={activeInsight} activeCity={activeCity} onClear={clearInsight} />

      <header className="topbar">
        <span className="topbar-wordmark" title="DR NON'S CITY HUB">
          CITY HUB<span className="topbar-version">v5</span>
        </span>

        {/* Desktop tab strip — 5 mono codes */}
        <nav className="topbar-tabs" aria-label="Switch city">
          {CITIES.map((city) => (
            <button
              key={city.id}
              className={`topbar-tab ${city.id === activeCity.id ? 'topbar-tab--active' : ''}`}
              onClick={() => cityHandler(city)}
              onMouseEnter={() => prefetchCity(city)}
              onFocus={() => prefetchCity(city)}
              title={city.name}
            >
              {city.hudClockLabel}
            </button>
          ))}
        </nav>

        {/* Mobile dropdown button (keeps existing sheet behaviour) */}
        <div className="md-hidden">
          <TopbarCityButton
            city={activeCity}
            open={mobileSheetOpen}
            onClick={() => setMobileSheetOpen((v) => !v)}
          />
        </div>

        {bangkokMode && (
          <button
            className="topbar-mode-btn"
            onClick={() => setGovernorMode((v) => !v)}
            title={governorMode ? 'Switch to analyst layer view' : 'Switch to governor briefing'}
          >
            · {governorMode ? 'SIT ROOM' : 'ANALYST'}
          </button>
        )}

        <div className="topbar-spacer" />

        {/* Basemap menu */}
        <div className="basemap-wrap">
          <button
            className="topbar-basemap-btn"
            onClick={() => setBasemapMenuOpen((v) => !v)}
            title="Switch basemap"
            aria-label="Switch basemap"
            aria-expanded={basemapMenuOpen}
          >
            <span className="topbar-basemap-icon" aria-hidden>◐</span>
            <span className="topbar-basemap-label">{getBasemapDef(basemap).label.toUpperCase()}</span>
          </button>
          {basemapMenuOpen && (
            <>
              <div className="basemap-menu-backdrop" onClick={() => setBasemapMenuOpen(false)} aria-hidden />
              <ul className="basemap-menu" role="menu">
                {BASEMAPS.map((id) => {
                  const def = getBasemapDef(id)
                  const disabled = def.requiresToken && !tokenAvailable
                  return (
                    <li key={id} role="none">
                      <button
                        role="menuitem"
                        className={`basemap-menu-item ${basemap === id ? 'basemap-menu-item--active' : ''} ${disabled ? 'basemap-menu-item--disabled' : ''}`}
                        disabled={disabled}
                        title={disabled ? 'Requires Mapbox token' : def.label}
                        onClick={() => {
                          if (disabled) return
                          setBasemap(id)
                          setBasemapMenuOpen(false)
                        }}
                      >
                        <span className="basemap-menu-dot" style={{ background: basemap === id ? 'var(--amber)' : 'transparent' }} aria-hidden />
                        <span className="basemap-menu-label">{def.label}</span>
                        {disabled && <span className="basemap-menu-lock" aria-hidden>·</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        {/* INSIGHT — the pattern-revealing button */}
        <button
          className="topbar-insight-btn"
          onClick={() => setInsightOpen(true)}
          title="Open insight templates — pre-configured layer stacks"
          aria-label="Open insights"
        >
          <span className="topbar-insight-icon" aria-hidden>◇</span>
          <span className="topbar-insight-label">INSIGHT</span>
        </button>

        <button
          className="topbar-cmdk"
          onClick={() => setCmdkOpen(true)}
          title="Search · Cmd+K"
          aria-label="Open command palette"
        >
          <span className="topbar-cmdk-icon">⌕</span>
          <span className="topbar-cmdk-key">⌘K</span>
        </button>
      </header>

      <InsightPanel
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        activeCity={activeCity}
        onApply={applyInsight}
      />

      <CityRail
        activeCity={activeCity}
        onDistrictSelect={bangkokMode ? setSelectedDistrict : undefined}
        selectedDistrict={selectedDistrict}
      />

      <MobileStrip
        activeCity={activeCity}
        onSelect={(city) => {
          setActiveCity(city)
          setSelectedDistrict(null)
          setMobileSheetOpen(false)
        }}
      />

      {bangkokMode ? (
        governorMode
          ? (selectedDistrict
              ? (
                <DistrictPanel
                  district={selectedDistrict}
                  onClose={() => setSelectedDistrict(null)}
                  onDraft={setAppDraft}
                />
              )
              : <AlertPanel />
            )
          : (
            <>
              <LayerRail activeIds={activeLayers} onToggle={toggleLayer} />
              <DataFeedPanel />
            </>
          )
      ) : (
        <LiteCityPanel activeCity={activeCity} />
      )}
    </>
  )
}
