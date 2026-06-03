/**
 * Pure risk computation — no React, no side effects.
 * Translates raw sensor values into decision-ready vitals and actionable alerts.
 */
import type { Pm25Live } from '../data/gistda'
import type { BangkokWeather } from '../data/openmeteo'
import type { BangkokAQI } from '../data/openmeteo-aq'
import type { TraffyStats } from '../data/traffy'

export type RiskLevel = 'good' | 'moderate' | 'high' | 'critical'

export interface VitalStatus {
  id: string
  label: string
  value: string
  unit?: string
  level: RiskLevel
  sub?: string
}

export interface CityAlert {
  id: string
  level: RiskLevel
  headline: string
  detail: string
  action: string
  draft?: string
}

// ── Threshold functions ───────────────────────────────────────────────────────

/** Thai PCD bands mapped to 4 risk levels */
export function pm25ToRisk(v: number): RiskLevel {
  if (v < 25) return 'good'      // below WHO daily guideline
  if (v < 50) return 'moderate'  // PCD "good" ceiling
  if (v < 100) return 'high'     // PCD "moderate" → "unhealthy"
  return 'critical'
}

export function heatToRisk(feelsLike: number): RiskLevel {
  if (feelsLike < 35) return 'good'
  if (feelsLike < 40) return 'moderate'
  if (feelsLike < 45) return 'high'
  return 'critical'
}

export function floodToRisk(count: number): RiskLevel {
  if (count === 0) return 'good'
  if (count < 3)  return 'moderate'
  if (count < 6)  return 'high'
  return 'critical'
}

export function aqiToRisk(aqi: number): RiskLevel {
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'high'
  return 'critical'
}

export function civicToRisk(active: number): RiskLevel {
  if (active < 100) return 'good'
  if (active < 500) return 'moderate'
  if (active < 2000) return 'high'
  return 'critical'
}

// ── Vitals ────────────────────────────────────────────────────────────────────

