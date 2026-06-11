import { useState, useCallback, useRef, useEffect } from 'react'
import {
  searchNominatim,
  nominatimToCityConfig,
  computeNutrition,
  nutritionLabel,
  nutritionScore,
  type NominatimResult,
} from '../lib/city-generator'
import { useCityStore } from '../store/cityStore'

interface Props {
  open: boolean
  onClose: () => void
}

export function CityOnboardingModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<NominatimResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const addCustomCity = useCityStore((s) => s.addCustomCity)
  const toggleCompareCity = useCityStore((s) => s.toggleCompareCity)
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
      const r = await searchNominatim(q)
      setResults(r)
      if (r.length > 0) setSelected(r[0])
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

  const handleAdd = () => {
    if (!selected) return
    const config = nominatimToCityConfig(selected)
    addCustomCity(config)
    onClose()
    setQuery('')
    setResults([])
    setSelected(null)
  }

  const handleAddAndPin = () => {
    if (!selected) return
    const config = nominatimToCityConfig(selected)
    addCustomCity(config)
    toggleCompareCity(config.id)
    onClose()
    setQuery('')
    setResults([])
    setSelected(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && selected) {
      e.preventDefault()
      handleAdd()
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length === 0) return
      const current = Math.max(0, results.findIndex((r) => r.place_id === selected?.place_id))
      const next = e.key === 'ArrowDown'
        ? Math.min(results.length - 1, current + 1)
        : Math.max(0, current - 1)
      setSelected(results[next])
    }
  }

  if (!open) return null

  const preview = selected ? nominatimToCityConfig(selected) : null
  const nutrition = preview ? computeNutrition(preview) : null

  return (
    <div className="onboarding-backdrop" onClick={onClose}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-header">
          <h2>ADD CITY</h2>
          <button className="onboarding-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="onboarding-body">
          <label className="onboarding-label">City name</label>
          <input
            className="onboarding-input"
            type="text"
            placeholder="e.g. Jakarta, Nairobi, Mexico City..."
            value={query}
            onKeyDown={handleKeyDown}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {loading && <div className="onboarding-loading">Searching…</div>}
          {error && <div className="onboarding-error">{error}</div>}

          {results.length > 0 && (
            <ul className="onboarding-results">
              {results.map((r) => (
                <li
                  key={r.place_id}
                  className={`onboarding-result ${selected?.place_id === r.place_id ? 'onboarding-result--active' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  <span className="onboarding-result-name">{nominatimToCityConfig(r).name}</span>
                  <span className="onboarding-result-meta">
                    {r.type} · {r.address?.state ?? r.display_name.split(',').slice(1, -1).pop()?.trim() ?? 'global'} · {r.address?.country ?? r.display_name.split(',').pop()?.trim()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {preview && (
            <div className="onboarding-preview">
              <div className="onboarding-preview-row">
                <span>Center</span>
                <code>{preview.center[1].toFixed(4)}, {preview.center[0].toFixed(4)}</code>
              </div>
              <div className="onboarding-preview-row">
                <span>Timezone</span>
                <code>{preview.timezone}</code>
              </div>
              <div className="onboarding-preview-row">
                <span>Layers</span>
                <span>{preview.availableLayers.length} global sources</span>
              </div>
              <div className="onboarding-preview-row">
                <span>Compare</span>
                <span>Pin up to 4 cities</span>
              </div>
              {nutrition && (
                <div className="onboarding-nutrition">
                  <div className="onboarding-nutrition-bar">
                    <div
                      className="onboarding-nutrition-fill"
                      style={{ width: `${nutritionScore(nutrition)}%` }}
                    />
                  </div>
                  <span className="onboarding-nutrition-label">{nutritionLabel(nutrition)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-btn onboarding-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="onboarding-btn onboarding-btn--primary"
            onClick={handleAdd}
            disabled={!preview}
          >
            Add
          </button>
          <button
            className="onboarding-btn onboarding-btn--primary"
            onClick={handleAddAndPin}
            disabled={!preview}
          >
            Add + Pin
          </button>
        </div>
      </div>
    </div>
  )
}
