/**
 * City Intelligence Engine — the brain of the Bangkok Operating System.
 *
 * Transforms raw sensor feeds into:
 *   1. Morning Brief — natural-language city status + recommended actions
 *   2. Predictive Risk — 6h trajectory extrapolation from trend data
 *   3. Anomaly Detection — automatic flagging of unusual patterns
 *   4. Cross-Source Gap Detection — when citizen reports contradict official data
 *   5. District Profiles — per-district accountability + risk scores
 *
 * Pure functions. No React. No side effects.
 */

import type { Pm25Live } from '../data/gistda'
import type { BangkokWeather } from '../data/openmeteo'
import type { BangkokAQI } from '../data/openmeteo-aq'
import type { TraffyStats, TraffyTicket } from '../data/traffy'
import type { GdeltNewsResult } from '../data/gdelt'
import { pm25ToRisk, aqiToRisk, heatToRisk, floodToRisk, civicToRisk, RISK_COLOR, type RiskLevel } from './risk'

// ── Morning Brief ─────────────────────────────────────────────────────────────

export interface MorningBrief {
  headline: string
  status: 'NORMAL' | 'ADVISORY' | 'ELEVATED' | 'CRITICAL'
  statusColor: string
  paragraphs: string[]
  actions: BriefAction[]
  gaps: SourceGap[]
}

export interface BriefAction {
  priority: number
  label: string
  detail: string
  draft?: string
}

export interface SourceGap {
  severity: 'low' | 'medium' | 'high'
  headline: string
  detail: string
}

