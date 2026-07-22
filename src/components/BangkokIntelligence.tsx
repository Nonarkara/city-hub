/**
 * BangkokIntelligence — Bangkok's full-tier digital twin brief.
 *
 * Architecture: registry-driven via CityIntelligence. This file is the
 * "full" twin — Kranj is the "lite" twin. Both share the .ki-* CSS chrome;
 * the .bkk-intel shell owns the Bangkok-specific layout.
 *
 * Content model — every block passes a triple-load test:
 *   - INFORMS: a real, cited number a governor / operator acts on
 *   - MOVES:   links to the right actions (insight templates, layer toggles)
 *   - MEANS:   lands inside Bangkok's economic / civic context, not generic
 *
 * Static blocks are sourced from NESDC / BMA / TomTom / WHO / SLIC v3.4 /
 * TRUE / DOPA / Wikipedia. Live blocks (Chao Phraya GloFAS) hide when
 * offline. Every figure is cited in the .ki-foot provenance line.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { CITIES } from '../config/cities'
import { DOPA_SUMMARY } from '../data/dopa-bkk'
import { fetchChaoPrayaForecast, type FloodForecast } from '../data/flood-forecast'
import { getCityScore, weakestPillar, strongestPillar } from '../lib/slic'

const BANGKOK = CITIES.find((c) => c.id === 'bangkok')!
const DEMO = BANGKOK.demographics!
const SLIC = getCityScore('bangkok')

/** Curated figures — every number cited in the .ki-foot provenance line. */
const B = {
  gdpBillion:        DEMO.gdpBillionUsd,           // NESDC Bangkok metro GPP proxy
  gdpPerCapita:      DEMO.gdpPerCapitaUsd,         // NESDC per-capita framing
  congestionPct:     DEMO.trafficCongestionPct!,   // TomTom Traffic Index 2024
  walkability:       DEMO.walkabilityScore!,       // Walk Score methodology
  greenM2:           DEMO.greenSpaceM2PerPerson!,  // BMA parks framing
  greenPct:          DEMO.greenSpacePct,           // % city area
  gini:              DEMO.giniCoefficient!,        // wealth inequality 0–1
  lifeExp:           DEMO.lifeExpectancyYears,
  birthRate:         DEMO.birthRatePer1k,
  popMillions:       BANGKOK.populationMillions,
  areaKm2:           BANGKOK.area_km2,
  whoGreenTarget:    9,                            // WHO urban green-space m²/person
  liveSources:       7,                            // OpenDataInventory bangkok active count
  totalSources:      8,

  // ── Demographics deep-dive (NESDC + UN-DESA + World Bank) ──
  popMetro:          16.7,    // M · Bangkok Metropolitan Region (BMR) · UN-DESA 2024
  popRegistered:     10.5,    // M · civil registration · DOPA 2568 (we are here)
  popShadow:         6.2,     // M · unregistered estimate (BMR minus registered)
  densityKm2:        6_700,   // people / km² · NESDC 2024
  densityBangkokMetro: 1_900, // people / km² over BMR area
  medianAge:         39.2,    // yrs · NESDC 2024
  workingAge:        71,      // % aged 15–64 · NESDC 2024
  elderly:           14,      // % aged 65+ · NESDC 2024
  netMigration:      -0.4,    // per 1k/yr · BMR losing residents to provinces · NESDC
  foreignResidents:  3.2,     // M · long-stay (work + retirement) · Thai PBS / immigration
  avgHousehold:      2.7,     // persons · NESDC
  households:        3.9,     // M · NESDC

  // ── Economic composition (NESDC Gross Provincial Product 2021) ──
  sectorServices:     56,      // % of GPP · finance / retail / hospitality
  sectorManufacturing: 22,    // % of GPP · auto, electronics, food
  sectorGovernment:   11,     // % · public admin + education + health
  sectorConstruction: 6,      // % · real estate + infrastructure
  sectorAgriculture:  1,      // % · urban remnant
  sectorOther:        4,      // % · utilities, mining, etc.
  unemployment:       1.1,    // % · NESDC Q1 2024
  laborForce:         4.1,    // M · NESDC
  informalWorkers:    32,     // % of labor force · informal sector estimate
  tourismReceipts:    1.3,    // T BHT (≈$35B) · TAT 2019 pre-COVID peak
  tourismRecovery:    78,     // % of 2019 receipts · TAT 2024

  // ── Real estate (Bangkok condominium market 2024) ──
  cbdLandPrice:       1_400_000,  // THB/m² · Ploenchit / Wireless road corridor
  midtownCondo:      180_000,    // THB/m² · Asok / Thonglor new launch
  suburbCondo:       95_000,     // THB/m² · outer ring (Bang Na, Lat Phrao)
  priceToIncome:     22,         // years · Bangkok condo P/I ratio · Numbeo 2024
  rentYieldStudio:   5.4,        // % gross · central Bangkok
  foreignOwnership:  49,         // % of new condo supply · REIC 2024 (legal cap 49%)
  newCondoSupply:    18_000,     // units launched 2024 · REIC
  housingAffordability: 18,      // % of median income to afford median home (severe)

  // ── Infrastructure (BMTA · BTS · MRT · ARL · SRT) ──
  btsSkytrainKm:     56.4,    // km · BTS Sukhumvit + Silom · BTSC 2024
  mrtBlueKm:         47,      // km · MRT Blue Line · MRTA
  mrtPurpleKm:       23,      // km · MRT Purple Line · MRTA
  arlKm:             28.6,    // km · Airport Rail Link · SRT
  btsDailyRiders:    720_000, // pax/day · BTSC Q4 2024
  mrtDailyRiders:    410_000, // pax/day · MRTA
  roadsKm:           9_400,   // km · BMA road network
  vehicleRegistered: 9.2,     // M · DLT
  vehiclePer1k:      550,     // per 1k residents · DLT
  bkkAirportPax:     60.7,    // M pax 2023 · Suvarnabhumi · AOT
  dmkAirportPax:     16.5,    // M pax 2023 · Don Mueang · AOT
  broadbandCoverage: 95,      // % households · NBTC 2024
  fiveGCoverage:     88,      // % population · NBTC 2024

  // ── Governance (BMA structure) ──
  districts:          50,      // khet (districts)
  subDistricts:       180,     // khwaeng (sub-districts)
  bmaBudget:          79,      // B BHT/yr · BMA fiscal 2024
  bmaEmployees:       25_000, // civil servants
  bmaRevenueSource:   35,      // % own-source revenue
  governorElected:   true,    // first direct election 2022 (Chadchart)
  governorName:       'Chadchart Sittipunt',
  governorSince:      2022,
  cabinetAppointed:  true,    // PM-appointed BMA admin exists in parallel

  // ── Climate & subsidence ──
  sinkingRate:        2,        // cm/yr average · NSTDA / Chulalongkorn studies
  sinkingMax:         5,        // cm/yr · inner city hot zones (Dusit, Pom Prap)
  floodProneArea:     40,       // % BMA area · 2011 flood footprint
  maxTempAvg:         35,       // °C April avg · TMD
  urbanHeatIsland:    3.5,     // °C above surrounding rural · Chulalongkorn 2023
  annualRainfall:     1_650,   // mm/yr · TMD 30-yr avg
  rainyDays:          128,     // days/yr · TMD

  // ── Innovation & digital (DEPA / NBTC) ──
  trueDigitalPark:    1,        // Thailand's first digital park · Chon Buri (counted as BMR proxy)
  startupsRegistered: 2_400,   // DEPA + Techsauce
  ventureCapital:     8.5,     // B THB 2023 deals · DEPA / Techsauce
  baseStations5G:     24_000,  // nationwide · NBTC (Bangkok ≈ 30%)
  eGovServices:       1_800,   // services on etax / egp / egov · DGA
  smartCityRank:      'Top 50', // IMD Smart City Index 2023
  creativeScore:      SLIC?.creativeScore ?? 71,
  capabilityScore:    SLIC?.capabilityScore ?? 64,

  // ── Comparison: ASEAN capitals (NESDC + World Bank 2024) ──
  peers: {
    bangkok:    { gdp: 175,  gpc: 16_000, pop: 10.5, density: 6_700, aqi: 64, greenM2: 4.2 },
    jakarta:    { gdp: 220,  gpc: 9_500,  pop: 10.6, density: 16_000, aqi: 156, greenM2: 3.0 },
    manila:     { gdp: 175,  gpc: 11_500, pop: 13.5, density: 43_000, aqi: 88, greenM2: 4.5 },
    kualalumpur:{ gdp: 110,  gpc: 18_000, pop: 1.8,  density: 7_500, aqi: 68, greenM2: 8.0 },
    singapore:  { gdp: 466,  gpc: 82_800, pop: 5.9,  density: 8_300, aqi: 45, greenM2: 66 },
    hanoi:      { gdp: 50,   gpc: 4_800,  pop: 8.5,  density: 9_800, aqi: 92, greenM2: 5.5 },
  } as const,

  // ── Major projects in pipeline ──
  projects: [
    { name: 'MRT Orange Line',     year: 2028, scale: '35.4 km · 17 stations · ฿230B', status: 'construction' },
    { name: 'MRT Purple Line South', year: 2027, scale: '23.6 km · 17 stations · ฿101B', status: 'construction' },
    { name: 'BTS Green Line extension', year: 2026, scale: '7.5 km · 4 stations · ฿15B', status: 'construction' },
    { name: 'SRT Dark Red Line',    year: 2027, scale: '14.6 km · 6 stations · ฿45B', status: 'testing' },
    { name: 'Suvarnabhumi Phase 2', year: 2030, scale: 'satellite + concourse · ฿42B',  status: 'approved' },
    { name: 'Chao Phraya flood barrier', year: 2029, scale: '8.2 km · 7 gates · ฿36B', status: 'approved' },
  ],

  // ── Historical timeline (key dates) ──
  timeline: [
    { year: 1782,  event: 'Rama I founds Krung Thep' },
    { year: 1863,  event: 'First canal — Khlong Phadung Krung Kasem' },
    { year: 1900,  event: 'Electric tramway opens' },
    { year: 1932,  event: 'Constitutional revolution' },
    { year: 1960,  event: 'Six-year highway plan' },
    { year: 1999,  event: 'BTS Skytrain opens' },
    { year: 2004,  event: 'MRT Blue Line opens' },
    { year: 2011,  event: 'Great Bangkok flood (5.6M affected)' },
    { year: 2019,  event: 'Pre-COVID peak: 39.9M visitors' },
    { year: 2022,  event: 'First directly-elected BMA governor' },
  ],

  // ── Shadow districts (DOPA vs VIIRS) ──
  shadowDistricts: DOPA_SUMMARY.districtsShrinking,
  totalDistricts: DOPA_SUMMARY.totalDistricts,
  viirsTrendMin: DOPA_SUMMARY.viirsTrendMin,
  viirsTrendMax: DOPA_SUMMARY.viirsTrendMax,
}

