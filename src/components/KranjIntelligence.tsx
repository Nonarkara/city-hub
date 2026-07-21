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
    // Safety net: requestAnimationFrame is paused in background/unfocused tabs,
    // which would leave the number stuck at 0. Guarantee the real value lands
    // regardless (setTimeout still fires when throttled) so the hero figures
    // are never shown as €0 to a viewer who wasn't looking at the tab on load.
    const safety = window.setTimeout(() => setV(target), ms + 400)
    return () => { cancelAnimationFrame(raf.current); clearTimeout(safety) }
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

  // Live hydrology — Sava river discharge (GloFAS model via Open-Meteo Flood API,
  // tokenless, CORS-open). The Sava–Kokra confluence IS Kranj's flood geography.
  const [hydro, setHydro] = useState<{ current: number; series: number[]; delta7: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch('https://flood-api.open-meteo.com/v1/flood?latitude=46.28&longitude=14.28&daily=river_discharge&past_days=10&forecast_days=4')
        const j = await r.json()
        const times: string[] = j?.daily?.time ?? []
        const disch: (number | null)[] = j?.daily?.river_discharge ?? []
        const today = new Date().toISOString().slice(0, 10)
        let i = times.indexOf(today)
        if (i < 0) i = disch.length - 4 // fall back to today ≈ end-of-past (before 4 forecast days)
        const current = disch[i]
        const past = disch[Math.max(0, i - 7)]
        const series = disch.filter((v): v is number => v != null)
        if (cancelled || current == null || series.length < 2) return
        const delta7 = past ? ((current - past) / past) * 100 : 0
        setHydro({ current, series, delta7 })
      } catch { /* offline — the block simply hides */ }
    }
    load()
    const t = setInterval(load, 30 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const gdp = useCountUp(K.gdpPerCapita)
  const wage = useCountUp(K.avgNetWage)
  const emp = useCountUp(K.employment, 1)

  const skillsPct = Math.round((K.digitalSkills / K.euDigitalSkills) * 100)

  const rising = (hydro?.delta7 ?? 0) >= 0
  const hydroSpark = hydro && hydro.series.length > 1 ? (() => {
    const W = 120, H = 34, s = hydro.series
    const mn = Math.min(...s), mx = Math.max(...s), rng = (mx - mn) || 1
    const pts = s.map((v, i) => `${((i / (s.length - 1)) * W).toFixed(1)},${(H - ((v - mn) / rng) * H).toFixed(1)}`).join(' ')
    return (
      <svg className="ki-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <polyline points={pts} fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  })() : null

  return (
    <section className="kranj-intel" id="city-twin-kranj" aria-label="Kranj economic and digital intelligence">
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

      {/* Live hydrology — Sava discharge (GloFAS via Open-Meteo Flood) */}
      {hydro && (
        <div className="ki-block">
          <div className="ki-block-head">
            <span>SAVA · RIVER FLOW</span>
            <span className="ki-live-sm"><span className="ki-live-dot" aria-hidden />LIVE</span>
          </div>
          <div className="ki-hydro">
            <div className="ki-hydro-read">
              <span className="ki-hydro-val">{hydro.current.toFixed(1)}<span className="ki-unit">m³/s</span></span>
              <span className="ki-hydro-delta">{rising ? '▲' : '▼'} {Math.abs(hydro.delta7).toFixed(0)}% · 7d</span>
            </div>
            {hydroSpark}
          </div>
          <div className="ki-block-note">Sava modeled discharge · GloFAS via Open-Meteo · Kranj sits at the Sava–Kokra confluence</div>
        </div>
      )}

      <div className="ki-foot">
        Economics: SURS · Eurostat (Gorenjska) 2024 · digital: EU Digital Decade. River: GloFAS via Open-Meteo (live).
      </div>
    </section>
  )
})
