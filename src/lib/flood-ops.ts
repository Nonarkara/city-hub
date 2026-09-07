/**
 * FloodDash-style operational watch for City Hub.
 *
 * Verb + freshness + measured vs modelled labels + act cards.
 * Heuristic watch only — not a DDPM / TMD / ONWR warning.
 *
 * Bangkok: GloFAS at Nakhon Sawan (modelled, published bands) + HII ThaiWater.
 * Other Thai cities with a province code: GloFAS relative + HII gauges.
 * Other cities: GloFAS relative at the city centroid only. Never invent
 * inundation polygons or pump status. Never ALL CLEAR on a dry/missing cell.
 */
import type { CityConfig } from '../config/cities'
import { fetchChaoPrayaForecast, fetchGlofasForecast, type FloodForecast } from '../data/flood-forecast'
import { fetchThaiwaterLevels, thaiwaterProvinceCode, type WaterLevelStation } from '../data/thaiwater'

export type FloodVerb =
  | 'ALL CLEAR'
  | 'STAY INFORMED'
  | 'PREPARE'
  | 'ACT NOW'
  | 'NO DATA'

export type FloodKind = 'measured' | 'modelled' | 'derived'

export interface FloodOpsState {
  verb: FloodVerb
  cityId: string
  reasons: Array<{ text: string; kind: FloodKind }>
  action: string
  hotlines: Array<{ label: string; tel: string }> | null
  disclaimer: string
  glofas: FloodForecast | null
  water: {
    stations: number
    worst: WaterLevelStation['status'] | null
    fallback: boolean
    obsTime: string | null
  } | null
  fetchedAt: string
}

const VERB_RANK: Record<FloodVerb, number> = {
  'NO DATA': 0,
  'ALL CLEAR': 1,
  'STAY INFORMED': 2,
  PREPARE: 3,
  'ACT NOW': 4,
}

function riskToVerb(risk: FloodForecast['days'][number]['risk']): FloodVerb {
  if (risk === 'emergency') return 'ACT NOW'
  if (risk === 'warning') return 'PREPARE'
  if (risk === 'watch') return 'STAY INFORMED'
  return 'ALL CLEAR'
}

function waterToVerb(status: WaterLevelStation['status']): FloodVerb {
  if (status === 'severe' || status === 'critical') return 'ACT NOW'
  if (status === 'warning') return 'PREPARE'
  return 'ALL CLEAR'
}

function worse(a: FloodVerb, b: FloodVerb): FloodVerb {
  return VERB_RANK[b] > VERB_RANK[a] ? b : a
}

const THAI_HOTLINES = [
  { label: 'DDPM 1784', tel: '1784' },
  { label: 'EMS 1669', tel: '1669' },
  { label: 'Police 191', tel: '191' },
]

function actionFor(verb: FloodVerb, city: CityConfig): string {
  switch (verb) {
    case 'ACT NOW':
      return city.country === 'TH'
        ? 'Avoid floodways. Move people and documents upstairs. Call 1784 / 1669. This is a watch from sensors + GloFAS, not a DDPM evacuation order.'
        : 'Avoid low ground. Treat this as a modelled river-discharge watch, not a local civil-protection order. Follow your city emergency service.'
    case 'PREPARE':
      return 'Move valuables off the floor. Photograph assets. Check local flood maps. Do not wait for the next news cycle.'
    case 'STAY INFORMED':
      return 'Discharge is elevated versus this cell’s recent baseline (or Chao Phraya watch bands). Recheck this panel tonight. Do not treat a watch as an all-clear.'
    case 'NO DATA':
      return city.country === 'TH'
        ? 'No usable flood signal. Do not assume ALL CLEAR. Check TMD / DDPM.'
        : 'No usable flood signal. Do not assume ALL CLEAR. Check your local hydro or civil-protection service.'
    default:
      return 'No flood action from this watch. Keep GloFAS and (where present) HII levels on a timer.'
  }
}

