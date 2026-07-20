/**
 * KranjIntelligence — the economic + digital gap-assessment brief for Kranj.
 *
 * Built for Dr Non's Kranj mayoral engagement (gap assessment + economic action
 * plan). Real, cited open data (SURS municipal profile, Eurostat Gorenjska NUTS3,
 * EU Digital Decade Slovenia) presented in a live-operations frame. Genuinely-live
 * figures (air, weather, news) live in the surrounding LiteCityPanel; this section
 * adds the economic/financial/digital layer those sources can't cover.
 *
 * The CITY OPS ticker is simulated telemetry (disclosed in the footer) — it gives
 * the "real-time" feel for the demo. Every economic/demographic/digital number is
 * real and sourced.
 */
import { memo, useEffect, useRef, useState } from 'react'
import type { CityConfig } from '../config/cities'

// ── Real, cited figures ──────────────────────────────────────────────────────
const K = {
  gdpPerCapita: 26_532,   // € · Gorenjska NUTS3 · Eurostat 2024
  vsNational:   -16,      // % vs Slovenia national
  avgNetWage:   1_528,    // €/month · SURS Kranj municipality 2024
  employment:   71.6,     // % · SURS 2024
  population:   57_220,   // SURS mid-2024
  meanAge:      43.5,     // SURS
  ageingIndex:  135,      // elderly per 100 young · SURS
  netMigration: 4.9,      // per 1,000 · SURS
  cars:         570,      // per 1,000 residents · SURS
  digitalSkills: 46.7,    // % with basic digital skills · Slovenia · EU Digital Decade
  euDigitalSkills: 55.6,  // EU average
  ictExperts:   4.5,      // % of workforce · target 10% by 2030
}

// Gap assessment — the engagement's working model (0–100, higher = stronger).
// Scored from the real indicators above; framed as assessment, not measurement.
const GAPS: { label: string; score: number; note: string }[] = [
  { label: 'Economic diversification', score: 52, note: 'legacy manufacturing reliance (Iskra · Sava-Goodyear)' },
  { label: 'Talent retention',         score: 44, note: 'GDP −16% vs national · 20 km to Ljubljana' },
  { label: 'Demographic balance',      score: 41, note: 'ageing index 135 · migration-dependent growth' },
  { label: 'Digital & AI readiness',   score: 47, note: '46.7% basic digital skills · below EU' },
  { label: 'Sustainable mobility',     score: 38, note: '570 cars / 1,000 · national road crossroads' },
  { label: 'Tourism conversion',       score: 61, note: 'medieval old town · day-trip → overnight upside' },
]

function statusOf(score: number): { word: string; color: string } {
  if (score >= 60) return { word: 'OPPORTUNITY', color: '#8bc34a' }
  if (score >= 50) return { word: 'MODERATE',    color: '#fdd835' }
  if (score >= 45) return { word: 'GAP',         color: '#fb8c00' }
  return              { word: 'AT RISK',     color: '#e53935' }
}

/** Count-up from 0 → target on mount. Plain rAF, no library. */
function useCountUp(target: number, decimals = 0, ms = 900): number {
  const [v, setV] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setV(Number((target * eased).toFixed(decimals)))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, decimals, ms])
  return v
}

function fmtEur(n: number): string {
  return '€' + Math.round(n).toLocaleString('en-US')
}

interface Props { activeCity: CityConfig }

