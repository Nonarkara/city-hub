/**
 * Insight Cards Engine — auto-generate statistical insights from live data.
 *
 * Scans all available feeds and produces typed insight cards that can be
 * rendered as a grid, pinned, or narrated by Gemini.
 */

import {
  zScore,
  stdDev,
  mean,
  cusumChangePoints,
  linearRegression,
} from './stats'
import type { DistrictSummary } from '../hooks/useDistrictData'
import type { CityAlert } from './risk'
import type { Anomaly } from './intelligence'

export type InsightType = 'trend' | 'outlier' | 'correlation' | 'changePoint' | 'benchmark' | 'comparison' | 'multiHazard'

export interface InsightCard {
  id: string
  type: InsightType
  severity: 'low' | 'medium' | 'high' | 'critical'
  headline: string
  detail: string
  value?: number
  delta?: number
  deltaPct?: number
  confidence: number // 0-1
  sources: string[]
  timestamp: number
  districtId?: string
  actionDraft?: string
}

interface InsightContext {
  pm25History: number[]
  aqiHistory: number[]
  traffyCounts: number[]
  districts: DistrictSummary[]
  alerts: CityAlert[]
  anomalies: Anomaly[]
  currentPM25: number
  currentAQI: number
  weatherTemp: number
  weatherWind: number
  floodCount: number
  peerCities?: { name: string; pm25: number; aqi: number }[]
}

