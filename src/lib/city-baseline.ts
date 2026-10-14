/**
 * city-baseline — the state document for a city.
 *
 * A planner starts work by knowing what the city IS, what we MEASURE, and what
 * we DON'T know. The baseline is the structured answer to those three. It is
 * computed from the city manifest alone (no network required), so a planner
 * can read it on a plane.
 *
 * Three things in this file:
 *  1. The hazard profile — what this city is at risk of.
 *  2. The baseline — identity + capacity + the one thing to watch this week.
 *  3. Synthesize from a live snapshot when readings are present.
 *
 * Hazard assignment is heuristic, not data-driven, and it has to be honest
 * about that. Bangkok does have floods; it is also a small landmass that
 * floods differently than Hanoi. We name the hazards and we say they are
 * typed, not measured.
 */
import type { CityConfig } from '../config/cities'

export type HazardKind = 'flood' | 'haze' | 'heat' | 'storm' | 'earthquake' | 'fire' | 'cold' | 'congestion'

/** A hazard the city is at risk of. `severity` is the planner's working
 *  assumption, not a measurement. We will overwrite it when we have
 *  evidence; until then, it is the conservative call. */
export interface Hazard {
  kind: HazardKind
  severity: 'low' | 'moderate' | 'high'
  seasonNote: string  // "November–January", "year-round", "May–October", …
}

export interface Capacity {
  populationMillions: number
  area_km2: number
  densityPerKm2: number
  tier: 'full' | 'lite'
  greenSpacePct?: number
  gdpPerCapitaUsd?: number
}

export interface CurrentReadings {
  aqi?: number
  aqiLevel?: 'good' | 'moderate' | 'unhealthy-sensitive' | 'unhealthy' | 'very-unhealthy' | 'hazardous'
  tempC?: number
  windKph?: number
  windDir?: string
  trafficIndex?: number       // 0–10, Longdo iTIC scale
  civicOpenCount?: number     // open Traffy-style issues
}

export interface CityBaseline {
  cityId: string
  cityName: string
  country: string
  capacity: Capacity
  hazards: Hazard[]
  /** The dominant concern. The one a planner should look at first. */
  primary: HazardKind
  /** "What I would tell a planner on day one." Single sentence. */
  briefing: string
  /** Empty until a live snapshot is supplied. */
  current: CurrentReadings
  /** When the live snapshot was assembled. */
  observedAt: string | null
}

interface HazardRule {
  match: (city: CityConfig) => boolean
  hazard: Hazard
}

const HAZARD_RULES: HazardRule[] = [
  // Bangkok — central Thailand, Chao Phraya, low-lying, basin haze, dense traffic.
  { match: (c) => c.id === 'bangkok',
    hazard: { kind: 'flood', severity: 'high', seasonNote: 'May–October monsoon, plus October king-tide' } },
  { match: (c) => c.id === 'bangkok',
    hazard: { kind: 'haze', severity: 'moderate', seasonNote: 'Dec–Apr (crop residue + regional)' } },
  { match: (c) => c.id === 'bangkok',
    hazard: { kind: 'congestion', severity: 'high', seasonNote: 'Year-round; peaks 7–9am, 4–7pm' } },

  // Chiang Mai — northern valley, agricultural burning.
  { match: (c) => c.id === 'chiang-mai',
    hazard: { kind: 'haze', severity: 'high', seasonNote: 'Feb–Apr burning season' } },
  { match: (c) => c.id === 'chiang-mai',
    hazard: { kind: 'flood', severity: 'moderate', seasonNote: 'Aug–Oct (Ping river)' } },

  // Phuket — island, tourism pressure, Andaman storms.
  { match: (c) => c.id === 'phuket',
    hazard: { kind: 'storm', severity: 'high', seasonNote: 'May–Oct (Andaman monsoon)' } },
  { match: (c) => c.id === 'phuket',
    hazard: { kind: 'congestion', severity: 'moderate', seasonNote: 'Nov–Feb (high season)' } },

  // Singapore — haze, heat.
  { match: (c) => c.id === 'singapore',
    hazard: { kind: 'haze', severity: 'moderate', seasonNote: 'Aug–Oct (regional fires)' } },
  { match: (c) => c.id === 'singapore',
    hazard: { kind: 'heat', severity: 'moderate', seasonNote: 'Year-round; peaks Mar–May' } },

  // Kuching — Borneo, Sarawak, similar to Singapore.
  { match: (c) => c.id === 'kuching',
    hazard: { kind: 'flood', severity: 'high', seasonNote: 'Nov–Feb (NE monsoon + king tides)' } },
  { match: (c) => c.id === 'kuching',
    hazard: { kind: 'haze', severity: 'moderate', seasonNote: 'Aug–Oct (regional peat fires)' } },

  // Canberra — bushfire, drought.
  { match: (c) => c.id === 'canberra',
    hazard: { kind: 'fire', severity: 'high', seasonNote: 'Oct–Mar (bushfire season)' } },
  { match: (c) => c.id === 'canberra',
    hazard: { kind: 'heat', severity: 'moderate', seasonNote: 'Dec–Feb' } },

  // Brasilia — Cerrado fire, dry winters.
  { match: (c) => c.id === 'brasilia',
    hazard: { kind: 'fire', severity: 'high', seasonNote: 'Aug–Oct (Cerrado burning)' } },
  { match: (c) => c.id === 'brasilia',
    hazard: { kind: 'heat', severity: 'moderate', seasonNote: 'Sep–Oct' } },

  // South-east Asian border city — Yala.
  { match: (c) => c.id === 'yala',
    hazard: { kind: 'flood', severity: 'moderate', seasonNote: 'Nov–Jan (monsoon)' } },
  { match: (c) => c.id === 'yala',
    hazard: { kind: 'heat', severity: 'low', seasonNote: 'Year-round' } },

  // Central Europe — flood on the big rivers, heat in summer, cold snap in winter.
  { match: (c) => ['warsaw', 'prague', 'budapest', 'bucharest'].includes(c.id),
    hazard: { kind: 'flood', severity: 'moderate', seasonNote: 'Mar–May (snow-melt + rain)' } },
  { match: (c) => ['warsaw', 'prague', 'budapest', 'bucharest', 'sofia', 'belgrade'].includes(c.id),
    hazard: { kind: 'heat', severity: 'moderate', seasonNote: 'Jun–Aug' } },
  { match: (c) => ['sofia', 'belgrade', 'bucharest'].includes(c.id),
    hazard: { kind: 'cold', severity: 'moderate', seasonNote: 'Dec–Feb' } },

  // Baltics — cold, ice.
  { match: (c) => ['tallinn', 'vilnius', 'riga'].includes(c.id),
    hazard: { kind: 'cold', severity: 'high', seasonNote: 'Nov–Mar' } },

  // Ljubljana + Kranj — Alpine, Sava river, earthquake history.
  { match: (c) => ['ljubljana', 'kranj'].includes(c.id),
    hazard: { kind: 'flood', severity: 'high', seasonNote: 'Oct–Dec (Sora/Sava)' } },
  { match: (c) => ['ljubljana', 'kranj'].includes(c.id),
    hazard: { kind: 'earthquake', severity: 'moderate', seasonNote: 'Dinaric fault zone' } },

  // Barcelona — Mediterranean, drought, heat, occasional flash flood.
  { match: (c) => c.id === 'barcelona',
    hazard: { kind: 'heat', severity: 'high', seasonNote: 'Jun–Sep' } },
  { match: (c) => c.id === 'barcelona',
    hazard: { kind: 'flood', severity: 'moderate', seasonNote: 'Sep–Nov (cut-back lows)' } },
]

