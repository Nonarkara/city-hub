/**
 * Reality Check Engine — systematic narrative-vs-measurement verdicts.
 *
 * For each topic, compares what sensors measure against what news says,
 * then issues a one-word verdict:
 *   CONFIRMED    — narrative matches reality
 *   UNDERSTATED  — problem exists but media is quiet
 *   OVERSTATED   — panic without basis in data
 *   CALM         — both data and narrative are quiet
 */

export type RealityVerdict = 'CONFIRMED' | 'UNDERSTATED' | 'OVERSTATED' | 'CALM'

export interface RealityCheckResult {
  topic: string
  narrative: {
    storyCount: number
    tone: number
    headlines: string[]
  }
  measured: {
    value: number | string
    unit: string
    level: 'good' | 'moderate' | 'high' | 'critical'
  }
  verdict: RealityVerdict
  verdictColor: string
  explanation: string
}

const VERDICT_COLOR: Record<RealityVerdict, string> = {
  CONFIRMED:   '#e53935',
  UNDERSTATED: '#fb8c00',
  OVERSTATED:  '#fdd835',
  CALM:        '#8bc34a',
}

function computeVerdict(measuredLevel: string, tone: number): RealityVerdict {
  const isBad = measuredLevel === 'critical' || measuredLevel === 'high'
  const isModerate = measuredLevel === 'moderate'
  const isAlarmist = tone < -3
  const isPositive = tone > 0

  if (isBad && isPositive) return 'UNDERSTATED'
  if (isBad && !isPositive) return 'CONFIRMED'
  if (isModerate && isAlarmist) return 'OVERSTATED'
  if (!isBad && isAlarmist) return 'OVERSTATED'
  return 'CALM'
}

/** Build a Reality Check for Air Quality */
export function realityCheckAir(
  pm25: number,
  aqi: number,
  newsTone: number,
  newsCount: number,
  headlines: string[],
): RealityCheckResult {
  const level = aqi >= 151 ? 'critical' : aqi >= 101 ? 'high' : aqi >= 51 ? 'moderate' : 'good'
  const verdict = computeVerdict(level, newsTone)
  return {
    topic: 'Air Quality',
    narrative: { storyCount: newsCount, tone: newsTone, headlines: headlines.slice(0, 3) },
    measured: { value: pm25, unit: 'µg/m³', level: level as RealityCheckResult['measured']['level'] },
    verdict,
    verdictColor: VERDICT_COLOR[verdict],
    explanation: verdict === 'CONFIRMED'
      ? `PM2.5 at ${pm25.toFixed(0)} µg/m³ and media tone at ${newsTone.toFixed(1)} — the crisis is real and being reported.`
      : verdict === 'UNDERSTATED'
      ? `PM2.5 at ${pm25.toFixed(0)} µg/m³ is hazardous, but media tone (${newsTone.toFixed(1)}) is too calm. The public may not be aware.`
      : verdict === 'OVERSTATED'
      ? `Media is alarmist (tone ${newsTone.toFixed(1)}) but PM2.5 at ${pm25.toFixed(0)} µg/m³ is not at crisis levels.`
      : `Air quality is normal at ${pm25.toFixed(0)} µg/m³ and media coverage is calm.`,
  }
}

/** Build a Reality Check for Traffic */
export function realityCheckTraffic(
  congestionAvg: number,
  newsTone: number,
  newsCount: number,
  headlines: string[],
): RealityCheckResult {
  const level = congestionAvg > 0.7 ? 'critical' : congestionAvg > 0.5 ? 'high' : congestionAvg > 0.3 ? 'moderate' : 'good'
  const verdict = computeVerdict(level, newsTone)
  return {
    topic: 'Traffic',
    narrative: { storyCount: newsCount, tone: newsTone, headlines: headlines.slice(0, 3) },
    measured: { value: Math.round(congestionAvg * 100), unit: '% congestion', level: level as RealityCheckResult['measured']['level'] },
    verdict,
    verdictColor: VERDICT_COLOR[verdict],
    explanation: verdict === 'CONFIRMED'
      ? `Congestion at ${Math.round(congestionAvg * 100)}% matches alarmist media coverage.`
      : verdict === 'UNDERSTATED'
      ? `Severe congestion (${Math.round(congestionAvg * 100)}%) but media is not reporting it.`
      : verdict === 'OVERSTATED'
      ? `Media hype about traffic but congestion is only ${Math.round(congestionAvg * 100)}%.`
      : `Traffic is flowing normally at ${Math.round(congestionAvg * 100)}% congestion.`,
  }
}