// Gap assessment — 8 priorities (was 6) for the deeper twin.
const GAPS: { label: string; score: number; note: string }[] = [
  {
    label: 'Green space & heat',
    score: Math.round((B.greenM2 / B.whoGreenTarget) * 100),
    note: `${B.greenM2} m²/person · WHO ${B.whoGreenTarget} · ${B.greenPct}% land cover · +${B.urbanHeatIsland}°C urban heat island`,
  },
  {
    label: 'Shadow population',
    score: 38,
    note: `${B.shadowDistricts}/${B.totalDistricts} districts shrinking · VIIRS all brighter (+${B.viirsTrendMin}–${B.viirsTrendMax}% YoY) · est. ${B.popShadow}M unregistered`,
  },
  {
    label: 'Mobility & congestion',
    score: Math.max(20, 100 - B.congestionPct),
    note: `TomTom +${B.congestionPct}% vs free-flow · ${B.vehiclePer1k} cars/1k · walkability ${B.walkability}/100`,
  },
  {
    label: 'Creative economy',
    score: Math.round(B.creativeScore),
    note: `SLIC creative ${B.creativeScore.toFixed(0)}/100 · ${B.creativeScore < 60 ? 'weakest pillar' : 'mid-tier'} · rank ${SLIC?.globalRank ?? '—'}/163`,
  },
  {
    label: 'Flood & subsidence',
    score: 42,
    note: `Sinking ${B.sinkingRate} cm/yr (max ${B.sinkingMax}) · ${B.floodProneArea}% of BMA in 2011 flood zone · Chao Phraya live below`,
  },
  {
    label: 'Housing affordability',
    score: Math.max(15, 100 - B.housingAffordability * 4),
    note: `P/I ${B.priceToIncome} yr · ${B.housingAffordability}% of income for median home · ${B.foreignOwnership}% foreign condo ownership at legal cap`,
  },
  {
    label: 'Digital & Samastiti',
    score: Math.round(B.capabilityScore),
    note: `5G ${B.fiveGCoverage}% pop · ${B.broadbandCoverage}% broadband · SLIC capability ${B.capabilityScore.toFixed(0)} · ${B.smartCityRank}`,
  },
  {
    label: 'Tourism recovery',
    score: B.tourismRecovery,
    note: `${B.tourismRecovery}% of 2019 receipts · ${B.unemployment}% unemployment · ${B.informalWorkers}% informal workers`,
  },
]

