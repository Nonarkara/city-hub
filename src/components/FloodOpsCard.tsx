/**
 * FloodDash-style act surface: one verb, source kinds, what to do, who to call.
 * Mounted on Bangkok AlertPanel and every LiteCityPanel.
 */
import { useEffect, useState } from 'react'
import type { CityConfig } from '../config/cities'
import { thaiwaterProvinceCode } from '../data/thaiwater'
import { computeFloodOps, type FloodOpsState, type FloodVerb } from '../lib/flood-ops'
import { FloodCascadePanel } from './FloodCascadePanel'

interface Props {
  activeCity: CityConfig
}

const VERB_COLOR: Record<FloodVerb, string> = {
  'ALL CLEAR': 'var(--emerald)',
  'STAY INFORMED': 'var(--amber)',
  PREPARE: '#f97316',
  'ACT NOW': '#ef4444',
  'NO DATA': 'var(--dim)',
}

export function FloodOpsCard({ activeCity }: Props) {
  const [ops, setOps] = useState<FloodOpsState | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOps(null)
    setError(false)
    computeFloodOps(activeCity)
      .then((s) => { if (!cancelled) setOps(s) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [activeCity.id])

  const verb = error ? 'NO DATA' : ops?.verb ?? null
  const color = verb ? VERB_COLOR[verb] : 'var(--dim)'
  const waterHint = thaiwaterProvinceCode(activeCity.id) ? ' + ThaiWater' : ''

  return (
    <div className="flood-ops">
      <div className="flood-ops-header">
        <span className="flood-ops-kicker">FLOOD WATCH</span>
        {verb && (
          <span className="flood-ops-verb" style={{ color, borderColor: color }}>{verb}</span>
        )}
      </div>

      {!ops && !error && <div className="flood-ops-loading">Reading GloFAS{waterHint}…</div>}
      {error && <div className="flood-ops-loading">Flood feeds unavailable.</div>}

      {ops && (
        <>
          <p className="flood-ops-action">{ops.action}</p>
          <ul className="flood-ops-reasons">
            {ops.reasons.map((r, i) => (
              <li key={i}>
                <span className={`flood-ops-kind flood-ops-kind--${r.kind}`}>{r.kind}</span>
                {r.text}
              </li>
            ))}
          </ul>
          {ops.hotlines && (
            <div className="flood-ops-hotlines">
              {ops.hotlines.map((h) => (
                <a key={h.tel} className="flood-ops-tel" href={`tel:${h.tel}`}>{h.label}</a>
              ))}
            </div>
          )}
          <p className="flood-ops-disclaimer">{ops.disclaimer}</p>
        </>
      )}

      {activeCity.id === 'bangkok' && <FloodCascadePanel />}
    </div>
  )
}
