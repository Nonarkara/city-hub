import { useState } from 'react'
import type { CityConfig } from '../config/cities'
import type { CityAQI } from '../data/openmeteo-aq'
import type { CityWeather } from '../data/openmeteo'
import { freshnessLabel } from '../lib/freshness'
import { greenScenario } from '../lib/twin-scenario'

export interface TwinSnapshot {
  aqi: CityAQI | null
  weather: CityWeather | null
  aqiFetchedAt: number | null
  weatherFetchedAt: number | null
}

export function CityTwinWorkbench({ city, snapshot, onClose, onPlan }: {
  city: CityConfig
  snapshot: TwinSnapshot | null
  onClose: () => void
  onPlan: () => void
}) {
  const [tab, setTab] = useState<'today' | 'scenario' | 'evidence'>('today')
  const [hectares, setHectares] = useState(10)
  const [growth, setGrowth] = useState(0)
  const scenario = greenScenario(city, hectares, growth)
  const maxHectares = Math.min(1000, Math.floor(city.area_km2 * 100))
  const wx = snapshot?.weather
  const aq = snapshot?.aqi
  const age = (ts: number | null | undefined) => ts
    ? `${Date.now() - ts > 10 * 60_000 ? 'Cached · last success' : 'Retrieved'} ${freshnessLabel(ts)}`
    : 'Unavailable'

  function download() {
    const blob = new Blob([JSON.stringify({
      city: { id: city.id, name: city.name, boundaryAreaKm2: city.area_km2, center: city.center },
      exportedAt: new Date().toISOString(),
      conditions: snapshot,
      scenario: { type: 'land-accounting', addedHectares: hectares, populationChangePct: growth, ...scenario },
      sources: ['https://open-meteo.com/en/docs', 'https://open-meteo.com/en/docs/air-quality-api'],
      limitations: 'Reference population and green-space profiles use mixed years and may use different boundaries. Scenario assumes compatible boundaries and constant existing green area. No cooling, access, health or economic effects are predicted.',
    }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${city.id}-scenario.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <aside className="twin-workbench" aria-label={`${city.name} city twin`}>
      <header className="twin-heading">
        <div><small>CITY EXPLORER</small><h2>{city.name}</h2><span>{city.countryName}</span></div>
        <button type="button" onClick={onClose} aria-label="Close city explorer" title="Close city explorer">×</button>
      </header>
      <div className="twin-tabs" role="tablist" aria-label="City explorer views" onKeyDown={(event) => {
        const ids = ['today', 'scenario', 'evidence'] as const
        const index = ids.indexOf(tab)
        const next = event.key === 'ArrowRight' ? (index + 1) % 3
          : event.key === 'ArrowLeft' ? (index + 2) % 3
            : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null
        if (next == null) return
        event.preventDefault()
        setTab(ids[next])
        document.getElementById(`twin-tab-${ids[next]}`)?.focus()
      }}>
        {(['today', 'scenario', 'evidence'] as const).map((id) => (
          <button key={id} type="button" role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`twin-${id}`} id={`twin-tab-${id}`} onClick={() => setTab(id)}>{id === 'today' ? 'Today' : id === 'scenario' ? 'What if?' : 'Evidence'}</button>
        ))}
      </div>
      <div className="twin-content" role="tabpanel" id={`twin-${tab}`} aria-labelledby={`twin-tab-${tab}`}>
        {tab === 'today' && <>
          <h3>A city at human scale</h3>
          <p>{city.distinctiveness}</p>
          <dl className="twin-readings">
            <div><dt>Air quality</dt><dd>{aq ? `${aq.usAqi} US AQI` : 'Unavailable'}</dd><small>CAMS via Open-Meteo · model estimate · {age(snapshot?.aqiFetchedAt)}</small></div>
            <div><dt>Feels like outdoors</dt><dd>{wx ? `${wx.feelsLike}°C` : 'Unavailable'}</dd><small>Open-Meteo · weather model · {age(snapshot?.weatherFetchedAt)}</small></div>
            <div><dt>Wind</dt><dd>{wx ? `${wx.windSpeed} km/h ${wx.windCardinal}` : 'Unavailable'}</dd><small>City-centre model grid · {age(snapshot?.weatherFetchedAt)}</small></div>
          </dl>
          <p className="twin-note">These conditions describe a model grid around the city centre. A shaded street, a busy road and a hillside can feel very different.</p>
          <button type="button" className="twin-action" onClick={() => setTab('scenario')}>Explore more green space</button>
          <button type="button" className="twin-action twin-action--quiet" onClick={onPlan}>City systems & planning assumptions</button>
        </>}
        {tab === 'scenario' && <>
          <h3>Room for more green</h3>
          <p>Explore how added green area and a changing population affect the space available per resident.</p>
          <label className="twin-input">Additional green area <strong>{hectares} hectares</strong><input aria-label="Additional green area" type="range" min="0" max={maxHectares} step="1" value={hectares} onChange={(e) => setHectares(Number(e.target.value))} /></label>
          <label className="twin-input">Population change <strong>{growth > 0 ? '+' : ''}{growth}%</strong><input aria-label="Population change" type="range" min="-50" max="100" value={growth} onChange={(e) => setGrowth(Number(e.target.value))} /></label>
          <div className="twin-scenario-result" aria-live="polite">
            <span>Green space per resident</span>
            <strong>{scenario.baselineM2PerPerson?.toFixed(2) ?? 'Unknown'} → {scenario.scenarioM2PerPerson?.toFixed(2) ?? 'Unknown'} m²</strong>
            <span>Scenario calculation · reference baseline</span>
          </div>
          <p>{hectares} hectares is {scenario.landSharePct.toFixed(2)}% of the city's stated area. The added area alone provides {scenario.addedM2PerPerson.toFixed(2)} m² per future resident.</p>
          <p className="twin-note">Assumes existing green area stays constant and population and green-space boundaries match. Reference profiles use mixed years. Land availability, public access, canopy, cost and displacement need local evidence. This calculation does not predict cooling or economic gains.</p>
          <button type="button" className="twin-action" onClick={download}>Download scenario & evidence</button>
          <button type="button" className="twin-action twin-action--quiet" onClick={() => { setHectares(10); setGrowth(0) }}>Reset scenario</button>
        </>}
        {tab === 'evidence' && <>
          <h3>What is known?</h3>
          <p>Current conditions refresh every ten minutes while this comparison is open. Retrieval time is separate from the model's observation period.</p>
          <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">Air quality: CAMS / Open-Meteo</a>
          <p>Regional atmospheric model, rather than a sensor on the selected street. {age(snapshot?.aqiFetchedAt)}.</p>
          <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">Weather: Open-Meteo</a>
          <p>Numerical weather model at the city centre. {age(snapshot?.weatherFetchedAt)}.</p>
          <h3>Reference profile</h3>
          <p>Population: {Math.round(city.populationMillions * 1e6).toLocaleString()} · area: {city.area_km2.toLocaleString()} km². Curated profile, mixed years. Per-value primary citations and boundary reconciliation are still needed.</p>
          <h3>Before a real-world decision</h3>
          <p>Validate the local boundary and public access, ask residents where shade is missing, and record an outcome after an intervention. Scenario results here are arithmetic, not a calibrated forecast.</p>
          <button type="button" className="twin-action" onClick={download}>Download scenario & evidence</button>
        </>}
      </div>
    </aside>
  )
}
