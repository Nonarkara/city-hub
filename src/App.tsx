import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { CityConfig } from './config/cities'
import { CITIES } from './config/cities'

import { MapView, defaultBasemap, getBasemapDef, BASEMAP_GROUPS, isTemporalBasemap, hasMapboxToken } from './components/MapView'
import { CityRail, MobileStrip, TopbarCityButton, TopbarCityDropdown } from './components/CityRail'
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
import { useCityStress } from './hooks/useCityStress'
import { useCityStore } from './store/cityStore'
import { useLayerStore } from './store/layerStore'
import { useUIStore } from './store/uiStore'
import { useSelectionStore } from './store/selectionStore'
import { trackEvent } from './lib/firebase'
import { ActionCenter } from './components/ActionCenter'
import { ShareButton } from './components/ShareButton'
import { useShareableView } from './hooks/useShareableView'
import { AboutModal } from './components/AboutModal'
import { ResearchPanel } from './components/ResearchPanel'
import { applyWadaPlate, getPlateForCity, getPlate } from './lib/wada-engine'
import { PlanOverlay } from './components/PlanOverlay'
import { lookLabel, PRODUCT_VERSION } from './lib/city-reading'
import { useCityRisk } from './hooks/useCityRisk'
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
import { DisasterAlerts } from './components/DisasterAlerts'
import { SmokeConeOverlay } from './components/SmokeConeOverlay'
import { DataSourceStatus, DataStatusChip } from './components/DataSourceStatus'
import { sourceCountForCity } from './data/source-registry'
import { ErrorBoundary } from './components/ErrorBoundary'
import { cityHasTwin } from './components/CityIntelligence'
import { IntelDrawer } from './components/IntelDrawer'

const ComparisonPanel = lazy(() => import('./components/ComparisonPanel').then((m) => ({ default: m.ComparisonPanel })))
const CityOnboardingModal = lazy(() => import('./components/CityOnboardingModal').then((m) => ({ default: m.CityOnboardingModal })))
const SplitCompare = lazy(() => import('./components/SplitCompare').then((m) => ({ default: m.SplitCompare })))
const CityChat = lazy(() => import('./components/CityChat').then((m) => ({ default: m.CityChat })))
const ForecastPanel = lazy(() => import('./components/ForecastPanel').then((m) => ({ default: m.ForecastPanel })))

// Real-time global overlays that ride on top of any lens, any city.
const LIVE_OVERLAYS: { id: string; label: string }[] = [
  { id: 'quakes', label: 'Earthquakes, last 24 hours' },
  { id: 'radar',  label: 'Rain' },
]

// NASA GIBS rasters — the same reading on every city, not only Bangkok.
const INTEL_OVERLAYS: { id: string; label: string }[] = [
  { id: 'night', label: 'Night lights — where the city is awake' },
  { id: 'heat',  label: 'Surface heat' },
  { id: 'green', label: 'Vegetation' },
  { id: 'haze',  label: 'Haze' },
]

const LOOK_GROUPS: Record<string, string> = {
  imagery: 'Photos of the ground',
  spectral: 'What the sensors measure',
}

function MoreItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li role="none">
      <button type="button" role="menuitem" className="basemap-menu-item" onClick={onClick}>
        <span className="basemap-menu-label">{label}</span>
      </button>
    </li>
  )
}

function CompareLoading() {
  return (
    <div className="split-loading" role="status" aria-live="polite">
      <div className="split-loading-grid" aria-hidden>
        <span />
        <span />
      </div>
      <div className="split-loading-status">PREPARING CITY COMPARISON</div>
    </div>
  )
}