export function computeVitals(
  pm25: Pm25Live | null,
  weather: BangkokWeather | null,
  floodCount: number,
  aqi: BangkokAQI | null,
  traffy: TraffyStats | null,
): VitalStatus[] {
  const trafficSub = traffy
    ? Object.entries(traffy.byType).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join(' · ') || 'NO DATA'
    : 'NO DATA'

  return [
    {
      id: 'air',
      label: 'AIR',
      value: aqi ? String(aqi.usAqi) : (pm25 ? pm25.pm25.toFixed(0) : '—'),
      unit: aqi ? 'US AQI' : (pm25 ? 'µg/m³' : undefined),
      level: aqi ? aqiToRisk(aqi.usAqi) : (pm25 ? pm25ToRisk(pm25.pm25) : 'good'),
      sub: aqi ? aqi.level.toUpperCase() : (pm25 ? pm25.level.toUpperCase() : 'NO DATA'),
    },
    {
      id: 'flood',
      label: 'FLOOD',
      value: floodCount > 0 ? String(floodCount) : 'CLEAR',
      unit: floodCount > 0 ? 'ZONES' : undefined,
      level: floodToRisk(floodCount),
      sub: floodCount > 0 ? 'CENTRAL REGION' : 'ALL CLEAR',
    },
    {
      id: 'heat',
      label: 'HEAT',
      value: weather ? `${weather.feelsLike}°` : '—',
      level: weather ? heatToRisk(weather.feelsLike) : 'good',
      sub: weather ? `${weather.windCardinal} · ${weather.windSpeed} KM/H` : 'LOADING…',
    },
    {
      id: 'traffic',
      label: 'CIVIC',
      value: traffy ? traffy.active.toLocaleString() : '—',
      unit: traffy ? 'OPEN' : undefined,
      level: traffy ? civicToRisk(traffy.active) : 'good',
      sub: trafficSub.length > 60 ? trafficSub.slice(0, 60) + '…' : trafficSub,
    },
    // DISEASE vital — placeholder until DDC Thailand API is integrated.
    // Research: DDC publishes dengue data weekly but has no live JSON endpoint.
    // See tasks backlog for DDC integration notes.
    // {
    //   id: 'disease',
    //   label: 'DENGUE',
    //   value: '—',
    //   level: 'good',
    //   sub: 'DDC data · pending',
    // },
  ]
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export function computeAlerts(
  pm25: Pm25Live | null,
  weather: BangkokWeather | null,
  floodCount: number,
  aqi: BangkokAQI | null,
  traffyFloods: number,
): CityAlert[] {
  const alerts: CityAlert[] = []

  // ── Air quality ──────────────────────────────────────────────────────────
  const airLevel = aqi ? aqiToRisk(aqi.usAqi) : (pm25 ? pm25ToRisk(pm25.pm25) : 'good')
  const airValue = aqi ? aqi.usAqi : (pm25 ? pm25.pm25 : 0)
  const airUnit = aqi ? 'US AQI' : 'µg/m³'
  const windNote = weather
    ? ` Wind ${weather.windCardinal} at ${weather.windSpeed} km/h — levels may peak by 14:00.`
    : ''

  if (airLevel === 'critical') {
    alerts.push({
      id: 'air-critical',
      level: 'critical',
      headline: `AIR CRITICAL — ${airValue} ${airUnit}`,
      detail: `Hazardous air across Bangkok.${windNote} ${aqi ? `PM2.5: ${aqi.pm25} · PM10: ${aqi.pm10} · NO₂: ${aqi.no2}` : `24h max: ${pm25?.max24h.toFixed(0)} µg/m³`}. Outdoor activity strongly discouraged.`,
      action: 'ISSUE OUTDOOR BAN',
      draft: `[BMA ALERT] ฝุ่น PM2.5 ระดับอันตราย ${airValue} ${airUnit} — ห้ามออกนอกอาคารหากไม่จำเป็น โดยเฉพาะกลุ่มเสี่ยง กรุณาสวมหน้ากาก N95`,
    })
  } else if (airLevel === 'high') {
    alerts.push({
      id: 'air-high',
      level: 'high',
      headline: `AIR UNHEALTHY — ${airValue} ${airUnit}`,
      detail: `Sensitive groups at risk.${windNote} ${aqi ? `PM2.5: ${aqi.pm25} · PM10: ${aqi.pm10}` : `24h max: ${pm25?.max24h.toFixed(0)} µg/m³`}.`,
      action: 'DRAFT SCHOOL ADVISORY',
      draft: `[BMA] แจ้งเตือน PM2.5 ${airValue} ${airUnit} — โรงเรียนในกรุงเทพฯ ควรงดกิจกรรมกลางแจ้งวันนี้`,
    })
  } else if (airLevel === 'moderate') {
    alerts.push({
      id: 'air-moderate',
      level: 'moderate',
      headline: `AIR ABOVE LIMIT — ${airValue} ${airUnit}`,
      detail: 'Above safe threshold. Monitor trend through afternoon.',
      action: 'MONITOR',
    })
  }

  // ── Traffy flood reports ─────────────────────────────────────────────────
  if (traffyFloods > 0) {
    alerts.push({
      id: 'traffy-flood',
      level: traffyFloods >= 10 ? 'critical' : traffyFloods >= 5 ? 'high' : 'moderate',
      headline: `CITIZEN FLOOD REPORTS — ${traffyFloods} TICKET${traffyFloods > 1 ? 'S' : ''}`,
      detail: 'Active flood complaints via Traffy Fondue. Cross-reference with GISTDA flood polygons and verify drainage pump status.',
      action: 'VERIFY DRAINAGE',
      draft: `[BMA] รับแจ้งน้ำท่วม ${traffyFloods} เรื่องจากประชาชน — กรุณาตรวจสอบสถานีสูบน้ำและรายงานผลภายใน 30 นาที`,
    })
  }

  // ── GISTDA Flooding ──────────────────────────────────────────────────────
  if (floodCount > 0) {
    alerts.push({
      id: 'flood-active',
      level: floodCount >= 4 ? 'critical' : 'high',
      headline: `FLOODING — ${floodCount} ACTIVE ZONE${floodCount > 1 ? 'S' : ''}`,
      detail: 'Active flood zones in central region. Verify drainage pump status. Check BTS/MRT On Nut, Bang Na corridor exposure.',
      action: 'ALERT DISTRICT CHIEFS',
      draft: `[BMA] น้ำท่วม ${floodCount} พื้นที่ — กรุณาตรวจสอบสถานีสูบน้ำในพื้นที่และรายงานสถานการณ์ภายใน 30 นาที`,
    })
  }

  // ── Heat ─────────────────────────────────────────────────────────────────
  if (weather) {
    if (weather.feelsLike >= 40) {
      alerts.push({
        id: 'heat-high',
        level: weather.feelsLike >= 45 ? 'critical' : 'high',
        headline: `HEAT INDEX ${weather.feelsLike}°C`,
        detail: `Outdoor workers at elevated risk. Construction sites in Bang Na, Lat Krabang, Min Buri are priority zones.`,
        action: 'ISSUE WORKER ADVISORY',
        draft: `[BMA] อากาศร้อนจัด ${weather.feelsLike}°C — แนะนำให้แรงงานกลางแจ้งพักในร่มอย่างน้อย 15 นาที/ชั่วโมง และดื่มน้ำบ่อยครั้ง`,
      })
    } else if (weather.feelsLike >= 35) {
      alerts.push({
        id: 'heat-moderate',
        level: 'moderate',
        headline: `HEAT INDEX ${weather.feelsLike}°C`,
        detail: `Elevated heat. Wind ${weather.windCardinal} at ${weather.windSpeed} km/h. Monitor outdoor event venues.`,
        action: 'MONITOR',
      })
    }
  }

  // All-clear fallback
  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      level: 'good',
      headline: 'CITY STATUS NORMAL',
      detail: 'All monitored systems within acceptable parameters.',
      action: 'NO ACTION REQUIRED',
    })
  }

  return alerts
}

// ── Colour maps ───────────────────────────────────────────────────────────────

export const RISK_COLOR: Record<RiskLevel, string> = {
  good:     '#8bc34a',
  moderate: '#fdd835',
  high:     '#fb8c00',
  critical: '#e53935',
}

/** Semi-transparent fills for the map district risk surface */
export const RISK_FILL: Record<RiskLevel, string> = {
  good:     'rgba(139,195,74,0.10)',
  moderate: 'rgba(253,216,53,0.16)',
  high:     'rgba(251,140,0,0.24)',
  critical: 'rgba(229,57,53,0.30)',
}

/** Border colour for district outlines */
export const RISK_BORDER: Record<RiskLevel, string> = {
  good:     'rgba(139,195,74,0.50)',
  moderate: 'rgba(253,216,53,0.65)',
  high:     'rgba(251,140,0,0.75)',
  critical: 'rgba(229,57,53,0.85)',
}
