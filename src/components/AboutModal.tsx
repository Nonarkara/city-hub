/**
 * AboutModal — a dossier card, not a product pitch.
 * Opens from the ABOUT button in the topbar.
 * Follows §12 Nonism: concrete first, philosophy last, no corporate copy.
 */
import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { CITIES } from '../config/cities'
import { InstallWebAppPanel } from './InstallWebAppPanel'

const SOURCES = [
  'NASA GIBS', 'USGS', 'Open-Meteo', 'WAQI', 'OpenAQ',
  'GISTDA', 'BMA', 'Traffy Fondue', 'TMD', 'GDELT',
  'NASA FIRMS', 'RainViewer', 'OpenStreetMap',
]

export function AboutModal() {
  const aboutOpen  = useUIStore((s) => s.aboutOpen)
  const setAboutOpen = useUIStore((s) => s.setAboutOpen)

  useEffect(() => {
    if (!aboutOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAboutOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [aboutOpen, setAboutOpen])

  if (!aboutOpen) return null

  return (
    <div className="about-overlay" onClick={() => setAboutOpen(false)}>
      <div className="about-card" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}>
        <button className="about-close" onClick={() => setAboutOpen(false)} aria-label="Close" title="Close About Modal">✕</button>

        <div className="about-brand-plate">
          <img
            className="about-brand-lockup"
            src="/brand/city-hub-lockup.png"
            alt="Dr Non's City Hub — City Intelligence"
          />
        </div>
        <div className="about-eyebrow">OPEN CIVIC INTELLIGENCE</div>
        <div id="about-title" className="about-name">DR NON'S CITY HUB</div>
        <div className="about-version-line">
          <span className="about-ver">v6</span>
          <span className="about-sep">·</span>
          <span className="about-status-chip">BUILD VERIFIED</span>
        </div>

        <div className="about-divider" />

        <div className="about-stats-row">
          <div className="about-stat">
            <div className="about-stat-val">{CITIES.length}</div>
            <div className="about-stat-label">CITIES</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-val">{SOURCES.length}+</div>
            <div className="about-stat-label">SOURCE CATALOG</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-val">0</div>
            <div className="about-stat-label">PAYWALLS</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-val">∞</div>
            <div className="about-stat-label">CITIES POSSIBLE</div>
          </div>
        </div>

        <div className="about-divider" />

        <p className="about-text">
          A replicable city intelligence platform. Any city. Any operator.
          The data layers that took years to assemble for Bangkok —
          air quality, fires, floods, civic reports, satellite imagery,
          forecasting — can be pointed at any city in an afternoon.
        </p>
        <p className="about-text">
          Built by <strong>Non Arkara</strong> — architect, urbanist,
          ex-ASEAN smart-city adviser. The point is not the dashboard.
          The point is what the data reveals when you put it all on one screen.
        </p>

        <div className="about-divider" />

        <InstallWebAppPanel />

        <div className="about-divider" />

        <div className="about-sources-label">DATA SOURCES</div>
        <div className="about-sources-grid">
          {SOURCES.map((s) => (
            <span key={s} className="about-source-chip">{s}</span>
          ))}
        </div>

        <div className="about-divider" />

        <div className="about-sources-label">KEYBOARD SHORTCUTS</div>
        <div className="about-keys-grid">
          {[
            ['1–5', 'Switch city'],
            ['G', 'Toggle globe'],
            ['F', 'Forecast'],
            ['S', 'Split compare'],
            ['A / /', 'Ask chatbot'],
            ['Cmd+K', 'Command palette'],
            ['Esc', 'Close panels'],
          ].map(([key, label]) => (
            <div key={key} className="about-key-row">
              <kbd className="about-kbd">{key}</kbd>
              <span className="about-key-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="about-divider" />

        <div className="about-sources-label">LEGAL · IP · DATA</div>
        <div className="about-legal">
          <p>
            <strong>Licence and intellectual property.</strong> The software source
            code is available under the MIT License in the repository. The Dr Non's
            City Hub name, logo, original research methods, written material, and
            design assets remain the intellectual property of
            Non&nbsp;Arkaraprasertkul (Dr&nbsp;Non&nbsp;Arkara) unless separately
            licensed. Third-party data and map content retain their providers'
            respective terms.
          </p>
          <p>
            <strong>Privacy — GDPR &amp; PDPA.</strong> The city layers use public and
            aggregate data. The app sets no advertising cookies and does not sell user
            data. When Firebase is configured, selected product interactions may be
            recorded as aggregate usage events; deployment operators remain responsible
            for consent, retention, and access controls.
          </p>
          <p>
            <strong>Systems.</strong> Built and self-hosted by Dr&nbsp;Non — a static
            client (React + Vite) delivered at the edge via Cloudflare Pages, with live
            data proxied through a single Cloudflare Worker. The open data sources listed
            above remain the property of their respective providers and are used under
            their public terms. Map labels and searched places use OpenStreetMap data
            © OpenStreetMap contributors, with labels served by CARTO.
          </p>
        </div>

        <div className="about-divider" />

        <div className="about-footer-row">
          <a
            className="about-link"
            href="mailto:non@nonarkara.org"
          >non@nonarkara.org</a>
          <a
            className="about-link"
            href="https://www.linkedin.com/in/drnon/"
            target="_blank"
            rel="noreferrer"
          >linkedin.com/in/drnon <span className="ext-icon" aria-hidden>↗</span></a>
        </div>

        <div className="about-footer-row">
          <span className="about-footer-dim">hub.nonarkara.org</span>
          <span className="about-footer-dim">self-hosted · © 2026 Non Arkaraprasertkul</span>
        </div>
      </div>
    </div>
  )
}
