import { useState, useCallback, useRef, useEffect } from 'react'
import {
  searchCityBasics,
  candidateToCityConfig,
  formatPopulation,
  zoomForPopulation,
  type CityCandidate,
} from '../lib/city-facts'
import { useCityStore } from '../store/cityStore'
import { trackEvent } from '../lib/firebase'

interface Props {
  open: boolean
  onClose: () => void
}

// "View any city" — geocode a typed name (Nominatim) and view it EPHEMERALLY:
// it becomes the active city for this session only, never written to storage,
// so the picker never accumulates. Every search + view is logged (city_search /
// city_view) so the demand geography is captured without a growing tab bar.
export function CityOnboardingModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CityCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<CityCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setActiveCity = useCityStore((s) => s.setActiveCity)
  const debounceRef = useRef<number>(0)

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSelected(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await searchCityBasics(q)
      setResults(r)
      if (r.length > 0) setSelected(r[0])
      trackEvent('city_search', { query: q.trim(), result_count: r.length })
    } catch (e) {
      setError(String(e))
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => handleSearch(query), 500)
    return () => window.clearTimeout(debounceRef.current)
  }, [query, handleSearch])

  const handleView = () => {
    if (!selected) return
    const config = candidateToCityConfig(selected)
    setActiveCity(config)   // ephemeral — sets active city, not persisted
    trackEvent('city_view', {
      city_id: config.id, name: config.name, country: config.country, source: 'search',
    })
    onClose()
    setQuery('')
    setResults([])
    setSelected(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selected) {
      e.preventDefault()
      handleView()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length === 0) return
      const current = Math.max(0, results.findIndex((r) => r.id === selected?.id))
      const next = e.key === 'ArrowDown'
        ? Math.min(results.length - 1, current + 1)
        : Math.max(0, current - 1)
      setSelected(results[next])
    }
  }

  if (!open) return null

  const preview = selected ? candidateToCityConfig(selected) : null

  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-header">
          <h2>VIEW ANY CITY</h2>
          <button className="onboarding-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="onboarding-body">
          <label className="onboarding-label">Search any city</label>
          <input
            className="onboarding-input"
            type="text"
            placeholder="e.g. Jakarta, Nairobi, Mexico City..."
            value={query}
            onKeyDown={handleKeyDown}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          <p className="onboarding-attribution">Place search © OpenStreetMap contributors</p>

          {loading && <div className="onboarding-loading">Searching…</div>}
          {error && <div className="onboarding-error">{error}</div>}

          {results.length > 0 && (
            <ul className="onboarding-results">
              {results.map((r) => (
                <li
                  key={r.id}
                  className={`onboarding-result ${selected?.id === r.id ? 'onboarding-result--active' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  <span className="onboarding-result-name">{r.name}</span>
                  {/* The basics are shown here, before the click. A search that
                      only reveals what a place is after you commit to it is a
                      lookup, not a search. */}
                  <span className="onboarding-result-meta">
                    {[r.admin, r.country].filter(Boolean).join(' · ')}
                  </span>
                  <span className="onboarding-result-basics">
                    <b>{formatPopulation(r.population)}</b>
                    {r.elevationM !== null && <span>{Math.round(r.elevationM)} m</span>}
                    {r.timezone && <span>{r.timezone.split('/').pop()?.replace(/_/g, ' ')}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* `selected` is named as well as `preview` so TypeScript narrows it;
              a derived non-null preview does not narrow the thing it was derived from. */}
          {selected && preview && (
            <div className="onboarding-preview">
              <div className="onboarding-preview-row">
                <span>People</span>
                {/* Attribution, not decoration: this figure is a settlement from
                    Open-Meteo, while the curated cities carry a metro figure.
                    The two are not the same quantity and must not be compared. */}
                <span>
                  {formatPopulation(selected.population)}
                  <small> · settlement, Open-Meteo</small>
                </span>
              </div>
              <div className="onboarding-preview-row">
                <span>Elevation</span>
                <span>{selected.elevationM !== null ? `${Math.round(selected.elevationM)} m` : 'Not published'}</span>
              </div>
              <div className="onboarding-preview-row">
                <span>Timezone</span>
                <code>{selected.timezone ?? 'Unknown'}</code>
              </div>
              <div className="onboarding-preview-row">
                <span>Study window</span>
                <span>{(zoomForPopulation(selected.population)).toFixed(1)} zoom · {preview.availableLayers.length} global sources</span>
              </div>
              <div className="onboarding-preview-row">
                <span>City image</span>
                <span>Read from OpenStreetMap · no curation needed</span>
              </div>
              <p className="onboarding-honest-note">
                Global feeds and the city image are live for anywhere on Earth. The
                full civic twin — modelled systems, districts, the economics — is
                hand-built and exists only for the cities in the atlas.
              </p>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn onboarding-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="onboarding-btn onboarding-btn--primary"
            onClick={handleView}
            disabled={!preview}
          >
            View city
          </button>
        </div>
      </div>
    </div>
  )
}