function CompareFailure({ onClose }: { onClose: () => void }) {
  return (
    <div className="split-loading split-loading--error" role="alert">
      <div className="split-loading-status">COMPARISON COULD NOT START</div>
      <button type="button" className="split-toolbar-btn" onClick={onClose}>RETURN TO MAP</button>
    </div>
  )
}

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
  const intelOpen = useUIStore((s) => s.intelOpen)
  const setIntelOpen = useUIStore((s) => s.setIntelOpen)
  const setAboutOpen = useUIStore((s) => s.setAboutOpen)
  const setResearchOpen = useUIStore((s) => s.setResearchOpen)
  const planOpen = useUIStore((s) => s.planOpen)
  const setPlanOpen = useUIStore((s) => s.setPlanOpen)

  // ── Onboarding modal ────────────────────────────────────────────────────────
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // ── Settings panel ──────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen]       = useState(false)
  const [dataStatusOpen, setDataStatusOpen] = useState(false)
  const [smokeVisible, setSmokeVisible]       = useState(false)

  // ── Insight application ─────────────────────────────────────────────────────
  // Pending applyInsight timeouts — cleared on city switch / unmount so a
  // stale flight can't yank the camera back to the previous city.
  const insightTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => {
    insightTimeoutsRef.current.forEach(clearTimeout)
  }, [])
  useEffect(() => {
    insightTimeoutsRef.current.forEach(clearTimeout)
    insightTimeoutsRef.current = []
  }, [activeCity.id])

  const applyInsight = useCallback((t: InsightTemplate) => {
    setGovernorMode(false)
    setActiveInsight(t)
    if (t.basemap && t.basemap !== basemap) {
      setBasemap(t.basemap)
    }
    insightTimeoutsRef.current.forEach(clearTimeout)
    insightTimeoutsRef.current = []
    const outer = setTimeout(() => {
      setActiveLayers(new Set(t.layers))
      if (t.zoom && map) {
        const inner = setTimeout(() => {
          // Read the city at fire time — skip the flight if it changed.
          const current = useCityStore.getState().activeCity
          if (current.id !== activeCity.id) return
          map.flyTo({
            center: current.center,
            zoom: t.zoom!,
            duration: 1600,
            essential: true,
          })
        }, 250)
        insightTimeoutsRef.current.push(inner)
      }
    }, 800)
    insightTimeoutsRef.current.push(outer)
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

  // ── Digital twin affordance ────────────────────────────────────────────────
  // The topbar TWIN button jumps the right-panel scroll to the active city's
  // twin section. The twin section itself sets id="city-twin-<id>" so the
  // jump works regardless of which panel chrome wraps it.
  const activeHasTwin = cityHasTwin(activeCity.id)
  const scrollToTwin = useCallback(() => {
    if (!activeHasTwin) return
    const target = document.getElementById(`city-twin-${activeCity.id}`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeHasTwin, activeCity.id])

  const bangkokMode = activeCity.tier === 'full'
  const selectedDistrictId = useSelectionStore((s) => s.selectedDistrictId)
  const districtComparePair = useSelectionStore((s) => s.districtComparePair)

  useBangkokLayers(map, activeLayers, bangkokMode, activeDate, bangkokMode ? setSelectedDistrict : undefined, selectedDistrictId)

  // Global real-time overlays (earthquakes, radar) — every city, every lens.
  useGlobalOverlays(map, activeOverlays)

  // Mirror the view (city · lens · date · overlays · globe) to the URL so it's
  // shareable, and apply any params from an incoming shared link on load.
  useShareableView()

  // Honor a city's declared basemap (only cities that set one — e.g. Kranj's
  // satellite-over-terrain 3D view). Fires on city switch; other cities keep
  // whatever lens is active, so a manual choice persists across switches.
  useEffect(() => {
    if (activeCity.basemapDefault) setBasemap(activeCity.basemapDefault)
    const cityPlate = getPlateForCity(activeCity.id)
    useUIStore.getState().setActiveWadaPlateId(cityPlate.id)
    applyWadaPlate(cityPlate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCity.id])

  // Synchronize dynamic plate change
  const activeWadaPlateId = useUIStore((s) => s.activeWadaPlateId)
  useEffect(() => {
    applyWadaPlate(getPlate(activeWadaPlateId))
  }, [activeWadaPlateId])

  const anomalies = useAnomalies(bangkokMode && !splitOpen)

  const toggleLayer = useCallback((id: string) => {
    trackEvent('toggle_layer', { layer_id: id })
    useLayerStore.getState().toggleLayer(id)
  }, [])

  const clearSelection = useSelectionStore((s) => s.clearSelection)

  const cityHandler = useMemo(() => (c: CityConfig) => {
    setActiveCity(c)
    setSelectedDistrict(null)
    clearSelection()
    trackEvent('city_view', { city_id: c.id, name: c.name, country: c.country, source: 'picker' })
  }, [setActiveCity, setSelectedDistrict, clearSelection])

  const tokenAvailable = hasMapboxToken()
  const cityRisk   = useCityRisk(!splitOpen)
  const cityStress = useCityStress(!splitOpen)
  const sourceCount = sourceCountForCity(activeCity)
  useEscalationAlerts(cityRisk, allCities)   // fires toasts via toastStore on escalation

  useKeyboardShortcuts({
    allCities, activeCity, setActiveCity,
    globeView, setGlobeView,
    forecastOpen, setForecastOpen,
    intelOpen, setIntelOpen,
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
    <Suspense fallback={<CompareLoading />}>
      <ToastSystem />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {!splitOpen && (
        <MapView city={activeCity} basemap={basemap} activeDate={activeDate} globeView={globeView} onMapReady={setMap} />
      )}

      {splitOpen && (
        <ErrorBoundary fallback={<CompareFailure onClose={() => setSplitOpen(false)} />}>
          <Suspense fallback={<CompareLoading />}>
            <SplitCompare />
          </Suspense>
        </ErrorBoundary>
      )}

      {chatOpen && <ErrorBoundary fallback={null}><Suspense fallback={null}><CityChat activeCity={activeCity} /></Suspense></ErrorBoundary>}

      {forecastOpen && <ErrorBoundary fallback={null}><Suspense fallback={null}><ForecastPanel activeCity={activeCity} /></Suspense></ErrorBoundary>}

      {!splitOpen && <SituationBrief allCities={allCities} />}
      {!splitOpen && <CopernicusAlert />}
      {!splitOpen && <DisasterAlerts />}
      {!splitOpen && bangkokMode && <SmokeConeOverlay map={map} activeCity={activeCity} visible={smokeVisible} />}


      {!splitOpen && (
        <HUD
          map={map}
          activeCity={activeCity}
          activeLayerCount={bangkokMode ? activeLayers.size : 0}
          sourceCount={sourceCount}
        />
      )}

      {!splitOpen && (
        <IntelDrawer
          map={map}
          activeCity={activeCity}
          allCities={allCities}
          open={intelOpen}
          onToggle={() => setIntelOpen(!intelOpen)}
        />
      )}

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

      {!splitOpen && bangkokMode && <FreshnessPanel />}
      <TimeScrubber visible={!splitOpen && bangkokMode && governorMode && !selectedDistrict && !showComparison} />
      <TimelineSlider activeDate={activeDate} onChange={setActiveDate} visible={!splitOpen && temporalBasemapActive && !selectedDistrict && !showComparison} />
      {!splitOpen && bangkokMode && governorMode && !showComparison && (
        <AnomalyPins map={map} anomalies={anomalies} cityCenter={activeCity.center} />
      )}
      {!splitOpen && bangkokMode && <ASEANStrip />}

      {!splitOpen && bangkokMode && <CounterpartStrip activeCity={activeCity} />}

      {!splitOpen && bangkokMode && compareMode && (
        <div className="multicity-chart-wrap">
          <MultiCityChart />
        </div>
      )}

      {!splitOpen && bangkokMode && !compareMode && (
        <div className="small-multiples-wrap">
          <SmallMultiplesGrid activeCity={activeCity} />
        </div>
      )}

      {appDraft && <DraftModal draft={appDraft} onClose={() => setAppDraft(null)} />}

      {!splitOpen && <CityFactsCard activeCity={activeCity} />}

      {!splitOpen && <ActiveInsightBanner active={activeInsight} activeCity={activeCity} onClear={clearInsight} />}

      <header className="topbar">
        <span className="topbar-wordmark" title="Dr Non's City Hub — read the city, not the photo">
          <img className="topbar-brand-mark" src="/brand/city-hub-mark.png" alt="" aria-hidden />
          <span className="topbar-wordmark-prefix">DR NON'S</span> CITY HUB
          <span className="topbar-version">{PRODUCT_VERSION}</span>
        </span>

        <div className="topbar-zone-sep" aria-hidden />

        {/* Desktop city picker — region-grouped dropdown */}
        <TopbarCityDropdown
          activeCity={activeCity}
          cities={allCities}
          onSelect={cityHandler}
          compareSet={compareSet}
          onTogglePin={toggleCompareCity}
          onAddCity={() => setOnboardingOpen(true)}
          cityStress={cityStress}
        />

        <div className="topbar-spacer" />

        {compareMode && (
          <button
            className="topbar-mode-btn"
            onClick={() => { useCityStore.getState().clearCompareSet() }}
            title="Stop comparing these cities"
            aria-label="Stop comparing"
          >
            Comparing {compareSet.length}
          </button>
        )}

        <button
          type="button"
          className={`topbar-split-btn ${splitOpen ? 'topbar-split-btn--active' : ''}`}
          onClick={() => setSplitOpen(!splitOpen)}
          title="Compare cities side by side (S)"
          aria-label={splitOpen ? 'Close compare' : 'Compare cities'}
          aria-pressed={splitOpen}
        >
          <span className="topbar-split-label">Compare</span>
        </button>

        {dataStatusOpen && <DataSourceStatus onClose={() => setDataStatusOpen(false)} />}

        {/* Action Center (Governor SitRep) */}
        {actionCenterOpen && (
          <ActionCenter onClose={() => setActionCenterOpen(false)} />
        )}

        {/* Mobile dropdown */}
        <div className="md-hidden">
          <TopbarCityButton
            city={activeCity}
            open={mobileSheetOpen}
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
          />
        </div>

        {/* Basemap menu */}
        <div className="basemap-wrap">
          <button
            className="topbar-basemap-btn"
            title={`Look — ${getBasemapDef(basemap).label}`}
            aria-label="Choose how you're looking"
            aria-expanded={basemapMenuOpen}
            onClick={() => { setBasemapMenuOpen(!basemapMenuOpen); setMoreOpen(false) }}
          >
            <span className="topbar-basemap-label">Look · {lookLabel(basemap)}</span>
          </button>
          {basemapMenuOpen && (
            <>
              <div className="basemap-menu-backdrop" onClick={() => setBasemapMenuOpen(false)} aria-hidden />
              <ul className="basemap-menu" role="menu">
                <li className="basemap-menu-title" role="presentation">How you’re looking</li>
                {BASEMAP_GROUPS.map((group) => (
                  <li key={group.label} role="presentation">
                    <div className="basemap-menu-group">{LOOK_GROUPS[group.label] ?? group.label}</div>
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

                {/* INTEL rasters — NASA products that work on every city */}
                <li role="presentation">
                  <div className="basemap-menu-group">On any city</div>
                  <ul className="basemap-menu-sublist" role="group" aria-label="intel overlays">
                    {INTEL_OVERLAYS.map((ov) => {
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

                {/* LIVE overlays — real-time layers on top of any lens */}
                <li role="presentation">
                  <div className="basemap-menu-group">Happening now</div>
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
                  <div className="basemap-menu-group">The map itself</div>
                  <ul className="basemap-menu-sublist" role="group" aria-label="projection">
                    <li role="none">
                      <button
                        role="menuitemcheckbox"
                        aria-checked={globeView}
                        className={`basemap-menu-item ${globeView ? 'basemap-menu-item--active' : ''}`}
                        onClick={() => setGlobeView(!globeView)}
                      >
                        <span className="basemap-menu-dot" style={{ background: globeView ? 'var(--amber)' : 'transparent' }} aria-hidden />
                        <span className="basemap-menu-label">Globe</span>
                        {globeView && <span className="basemap-menu-temporal" aria-hidden>●</span>}
                      </button>
                    </li>
                  </ul>
                </li>
              </ul>
            </>
          )}
        </div>

        <button
          type="button"
          className="topbar-mode-btn topbar-research-btn"
          onClick={() => setResearchOpen(true)}
          title="Why this is not a satellite viewer"
        >
          Research
        </button>

        <DataStatusChip onClick={() => setDataStatusOpen((v) => !v)} />

        <div className="basemap-wrap">
          <button
            type="button"
            className="topbar-basemap-btn"
            onClick={() => { setMoreOpen((v) => !v); setBasemapMenuOpen(false) }}
            aria-expanded={moreOpen}
            aria-label="More"
          >
            <span className="topbar-basemap-label">More</span>
          </button>
          {moreOpen && (
            <>
              <div className="basemap-menu-backdrop" onClick={() => setMoreOpen(false)} aria-hidden />
              <ul className="basemap-menu topbar-more-menu" role="menu">
                <li className="basemap-menu-title" role="presentation">More</li>
                <MoreItem label={planOpen ? 'Close the plan' : 'Plan'} onClick={() => { setPlanOpen(!planOpen); setMoreOpen(false) }} />
                <MoreItem label={intelOpen ? 'Close this view' : 'This view'} onClick={() => { setIntelOpen(!intelOpen); setMoreOpen(false) }} />
                <MoreItem label={forecastOpen ? 'Close the next 48 hours' : 'Next 48 hours'} onClick={() => { setForecastOpen(!forecastOpen); setMoreOpen(false) }} />
                <MoreItem label={chatOpen ? 'Close ask' : 'Ask'} onClick={() => { setChatOpen(!chatOpen); setMoreOpen(false) }} />
                <MoreItem label="Patterns" onClick={() => { setInsightOpen(true); setMoreOpen(false) }} />
                {bangkokMode && (
                  <MoreItem label={smokeVisible ? 'Hide smoke' : 'Smoke from fires'} onClick={() => { setSmokeVisible((v) => !v); setMoreOpen(false) }} />
                )}
                {bangkokMode && (
                  <MoreItem
                    label={governorMode ? 'Switch to layers' : 'Switch to the brief'}
                    onClick={() => { toggleGovernorMode(); setMoreOpen(false) }}
                  />
                )}
                {bangkokMode && (
                  <MoreItem label="Actions" onClick={() => { setActionCenterOpen(!actionCenterOpen); setMoreOpen(false) }} />
                )}
                {activeHasTwin && (
                  <MoreItem label={`${activeCity.name} brief`} onClick={() => { scrollToTwin(); setMoreOpen(false) }} />
                )}
                <li role="none"><ShareButton menu /></li>
                <MoreItem label="Search" onClick={() => { setCmdkOpen(true); setMoreOpen(false) }} />
                <MoreItem label="About" onClick={() => { setAboutOpen(true); setMoreOpen(false) }} />
              </ul>
            </>
          )}
        </div>
      </header>

      {/* Keep the fixed dialog outside the blurred topbar. Backdrop filters
          create a containing block that would otherwise pin it to 44px. */}
      <AboutModal />
      <ResearchPanel />
      <PlanOverlay city={activeCity} />

      <InsightPanel
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        activeCity={activeCity}
        onApply={applyInsight}
      />

      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <CityOnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
        </Suspense>
      </ErrorBoundary>

      {!splitOpen && (
        <CityRail
          activeCity={activeCity}
          onDistrictSelect={bangkokMode ? setSelectedDistrict : undefined}
          selectedDistrict={selectedDistrict}
        />
      )}

      {!splitOpen && (
        <MobileStrip
          activeCity={activeCity}
          onAddCity={() => setOnboardingOpen(true)}
          open={mobileSheetOpen}
          onOpenChange={setMobileSheetOpen}
          onSelect={(city) => {
            setActiveCity(city)
            setSelectedDistrict(null)
            setMobileSheetOpen(false)
          }}
        />
      )}

      {!splitOpen && (
        showComparison ? (
          <ErrorBoundary fallback={null}><Suspense fallback={null}><ComparisonPanel /></Suspense></ErrorBoundary>
        ) : bangkokMode ? (
          districtComparePair ? (
            <DistrictComparePanel />
          ) : governorMode
            ? (selectedDistrict
                ? (
                  <ErrorBoundary fallback={null}>
                    <Suspense fallback={null}>
                      <DistrictPanel
                        district={selectedDistrict}
                        onClose={() => setSelectedDistrict(null)}
                        onDraft={setAppDraft}
                      />
                    </Suspense>
                  </ErrorBoundary>
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
        )
      )}
    </Suspense>
  )
}
