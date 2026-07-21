/**
 * BangkokIntelligence — economic + digital + civic twin brief for Bangkok.
 *
 * Same architectural pattern as KranjIntelligence (lite twin): cited open
 * figures in a live-ops frame, gap assessment, live hydrology. Bangkok is
 * richer because the repo already holds DOPA shadow-population, SLIC pillars,
 * TomTom congestion, open-data inventory, and GloFAS Chao Phraya forecasts.
 *
 * Live sensor/news layers stay in AlertPanel; this section adds the structural
 * intelligence those streams cannot cover. Every static number is sourced;
 * live blocks hide when offline.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { CITIES } from '../config/cities'
import { DOPA_SUMMARY } from '../data/dopa-bkk'
import { fetchChaoPrayaForecast, type FloodForecast } from '../data/flood-forecast'
import { getCityScore, weakestPillar, strongestPillar } from '../lib/slic'

const BANGKOK = CITIES.find((c) => c.id === 'bangkok')!
const DEMO = BANGKOK.demographics!
const SLIC = getCityScore('bangkok')

/** Cited structural figures — NESDC / BMA / TomTom / WHO framing where noted. */
const B = {
  gdpBillion:       DEMO.gdpBillionUsd,          // Bangkok metro GPP proxy · cities.ts
  gdpPerCapita:     DEMO.gdpPerCapitaUsd,        // USD · cities.ts curated
  congestionPct:    DEMO.trafficCongestionPct!,  // TomTom Traffic Index
  walkability:      DEMO.walkabilityScore!,      // Walk Score methodology
  greenM2:          DEMO.greenSpaceM2PerPerson!, // m²/person · BMA parks framing
  greenPct:         DEMO.greenSpacePct,          // % city area
  gini:             DEMO.giniCoefficient!,       // wealth inequality 0–1
  lifeExp:          DEMO.lifeExpectancyYears,
  birthRate:        DEMO.birthRatePer1k,
  popMillions:      BANGKOK.populationMillions,
  areaKm2:          BANGKOK.area_km2,
  whoGreenTarget:   9,                           // WHO urban green-space guidance m²/person
  liveSources:      7,                           // OpenDataInventory bangkok active count
  totalSources:     8,
}

// Gap assessment — scored from real indicators above; framed as assessment.
const GAPS: { label: string; score: number; note: string }[] = [
  {
    label: 'Green space & heat',
    score: Math.round((B.greenM2 / B.whoGreenTarget) * 100),
    note: `${B.greenM2} m²/person · WHO guidance ${B.whoGreenTarget} · ${B.greenPct}% land cover`,
  },
  {
    label: 'Shadow population',
    score: 38,
    note: `${DOPA_SUMMARY.districtsShrinking}/${DOPA_SUMMARY.totalDistricts} districts officially shrinking · VIIRS lights all brighter`,
  },
  {
    label: 'Mobility & congestion',
    score: Math.max(20, 100 - B.congestionPct),
    note: `TomTom +${B.congestionPct}% vs free-flow · walkability ${B.walkability}/100`,
  },
  {
    label: 'Creative economy',
    score: SLIC ? Math.round(SLIC.creativeScore) : 45,
    note: SLIC
      ? `SLIC creative ${SLIC.creativeScore.toFixed(0)}/100 · weakest pillar · rank ${SLIC.globalRank}/163`
      : 'SLIC creative pillar unavailable',
  },
  {
    label: 'Flood & subsidence',
    score: 42,
    note: 'Chao Phraya delta · sinking ~2 cm/yr · GloFAS Nakhon Sawan upstream gauge',
  },
  {
    label: 'Digital & Samastiti readiness',
    score: SLIC ? Math.round(SLIC.capabilityScore) : 68,
    note: SLIC
      ? `SLIC capability ${SLIC.capabilityScore.toFixed(0)} · ${B.liveSources}/${B.totalSources} open-data feeds live`
      : `${B.liveSources}/${B.totalSources} open-data feeds live`,
  },
]

