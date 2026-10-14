/**
 * PlanOverlay — the full-screen planning surface.
 *
 * Shares the reading-room shell with ResearchPanel so the two documents read
 * as the same series: this is what the argument looks like when it is applied
 * to the city you are looking at. Esc closes; backdrop click closes.
 */
import { useEffect } from 'react'
import type { CityConfig } from '../config/cities'
import { useUIStore } from '../store/uiStore'
import { CityModelPanel } from './CityModelPanel'

export function PlanOverlay({ city }: { city: CityConfig }) {
  const open = useUIStore((s) => s.planOpen)
  const setOpen = useUIStore((s) => s.setPlanOpen)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="about-overlay" onClick={() => setOpen(false)}>
      <div
        className="about-card plan-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="about-close" onClick={() => setOpen(false)} aria-label="Close" title="Close">✕</button>
        <h2 id="plan-title" className="visually-hidden">Plan</h2>
        <CityModelPanel city={city} />
      </div>
    </div>
  )
}