/** Build a Reality Check for Flooding */
export function realityCheckFlood(
  floodCount: number,
  citizenReports: number,
  newsTone: number,
  newsCount: number,
  headlines: string[],
): RealityCheckResult {
  const level = floodCount >= 5 ? 'critical' : floodCount >= 2 ? 'high' : floodCount > 0 ? 'moderate' : 'good'
  const verdict = computeVerdict(level, newsTone)
  return {
    topic: 'Flooding',
    narrative: { storyCount: newsCount, tone: newsTone, headlines: headlines.slice(0, 3) },
    measured: { value: floodCount, unit: 'zones', level: level as RealityCheckResult['measured']['level'] },
    verdict,
    verdictColor: VERDICT_COLOR[verdict],
    explanation: verdict === 'CONFIRMED'
      ? `${floodCount} flood zones and ${citizenReports} citizen reports confirm the narrative.`
      : verdict === 'UNDERSTATED'
      ? `${floodCount} flood zones + ${citizenReports} reports but media is quiet. Residents may be unaware.`
      : verdict === 'OVERSTATED'
      ? `Media alarm but only ${floodCount} flood zones reported by sensors.`
      : `No significant flooding detected.`,
  }
}

/** Build a Reality Check for Heat */
export function realityCheckHeat(
  heatIndex: number,
  newsTone: number,
  newsCount: number,
  headlines: string[],
): RealityCheckResult {
  const level = heatIndex >= 42 ? 'critical' : heatIndex >= 38 ? 'high' : heatIndex >= 35 ? 'moderate' : 'good'
  const verdict = computeVerdict(level, newsTone)
  return {
    topic: 'Heat',
    narrative: { storyCount: newsCount, tone: newsTone, headlines: headlines.slice(0, 3) },
    measured: { value: heatIndex, unit: '°C feels-like', level: level as RealityCheckResult['measured']['level'] },
    verdict,
    verdictColor: VERDICT_COLOR[verdict],
    explanation: verdict === 'CONFIRMED'
      ? `Heat index at ${heatIndex.toFixed(0)}°C is dangerous and media is reporting it.`
      : verdict === 'UNDERSTATED'
      ? `Extreme heat (${heatIndex.toFixed(0)}°C) but media coverage is insufficient.`
      : verdict === 'OVERSTATED'
      ? `Media heat warnings exceed actual conditions (${heatIndex.toFixed(0)}°C).`
      : `Heat index at ${heatIndex.toFixed(0)}°C is within normal range.`,
  }
}

/** Build a Reality Check for Civic Issues */
export function realityCheckCivic(
  activeComplaints: number,
  newsTone: number,
  newsCount: number,
  headlines: string[],
): RealityCheckResult {
  const level = activeComplaints >= 1000 ? 'critical' : activeComplaints >= 500 ? 'high' : activeComplaints >= 100 ? 'moderate' : 'good'
  const verdict = computeVerdict(level, newsTone)
  return {
    topic: 'Civic Issues',
    narrative: { storyCount: newsCount, tone: newsTone, headlines: headlines.slice(0, 3) },
    measured: { value: activeComplaints, unit: 'open tickets', level: level as RealityCheckResult['measured']['level'] },
    verdict,
    verdictColor: VERDICT_COLOR[verdict],
    explanation: verdict === 'CONFIRMED'
      ? `${activeComplaints} open tickets align with media attention.`
      : verdict === 'UNDERSTATED'
      ? `${activeComplaints} citizen complaints but little media coverage.`
      : verdict === 'OVERSTATED'
      ? `Media focus on civic issues exceeds the ${activeComplaints} open ticket volume.`
      : `Civic complaint volume is low at ${activeComplaints}.`,
  }
}

/** Generate all Reality Checks for a city snapshot */
export function generateRealityChecks(ctx: {
  pm25: number
  aqi: number
  congestionAvg: number
  floodCount: number
  citizenFloodReports: number
  heatIndex: number
  activeComplaints: number
  newsTone: number
  newsCount: number
  headlines: string[]
}): RealityCheckResult[] {
  return [
    realityCheckAir(ctx.pm25, ctx.aqi, ctx.newsTone, ctx.newsCount, ctx.headlines),
    realityCheckTraffic(ctx.congestionAvg, ctx.newsTone, ctx.newsCount, ctx.headlines),
    realityCheckFlood(ctx.floodCount, ctx.citizenFloodReports, ctx.newsTone, ctx.newsCount, ctx.headlines),
    realityCheckHeat(ctx.heatIndex, ctx.newsTone, ctx.newsCount, ctx.headlines),
    realityCheckCivic(ctx.activeComplaints, ctx.newsTone, ctx.newsCount, ctx.headlines),
  ].filter((r) => r.measured.level !== 'good' || r.narrative.storyCount > 0)
}
