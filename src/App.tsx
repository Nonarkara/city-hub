import { useState, useCallback, useMemo } from 'react'
import type { Map as MapLibre } from 'maplibre-gl'
import { CITIES, vpmId, type CityConfig } from './config/cities'
import { BANGKOK_LAYERS } from './config/bangkok-layers'
import { MapView } from './components/MapView'
import { CityRail, MobileStrip, TopbarCityButton } from './components/CityRail'
import { LayerRail } from './components/LayerRail'
import { DataFeedPanel } from './components/DataFeedPanel'
import { useBangkokLayers } from './components/map-layers/use-bangkok-layers'

const API_KEY = import.meta.env.VITE_UNL_API_KEY as string

const DEFAULT_ACTIVE_LAYERS = new Set(
  BANGKOK_LAYERS.filter((l) => l.defaultOn && l.status === 'live').map((l) => l.id),
)

export default function App() {
  const [activeCity, setActiveCity] = useState<CityConfig>(CITIES[0])
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [map, setMap] = useState<MapLibre | null>(null)
  const [activeLayers, setActiveLayers] = useState<Set<string>>(DEFAULT_ACTIVE_LAYERS)

  const bangkokMode = activeCity.id === 'bangkok'

  // Wire Bangkok layers into the map (no-op when bangkokMode is false)
  useBangkokLayers(map, activeLayers, bangkokMode)

  const toggleLayer = useCallback((id: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // When switching away from Bangkok, no need to clear toggles — useBangkokLayers
  // removes layers when bangkokMode becomes false. When user returns, the same
  // toggle set is applied again.
  const cityHandler = useMemo(() => (c: CityConfig) => setActiveCity(c), [])

  return (
    <>
      <MapView city={activeCity} vpmId={vpmId} apiKey={API_KEY} onMapReady={setMap} />

      <header className="topbar">
        <span className="topbar-wordmark">CITY·HUB</span>
        <div className="topbar-divider" />
        <div className="md-hidden">
          <TopbarCityButton
            city={activeCity}
            open={mobileSheetOpen}
            onClick={() => setMobileSheetOpen((v) => !v)}
          />
        </div>
        <span className="desktop-city-label">{activeCity.name}</span>
        {bangkokMode && <span className="topbar-mode">· SUPER MODE</span>}
        <div className="topbar-spacer" />
        <span className="topbar-vpm-label">UNL VPM</span>
      </header>

      <CityRail activeCity={activeCity} onSelect={cityHandler} vpmId={vpmId} />

      <MobileStrip
        activeCity={activeCity}
        onSelect={(city) => {
          setActiveCity(city)
          setMobileSheetOpen(false)
        }}
      />

      {bangkokMode && (
        <>
          <LayerRail activeIds={activeLayers} onToggle={toggleLayer} />
          <DataFeedPanel />
        </>
      )}
    </>
  )
}
