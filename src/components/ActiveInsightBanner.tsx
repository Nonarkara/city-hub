/**
 * ActiveInsightBanner — floating bar that tells the user what they're
 * currently looking at after applying an insight template.
 *
 * Don Norman feedback principle: after applying a stack, the user should
 * always know which question they're investigating and what to look for.
 * Click × to clear the stack and return to defaults.
 *
 * On mount it asks Gemini (via the Worker /narrate endpoint) for a
 * 2-sentence reading of what THIS stack on THIS city likely reveals.
 * Falls back to the template hypothesis if Gemini unreachable.
 */
import { useEffect, useState } from 'react'
import type { InsightTemplate } from '../config/insights'
import type { CityConfig } from '../config/cities'
import { narrate, type NarrateResult } from '../lib/narrate'

interface Props {
  active: InsightTemplate | null
  activeCity: CityConfig
  onClear: () => void
}

const CATEGORY_COLOR: Record<string, string> = {
  forensic:       '#e53935',
  predictive:     '#fb8c00',
  accountability: '#fdd835',
  introduction:   '#58a6ff',
}

export function ActiveInsightBanner({ active, activeCity, onClear }: Props) {
  const [reading, setReading] = useState<NarrateResult | null>(null)

  // Ask Gemini for a short reading of what this stack reveals.
  // Re-runs when the template or city changes.
  useEffect(() => {
    if (!active) {
      setReading(null)
      return
    }
    let cancelled = false
    setReading(null)
    narrate(
      `Applying the "${active.title}" insight stack over ${activeCity.name}. ` +
      `Layers: ${active.layers.join(' + ')}. ` +
      `The hypothesis to test: ${active.hypothesis}. ` +
      `Write a 2-sentence reading of what the user should look for and what would confirm or refute the hypothesis. Be specific to ${activeCity.name}.`,
      {
        city: activeCity.name,
        country: activeCity.countryName,
        templateId: active.id,
        category: active.category,
        layers: active.layers,
      },
      { style: 'brief', maxWords: 65 },
    ).then((r) => {
      if (!cancelled) setReading(r)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [active, activeCity.id, activeCity.name, activeCity.countryName])

  if (!active) return null

  const color = CATEGORY_COLOR[active.category]
  const isAI = reading?.model === 'gemini-2.5'

  return (
    <aside
      className="active-insight-banner"
      role="status"
      aria-label={`Active insight: ${active.title}`}
    >
      <div className="aib-dot" style={{ background: color }} aria-hidden />
      <div className="aib-content">
        <div className="aib-header-row">
          <span className="aib-category" style={{ color }}>{active.category.toUpperCase()}</span>
          <span className="aib-title">{active.title}</span>
          {isAI && (
            <span className="aib-ai-tag" title="Reading narrated by Gemini 2.5">ai</span>
          )}
        </div>
        <div className="aib-look-row">
          <span className="aib-look-label">LOOK FOR ·</span>
          <span className="aib-look-text">
            {isAI && reading ? reading.narration : active.hypothesis}
          </span>
        </div>
      </div>
      <button className="aib-clear" onClick={onClear} aria-label="Clear active insight">
        <span className="aib-clear-icon">✕</span>
        <span className="aib-clear-label">RESET</span>
      </button>
    </aside>
  )
}