export const KranjIntelligence = memo(function KranjIntelligence({ activeCity }: Props) {
  // Live clock — Europe/Ljubljana
  const [clock, setClock] = useState('')
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: activeCity.timezone,
    }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [activeCity.timezone])

  // Simulated CITY OPS telemetry — small random walk around plausible bases.
  const [ops, setOps] = useState({ grid: 68, transit: 412, requests: 37, ev: 24 })
  useEffect(() => {
    const t = setInterval(() => {
      setOps((o) => ({
        grid:     Math.max(41, Math.min(92, o.grid + (Math.random() - 0.5) * 4)),
        transit:  Math.max(180, Math.min(640, o.transit + Math.round((Math.random() - 0.5) * 22))),
        requests: Math.max(0, o.requests + (Math.random() < 0.35 ? 1 : 0)),
        ev:       Math.max(6, Math.min(48, o.ev + Math.round((Math.random() - 0.5) * 3))),
      }))
    }, 3200)
    return () => clearInterval(t)
  }, [])

  const gdp = useCountUp(K.gdpPerCapita)
  const wage = useCountUp(K.avgNetWage)
  const emp = useCountUp(K.employment, 1)

  const skillsPct = Math.round((K.digitalSkills / K.euDigitalSkills) * 100)

  return (
    <section className="kranj-intel" aria-label="Kranj economic and digital intelligence">
      <div className="ki-head">
        <span className="ki-title">ECONOMIC &amp; DIGITAL INTELLIGENCE</span>
        <span className="ki-live"><span className="ki-live-dot" aria-hidden />LIVE {clock}</span>
      </div>

      {/* Economic vitals */}
      <div className="ki-stats">
        <div className="ki-stat">
          <span className="ki-stat-val">{fmtEur(gdp)}</span>
          <span className="ki-stat-lbl">GDP / CAPITA</span>
          <span className="ki-stat-sub" style={{ color: '#fb8c00' }}>{K.vsNational}% vs national</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">{fmtEur(wage)}</span>
          <span className="ki-stat-lbl">NET WAGE / MO</span>
          <span className="ki-stat-sub">SURS 2024</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">{emp.toFixed(1)}<span className="ki-unit">%</span></span>
          <span className="ki-stat-lbl">EMPLOYMENT</span>
          <span className="ki-stat-sub">22,616 jobs</span>
        </div>
      </div>

      {/* Digital & AI readiness gauge */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>DIGITAL &amp; AI READINESS</span>
          <span className="ki-block-val">{K.digitalSkills}%<span className="ki-vs"> / EU {K.euDigitalSkills}%</span></span>
        </div>
        <div className="ki-bar" role="img" aria-label={`Basic digital skills ${K.digitalSkills}% versus EU ${K.euDigitalSkills}%`}>
          <div className="ki-bar-fill" style={{ width: `${skillsPct}%` }} />
          <div className="ki-bar-eu" style={{ left: '100%' }} title={`EU average ${K.euDigitalSkills}%`} />
        </div>
        <div className="ki-block-note">Basic digital skills below EU average · ICT specialists {K.ictExperts}% (target 10% by 2030)</div>
      </div>

      {/* Gap assessment */}
      <div className="ki-block">
        <div className="ki-block-head"><span>GAP ASSESSMENT</span><span className="ki-block-tag">6 PRIORITIES</span></div>
        <div className="ki-gaps">
          {GAPS.map((g) => {
            const s = statusOf(g.score)
            return (
              <div className="ki-gap" key={g.label}>
                <div className="ki-gap-top">
                  <span className="ki-gap-lbl">{g.label}</span>
                  <span className="ki-gap-status" style={{ color: s.color }}>{s.word}</span>
                </div>
                <div className="ki-gap-track"><div className="ki-gap-fill" style={{ width: `${g.score}%`, background: s.color }} /></div>
                <span className="ki-gap-note">{g.note}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Simulated live city operations */}
      <div className="ki-block">
        <div className="ki-block-head"><span>CITY OPS</span><span className="ki-live-sm"><span className="ki-live-dot" aria-hidden />STREAMING</span></div>
        <div className="ki-ops">
          <div className="ki-op"><span className="ki-op-val">{ops.grid.toFixed(0)}<span className="ki-unit">%</span></span><span className="ki-op-lbl">GRID LOAD</span></div>
          <div className="ki-op"><span className="ki-op-val">{ops.transit}</span><span className="ki-op-lbl">TRANSIT /HR</span></div>
          <div className="ki-op"><span className="ki-op-val">{ops.requests}</span><span className="ki-op-lbl">CIVIC REPORTS</span></div>
          <div className="ki-op"><span className="ki-op-val">{ops.ev}</span><span className="ki-op-lbl">EV SESSIONS</span></div>
        </div>
      </div>

      <div className="ki-foot">
        SURS · Eurostat (Gorenjska) · EU Digital Decade — figures 2024. City-ops telemetry simulated for demonstration.
      </div>
    </section>
  )
})