export async function computeFloodOps(city: CityConfig): Promise<FloodOpsState> {
  const fetchedAt = new Date().toISOString()
  const disclaimer =
    'Heuristic civic watch — not an official DDPM, TMD, or ONWR warning. GloFAS is modelled; ThaiWater gauges are measured when live. Chao Phraya bands apply only to Bangkok / Nakhon Sawan.'

  const glofasPromise =
    city.id === 'bangkok'
      ? fetchChaoPrayaForecast(30).catch(() => null)
      : fetchGlofasForecast(
          city.center[1],
          city.center[0],
          `${city.name} centroid (GloFAS)`,
          16,
          'relative',
        ).catch(() => null)

  const province = thaiwaterProvinceCode(city.id)
  const waterPromise = province
    ? fetchThaiwaterLevels(province).catch(() => null)
    : Promise.resolve(null)

  const [glofas, water] = await Promise.all([glofasPromise, waterPromise])

  const reasons: FloodOpsState['reasons'] = []
  let verb: FloodVerb = 'NO DATA'
  const glofasUsable = Boolean(glofas?.usable)

  if (glofas && glofasUsable) {
    const peak = glofas.days.reduce(
      (w, d) => (['low', 'watch', 'warning', 'emergency'].indexOf(d.risk) > ['low', 'watch', 'warning', 'emergency'].indexOf(w) ? d.risk : w),
      'low' as FloodForecast['days'][number]['risk'],
    )
    verb = worse(verb === 'NO DATA' ? 'ALL CLEAR' : verb, riskToVerb(peak))
    const band = glofas.mode === 'chao-phraya' ? 'Chao Phraya bands' : 'vs 45-day p90'
    reasons.push({
      text: `GloFAS ${glofas.gauge}: ${glofas.currentDischarge.toLocaleString()} m³/s now · peak ${glofas.peakDischarge?.toLocaleString() ?? '—'} (${glofas.trend}) · ${band}`,
      kind: 'modelled',
    })
  } else if (glofas && !glofasUsable) {
    reasons.push({
      text: `GloFAS at ${glofas.gauge}: cell looks dry (near-zero discharge). Not a calibrated flood gauge — not an all-clear.`,
      kind: 'modelled',
    })
  }

  let waterState: FloodOpsState['water'] = null
  if (water && water.length > 0) {
    const live = water.filter((s) => !s.isFallback)
    const used = live.length > 0 ? live : water
    const fallback = live.length === 0
    const rank = ['normal', 'warning', 'critical', 'severe'] as const
    const worst = used.reduce(
      (w, s) => (rank.indexOf(s.status) > rank.indexOf(w) ? s.status : w),
      'normal' as WaterLevelStation['status'],
    )
    const obsTime = used.map((s) => s.lastUpdate).sort().slice(-1)[0] ?? null
    waterState = { stations: used.length, worst, fallback, obsTime }

    if (fallback) {
      reasons.push({
        text: `ThaiWater gauges unavailable — ${used.length} frozen fallback points (not live). Ignored for the verb.`,
        kind: 'derived',
      })
    } else {
      verb = worse(verb, waterToVerb(worst))
      const nWarn = used.filter((s) => s.status !== 'normal').length
      reasons.push({
        text: `HII ThaiWater · ${city.name}: ${used.length} gauges, ${nWarn} at watch/overflow · worst ${worst.toUpperCase()} · obs ${obsTime ?? '—'}`,
        kind: 'measured',
      })
    }
  }

  const liveWater = Boolean(waterState && !waterState.fallback)
  if (!glofasUsable && !liveWater) verb = 'NO DATA'

  return {
    verb,
    cityId: city.id,
    reasons,
    action: actionFor(verb, city),
    hotlines: city.country === 'TH' ? THAI_HOTLINES : null,
    disclaimer,
    glofas,
    water: waterState,
    fetchedAt,
  }
}
