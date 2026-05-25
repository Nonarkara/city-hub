import { useState, useCallback, useMemo } from 'react'
import type { Map as MapLibre } from 'maplibre-gl'
import { CITIES, vpmId, type CityConfig } from './config/cities'
import { BANGKOK_LAYERS } from './config/bangkok-layers'
import { MapView } from './components/MapView'
import { CityRail, MobileStrip, TopbarCityButton } from './components/CityRail'
import { LayerRail } from './components/LayerRail'
import { DataFeedPanel } from './components/DataFeedPanel'
import { AlertPanel, DraftModal } from './components/AlertPanel'
import { DistrictPanel } from './components/DistrictPanel'
import { HUD } from './components/HUD'
import { CommandPalette } from './components/CommandPalette'
import { FreshnessPanel } from './components/FreshnessPanel'
import { TimeScrubber } from './components/TimeScrubber'
import { useBangkokLayers } from './components/map-layers/use-bangkok-layers'
import { type DistrictSummary } from './hooks/useDistrictData'

const API_KEY = import.meta.env.VITE_UNL_API_KEY as string

const DEFAULT_ACTIVE_LAYERS = new Set(
  BANGKOK_LAYERS.filter((l) => l.defaultOn && l.status === 'live').map((l) => l.id),
)

export default function App() {
  const [activeCity, setActiveCity] = useState<CityConfig>(CITIES[0])
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [map, setMap] = useState<MapLibre | null>(null)
  const [activeLayers, setActiveLayers] = useState<Set<string>>(DEFAULT_ACTIVE_LAYERS)
  // Governor mode = default briefing view. Analyst mode = full layer rail.
  const [governorMode, setGovernorMode] = useState(true)
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictSummary | null>(null)
  const [appDraft, setAppDraft] = useState<string | null>(null)
  const [cmdkOpen, setCmdkOpen] = useState(false)

  // Expose a window hook so CommandPalette's global keydown can open it.
  // Lighter than passing a setter through React context.
  if (typeof window !== 'undefined') {
    (window as unknown as { __openCmdK?: () => void }).__openCmdK = () => setCmdkOpen(true)
  }

  const bangkokMode = activeCity.id === 'bangkok'

  useBangkokLayers(map, activeLayers, bangkokMode, bangkokMode ? setSelectedDistrict : undefined)

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

  return (
    <>
      <MapView city={activeCity} vpmId={vpmId} apiKey={API_KEY} onMapReady={setMap} />

      <HUD
        map={map}
        activeLayerCount={bangkokMode ? activeLayers.size : 0}
        sourceCount={bangkokMode ? 7 : 1}
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

      {appDraft && <DraftModal draft={appDraft} onClose={() => setAppDraft(null)} />}

      <header className="topbar">
        <span className="topbar-wordmark">DR NON'S CITY HUB<span className="topbar-version">v5</span></span>
        <div className="topbar-divider" />
        <div className="md-hidden">
          <TopbarCityButton
            city={activeCity}
            open={mobileSheetOpen}
            onClick={() => setMobileSheetOpen((v) => !v)}
          />
        </div>
        <span className="desktop-city-label">{activeCity.name}</span>
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
        <button
          className="topbar-cmdk"
          onClick={() => setCmdkOpen(true)}
          title="Search · Cmd+K"
          aria-label="Open command palette"
        >
          <span className="topbar-cmdk-icon">⌕</span>
          <span className="topbar-cmdk-key">⌘K</span>
        </button>
        <span className="topbar-vpm-label">UNL VPM</span>
      </header>

      <CityRail
        activeCity={activeCity}
        onSelect={cityHandler}
        vpmId={vpmId}
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

      {bangkokMode && (
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
      )}
    </>
  )
}
