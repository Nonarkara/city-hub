/**
 * Population Reality Panel — DOPA 2568 × NASA VIIRS.
 *
 * Surfaces the "ประชากรแฝง" (shadow population) intelligence layer for Bangkok:
 * civil registration says 36/50 districts are shrinking; night lights from orbit
 * show every single one growing brighter. The gap is the invisible city.
 *
 * Three lenses:
 *   SHADOW POP   — districts ranked by absolute gap (actual − registered)
 *   DOPA BALANCE — districts ranked by birth/death deficit (most negative first)
 *   NIGHT LIGHTS — districts ranked by VIIRS brightness gain
 *
 * Data: DataProteins / กรมการปกครอง 2568 + NASA VIIRS Black Marble 2024.
 * Published estimates marked as-is; satellite-modelled estimates marked ~.
 */
import { useState } from 'react'
import { DOPA_BKK, DOPA_SUMMARY, type DOPADistrict } from '../data/dopa-bkk'

type Tab = 'shadow' | 'balance' | 'lights'

// ── Row sub-components ────────────────────────────────────────────────────────

function ShadowRow({ d, max }: { d: DOPADistrict; max: number }) {
  const regPct  = Math.round((d.registered / d.estimatedActual) * 100)
  const color   = d.shadowRatio >= 2.0 ? '#f97316'
                : d.shadowRatio >= 1.6 ? '#f59e0b'
                : '#58a6ff'

  return (
    <div className="pop-row">
      <div className="pop-row-top">
        <span className="pop-row-name">{d.name_th}</span>
        <span className="pop-row-ratio" style={{ color }}>{d.shadowRatio.toFixed(2)}×</span>
      </div>
      <div className="pop-bar-track">
        <div className="pop-bar-reg" style={{ width: `${regPct}%` }} />
        <div className="pop-bar-shadow" />
      </div>
      <div className="pop-row-bot">
        <span className="pop-dim">reg {(d.registered / 1000).toFixed(0)}K</span>
        <span className="pop-gap" style={{ color }}>
          +{(d.shadowExtra / 1000).toFixed(0)}K shadow
        </span>
        <span className="pop-dim">actual {(d.estimatedActual / 1000).toFixed(0)}K</span>
        {d.dataSource === 'estimated' && <span className="pop-est">~</span>}
      </div>
    </div>
  )
}

function BalanceRow({ d, max }: { d: DOPADistrict; max: number }) {
  const absPct  = Math.round((Math.abs(d.balance) / max) * 100)
  const color   = d.hospitalBias ? '#f59e0b'
                : d.balance < 0  ? '#ef4444'
                : '#22c55e'

  return (
    <div className="pop-row">
      <div className="pop-row-top">
        <span className="pop-row-name">{d.name_th}</span>
        <span className="pop-lights-tag">📡 +{d.viirsTrend}%</span>
      </div>
      <div className="pop-bar-track">
        <div className="pop-bar-fill" style={{ width: `${absPct}%`, background: color }} />
      </div>
      <div className="pop-row-bot">
        <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {d.balance >= 0 ? '+' : ''}{d.balance.toLocaleString()}/yr
        </span>
        {d.hospitalBias && (
          <span className="pop-note">hospital births bias</span>
        )}
        {d.dataSource === 'estimated' && <span className="pop-est">~</span>}
      </div>
    </div>
  )
}

function LightsRow({ d, max }: { d: DOPADistrict; max: number }) {
  const pct   = Math.round((d.viirsTrend / max) * 100)
  const color = d.viirsTrend >= 60 ? '#f97316'
              : d.viirsTrend >= 40 ? '#f59e0b'
              : '#58a6ff'

  return (
    <div className="pop-row">
      <div className="pop-row-top">
        <span className="pop-row-name">{d.name_th}</span>
        <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>
          +{d.viirsTrend}%
        </span>
      </div>
      <div className="pop-bar-track">
        <div className="pop-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="pop-row-bot">
        <span className="pop-dim">
          {d.balance >= 0 ? '+' : ''}{d.balance.toLocaleString()} DOPA bal
        </span>
        {d.dataSource === 'estimated' && <span className="pop-est">~</span>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PopulationRealityPanel() {
  const [tab, setTab] = useState<Tab>('shadow')

  const rows: DOPADistrict[] = tab === 'shadow'
    ? [...DOPA_BKK].sort((a, b) => b.shadowExtra - a.shadowExtra).slice(0, 8)
    : tab === 'balance'
    ? [...DOPA_BKK].sort((a, b) => a.balance - b.balance).slice(0, 8)
    : [...DOPA_BKK].sort((a, b) => b.viirsTrend - a.viirsTrend).slice(0, 8)

  const maxVal = tab === 'shadow'  ? (rows[0]?.shadowExtra ?? 1)
               : tab === 'balance' ? Math.abs(rows[0]?.balance ?? 1)
               :                     (rows[0]?.viirsTrend ?? 1)

  return (
    <div className="pop-reality-panel">
      <div className="panel-zone" aria-hidden>
        <span className="panel-zone-dot" style={{ background: '#58a6ff' }} />
        POPULATION REALITY · DOPA × VIIRS
      </div>

      <div className="pop-lede">
        Official: {DOPA_SUMMARY.districtsShrinking}/{DOPA_SUMMARY.totalDistricts} khet shrinking.
        {' '}Night lights: every district brighter.
      </div>

      <div className="pop-tabs" role="tablist">
        {(['shadow', 'balance', 'lights'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`pop-tab${tab === t ? ' pop-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'shadow' ? 'SHADOW POP' : t === 'balance' ? 'DOPA BALANCE' : 'NIGHT LIGHTS'}
          </button>
        ))}
      </div>

      <div className="pop-list">
        {tab === 'shadow'  && rows.map((r) => <ShadowRow  key={r.name_th} d={r} max={maxVal} />)}
        {tab === 'balance' && rows.map((r) => <BalanceRow key={r.name_th} d={r} max={maxVal} />)}
        {tab === 'lights'  && rows.map((r) => <LightsRow  key={r.name_th} d={r} max={maxVal} />)}
      </div>

      <div className="pop-footer">
        กรมการปกครอง 2568 · NASA VIIRS 2024 · DataProteins
        <span className="pop-est"> · ~&nbsp;=&nbsp;estimated</span>
      </div>
    </div>
  )
}
