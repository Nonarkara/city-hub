/**
 * AboutModal — a dossier card, not a product pitch.
 * Opens from the ABOUT button in the topbar.
 * Follows §12 Nonism: concrete first, philosophy last, no corporate copy.
 */
import { useUIStore } from '../store/uiStore'
import { CITIES } from '../config/cities'

const SOURCES = [
  'NASA GIBS', 'USGS', 'Open-Meteo', 'GloFAS', 'WAQI', 'OpenAQ',
  'GISTDA', 'HII ThaiWater', 'BMA', 'Traffy Fondue', 'TMD', 'GDELT',
  'NASA FIRMS', 'RainViewer', 'SLIC Index',
]

export function AboutModal() {
  const aboutOpen  = useUIStore((s) => s.aboutOpen)
  const setAboutOpen = useUIStore((s) => s.setAboutOpen)

  if (!aboutOpen) return null

  return (
    <div className="about-overlay" onClick={() => setAboutOpen(false)}>
      <div className="about-card" onClick={(e) => e.stopPropagation()}>
        <button className="about-close" onClick={() => setAboutOpen(false)} aria-label="Close" title="Close About Modal">✕</button>

        <div className="about-eyebrow">OPEN CIVIC INTELLIGENCE</div>
        <div className="about-name">DR NON'S CITY HUB</div>
        <div className="about-version-line">
          <span className="about-ver">v6</span>
          <span className="about-sep">·</span>
          <span className="about-status-chip">SYSTEM NOMINAL</span>
        </div>

        <div className="about-divider" />

        <div className="about-stats-row">
          <div className="about-stat">
            <div className="about-stat-val">{CITIES.length}</div>
            <div className="about-stat-label">CITIES</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-val">{SOURCES.length}+</div>
            <div className="about-stat-label">LIVE SOURCES</div>
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
            ['1–5', 'First five cities'],
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
            <strong>Intellectual property.</strong> Source code is MIT
            (see <code>LICENSE</code> in this repository) © 2026
            Non&nbsp;Arkaraprasertkul. SLIC V3 scores are the published
            Smart and Liveable Cities Index (Arkara &amp; Thiengburanathum) —
            cite the method, do not sell ranks as paid placement. Forks must
            not impersonate BMA, DEPA, or any government product.
          </p>
          <p>
            <strong>Privacy — GDPR &amp; PDPA.</strong> This dashboard renders publicly
            available open data. It sets no advertising cookies. Firebase Analytics
            may run in production if <code>VITE_FIREBASE_*</code> is configured —
            that is usage telemetry, not an ad network. Traffy tickets are public
            civic reports; do not use them to identify people.
          </p>
          <p>
            <strong>Systems.</strong> Built and self-hosted by Dr&nbsp;Non — a static
            client (React + Vite) delivered at the edge via Cloudflare Pages, with live
            data proxied through a single Cloudflare Worker. The open data sources listed
            above remain the property of their respective providers and are used under
            their public terms.
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
