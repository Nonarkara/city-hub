/**
 * CityModelPanel — the planning surface.
 *
 * Opens from More → Plan. Shows, for the active city:
 *
 *   1. THE MODEL      eight systems, each with capacity, demand, and the
 *                     margin between them, with the basis of every number
 *                     marked MEASURED / DERIVED / ASSUMED
 *   2. THE PLAN       what to do about each system over capacity, ordered
 *   3. MEASUREMENT DEBT  the assumptions that would change the ranking
 *
 * The basis chips are not decoration. A planner must be able to tell, at a
 * glance, which rows are load-bearing and which are placeholders.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CityConfig } from '../config/cities'
import {
  assessCity, BASIS_LABEL, fmtCoefficient,
  type Basis, type SystemModel,
} from '../lib/city-model'
import { buildPlan, kindLabel, type InterventionKind } from '../lib/plan'
import { fetchCityImage, type CityImage } from '../data/city-image'
import { citationLine, projectSystems, type SystemProjection } from '../lib/ioc/system-elements'

const PRESSURE_COLOR: Record<SystemModel['pressure'], string> = {
  ok:     'var(--ok)',
  watch:  'rgba(245, 158, 11, 0.75)',
  tight:  '#fb8c00',
  over:   '#e53935',
}

const BASIS_COLOR: Record<Basis, string> = {
  measured: 'var(--ok)',
  derived:  '#8fb7d8',
  assumed:  'rgba(245, 158, 11, 0.8)',
}

const KIND_COLOR: Record<InterventionKind, string> = {
  measure:       'rgba(245, 158, 11, 0.8)',
  'remove-demand': 'var(--ok)',
  'add-capacity':  '#8fb7d8',
  sequence:      'rgba(245, 245, 240, 0.4)',
}

/** Horizontal bar: capacity at 100%, demand drawn against it. */
function BalanceBar({ system }: { system: SystemModel }) {
  const pct = Math.min(130, system.utilisation * 100)
  const over = system.utilisation > 1
  const color = PRESSURE_COLOR[system.pressure]
  return (
    <div className="cm-bar" role="img" aria-label={`${system.label} at ${Math.round(system.utilisation * 100)}% of capacity`}>
      <div className="cm-bar-track">
        <div className="cm-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        {over && (
          <div className="cm-bar-over" style={{ left: `${Math.min(99, 100 * (1 / (system.utilisation || 1)))}%` }} />
        )}
      </div>
      <div className="cm-bar-wall" />
      <span className="cm-bar-val" style={{ color }}>{Math.round(system.utilisation * 100)}%</span>
    </div>
  )
}

function SystemRow({ system, projection }: { system: SystemModel; projection?: SystemProjection }) {
  const where = projection ? citationLine(projection) : null
  return (
    <div className={`cm-sys cm-sys--${system.pressure}`}>
      <div className="cm-sys-head">
        <span className="cm-sys-label">{system.label}</span>
        <span className="cm-sys-basis" style={{ color: BASIS_COLOR[system.capacity.basis] }}>
          {BASIS_LABEL[system.capacity.basis]}
        </span>
        <span className="cm-sys-role">{system.role}</span>
      </div>
      <BalanceBar system={system} />
      <div className="cm-sys-figures">
        <span className="cm-fig">
          <span className="cm-fig-k">CAPACITY</span>
          <span className="cm-fig-v">{fmtCoefficient(system.capacity)}</span>
        </span>
        <span className="cm-fig">
          <span className="cm-fig-k">DEMAND</span>
          <span className="cm-fig-v">{fmtCoefficient(system.demand)}</span>
        </span>
      </div>
      <div className="cm-sys-verdict">{system.verdict}</div>
      {projection && (
        <div className="cm-sys-where">
          <span className="cm-where-k">IN THE CITY</span> {projection.line}
          {where && <span className="cm-where-cite">{where}</span>}
          {projection.limited && <span className="cm-where-limit">· limited sample</span>}
        </div>
      )}
      <div className="cm-sys-caveat" title={system.caveat}>
        <span className="cm-caveat-k">CAVEAT</span> {system.caveat}
      </div>
    </div>
  )
}