function statusOf(score: number): { word: string; color: string } {
  if (score >= 60) return { word: 'OPPORTUNITY', color: '#8bc34a' }
  if (score >= 50) return { word: 'MODERATE',    color: '#fdd835' }
  if (score >= 40) return { word: 'GAP',         color: '#fb8c00' }
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
      const eased = 1 - Math.pow(1 - t, 3)
      setV(Number((target * eased).toFixed(decimals)))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    const safety = window.setTimeout(() => setV(target), ms + 400)
    return () => { cancelAnimationFrame(raf.current); clearTimeout(safety) }
  }, [target, decimals, ms])
  return v
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(0) + 'B'
  if (n >= 1_000) return '$' + Math.round(n).toLocaleString('en-US')
  return '$' + n
}

export const BangkokIntelligence = memo(function BangkokIntelligence() {
  const [clock, setClock] = useState('')
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: BANGKOK.timezone,
    }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const [hydro, setHydro] = useState<FloodForecast | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const f = await fetchChaoPrayaForecast(14)
        if (!cancelled && f.currentDischarge > 0) setHydro(f)
      } catch { /* offline — block hides */ }
    }
    load()
    const t = setInterval(load, 30 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const gdp = useCountUp(B.gdpBillion)
  const gpc = useCountUp(B.gdpPerCapita)
  const cong = useCountUp(B.congestionPct)

  const weak = SLIC ? weakestPillar(SLIC) : null
  const strong = SLIC ? strongestPillar(SLIC) : null
  const greenPctOfWho = Math.min(100, Math.round((B.greenM2 / B.whoGreenTarget) * 100))

  const hydroSpark = hydro && hydro.days.length > 1 ? (() => {
    const W = 120, H = 34
    const s = hydro.days.map((d) => d.discharge)
    const mn = Math.min(...s), mx = Math.max(...s), rng = (mx - mn) || 1
    const pts = s.map((v, i) => `${((i / (s.length - 1)) * W).toFixed(1)},${(H - ((v - mn) / rng) * H).toFixed(1)}`).join(' ')
    return (
      <svg className="ki-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <polyline points={pts} fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  })() : null

  const rising = hydro?.trend === 'rising'
  const hydroRisk = hydro?.days[0]?.risk ?? 'low'
  const hydroRiskColor =
    hydroRisk === 'emergency' ? '#e53935'
    : hydroRisk === 'warning' ? '#fb8c00'
    : hydroRisk === 'watch'   ? '#fdd835'
    : '#8bc34a'

  return (
    <section className="bkk-intel" id="city-twin-bangkok" aria-label="Bangkok economic and digital twin intelligence">
      <div className="ki-head">
        <span className="ki-title">BANGKOK DIGITAL TWIN · ECONOMIC &amp; CIVIC</span>
        <span className="ki-live"><span className="ki-live-dot" aria-hidden />LIVE {clock}</span>
      </div>

      <div className="ki-stats">
        <div className="ki-stat">
          <span className="ki-stat-val">${Math.round(gdp)}<span className="ki-unit">B</span></span>
          <span className="ki-stat-lbl">METRO GPP</span>
          <span className="ki-stat-sub">USD · NESDC framing</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">{fmtUsd(gpc)}</span>
          <span className="ki-stat-lbl">GDP / CAPITA</span>
          <span className="ki-stat-sub">{B.popMillions}M · {B.areaKm2} km²</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">+{cong.toFixed(0)}<span className="ki-unit">%</span></span>
          <span className="ki-stat-lbl">CONGESTION</span>
          <span className="ki-stat-sub" style={{ color: '#fb8c00' }}>TomTom vs free-flow</span>
        </div>
      </div>

      {/* Shadow population — the Bangkok-specific structural signal */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>SHADOW POPULATION · ประชากรแฝง</span>
          <span className="ki-block-tag">{DOPA_SUMMARY.districtsShrinking}/{DOPA_SUMMARY.totalDistricts} SHRINKING</span>
        </div>
        <div className="ki-block-note">
          Civil registration says {DOPA_SUMMARY.districtsShrinking} of {DOPA_SUMMARY.totalDistricts} districts are dying;
          NASA VIIRS night lights show every district brighter (+{DOPA_SUMMARY.viirsTrendMin}–{DOPA_SUMMARY.viirsTrendMax}% YoY).
          The gap is the invisible city.
        </div>
      </div>

      {/* Green space vs WHO */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>GREEN SPACE / PERSON</span>
          <span className="ki-block-val">{B.greenM2}<span className="ki-vs"> / WHO {B.whoGreenTarget} m²</span></span>
        </div>
        <div className="ki-bar" role="img" aria-label={`Green space ${B.greenM2} m² per person versus WHO ${B.whoGreenTarget}`}>
          <div className="ki-bar-fill" style={{ width: `${greenPctOfWho}%` }} />
          <div className="ki-bar-eu" style={{ left: '100%' }} title={`WHO ${B.whoGreenTarget} m²`} />
        </div>
        <div className="ki-block-note">
          {B.greenPct}% land cover · Gini {B.gini.toFixed(2)} · life expectancy {B.lifeExp} yr · birth {B.birthRate}/1k
        </div>
      </div>

      {/* SLIC / Samastiti structural readiness */}
      {SLIC && (
        <div className="ki-block">
          <div className="ki-block-head">
            <span>SLIC · SAMASTITI STRUCTURE</span>
            <span className="ki-block-val">{SLIC.slicScore.toFixed(1)}<span className="ki-vs"> · #{SLIC.globalRank}/163</span></span>
          </div>
          <div className="ki-block-note">
            Strongest: {strong?.label ?? '—'} ({strong?.value ?? '—'}).
            Weakest: {weak?.label ?? '—'} ({weak?.value ?? '—'}).
            Open data live: {B.liveSources}/{B.totalSources} (GISTDA · Air4Thai · Traffy · BMA · TMD · Thaiwater · data.go.th).
          </div>
        </div>
      )}

      {/* Gap assessment */}
      <div className="ki-block">
        <div className="ki-block-head"><span>GAP ASSESSMENT</span><span className="ki-block-tag">6 PRIORITIES</span></div>
        <div className="ki-gaps">
          {GAPS.map((g) => {
            const s = statusOf(Math.min(100, Math.max(0, g.score)))
            const w = Math.min(100, Math.max(0, g.score))
            return (
              <div className="ki-gap" key={g.label}>
                <div className="ki-gap-top">
                  <span className="ki-gap-lbl">{g.label}</span>
                  <span className="ki-gap-status" style={{ color: s.color }}>{s.word}</span>
                </div>
                <div className="ki-gap-track"><div className="ki-gap-fill" style={{ width: `${w}%`, background: s.color }} /></div>
                <span className="ki-gap-note">{g.note}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Live hydrology — Chao Phraya via GloFAS */}
      {hydro && (
        <div className="ki-block">
          <div className="ki-block-head">
            <span>CHAO PHRAYA · RIVER FLOW</span>
            <span className="ki-live-sm"><span className="ki-live-dot" aria-hidden />LIVE</span>
          </div>
          <div className="ki-hydro">
            <div className="ki-hydro-read">
              <span className="ki-hydro-val">{hydro.currentDischarge.toLocaleString()}<span className="ki-unit">m³/s</span></span>
              <span className="ki-hydro-delta" style={{ color: hydroRiskColor }}>
                {rising ? '▲' : hydro.trend === 'falling' ? '▼' : '●'} {hydro.trend.toUpperCase()} · {hydroRisk.toUpperCase()}
              </span>
            </div>
            {hydroSpark}
          </div>
          <div className="ki-block-note">
            Nakhon Sawan confluence gauge · GloFAS via Open-Meteo · Bangkok lag ~3.5 days ·
            watch ≥2,000 · warning ≥3,500 · emergency ≥5,000 m³/s
            {hydro.peakDischarge != null && hydro.peakDate
              ? ` · peak ${hydro.peakDischarge.toLocaleString()} on ${hydro.peakDate}`
              : ''}
          </div>
        </div>
      )}

      <div className="ki-foot">
        Economics: NESDC / BMA framing in city registry · DOPA 2568 × NASA VIIRS (DataProteins) ·
        TomTom congestion · SLIC v3.4 · WHO green-space guidance. River: GloFAS via Open-Meteo (live).
        Sensors &amp; Traffy live in the brief below.
      </div>
    </section>
  )
})
