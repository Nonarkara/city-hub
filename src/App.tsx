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