export function CityModelPanel({ city }: { city: CityConfig }) {
  const assessment = useMemo(() => assessCity(city), [city])
  const plan = useMemo(() => buildPlan(assessment), [assessment])

  // IoC 2.0: resolve each system onto the city image. `fetchCityImage` caches
  // per city centre, so opening the plan after Compare shares the same read
  // rather than issuing a second Overpass query. A failure leaves the image
  // null, and the projection then says the image is unavailable — which is the
  // truth, and better than inventing an element to point at.
  const [image, setImage] = useState<CityImage | null>(null)
  useEffect(() => {
    let alive = true
    fetchCityImage(city)
      .then((result) => { if (alive) setImage(result) })
      .catch(() => { if (alive) setImage(null) })
    return () => { alive = false }
  }, [city])

  const projectionById = useMemo(() => {
    const list = projectSystems(image, assessment.systems.map((s) => s.id))
    return new Map(list.map((p) => [p.system, p] as const))
  }, [image, assessment.systems])

  return (
    <div className="cm-panel" role="region" aria-label={`${city.name} planning model`}>
      <header className="cm-head">
        <span className="cm-eyebrow">PLAN · {city.name.toUpperCase()}</span>
        <h3 className="cm-title">The model</h3>
        <p className="cm-opening">{plan.openingMove}</p>
        <div className="cm-tallies">
          <span className="cm-tally" style={{ color: assessment.overCount ? '#e53935' : 'var(--ok)' }}>
            {assessment.overCount} OVER
          </span>
          <span className="cm-tally" style={{ color: assessment.tightCount ? '#fb8c00' : 'var(--dim)' }}>
            {assessment.tightCount} TIGHT
          </span>
          <span className="cm-tally cm-tally-dim">
            MEAN {Math.round(assessment.meanUtilisation * 100)}%
          </span>
        </div>
      </header>

      <section className="cm-sys-list" aria-label="System capacity and demand">
        {assessment.systems.map((s) => <SystemRow key={s.id} system={s} projection={projectionById.get(s.id)} />)}
      </section>

      <section className="cm-plan" aria-label="Plan">
        <h4 className="cm-plan-h">THE PLAN</h4>
        {plan.steps.length === 0 ? (
          <p className="cm-plan-empty">
            No system is over or tight capacity on the coefficients used. That is a statement about
            the assumptions, not about the city — check the measurement debt below before reading
            this as reassurance.
          </p>
        ) : plan.steps.map((step) => (
          <div key={step.system.id} className="cm-step">
            <div className="cm-step-head">
              <span className="cm-step-rank">{step.rank.toString().padStart(2, '0')}</span>
              <span className="cm-step-sys">{step.system.label}</span>
              <span className="cm-step-util" style={{ color: PRESSURE_COLOR[step.system.pressure] }}>
                {Math.round(step.system.utilisation * 100)}%
              </span>
            </div>
            <ol className="cm-iv-list">
              {step.interventions.map((iv) => (
                <li key={iv.id} className="cm-iv">
                  <div className="cm-iv-head">
                    <span className="cm-iv-kind" style={{ color: KIND_COLOR[iv.kind] }}>
                      {kindLabel(iv.kind)}
                    </span>
                    <span className="cm-iv-horizon">{iv.horizon}</span>
                    {iv.measureFirst && (
                      <span className="cm-iv-measure">MEASURE FIRST</span>
                    )}
                  </div>
                  <div className="cm-iv-title">{iv.title}</div>
                  <div className="cm-iv-mech">{iv.mechanism}</div>
                  <div className="cm-iv-why">
                    <span className="cm-why-k">WHY HERE</span> {iv.because}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section className="cm-debt" aria-label="Measurement debt">
        <h4 className="cm-debt-h">MEASUREMENT DEBT</h4>
        <p className="cm-debt-lead">
          These rows rest on an assumption. Replace one and the ranking may change. A plan that
          hides its own uncertainty is not a plan.
        </p>
        <ul className="cm-debt-list">
          {plan.measurementDebt.map((d, i) => (
            <li key={i} className="cm-debt-item">
              <span className="cm-debt-dot" style={{ background: BASIS_COLOR.assumed }} aria-hidden />
              {d}
            </li>
          ))}
        </ul>
        <p className="cm-foot">
          Static balance sheet. No time dimension, no feedback, not a forecast.
          Find the gap here, then measure the gap properly.
        </p>
      </section>
    </div>
  )
}