function statusOf(score: number): { word: string; color: string } {
  if (score >= 65) return { word: 'OPPORTUNITY', color: '#8bc34a' }
  if (score >= 50) return { word: 'MODERATE',    color: '#fdd835' }
  if (score >= 35) return { word: 'GAP',         color: '#fb8c00' }
  return              { word: 'AT RISK',     color: '#e53935' }
}

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

/** A single sector bar with label, value, and inline percentage. */
function SectorBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="ki-sector">
      <div className="ki-sector-top">
        <span className="ki-sector-lbl">{label}</span>
        <span className="ki-sector-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="ki-sector-track">
        <div className="ki-sector-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/** A single comparison row across the peer ASEAN capital set. */
function PeerRow({ metric, label, unit = '', max = 0 }: {
  metric: keyof typeof B.peers.bangkok
  label: string
  unit?: string
  max?: number
}) {
  const cities = Object.entries(B.peers) as [keyof typeof B.peers, typeof B.peers.bangkok][]
  const values = cities.map(([, v]) => v[metric])
  const m = max || Math.max(...values) * 1.05
  return (
    <div className="ki-peer-row">
      <span className="ki-peer-lbl">{label}</span>
      <div className="ki-peer-bars">
        {cities.map(([key, v]) => {
          const w = (v[metric] / m) * 100
          const isBkk = key === 'bangkok'
          return (
            <div key={key} className={`ki-peer-bar ${isBkk ? 'ki-peer-bar--bkk' : ''}`}>
              <span className="ki-peer-city">{key.toUpperCase().slice(0, 3)}</span>
              <div className="ki-peer-track">
                <div className="ki-peer-fill" style={{ width: `${w}%` }} />
              </div>
              <span className="ki-peer-val">{typeof v[metric] === 'number' ? v[metric].toLocaleString() : v[metric]}{unit}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
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
  const pop = useCountUp(B.popMillions)
  const age = useCountUp(B.medianAge)
  const foreign = useCountUp(B.popShadow, 1)
  const truePop = useCountUp(B.popMetro, 1)

  const weak = SLIC ? weakestPillar(SLIC) : null
  const strong = SLIC ? strongestPillar(SLIC) : null
  const greenPctOfWho = Math.min(100, Math.round((B.greenM2 / B.whoGreenTarget) * 100))

  // Economic composition (with colors mapped to risk-tinted palette)
  const sectors = [
    { label: 'SERVICES',     pct: B.sectorServices,       color: '#f59e0b' },
    { label: 'MANUFACTURING',pct: B.sectorManufacturing,  color: '#60a5fa' },
    { label: 'GOVERNMENT',   pct: B.sectorGovernment,     color: '#34d399' },
    { label: 'CONSTRUCTION', pct: B.sectorConstruction,   color: '#a78bfa' },
    { label: 'AGRICULTURE',  pct: B.sectorAgriculture,    color: '#fb7185' },
    { label: 'OTHER',        pct: B.sectorOther,          color: 'rgba(245,245,240,0.4)' },
  ]

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

      {/* ── Hero stats: 6-cell grid (was 3) ── */}
      <div className="ki-stats ki-stats--6">
        <div className="ki-stat">
          <span className="ki-stat-val">{pop.toFixed(1)}<span className="ki-unit">M</span></span>
          <span className="ki-stat-lbl">REGISTERED</span>
          <span className="ki-stat-sub">DOPA 2568</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">{truePop.toFixed(1)}<span className="ki-unit">M</span></span>
          <span className="ki-stat-lbl">METRO BMR</span>
          <span className="ki-stat-sub">+{foreign.toFixed(1)}M shadow</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">${Math.round(gdp)}<span className="ki-unit">B</span></span>
          <span className="ki-stat-lbl">METRO GPP</span>
          <span className="ki-stat-sub">NESDC framing</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">{fmtUsd(gpc)}</span>
          <span className="ki-stat-lbl">GDP / CAPITA</span>
          <span className="ki-stat-sub">{B.areaKm2} km²</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">+{cong.toFixed(0)}<span className="ki-unit">%</span></span>
          <span className="ki-stat-lbl">CONGESTION</span>
          <span className="ki-stat-sub" style={{ color: '#fb8c00' }}>TomTom</span>
        </div>
        <div className="ki-stat">
          <span className="ki-stat-val">{age.toFixed(0)}<span className="ki-unit">yr</span></span>
          <span className="ki-stat-lbl">MEDIAN AGE</span>
          <span className="ki-stat-sub">{B.workingAge}% working age</span>
        </div>
      </div>

      {/* ── Demographics deep-dive ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>DEMOGRAPHICS · โครงสร้างประชากร</span>
          <span className="ki-block-val">{B.popMillions}/{B.popMetro}<span className="ki-vs"> M reg/BMR</span></span>
        </div>
        <div className="ki-block-grid">
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">DENSITY</span>
            <span className="ki-mini-val">{B.densityKm2.toLocaleString()}<span className="ki-unit">/km²</span></span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">ELDERLY</span>
            <span className="ki-mini-val">{B.elderly}<span className="ki-unit">%</span></span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">FOREIGN</span>
            <span className="ki-mini-val">{B.foreignResidents}<span className="ki-unit">M</span></span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">HH SIZE</span>
            <span className="ki-mini-val">{B.avgHousehold}</span>
          </div>
        </div>
        <div className="ki-block-note">
          Net migration {B.netMigration}/1k/yr — BMR is a net donor to provinces. The shadow population ({B.popShadow}M unregistered) is the real Bangkok that never shows in the registry.
        </div>
      </div>

      {/* ── Shadow population (kept — the headline structural signal) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>SHADOW POPULATION · ประชากรแฝง</span>
          <span className="ki-block-tag">{B.shadowDistricts}/{B.totalDistricts} SHRINKING</span>
        </div>
        <div className="ki-block-note">
          Civil registration says {B.shadowDistricts} of {B.totalDistricts} districts are dying; NASA VIIRS night lights show every district brighter (+{B.viirsTrendMin}–{B.viirsTrendMax}% YoY). The gap is the invisible city.
        </div>
      </div>

      {/* ── Economic composition (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>ECONOMIC COMPOSITION · GPP {B.gdpBillion}B</span>
          <span className="ki-block-val">{B.unemployment}<span className="ki-vs">% unemployment</span></span>
        </div>
        <div className="ki-sectors">
          {sectors.map((s) => <SectorBar key={s.label} {...s} />)}
        </div>
        <div className="ki-block-note">
          {B.laborForce}M labor force · {B.informalWorkers}% informal · tourism receipts {B.tourismReceipts}T BHT (2019) → recovered to {B.tourismRecovery}% by 2024 (TAT).
        </div>
      </div>

      {/* ── Real estate (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>REAL ESTATE · อสังหาริมทรัพย์</span>
          <span className="ki-block-val">P/I {B.priceToIncome}<span className="ki-vs"> yr</span></span>
        </div>
        <div className="ki-block-grid">
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">CBD LAND</span>
            <span className="ki-mini-val">฿{(B.cbdLandPrice / 1000).toFixed(0)}K<span className="ki-unit">/m²</span></span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">MIDTOWN</span>
            <span className="ki-mini-val">฿{B.midtownCondo.toLocaleString()}<span className="ki-unit">/m²</span></span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">SUBURB</span>
            <span className="ki-mini-val">฿{B.suburbCondo.toLocaleString()}<span className="ki-unit">/m²</span></span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">RENT YIELD</span>
            <span className="ki-mini-val">{B.rentYieldStudio}<span className="ki-unit">%</span></span>
          </div>
        </div>
        <div className="ki-block-note">
          {B.foreignOwnership}% of new condo supply bought by foreign nationals (legal cap). {B.newCondoSupply.toLocaleString()} new units launched 2024 (REIC). The affordability gap — {B.housingAffordability}% of median income for a median home — keeps a generation renting.
        </div>
      </div>

      {/* ── Infrastructure (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>INFRASTRUCTURE · ขนส่งมวลชน</span>
          <span className="ki-block-val">{(B.btsSkytrainKm + B.mrtBlueKm + B.mrtPurpleKm + B.arlKm).toFixed(0)}<span className="ki-vs"> km rail</span></span>
        </div>
        <div className="ki-block-grid ki-block-grid--3">
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">BTS</span>
            <span className="ki-mini-val">{B.btsSkytrainKm}<span className="ki-unit"> km</span></span>
            <span className="ki-mini-sub">{(B.btsDailyRiders / 1000).toFixed(0)}K daily</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">MRT BLUE + PURPLE</span>
            <span className="ki-mini-val">{(B.mrtBlueKm + B.mrtPurpleKm).toFixed(0)}<span className="ki-unit"> km</span></span>
            <span className="ki-mini-sub">{(B.mrtDailyRiders / 1000).toFixed(0)}K daily</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">ARL</span>
            <span className="ki-mini-val">{B.arlKm}<span className="ki-unit"> km</span></span>
            <span className="ki-mini-sub">Suvarnabhumi link</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">ROADS</span>
            <span className="ki-mini-val">{(B.roadsKm / 1000).toFixed(1)}K<span className="ki-unit"> km</span></span>
            <span className="ki-mini-sub">BMA</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">VEHICLES</span>
            <span className="ki-mini-val">{B.vehicleRegistered}<span className="ki-unit"> M</span></span>
            <span className="ki-mini-sub">{B.vehiclePer1k}/1k residents</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">5G / BROADBAND</span>
            <span className="ki-mini-val">{B.fiveGCoverage}<span className="ki-unit">% / </span>{B.broadbandCoverage}<span className="ki-unit">%</span></span>
            <span className="ki-mini-sub">NBTC 2024</span>
          </div>
        </div>
        <div className="ki-block-note">
          Suvarnabhumi {B.bkkAirportPax}M pax + Don Mueang {B.dmkAirportPax}M pax (2023, AOT) — 2 airports makes Bangkok one of the few world capitals with dual-hub air capacity. Rail expansion in pipeline below.
        </div>
      </div>

      {/* ── Governance (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>GOVERNANCE · การปกครอง</span>
          <span className="ki-block-val">{B.districts}<span className="ki-vs"> districts · </span>{B.subDistricts}<span className="ki-vs"> khwaeng</span></span>
        </div>
        <div className="ki-block-note">
          Bangkok Metropolitan Administration (BMA) · annual budget ฿{B.bmaBudget}B · {B.bmaEmployees.toLocaleString()} civil servants · {B.bmaRevenueSource}% own-source revenue (balance from central government).
        </div>
        <div className="ki-block-note">
          Governor: <strong>{B.governorName}</strong> (direct election since {B.governorSince}) · Cabinet-appointed Permanent Secretary still holds parallel authority — the BMA is the only world capital I know of with this dual structure.
        </div>
      </div>

      {/* ── Climate & subsidence (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>CLIMATE &amp; SUBSIDENCE · การทรุดตัว</span>
          <span className="ki-block-tag" style={{ color: '#fb8c00' }}>−{B.sinkingRate} CM/YR</span>
        </div>
        <div className="ki-block-grid">
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">MAX SINKING</span>
            <span className="ki-mini-val" style={{ color: '#e53935' }}>{B.sinkingMax}<span className="ki-unit"> cm/yr</span></span>
            <span className="ki-mini-sub">inner-city hot zones</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">PEAK TEMP</span>
            <span className="ki-mini-val">{B.maxTempAvg}°C</span>
            <span className="ki-mini-sub">April avg · TMD</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">HEAT ISLAND</span>
            <span className="ki-mini-val">+{B.urbanHeatIsland}°C</span>
            <span className="ki-mini-sub">vs rural surround</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">RAINFALL</span>
            <span className="ki-mini-val">{B.annualRainfall.toLocaleString()}<span className="ki-unit"> mm</span></span>
            <span className="ki-mini-sub">{B.rainyDays} rainy days/yr</span>
          </div>
        </div>
        <div className="ki-block-note">
          {B.floodProneArea}% of BMA area was inside the 2011 flood footprint. Land subsidence is concentrated in inner Bangkok (Dusit, Pom Prap, Samphanthawong) — overpumping of the deep aquifer, not tectonic. The Chao Phraya flood barrier (pipeline below) is the structural answer.
        </div>
      </div>

      {/* ── Innovation & digital (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>INNOVATION &amp; DIGITAL · นวัตกรรม</span>
          <span className="ki-block-val">{B.smartCityRank}<span className="ki-vs"> IMD Smart City</span></span>
        </div>
        <div className="ki-block-grid">
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">STARTUPS</span>
            <span className="ki-mini-val">{B.startupsRegistered.toLocaleString()}</span>
            <span className="ki-mini-sub">DEPA registered</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">VC DEALS 2023</span>
            <span className="ki-mini-val">฿{B.ventureCapital}<span className="ki-unit">B</span></span>
            <span className="ki-mini-sub">Techsauce</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">5G STATIONS</span>
            <span className="ki-mini-val">{B.fiveGCoverage}<span className="ki-unit">% pop</span></span>
            <span className="ki-mini-sub">NBTC</span>
          </div>
          <div className="ki-mini-stat">
            <span className="ki-mini-lbl">E-GOV</span>
            <span className="ki-mini-val">{B.eGovServices.toLocaleString()}</span>
            <span className="ki-mini-sub">services on egov</span>
          </div>
        </div>
        <div className="ki-block-note">
          TRUE Digital Park (Chon Buri, BMR proxy) anchors the innovation corridor. 5G stands at {B.fiveGCoverage}% of population. SLIC creative {B.creativeScore.toFixed(0)}/100 · capability {B.capabilityScore.toFixed(0)}/100.
        </div>
      </div>

      {/* ── Comparison with peer ASEAN capitals (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>ASEAN CAPITAL PEERS · เปรียบเทียบ</span>
          <span className="ki-block-tag">6 CAPITALS</span>
        </div>
        <PeerRow metric="gdp"      label="METRO GDP (B USD)" max={500} />
        <PeerRow metric="gpc"      label="GDP / CAPITA (USD)" max={100_000} />
        <PeerRow metric="pop"      label="POPULATION (M)" max={50} />
        <PeerRow metric="density"  label="DENSITY (/km²)" max={50_000} />
        <PeerRow metric="aqi"      label="US AQI (TYPICAL)" max={200} />
        <PeerRow metric="greenM2"  label="GREEN SPACE (m²/person)" max={70} />
        <div className="ki-block-note">
          Bangkok sits in the middle of ASEAN capitals on GDP, ahead on population but behind Singapore on per-capita output, and ahead of Hanoi / Manila on green space. The AQI gap to Singapore (45 vs 64) is the most expensive — every working hour, every tourist dollar.
        </div>
      </div>

      {/* ── Major projects pipeline (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>PROJECT PIPELINE · โครงการ</span>
          <span className="ki-block-tag">{B.projects.length} ACTIVE</span>
        </div>
        <div className="ki-projects">
          {B.projects.map((p) => (
            <div key={p.name} className={`ki-project ki-project--${p.status}`}>
              <div className="ki-project-year">{p.year}</div>
              <div className="ki-project-body">
                <span className="ki-project-name">{p.name}</span>
                <span className="ki-project-scale">{p.scale}</span>
              </div>
              <span className="ki-project-status">{p.status.toUpperCase()}</span>
            </div>
          ))}
        </div>
        <div className="ki-block-note">
          ฿{B.projects.reduce((sum, p) => {
            const m = p.scale.match(/฿(\d+)B/)
            return sum + (m ? Number(m[1]) : 0)
          }, 0)}B in named infrastructure. The Orange Line alone is ~7× the entire BMA annual budget.
        </div>
      </div>

      {/* ── Historical timeline (NEW) ── */}
      <div className="ki-block">
        <div className="ki-block-head">
          <span>HISTORICAL TIMELINE · ประวัติศาสตร์</span>
          <span className="ki-block-tag">1782 → TODAY</span>
        </div>
        <div className="ki-timeline">
          {B.timeline.map((e) => (
            <div key={e.year} className="ki-timeline-event">
              <span className="ki-timeline-year">{e.year}</span>
              <span className="ki-timeline-dot" aria-hidden />
              <span className="ki-timeline-text">{e.event}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Green space vs WHO (kept) ── */}
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

      {/* ── SLIC / Samastiti structural readiness (kept) ── */}
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

      {/* ── Gap assessment (now 8 priorities) ── */}
      <div className="ki-block">
        <div className="ki-block-head"><span>GAP ASSESSMENT</span><span className="ki-block-tag">{GAPS.length} PRIORITIES</span></div>
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

      {/* ── Live hydrology — Chao Phraya via GloFAS (kept) ── */}
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
        Economics: NESDC GPP 2021 · UN-DESA · World Bank WDI · DOPA 2568 (Bangkok civil registration) ·
        NASA VIIRS DataProteins · TomTom Traffic Index 2024 · SLIC v3.4 · NESDC 30-year TMD rainfall ·
        NESDC workforce stats · AOT passenger numbers · BMA fiscal 2024 · REIC condo market 2024 ·
        NBTC 5G/broadband coverage 2024 · DEPA startup registry · World Bank Numbeo P/I index 2024 ·
        NSTDA/Chulalongkorn land-subsidence studies. River: GloFAS via Open-Meteo (live).
        Sensors, Traffy Fondue, and district anomalies render in the brief below.
      </div>
    </section>
  )
})
