/**
 * InsightPanel — the dashboard's pattern-revealing instrument.
 *
 * Opens from the topbar's INSIGHT button. Shows pre-configured layer stacks
 * that reveal patterns no single layer surfaces. Each template includes
 * the question it answers and the hypothesis it tests.
 *
 * Clicking a template activates its layer set in one motion — and pushes
 * the user out of Governor mode into Analyst mode so they can see the map.
 */
import { useState } from 'react'
import type { CityConfig } from '../config/cities'
import { INSIGHTS, insightsForCity, type InsightTemplate } from '../config/insights'

interface Props {
  open: boolean
  onClose: () => void
  activeCity: CityConfig
  onApply: (template: InsightTemplate) => void
}

function categoryColor(category: InsightTemplate['category']): string {
  switch (category) {
    case 'forensic':       return '#e53935'  // red — investigation
    case 'predictive':     return '#fb8c00'  // orange — foresight
    case 'accountability': return '#fdd835'  // yellow — speaks truth
    case 'introduction':   return '#58a6ff'  // blue — onboarding
  }
}

export function InsightPanel({ open, onClose, activeCity, onApply }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (!open) return null

  const templates = insightsForCity(activeCity.id)
  const otherTemplates = INSIGHTS.filter((t) => t.cityScope !== activeCity.id && t.cityScope !== 'all')

  return (
    <>
      <div className="insight-backdrop" onClick={onClose} aria-hidden />
      <aside className="insight-panel" role="dialog" aria-label="Insight templates">
        <header className="insight-header">
          <div className="insight-title-block">
            <span className="insight-eyebrow">INSIGHT MODE</span>
            <h2 className="insight-title">PATTERNS WORTH STACKING</h2>
            <p className="insight-sub">
              Single layers show data. Stacked layers show what no single layer can.
              Each template below activates a curated stack of layers and explains
              what to look for when they overlap.
            </p>
          </div>
          <button className="insight-close" onClick={onClose} aria-label="Close insight panel">✕</button>
        </header>

        <div className="insight-list">
          {templates.length > 0 && templates.map((t) => (
            <button
              key={t.id}
              className="insight-card"
              onClick={() => {
                onApply(t)
                onClose()
              }}
              onMouseEnter={() => setHoveredId(t.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="insight-card-head">
                <span
                  className="insight-category"
                  style={{ color: categoryColor(t.category), borderColor: categoryColor(t.category) }}
                >
                  {t.category.toUpperCase()}
                </span>
                <span className="insight-difficulty" data-difficulty={t.difficulty}>
                  {t.difficulty.toUpperCase()}
                </span>
              </div>

              <div className="insight-card-title">{t.title}</div>
              <p className="insight-card-question">{t.question}</p>

              {hoveredId === t.id && (
                <div className="insight-card-hypothesis">
                  <span className="insight-hypothesis-label">WHAT TO LOOK FOR</span>
                  <p>{t.hypothesis}</p>
                </div>
              )}

              <div className="insight-card-layers">
                <span className="insight-layers-label">LAYERS</span>
                <span className="insight-layers-list">{t.layers.join(' + ')}</span>
              </div>

              {t.basemap && (
                <div className="insight-card-basemap">
                  <span className="insight-basemap-label">BASEMAP</span>
                  <span className="insight-basemap-val">{t.basemap}</span>
                </div>
              )}

              <div className="insight-card-cta">APPLY STACK →</div>
            </button>
          ))}

          {otherTemplates.length > 0 && (
            <div className="insight-other">
              <div className="insight-other-label">AVAILABLE ON OTHER CITIES</div>
              {otherTemplates.map((t) => (
                <div key={t.id} className="insight-other-row" title={`Switch to ${t.cityScope} to use this template`}>
                  <span className="insight-other-name">{t.title}</span>
                  <span className="insight-other-city">{t.cityScope.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="insight-footer">
          <span className="insight-foot-line">
            Each template is a question. The map is the answer.
          </span>
          <span className="insight-foot-credit">
            Built for cities, not for selling. ทุกอย่างเกิดขึ้นเพราะมีเหตุ.
          </span>
        </footer>
      </aside>
    </>
  )
}

export type { InsightTemplate }
