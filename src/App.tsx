import { useState, useCallback, useMemo, lazy, Suspense } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { CityConfig } from './config/cities'
import { CITIES } from './config/cities'

import { MapView, defaultBasemap, getBasemapDef, BASEMAP_GROUPS, isTemporalBasemap, hasMapboxToken } from './components/MapView'
import { CityRail, MobileStrip, TopbarCityButton } from './components/CityRail'
import { LayerRail } from './components/LayerRail'
import { DataFeedPanel } from './components/DataFeedPanel'
import { AlertPanel, DraftModal } from './components/AlertPanel'
import { LiteCityPanel } from './components/LiteCityPanel'
const DistrictPanel = lazy(() => import('./components/DistrictPanel').then((m) => ({ default: m.DistrictPanel })))
import { HUD } from './components/HUD'
import { CommandPalette } from './components/CommandPalette'
import { FreshnessPanel } from './components/FreshnessPanel'
import { TimeScrubber } from './components/TimeScrubber'
import { TimelineSlider } from './components/TimelineSlider'
import { AnomalyPins } from './components/AnomalyPins'
import { useAnomalies } from './hooks/useAnomalies'
import { ASEANStrip } from './components/ASEANStrip'
import { useBangkokLayers } from './components/map-layers/use-bangkok-layers'
import { useGlobalOverlays } from './components/map-layers/use-global-overlays'
import { InsightPanel, type InsightTemplate } from './components/InsightPanel'
import { CityFactsCard } from './components/CityFactsCard'
import { ActiveInsightBanner } from './components/ActiveInsightBanner'
import { prefetchCity } from './lib/city-prefetch'
import { useCityStore } from './store/cityStore'
import { useLayerStore } from './store/layerStore'
import { useUIStore } from './store/uiStore'
import { useSelectionStore } from './store/selectionStore'
import { trackEvent } from './lib/firebase'
import { ActionCenter } from './components/ActionCenter'
import { ShareButton } from './components/ShareButton'
import { useShareableView } from './hooks/useShareableView'
import { AboutModal } from './components/AboutModal'
import { NewsTicker } from './components/NewsTicker'
import { useCityRisk } from './hooks/useCityRisk'
import { useCityStress, STRESS_COLOR } from './hooks/useCityStress'
// RISK_COLOR removed (replaced by STRESS_COLOR)
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { CounterpartStrip } from './components/CounterpartStrip'
import { MultiCityChart } from './components/MultiCityChart'
import { SmallMultiplesGrid } from './components/SmallMultiplesGrid'
import { DistrictComparePanel } from './components/DistrictComparePanel'
import { ToastSystem } from './components/ToastSystem'
import { SettingsPanel } from './components/SettingsPanel'
import { useToastStore } from './store/toastStore'
import { useEscalationAlerts } from './hooks/useEscalationAlerts'
import { SituationBrief } from './components/SituationBrief'
import { CopernicusAlert } from './components/CopernicusAlert'
import { DataSourceStatus, DataStatusChip } from './components/DataSourceStatus'

const ComparisonPanel = lazy(() => import('./components/ComparisonPanel').then((m) => ({ default: m.ComparisonPanel })))
const CityOnboardingModal = lazy(() => import('./components/CityOnboardingModal').then((m) => ({ default: m.CityOnboardingModal })))
const SplitCompare = lazy(() => import('./components/SplitCompare').then((m) => ({ default: m.SplitCompare })))
const CityChat = lazy(() => import('./components/CityChat').then((m) => ({ default: m.CityChat })))
const ForecastPanel = lazy(() => import('./components/ForecastPanel').then((m) => ({ default: m.ForecastPanel })))

// Real-time global overlays that ride on top of any lens, any city.
const LIVE_OVERLAYS: { id: string; label: string }[] = [
  { id: 'quakes', label: 'Earthquakes · 24h' },
  { id: 'radar',  label: 'Rain Radar' },
]

