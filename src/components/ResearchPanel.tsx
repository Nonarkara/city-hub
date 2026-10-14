/**
 * Research — the argument the bar is a short form of.
 * Opens from the Research button and from the reading line.
 */
import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { RESEARCH_SECTIONS } from '../content/research'
import { PRODUCT_VERSION } from '../lib/city-reading'

export function ResearchPanel() {
  const open = useUIStore((s) => s.researchOpen)
  const setOpen = useUIStore((s) => s.setResearchOpen)

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
        className="about-card research-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="about-close research-close-btn" onClick={() => setOpen(false)} aria-label="Close" title="Close">✕</button>
        <header className="research-header">
          <div className="research-eyebrow">CITY HUB {PRODUCT_VERSION} · WADA READING ROOM</div>
          <h2 id="research-title" className="research-title">Research</h2>
          <p className="research-standfirst">
            This is not a comparison of satellite photos. The photo is how you look. The bar is what we are telling you.
          </p>
        </header>

        {RESEARCH_SECTIONS.map((section) => (
          <section key={section.id} className="research-section">
            <h3 className="research-heading">{section.heading}</h3>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="about-text">{p}</p>
            ))}
          </section>
        ))}

        <footer className="research-footer">
          <span className="research-footer-text">Dr Non Arkara · non@nonarkara.org</span>
          <span className="research-footer-text">WADA PLATE 002 · YELLOW ORANGE &amp; DARK TYRIAN BLUE</span>
        </footer>
      </div>
    </div>
  )
}