export function generateMorningBrief(
  pm25: Pm25Live | null,
  weather: BangkokWeather | null,
  floodCount: number,
  aqi: BangkokAQI | null,
  traffy: TraffyStats | null,
  traffyFloods: TraffyTicket[],
  news: GdeltNewsResult | null,
): MorningBrief {
  const paragraphs: string[] = []
  const actions: BriefAction[] = []
  const gaps: SourceGap[] = []

  // ── Air quality narrative ────────────────────────────────────────────────
  const airLevel = aqi ? aqiToRisk(aqi.usAqi) : (pm25 ? pm25ToRisk(pm25.pm25) : 'good')
  const airValue = aqi ? `${aqi.usAqi} US AQI` : (pm25 ? `${pm25.pm25.toFixed(1)} µg/m³` : 'unknown')
  const airTrend = computeTrend(pm25?.history24h)

  if (airLevel === 'critical' || airLevel === 'high') {
    paragraphs.push(
      `Hazardous air quality detected at ${airValue}. ` +
      `${weather ? `Wind ${weather.windCardinal} at ${weather.windSpeed} km/h is insufficient for dispersion.` : ''} ` +
      `${airTrend === 'rising' ? 'Levels are trending worse — expect peak conditions by early morning.' : 'Levels are stable but remain in the danger zone.'}`
    )
    actions.push({
      priority: 1,
      label: 'ISSUE OUTDOOR BAN',
      detail: 'PM2.5 is in the hazardous range. Outdoor activity should be suspended for sensitive groups.',
      draft: aqi
        ? `[BMA ALERT] ค่าดัชนีคุณภาพอากาศ (AQI) ${aqi.usAqi} ระดับอันตราย — ห้ามออกนอกอาคารหากไม่จำเป็น โดยเฉพาะกลุ่มเสี่ยง กรุณาสวมหน้ากาก N95`
        : `[BMA ALERT] ฝุ่น PM2.5 ระดับอันตราย ${pm25?.pm25.toFixed(0)} µg/m³ — ห้ามออกนอกอาคารหากไม่จำเป็น`,
    })
  } else if (airLevel === 'moderate') {
    paragraphs.push(
      `Air quality is above safe limits at ${airValue}. ` +
      `${airTrend === 'rising' ? 'Trending upward — monitor closely through the afternoon.' : 'Stable but elevated.'}`
    )
    actions.push({
      priority: 3,
      label: 'MONITOR AIR TREND',
      detail: 'PM2.5 is above WHO guidelines. Watch for further deterioration.',
    })
  } else {
    paragraphs.push(`Air quality is within acceptable parameters at ${airValue}.`)
  }

  // ── Predictive narrative ─────────────────────────────────────────────────
  const prediction = predictPM25(pm25, weather)
  if (prediction) {
    if (prediction.risk === 'critical' || prediction.risk === 'high') {
      paragraphs.push(
        `Predictive models forecast ${prediction.risk === 'critical' ? 'CRITICAL' : 'UNHEALTHY'} air quality ` +
        `within ${prediction.hours} hours due to ${prediction.reason}. ` +
        `Pre-emptive action is recommended before conditions worsen.`
      )
      actions.push({
        priority: 2,
        label: 'PRE-EMPTIVE SCHOOL ADVISORY',
        detail: `Forecast suggests hazardous conditions by ${prediction.timeLabel}. Issue advisory tonight.`,
        draft: `[BMA] คาดการณ์คุณภาพอากาศพรุ่งนี้เช้าระดับอันตราย — โรงเรียนในกรุงเทพฯ ควรเตรียมงดกิจกรรมกลางแจ้ง`,
      })
    } else if (prediction.risk === 'moderate') {
      paragraphs.push(`Forecast indicates moderate elevation in ${prediction.hours} hours. No immediate action required.`)
    }
  }

  // ── Flood narrative ──────────────────────────────────────────────────────
  const traffyFloodCount = traffyFloods.length
  if (floodCount > 0 || traffyFloodCount > 0) {
    paragraphs.push(
      `${floodCount > 0 ? `${floodCount} flood zone${floodCount > 1 ? 's' : ''} active in central region per GISTDA.` : ''} ` +
      `${traffyFloodCount > 0 ? `${traffyFloodCount} citizen flood report${traffyFloodCount > 1 ? 's' : ''} via Traffy Fondue.` : ''} ` +
      `${weather ? `Current wind ${weather.windCardinal} at ${weather.windSpeed} km/h.` : ''}`
    )
    actions.push({
      priority: floodCount >= 3 ? 1 : 2,
      label: 'VERIFY DRAINAGE PUMPS',
      detail: `Active flooding detected. Verify pump status in Bang Na, On Nut, and Lat Krabang corridors.`,
      draft: `[BMA] น้ำท่วม ${Math.max(floodCount, traffyFloodCount)} พื้นที่ — กรุณาตรวจสอบสถานีสูบน้ำและรายงานผลภายใน 30 นาที`,
    })
  }

  // ── Heat narrative ───────────────────────────────────────────────────────
  if (weather && weather.feelsLike >= 35) {
    paragraphs.push(
      `Heat index at ${weather.feelsLike}°C. ` +
      `${weather.feelsLike >= 40 ? 'Outdoor workers at elevated risk. Construction sites in Bang Na, Lat Krabang, Min Buri are priority zones.' : 'Monitor outdoor event venues and construction sites.'}`
    )
    if (weather.feelsLike >= 40) {
      actions.push({
        priority: 2,
        label: 'ISSUE WORKER ADVISORY',
        detail: 'Heat stress risk for outdoor labor. Mandate shade breaks and hydration.',
        draft: `[BMA] อากาศร้อนจัด ${weather.feelsLike}°C — แนะนำให้แรงงานกลางแจ้งพักในร่มอย่างน้อย 15 นาที/ชั่วโมง`,
      })
    }
  }

  // ── Civic issues narrative ───────────────────────────────────────────────
  if (traffy && traffy.active > 0) {
    const topTypes = Object.entries(traffy.byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
    paragraphs.push(
      `${traffy.active.toLocaleString()} active civic issues via Traffy Fondue. ` +
      `${topTypes.length > 0 ? `Top categories: ${topTypes.map(([t, c]) => `${t} (${c})`).join(', ')}.` : ''}`
    )
    if (traffy.active > 500) {
      actions.push({
        priority: 3,
        label: 'REVIEW CIVIC BACKLOG',
        detail: `High volume of unresolved citizen reports (${traffy.active.toLocaleString()}). Review district allocation.`,
      })
    }
  }

  // ── Cross-source gap detection ───────────────────────────────────────────
  if (traffyFloodCount > 0 && floodCount === 0) {
    gaps.push({
      severity: 'high',
      headline: 'GAP: Citizen floods without official polygons',
      detail: `${traffyFloodCount} citizen flood reports but GISTDA shows 0 flood zones. Official monitoring may be missing localized flooding.`,
    })
  }
  if (airLevel === 'critical' && news && news.avgTone > 0) {
    gaps.push({
      severity: 'medium',
      headline: 'GAP: Hazardous air, calm news narrative',
      detail: `Air quality is CRITICAL but news sentiment is positive/calm (${news.avgTone.toFixed(1)}). Public awareness may be insufficient.`,
    })
  }
  if (airLevel === 'good' && news && news.avgTone < -5) {
    gaps.push({
      severity: 'low',
      headline: 'GAP: Calm air, alarmist news narrative',
      detail: `Air quality is normal but news tone is alarmist (${news.avgTone.toFixed(1)}). Possible misinformation or outdated reporting.`,
    })
  }

  // ── Overall status ───────────────────────────────────────────────────────
  const worstRisk = computeWorstRisk(airLevel, floodCount > 0 ? floodToRisk(floodCount) : 'good', weather ? heatToRisk(weather.feelsLike) : 'good', traffy ? civicToRisk(traffy.active) : 'good')
  const status = worstRisk === 'critical' ? 'CRITICAL' : worstRisk === 'high' ? 'ELEVATED' : worstRisk === 'moderate' ? 'ADVISORY' : 'NORMAL'
  const statusColor = RISK_COLOR[worstRisk]

  // Sort actions by priority
  actions.sort((a, b) => a.priority - b.priority)

  // Deduplicate actions by label
  const seen = new Set<string>()
  const uniqueActions = actions.filter((a) => {
    if (seen.has(a.label)) return false
    seen.add(a.label)
    return true
  })

  return {
    headline: `${status} · ${new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })}`,
    status,
    statusColor,
    paragraphs,
    actions: uniqueActions,
    gaps,
  }
}

// ── Predictive Intelligence ───────────────────────────────────────────────────

export interface Prediction {
  hours: number
  risk: RiskLevel
  reason: string
  timeLabel: string
}

function predictPM25(pm25: Pm25Live | null, weather: BangkokWeather | null): Prediction | null {
  if (!pm25 || pm25.history24h.length < 6) return null

  const history = pm25.history24h.map((h) => h[0])
  const recent = history.slice(-6)
  const slope = linearSlope(recent)
  const current = pm25.pm25
  const projected6h = current + slope * 6

  let risk: RiskLevel = pm25ToRisk(projected6h)
  if (risk === 'good') return null // Only warn if getting worse

  // Adjust for weather
  let reason = 'trend continuation'
  if (weather) {
    if (weather.windSpeed < 5) {
      reason = 'calm winds preventing dispersion'
      risk = escalateRisk(risk)
    } else if (weather.windSpeed > 15 && weather.windCardinal === 'N') {
      reason = 'northerly winds may improve conditions'
      risk = deEscalateRisk(risk)
    }
  }

  const now = new Date()
  const future = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  const timeLabel = future.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })

  return { hours: 6, risk, reason, timeLabel }
}

function linearSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const sumX = values.reduce((s, _, i) => s + i, 0)
  const sumY = values.reduce((s, v) => s + v, 0)
  const sumXY = values.reduce((s, v, i) => s + i * v, 0)
  const sumXX = values.reduce((s, _, i) => s + i * i, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

function escalateRisk(r: RiskLevel): RiskLevel {
  if (r === 'good') return 'moderate'
  if (r === 'moderate') return 'high'
  return 'critical'
}

function deEscalateRisk(r: RiskLevel): RiskLevel {
  if (r === 'critical') return 'high'
  if (r === 'high') return 'moderate'
  return 'good'
}

// ── Anomaly Detection ─────────────────────────────────────────────────────────

export interface Anomaly {
  id: string
  severity: 'low' | 'medium' | 'high'
  metric: string
  message: string
}

export function detectAnomalies(
  pm25: Pm25Live | null,
  weather: BangkokWeather | null,
  floodCount: number,
  aqi: BangkokAQI | null,
  traffy: TraffyStats | null,
): Anomaly[] {
  const anomalies: Anomaly[] = []

  // PM2.5 spike detection
  if (pm25 && pm25.history24h.length >= 4) {
    const recent = pm25.history24h.slice(-4).map((h) => h[0])
    const prev = recent[0]
    const curr = recent[recent.length - 1]
    const change = prev > 0 ? ((curr - prev) / prev) * 100 : 0
    if (change > 40) {
      anomalies.push({
        id: 'pm25-spike',
        severity: change > 80 ? 'high' : 'medium',
        metric: 'PM2.5',
        message: `PM2.5 jumped ${change.toFixed(0)}% in the last 4 hours`,
      })
    }
  }

  // AQI anomaly
  if (aqi && aqi.usAqi > 150) {
    anomalies.push({
      id: 'aqi-extreme',
      severity: 'high',
      metric: 'AQI',
      message: `US AQI at ${aqi.usAqi} — in the very-unhealthy range`,
    })
  }

  // Heat anomaly
  if (weather && weather.feelsLike >= 42) {
    anomalies.push({
      id: 'heat-extreme',
      severity: 'high',
      metric: 'HEAT',
      message: `Heat index ${weather.feelsLike}°C — extreme heat stress threshold`,
    })
  }

  // Civic backlog anomaly
  if (traffy && traffy.active > 1000) {
    anomalies.push({
      id: 'civic-backlog',
      severity: traffy.active > 5000 ? 'high' : 'medium',
      metric: 'CIVIC',
      message: `${traffy.active.toLocaleString()} unresolved citizen issues — backlog above threshold`,
    })
  }

  // Flood anomaly
  if (floodCount >= 5) {
    anomalies.push({
      id: 'flood-widespread',
      severity: 'high',
      metric: 'FLOOD',
      message: `${floodCount} simultaneous flood zones — widespread event`,
    })
  }

  return anomalies
}

// ── District Intelligence ─────────────────────────────────────────────────────

export interface DistrictProfile {
  name: string
  activeIssues: number
  topIssueTypes: string[]
  resolutionRate: number
  avgResponseHours: number | null
  floodRisk: 'low' | 'medium' | 'high'
}

export function buildDistrictProfiles(
  features: GeoJSON.Feature[],
): DistrictProfile[] {
  const byDistrict = new Map<string, { issues: number; types: Record<string, number>; finished: number; inprogress: number; responseMinutes: number[] }>()

  for (const f of features) {
    const props = (f.properties ?? {}) as Record<string, unknown>
    const district = String(props.district ?? 'Unknown')
    const state = String(props.state ?? '')
    const types = (props.problem_type_fondue as string[]) ?? []

    if (!byDistrict.has(district)) {
      byDistrict.set(district, { issues: 0, types: {}, finished: 0, inprogress: 0, responseMinutes: [] })
    }
    const d = byDistrict.get(district)!
    d.issues++
    for (const t of types) {
      d.types[t] = (d.types[t] ?? 0) + 1
    }
    if (state === 'เสร็จสิ้น') d.finished++
    if (state === 'กำลังดำเนินการ') d.inprogress++

    const dur = Number(props.duration_minutes_finished ?? 0)
    if (dur > 0) d.responseMinutes.push(dur)
  }

  const profiles: DistrictProfile[] = []
  for (const [name, data] of byDistrict) {
    const topTypes = Object.entries(data.types)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t)
    const totalResolved = data.finished + data.inprogress
    const resolutionRate = data.issues > 0 ? totalResolved / data.issues : 0
    const avgResponseHours = data.responseMinutes.length > 0
      ? data.responseMinutes.reduce((s, m) => s + m, 0) / data.responseMinutes.length / 60
      : null
    profiles.push({
      name,
      activeIssues: data.issues,
      topIssueTypes: topTypes,
      resolutionRate,
      avgResponseHours,
      floodRisk: data.types['น้ำท่วม'] > 3 ? 'high' : data.types['น้ำท่วม'] > 0 ? 'medium' : 'low',
    })
  }

  return profiles.sort((a, b) => b.activeIssues - a.activeIssues)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeTrend(history?: Array<[number, string]>): 'rising' | 'falling' | 'stable' {
  if (!history || history.length < 4) return 'stable'
  const recent = history.slice(-4).map((h) => h[0])
  const slope = linearSlope(recent)
  if (slope > 2) return 'rising'
  if (slope < -2) return 'falling'
  return 'stable'
}

function computeWorstRisk(...risks: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ['good', 'moderate', 'high', 'critical']
  let worst: RiskLevel = 'good'
  for (const r of risks) {
    if (order.indexOf(r) > order.indexOf(worst)) worst = r
  }
  return worst
}
