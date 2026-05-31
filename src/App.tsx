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
import { InsightPanel, type InsightTemplate } from './components/InsightPanel'
import { CityFactsCard } from './components/CityFactsCard'
import { ActiveInsightBanner } from './components/ActiveInsightBanner'
import { prefetchCity } from './lib/city-prefetch'
import { useCityStore } from './store/cityStore'
import { useLayerStore } from './store/layerStore'
import { useUIStore } from './store/uiStore'
import { trackEvent } from './lib/firebase'
import { ActionCenter } from './components/ActionCenter'

const ComparisonPanel = lazy(() => import('./components/ComparisonPanel').then((m) => ({ default: m.ComparisonPanel })))
const CityOnboardingModal = lazy(() => import('./components/CityOnboardingModal').then((m) => ({ default: m.CityOnboardingModal })))
const SplitCompare = lazy(() => import('./components/SplitCompare').then((m) => ({ default: m.SplitCompare })))
const CityChat = lazy(() => import('./components/CityChat').then((m) => ({ default: m.CityChat })))

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

  // ── Onboarding modal ────────────────────────────────────────────────────────
  const [onboardingOpen, setOnboardingOpen] = useState(false)

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

  useBangkokLayers(map, activeLayers, bangkokMode, activeDate, bangkokMode ? setSelectedDistrict : undefined)

  const anomalies = useAnomalies(bangkokMode)

  const toggleLayer = useCallback((id: string) => {
    trackEvent('toggle_layer', { layer_id: id })
    useLayerStore.getState().toggleLayer(id)
  }, [])

  const cityHandler = useMemo(() => (c: CityConfig) => {
    setActiveCity(c)
    setSelectedDistrict(null)
  }, [setActiveCity, setSelectedDistrict])

  const tokenAvailable = hasMapboxToken()

  // If compare mode is active, show comparison panel instead of city-specific panels
  const showComparison = compareMode && compareSet.length >= 2

  // Time machine — the temporal scrubber is available on ANY city whenever a
  // date-keyed satellite lens (MODIS, aerosol, NDVI, surface-temp, nightlights)
  // is the active basemap. Google shows only today; this scrubs 30 days back.
  const temporalBasemapActive = isTemporalBasemap(basemap)

  return (
    <Suspense fallback={null}>
      <MapView city={activeCity} basemap={basemap} activeDate={activeDate} onMapReady={setMap} />

      {splitOpen && <SplitCompare />}

      {chatOpen && <CityChat activeCity={activeCity} />}

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
      <TimeScrubber visible={bangkokMode && governorMode && !selectedDistrict && !showComparison} />
      <TimelineSlider activeDate={activeDate} onChange={setActiveDate} visible={(temporalBasemapActive || (bangkokMode && governorMode)) && !selectedDistrict && !showComparison} />
      {bangkokMode && governorMode && !showComparison && (
        <AnomalyPins map={map} anomalies={anomalies} cityCenter={activeCity.center} />
      )}
      {bangkokMode && <ASEANStrip />}

      {appDraft && <DraftModal draft={appDraft} onClose={() => setAppDraft(null)} />}

      <CityFactsCard activeCity={activeCity} />

      <ActiveInsightBanner active={activeInsight} activeCity={activeCity} onClear={clearInsight} />

      <header className="topbar">
        <span className="topbar-wordmark" title="DR NON'S CITY HUB">
          CITY HUB<span className="topbar-version">v6</span>
        </span>

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
              </button>
            )
          })}
          <button
            className="topbar-tab topbar-tab--add"
            onClick={() => setOnboardingOpen(true)}
            title="Add a new city"
          >
            + ADD
          </button>
        </nav>

        {/* Action Center (Governor SitRep) */}
        {actionCenterOpen && (
          <ActionCenter onClose={() => setActionCenterOpen(false)} />
        )}

        {/* Mobile dropdown button */}
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
            >
              · {governorMode ? 'SIT ROOM' : 'ANALYST'}
            </button>
            <button
              className="topbar-mode-btn topbar-sitrep-btn"
              onClick={() => setActionCenterOpen(!actionCenterOpen)}
              title="Review Global SitRep Actions"
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
    </Suspense>
  )
}