export default function App() {
  const [map, setMap] = useState<MapLibreMap | null>(null)

  // ── City store ──────────────────────────────────────────────────────────────
  const activeCity = useCityStore((s) => s.activeCity)
  const customCities = useCityStore((s) => s.customCities)
  const allCities = useMemo(() => [...CITIES, ...customCities], [customCities])
  const setActiveCity = useCityStore((s) => s.setActiveCity)
  const compareMode = useCityStore((s) => s.compareMode)
  const compareSet = useCityStore((s) => s.compareSet)
  const toggleCompareCity = useCityStore((s) => s.toggleCompareCity)

  // ── Layer store ─────────────────────────────────────────────────────────────
  const activeLayers = useLayerStore((s) => s.activeLayers)
  const setActiveLayers = useLayerStore((s) => s.setActiveLayers)

  // ── UI store ────────────────────────────────────────────────────────────────
  const governorMode = useUIStore((s) => s.governorMode)
  const setGovernorMode = useUIStore((s) => s.setGovernorMode)
  const toggleGovernorMode = useUIStore((s) => s.toggleGovernorMode)
  const selectedDistrict = useUIStore((s) => s.selectedDistrict)
  const setSelectedDistrict = useUIStore((s) => s.setSelectedDistrict)
  const appDraft = useUIStore((s) => s.appDraft)
  const setAppDraft = useUIStore((s) => s.setAppDraft)
  const cmdkOpen = useUIStore((s) => s.cmdkOpen)
  const setCmdkOpen = useUIStore((s) => s.setCmdkOpen)
  const basemap = useUIStore((s) => s.basemap)
  const setBasemap = useUIStore((s) => s.setBasemap)
  const basemapMenuOpen = useUIStore((s) => s.basemapMenuOpen)
  const setBasemapMenuOpen = useUIStore((s) => s.setBasemapMenuOpen)
  const insightOpen = useUIStore((s) => s.insightOpen)
  const setInsightOpen = useUIStore((s) => s.setInsightOpen)
  const activeInsight = useUIStore((s) => s.activeInsight)
  const setActiveInsight = useUIStore((s) => s.setActiveInsight)
  const activeDate = useUIStore((s) => s.activeDate)
  const setActiveDate = useUIStore((s) => s.setActiveDate)
  const mobileSheetOpen = useUIStore((s) => s.mobileSheetOpen)
  const setMobileSheetOpen = useUIStore((s) => s.setMobileSheetOpen)
  const splitOpen = useUIStore((s) => s.splitOpen)
  const setSplitOpen = useUIStore((s) => s.setSplitOpen)
  const chatOpen = useUIStore((s) => s.chatOpen)
  const setChatOpen = useUIStore((s) => s.setChatOpen)
  const actionCenterOpen = useUIStore((s) => s.actionCenterOpen)
  const setActionCenterOpen = useUIStore((s) => s.setActionCenterOpen)
  const activeOverlays = useUIStore((s) => s.activeOverlays)
  const toggleOverlay = useUIStore((s) => s.toggleOverlay)
  const globeView = useUIStore((s) => s.globeView)
  const setGlobeView = useUIStore((s) => s.setGlobeView)
  const forecastOpen = useUIStore((s) => s.forecastOpen)
  const setForecastOpen = useUIStore((s) => s.setForecastOpen)
  const setAboutOpen = useUIStore((s) => s.setAboutOpen)

  // ── Onboarding modal ────────────────────────────────────────────────────────
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  // ── Settings panel ──────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ── Insight application ─────────────────────────────────────────────────────
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
  }, [map, activeCity, basemap, setGovernorMode, setActiveInsight, setBasemap, setActiveLayers])

  const clearInsight = useCallback(() => {
    useUIStore.getState().setActiveInsight(null)
    useLayerStore.getState().resetToDefaults()
    useUIStore.getState().setBasemap(defaultBasemap())
    useUIStore.getState().setGovernorMode(true)
  }, [])

  if (typeof window !== 'undefined') {
    (window as unknown as { __openCmdK?: () => void }).__openCmdK = () => setCmdkOpen(true)
  }

  const bangkokMode = activeCity.tier === 'full'
  const selectedDistrictId = useSelectionStore((s) => s.selectedDistrictId)
  const districtComparePair = useSelectionStore((s) => s.districtComparePair)

  useBangkokLayers(map, activeLayers, bangkokMode, activeDate, bangkokMode ? setSelectedDistrict : undefined, selectedDistrictId)

  // Global real-time overlays (earthquakes, radar) — every city, every lens.
  useGlobalOverlays(map, activeOverlays)

  // Mirror the view (city · lens · date · overlays · globe) to the URL so it's
  // shareable, and apply any params from an incoming shared link on load.
  useShareableView()

  const anomalies = useAnomalies(bangkokMode)

  const toggleLayer = useCallback((id: string) => {
    trackEvent('toggle_layer', { layer_id: id })
    useLayerStore.getState().toggleLayer(id)
  }, [])

  const clearSelection = useSelectionStore((s) => s.clearSelection)

  const cityHandler = useMemo(() => (c: CityConfig) => {
    setActiveCity(c)
    setSelectedDistrict(null)
    clearSelection()
  }, [setActiveCity, setSelectedDistrict, clearSelection])

  const tokenAvailable = hasMapboxToken()
  const cityRisk   = useCityRisk()
  const cityStress = useCityStress()
  useEscalationAlerts(cityRisk, allCities)   // fires toasts via toastStore on escalation

  useKeyboardShortcuts({
    allCities, activeCity, setActiveCity,
    globeView, setGlobeView,
    forecastOpen, setForecastOpen,
    splitOpen, setSplitOpen,
    chatOpen, setChatOpen,
    cmdkOpen, setCmdkOpen,
    settingsOpen, setSettingsOpen,
    onRunInsightScan: () => {
      useToastStore.getState().addToast({
        type: 'info',
        title: 'Insight Scan Running',
        message: 'Analyzing all data sources for patterns...',
        duration: 3000,
      })
    },
  })

  // If compare mode is active, show comparison panel instead of city-specific panels
  const showComparison = compareMode && compareSet.length >= 2

  // Time machine — the temporal scrubber is available on ANY city whenever a
  // date-keyed satellite lens (MODIS, aerosol, NDVI, surface-temp, nightlights)
  // is the active basemap. Google shows only today; this scrubs 30 days back.
  const temporalBasemapActive = isTemporalBasemap(basemap)

  return (
    <Suspense fallback={null}>
      <ToastSystem />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      <MapView city={activeCity} basemap={basemap} activeDate={activeDate} globeView={globeView} onMapReady={setMap} />

      {splitOpen && <SplitCompare />}

      {chatOpen && <CityChat activeCity={activeCity} />}

      {forecastOpen && <ForecastPanel activeCity={activeCity} />}

      <NewsTicker activeCity={activeCity} />

      <SituationBrief allCities={allCities} />
      <CopernicusAlert />

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
        allCities={allCities}
        activeCity={activeCity}
        onSelectCity={cityHandler}
        basemap={basemap}
        onSetBasemap={setBasemap}
        globeView={globeView}
        onSetGlobeView={setGlobeView}
        forecastOpen={forecastOpen}
        onSetForecast={setForecastOpen}
        splitOpen={splitOpen}
        onSetSplit={setSplitOpen}
        chatOpen={chatOpen}
        onSetChat={setChatOpen}
      />

      {bangkokMode && <FreshnessPanel />}
      <TimeScrubber visible={bangkokMode && governorMode && !selectedDistrict && !showComparison} />
      <TimelineSlider activeDate={activeDate} onChange={setActiveDate} visible={(temporalBasemapActive || (bangkokMode && governorMode)) && !selectedDistrict && !showComparison} />
      {bangkokMode && governorMode && !showComparison && (
        <AnomalyPins map={map} anomalies={anomalies} cityCenter={activeCity.center} />
      )}
      {bangkokMode && <ASEANStrip />}

      {bangkokMode && <CounterpartStrip activeCity={activeCity} />}

      {bangkokMode && compareMode && (
        <div className="multicity-chart-wrap">
          <MultiCityChart />
        </div>
      )}

      {bangkokMode && !compareMode && (
        <div className="small-multiples-wrap">
          <SmallMultiplesGrid activeCity={activeCity} />
        </div>
      )}

      {appDraft && <DraftModal draft={appDraft} onClose={() => setAppDraft(null)} />}

      <CityFactsCard activeCity={activeCity} />

      <ActiveInsightBanner active={activeInsight} activeCity={activeCity} onClear={clearInsight} />

      <header className="topbar">
        <span className="topbar-wordmark" title="Dr Non's City Hub — Open Civic Intelligence">
          <span className="topbar-wordmark-prefix">DR NON'S</span> CITY HUB<span className="topbar-version">v3.0</span>
        </span>

        <div className="topbar-zone-sep" aria-hidden />

        {/* Desktop tab strip — all cities + pin toggle */}
        <nav className="topbar-tabs" aria-label="Switch city">
          {allCities.map((city) => {
            const pinned = compareSet.includes(city.id)
            return (
              <button
                key={city.id}
                className={`topbar-tab ${city.id === activeCity.id ? 'topbar-tab--active' : ''}`}
                onClick={() => cityHandler(city)}
                onMouseEnter={() => prefetchCity(city)}
                onFocus={() => prefetchCity(city)}
                title={city.name}
                aria-label={`Select city: ${city.name}`}
              >
                <span
                  className="topbar-tab-pin"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleCompareCity(city.id)
                  }}
                  title={pinned ? 'Unpin from comparison' : 'Pin for comparison'}
                >
                  {pinned ? '📌' : '·'}
                </span>
                {city.hudClockLabel}
                {cityStress[city.id] && (
                  <span
                    className={`topbar-tab-stress topbar-tab-stress--${cityStress[city.id].level}`}
                    style={{ color: STRESS_COLOR[cityStress[city.id].level] }}
                    title={`City stress: ${cityStress[city.id].score}/100 · ${cityStress[city.id].level.toUpperCase()}`}
                  >
                    {cityStress[city.id].score}
                  </span>
                )}
              </button>
            )
          })}
          <button
            className="topbar-tab topbar-tab--add"
            onClick={() => setOnboardingOpen(true)}
            title="Add a new city"
            aria-label="Add a new city"
          >
            + ADD
          </button>
        </nav>

        <div className="topbar-spacer" />

        <div className="topbar-right">
          <DataStatusChip onClick={() => setSettingsOpen((v) => !v)} />
          <button
            className="topbar-chat-btn"
            onClick={() => setAboutOpen(true)}
            title="About this dashboard"
            aria-label="About"
          >· ABOUT</button>
        </div>

        {settingsOpen && <DataSourceStatus onClose={() => setSettingsOpen(false)} />}

        {/* Action Center (Governor SitRep) */}
        {actionCenterOpen && (
          <ActionCenter onClose={() => setActionCenterOpen(false)} />
        )}

        {/* About dossier */}
        <AboutModal />

        {/* Mobile dropdown */}
        <div className="md-hidden">
          <TopbarCityButton
            city={activeCity}
            open={mobileSheetOpen}
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
          />
        </div>

        {compareMode && (
          <button
            className="topbar-mode-btn"
            onClick={() => {
              useCityStore.getState().clearCompareSet()
            }}
            title="Exit comparison mode"
            aria-label="Exit comparison mode"
          >
            · COMPARE ({compareSet.length})
          </button>
        )}

        {bangkokMode && !compareMode && (
          <>
            <button
              className="topbar-mode-btn"
              onClick={() => toggleGovernorMode()}
              title={governorMode ? 'Switch to analyst layer view' : 'Switch to governor briefing'}
              aria-label={governorMode ? 'Switch to analyst layer view' : 'Switch to governor briefing'}
            >
              · {governorMode ? 'SIT ROOM' : 'ANALYST'}
            </button>
            <button
              className="topbar-mode-btn topbar-sitrep-btn"
              onClick={() => setActionCenterOpen(!actionCenterOpen)}
              title="Review Global SitRep Actions"
              aria-label="Review Global SitRep Actions"
            >
              · ACTION CENTER
            </button>
          </>
        )}

        <div className="topbar-spacer" />

        {/* Basemap menu */}
        <div className="basemap-wrap">
          <button
            className="topbar-basemap-btn"
            onClick={() => setBasemapMenuOpen(!basemapMenuOpen)}
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
                <li className="basemap-menu-title" role="presentation">SATELLITE STACK</li>
                {BASEMAP_GROUPS.map((group) => (
                  <li key={group.label} role="presentation">
                    <div className="basemap-menu-group">{group.label}</div>
                    <ul className="basemap-menu-sublist" role="group" aria-label={group.label}>
                      {group.ids.map((id) => {
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
                              {def.temporal && <span className="basemap-menu-temporal" title="Scrubbable through time" aria-hidden>⧗</span>}
                              {disabled && <span className="basemap-menu-lock" aria-hidden>·</span>}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}

                {/* LIVE overlays — real-time layers on top of any lens */}
                <li role="presentation">
                  <div className="basemap-menu-group">live</div>
                  <ul className="basemap-menu-sublist" role="group" aria-label="live overlays">
                    {LIVE_OVERLAYS.map((ov) => {
                      const on = activeOverlays.has(ov.id)
                      return (
                        <li key={ov.id} role="none">
                          <button
                            role="menuitemcheckbox"
                            aria-checked={on}
                            className={`basemap-menu-item ${on ? 'basemap-menu-item--active' : ''}`}
                            onClick={() => toggleOverlay(ov.id)}
                          >
                            <span className="basemap-menu-dot" style={{ background: on ? 'var(--amber)' : 'transparent' }} aria-hidden />
                            <span className="basemap-menu-label">{ov.label}</span>
                            {on && <span className="basemap-menu-temporal" aria-hidden>●</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </li>

                {/* VIEW — projection */}
                <li role="presentation">
                  <div className="basemap-menu-group">view</div>
                  <ul className="basemap-menu-sublist" role="group" aria-label="projection">
                    <li role="none">
                      <button
                        role="menuitemcheckbox"
                        aria-checked={globeView}
                        className={`basemap-menu-item ${globeView ? 'basemap-menu-item--active' : ''}`}
                        onClick={() => setGlobeView(!globeView)}
                      >
                        <span className="basemap-menu-dot" style={{ background: globeView ? 'var(--amber)' : 'transparent' }} aria-hidden />
                        <span className="basemap-menu-label">Globe (3D)</span>
                        {globeView && <span className="basemap-menu-temporal" aria-hidden>●</span>}
                      </button>
                    </li>
                  </ul>
                </li>
              </ul>
            </>
          )}
        </div>

        {/* SPLIT — side-by-side satellite compare */}
        <button
          className={`topbar-insight-btn ${splitOpen ? 'topbar-insight-btn--active' : ''}`}
          onClick={() => setSplitOpen(!splitOpen)}
          title="Split-screen compare — any city / lens / date vs any other"
          aria-label="Toggle split-screen compare"
          aria-pressed={splitOpen}
        >
          <span className="topbar-insight-icon" aria-hidden>◫</span>
          <span className="topbar-insight-label">SPLIT</span>
        </button>

        {/* FORECAST — 48h AQI + temp outlook */}
        <button
          className={`topbar-insight-btn ${forecastOpen ? 'topbar-insight-btn--active' : ''}`}
          onClick={() => setForecastOpen(!forecastOpen)}
          title="48-hour air & temperature forecast for this city"
          aria-label="Toggle forecast"
          aria-pressed={forecastOpen}
        >
          <span className="topbar-insight-icon" aria-hidden>◷</span>
          <span className="topbar-insight-label">FORECAST</span>
        </button>

        {/* ASK — local Ollama city chatbot */}
        <button
          className={`topbar-insight-btn ${chatOpen ? 'topbar-insight-btn--active' : ''}`}
          onClick={() => setChatOpen(!chatOpen)}
          title="Ask about the cities — local AI (Ollama)"
          aria-label="Toggle city chatbot"
          aria-pressed={chatOpen}
        >
          <span className="topbar-insight-icon" aria-hidden>✦</span>
          <span className="topbar-insight-label">ASK</span>
        </button>

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

        <ShareButton />

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

      <CityOnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

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

      {showComparison ? (
        <ComparisonPanel />
      ) : bangkokMode ? (
        districtComparePair ? (
          <DistrictComparePanel />
        ) : governorMode
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
    </Suspense>
  )
}
