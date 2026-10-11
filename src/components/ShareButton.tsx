/**
 * ShareButton — copies a link to the exact current view to the clipboard.
 * The URL is kept in sync with the view by useShareableView, so this just
 * grabs window.location.href and shows a brief confirmation.
 */
import { useState } from 'react'

export function ShareButton({ menu = false }: { menu?: boolean }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op.
    }
  }

  if (menu) {
    return (
      <button type="button" className="basemap-menu-item topbar-more-item" onClick={share}>
        <span className="basemap-menu-label">{copied ? 'Link copied' : 'Copy a link to this view'}</span>
      </button>
    )
  }

  return (
    <button
      className={`topbar-insight-btn ${copied ? 'topbar-insight-btn--active' : ''}`}
      onClick={share}
      title="Copy a link to this exact view (city · lens · date · overlays)"
      aria-label="Share this view"
    >
      <span className="topbar-insight-icon" aria-hidden>{copied ? '✓' : '⤴'}</span>
      <span className="topbar-insight-label">{copied ? 'COPIED' : 'SHARE'}</span>
    </button>
  )
}