/** Generate all insight cards from a live context snapshot */
export function computeInsightCards(ctx: InsightContext): InsightCard[] {
  const cards: InsightCard[] = []
  const now = Date.now()

  // ── 1. Trend insights ──────────────────────────────────────────────────────
  if (ctx.pm25History.length >= 6) {
    const recent = ctx.pm25History.slice(-6)
    const lr = linearRegression(recent.map((_, i) => i), recent)
    if (Math.abs(lr.slope) > 1.5) {
      const direction = lr.slope > 0 ? 'rising' : 'falling'
      const hours = recent.length
      const change = recent[recent.length - 1] - recent[0]
      cards.push({
        id: `trend-pm25-${now}`,
        type: 'trend',
        severity: change > 20 ? 'critical' : change > 10 ? 'high' : 'medium',
        headline: `PM2.5 ${direction} for ${hours} consecutive hours`,
        detail: `Levels moved from ${recent[0].toFixed(1)} to ${recent[recent.length - 1].toFixed(1)} µg/m³ (${change > 0 ? '+' : ''}${change.toFixed(1)}). Slope ${lr.slope.toFixed(2)} µg/hr.`,
        value: recent[recent.length - 1],
        delta: change,
        confidence: Math.min(0.95, Math.abs(lr.r2)),
        sources: ['GISTDA'],
        timestamp: now,
        actionDraft: change > 15
          ? `[BMA ALERT] ค่าฝุ่น PM2.5 เพิ่มขึ้นต่อเนื่อง ${hours} ชั่วโมง — ประชาชนควรสวมหน้ากากและหลีกเลี่ยงกิจกรรมกลางแจ้ง`
          : undefined,
      })
    }
  }

  // ── 2. Outlier insights ────────────────────────────────────────────────────
  if (ctx.districts.length > 0) {
    const counts = ctx.districts.map((d) => d.complaint_count)
    const avg = mean(counts)
    const sd = stdDev(counts)
    for (const d of ctx.districts) {
      const z = sd > 0 ? (d.complaint_count - avg) / sd : 0
      if (z > 2.5) {
        cards.push({
          id: `outlier-district-${d.name_th}-${now}`,
          type: 'outlier',
          severity: z > 3.5 ? 'critical' : 'high',
          headline: `${d.name_en} has ${d.complaint_count}x normal complaint volume`,
          detail: `${d.complaint_count} active complaints vs district average ${avg.toFixed(0)} (z=${z.toFixed(1)}). Vulnerability score: ${d.vulnerability_score}/100.`,
          value: d.complaint_count,
          deltaPct: sd > 0 ? ((d.complaint_count - avg) / avg) * 100 : 0,
          confidence: Math.min(0.95, z / 4),
          sources: ['Traffy Fondue'],
          timestamp: now,
          districtId: d.name_th,
          actionDraft: `[BMA] เขต${d.name_th} รับเรื่องร้องเรียน ${d.complaint_count} เรื่อง (สูงกว่าค่าเฉลี่ย ${Math.round((z * 100))}%) — กรุณาตรวจสอบและรายงานผล`,
        })
      }
    }
  }

  // ── 3. Z-score outlier on PM2.5 history ────────────────────────────────────
  if (ctx.pm25History.length >= 12) {
    const z = zScore(ctx.pm25History[ctx.pm25History.length - 1], ctx.pm25History)
    if (Math.abs(z) > 2) {
      cards.push({
        id: `outlier-pm25-${now}`,
        type: 'outlier',
        severity: z > 3 ? 'critical' : 'high',
        headline: `PM2.5 ${z > 0 ? 'spike' : 'drop'} — ${Math.abs(z).toFixed(1)}σ from normal`,
        detail: `Current ${ctx.currentPM25.toFixed(1)} µg/m³ is ${Math.abs(z).toFixed(1)} standard deviations ${z > 0 ? 'above' : 'below'} the 24h average.`,
        value: ctx.currentPM25,
        confidence: Math.min(0.95, Math.abs(z) / 4),
        sources: ['GISTDA'],
        timestamp: now,
      })
    }
  }

  // ── 4. Change-point insights ───────────────────────────────────────────────
  if (ctx.aqiHistory.length >= 12) {
    const cps = cusumChangePoints(ctx.aqiHistory, 2.5)
    if (cps.length > 0) {
      const lastCp = cps[cps.length - 1]
      const before = mean(ctx.aqiHistory.slice(Math.max(0, lastCp - 3), lastCp))
      const after = mean(ctx.aqiHistory.slice(lastCp, Math.min(ctx.aqiHistory.length, lastCp + 3)))
      const change = after - before
      cards.push({
        id: `changepoint-aqi-${now}`,
        type: 'changePoint',
        severity: Math.abs(change) > 30 ? 'critical' : Math.abs(change) > 15 ? 'high' : 'medium',
        headline: `AQI shifted ${change > 0 ? '+' : ''}${change.toFixed(0)} points at H-${ctx.aqiHistory.length - lastCp}`,
        detail: `CUSUM detected a regime change ${ctx.aqiHistory.length - lastCp} hours ago. Pre-level ${before.toFixed(0)}, post-level ${after.toFixed(0)}.`,
        value: after,
        delta: change,
        confidence: 0.82,
        sources: ['Open-Meteo'],
        timestamp: now,
      })
    }
  }

  // ── 5. Benchmark insights ──────────────────────────────────────────────────
  const whoGuideline = 15 // µg/m³ annual, 25 daily — use 25 as alert threshold
  if (ctx.currentPM25 > whoGuideline) {
    const ratio = ctx.currentPM25 / whoGuideline
    cards.push({
      id: `benchmark-who-${now}`,
      type: 'benchmark',
      severity: ratio > 4 ? 'critical' : ratio > 2 ? 'high' : 'medium',
      headline: `PM2.5 is ${ratio.toFixed(1)}× WHO daily guideline`,
      detail: `Current ${ctx.currentPM25.toFixed(1)} µg/m³ vs WHO 25 µg/m³ daily limit. ${ratio > 3 ? 'Hazardous for all groups.' : 'Sensitive groups should limit exposure.'}`,
      value: ctx.currentPM25,
      deltaPct: (ratio - 1) * 100,
      confidence: 0.95,
      sources: ['WHO', 'GISTDA'],
      timestamp: now,
      actionDraft: ratio > 3
        ? `[BMA ALERT] ค่าฝุ่น PM2.5 สูงกว่าเกณฑ์ WHO ${ratio.toFixed(1)} เท่า — ประกาศห้ามออกนอกอาคารสำหรับทุกกลุ่ม`
        : `[BMA] ค่าฝุ่น PM2.5 เกินเกณฑ์ WHO — กลุ่มเสี่ยงควรหลีกเลี่ยงกิจกรรมกลางแจ้ง`,
    })
  }

  // ── 6. Multi-hazard stacking ───────────────────────────────────────────────
  const hazardCount = [
    ctx.currentPM25 > 50,
    ctx.floodCount > 0,
    ctx.weatherTemp >= 35,
    ctx.anomalies.length > 0,
  ].filter(Boolean).length
  if (hazardCount >= 3) {
    cards.push({
      id: `multihazard-${now}`,
      type: 'multiHazard',
      severity: 'critical',
      headline: `MULTI-HAZARD DAY — ${hazardCount} simultaneous stressors`,
      detail: `Concurrent: PM2.5 ${ctx.currentPM25.toFixed(0)} µg/m³, ${ctx.floodCount} flood zone${ctx.floodCount > 1 ? 's' : ''}, heat index ${ctx.weatherTemp.toFixed(0)}°C, ${ctx.anomalies.length} anomaly flag${ctx.anomalies.length > 1 ? 's' : ''}.`,
      confidence: 0.92,
      sources: ['GISTDA', 'Open-Meteo', 'Traffy'],
      timestamp: now,
      actionDraft: `[BMA] วันนี้มีภัยพิบัติหลายประเภทพร้อมกัน ${hazardCount} อย่าง — กรุณาประสานหน่วยงานที่เกี่ยวข้องและตรวจสอบพื้นที่เสี่ยง`,
    })
  }

  // ── 7. Peer city comparison ────────────────────────────────────────────────
  if (ctx.peerCities && ctx.peerCities.length > 0) {
    const peers = ctx.peerCities.filter((p) => p.pm25 > 0)
    if (peers.length > 0) {
      const peerAvg = mean(peers.map((p) => p.pm25))
      const diff = ctx.currentPM25 - peerAvg
      const diffPct = peerAvg > 0 ? (diff / peerAvg) * 100 : 0
      if (Math.abs(diffPct) > 15) {
        cards.push({
          id: `comparison-peer-${now}`,
          type: 'comparison',
          severity: diffPct > 30 ? 'high' : 'medium',
          headline: `Bangkok PM2.5 ${diff > 0 ? diffPct.toFixed(0) + '% above' : Math.abs(diffPct).toFixed(0) + '% below'} peer average`,
          detail: `Current ${ctx.currentPM25.toFixed(1)} vs peer average ${peerAvg.toFixed(1)} µg/m³ across ${peers.length} cities.`,
          value: ctx.currentPM25,
          deltaPct: diffPct,
          confidence: 0.78,
          sources: ['Open-Meteo'],
          timestamp: now,
        })
      }
    }
  }

  // ── 8. Wind-dispersion insight ─────────────────────────────────────────────
  if (ctx.currentPM25 > 40 && ctx.weatherWind < 5) {
    cards.push({
      id: `wind-dispersion-${now}`,
      type: 'correlation',
      severity: ctx.currentPM25 > 80 ? 'critical' : 'high',
      headline: 'Stagnant air trapping pollution',
      detail: `PM2.5 at ${ctx.currentPM25.toFixed(0)} µg/m³ with wind only ${ctx.weatherWind.toFixed(0)} km/h — insufficient for dispersion. Expect accumulation.`,
      confidence: 0.85,
      sources: ['Open-Meteo', 'GISTDA'],
      timestamp: now,
      actionDraft: `[BMA] ลมสงบ (${ctx.weatherWind.toFixed(0)} กม./ชม.) ทำให้ฝุ่นไม่กระจาย — แนะนำให้งดกิจกรรมกลางแจ้งและเพิ่มการรดน้ำถนน`,
    })
  }

  // Sort by severity then confidence
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return cards.sort((a, b) => {
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity]
    }
    return b.confidence - a.confidence
  })
}
