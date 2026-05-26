/**
 * ActiveInsightBanner — floating bar that tells the user what they're
 * currently looking at after applying an insight template.
 *
 * Don Norman feedback principle: after applying a stack, the user should
 * always know which question they're investigating and what to look for.
 * Click × to clear the stack and return to defaults.
 */
import type { InsightTemplate } from '../config/insights'

interface Props {
  active: InsightTemplate | null
  onClear: () => void
}

const CATEGORY_COLOR: Record<string, string> = {
  forensic:       '#e53935',
  predictive:     '#fb8c00',
  accountability: '#fdd835',
  introduction:   '#58a6ff',
}

export function ActiveInsightBanner({ active, onClear }: Props) {
  if (!active) return null

  const color = CATEGORY_COLOR[active.category]

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
        </div>
        <div className="aib-look-row">
          <span className="aib-look-label">LOOK FOR ·</span>
          <span className="aib-look-text">{active.hypothesis}</span>
        </div>
      </div>
      <button className="aib-clear" onClick={onClear} aria-label="Clear active insight">
        <span className="aib-clear-icon">✕</span>
        <span className="aib-clear-label">RESET</span>
      </button>
    </aside>
  )
}