const DEFAULT_RULES: HazardRule[] = [
  // Any uncovered city gets a temperate baseline.
  { match: (_c) => true,
    hazard: { kind: 'heat', severity: 'low', seasonNote: 'Year-round' } },
]

function deriveHazards(city: CityConfig): Hazard[] {
  const found: Hazard[] = []
  for (const rule of HAZARD_RULES) {
    if (rule.match(city)) found.push(rule.hazard)
  }
  if (found.length === 0) {
    for (const rule of DEFAULT_RULES) {
      if (rule.match(city)) found.push(rule.hazard)
    }
  }
  // Stable order: high severity first, then by kind.
  const order: Record<HazardKind, number> = { flood: 0, haze: 1, storm: 2, fire: 3, heat: 4, cold: 5, earthquake: 6, congestion: 7 }
  const sevOrder = { high: 0, moderate: 1, low: 2 } as const
  return found.slice().sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || order[a.kind] - order[b.kind])
}

const HAZARD_PHRASE: Record<HazardKind, string> = {
  flood:      'flood',
  haze:       'haze',
  heat:       'heat',
  storm:      'storm',
  fire:       'fire',
  cold:       'cold',
  earthquake: 'earthquake',
  congestion: 'congestion',
}

/**
 * Build a baseline from a city config alone — no network.
 * The briefing names the dominant hazard and gives a planner the
 * "look at this first" sentence.
 */
export function synthesizeBaseline(city: CityConfig): CityBaseline {
  const hazards = deriveHazards(city)
  const primary = hazards[0]?.kind ?? 'heat'
  const density = city.populationMillions * 1_000_000 / Math.max(1, city.area_km2)

  const tier = city.tier
  const capacity: Capacity = {
    populationMillions: city.populationMillions,
    area_km2: city.area_km2,
    densityPerKm2: Math.round(density),
    tier,
    greenSpacePct: city.demographics?.greenSpacePct,
    gdpPerCapitaUsd: city.demographics?.gdpPerCapitaUsd,
  }

  const phrase = HAZARD_PHRASE[primary]
  const season = hazards[0]?.seasonNote ?? ''
  const briefing = `${city.name} is a ${tier === 'full' ? 'full-tier' : 'lite-tier'} ${city.climate.toLowerCase()} city. Watch ${phrase} first (${season}).`

  return {
    cityId: city.id,
    cityName: city.name,
    country: city.country,
    capacity,
    hazards,
    primary,
    briefing,
    current: {},
    observedAt: null,
  }
}

/** Attach live readings to an existing baseline. Returns a new baseline. */
export function attachReadings(baseline: CityBaseline, readings: CurrentReadings, observedAt: string = new Date().toISOString()): CityBaseline {
  return { ...baseline, current: { ...baseline.current, ...readings }, observedAt }
}

/** Level helper, mirrors the dashboard's existing band. */
export function aqiLevel(aqi: number): CurrentReadings['aqiLevel'] {
  if (aqi <= 50)  return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'unhealthy-sensitive'
  if (aqi <= 200) return 'unhealthy'
  if (aqi <= 300) return 'very-unhealthy'
  return 'hazardous'
}

const AQI_COLOR: Record<NonNullable<CurrentReadings['aqiLevel']>, string> = {
  'good':                 '#8bc34a',
  'moderate':             '#fdd835',
  'unhealthy-sensitive':  '#fb8c00',
  'unhealthy':            '#e53935',
  'very-unhealthy':       '#8e24aa',
  'hazardous':            '#7e0023',
}

export function aqiColor(level: CurrentReadings['aqiLevel']): string {
  return level ? AQI_COLOR[level] : '#666666'
}
