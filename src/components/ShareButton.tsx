/**
 * ShareButton — copies a link to the exact current view to the clipboard.
 * The URL is kept in sync with the view by useShareableView, so this just
 * grabs window.location.href and shows a brief confirmation.
 */
import { useState } from 'react'

export function ShareButton() {
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
