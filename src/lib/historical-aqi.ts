/**
 * Historical AQI context — fetches last 7 days of hourly AQI from
 * Open-Meteo's free historical air quality API and computes:
 *   - weekAvg:     average AQI over the past 7 days
 *   - vsLastWeek:  % difference (current vs same day last week)
 *   - vsLastYear:  % difference vs same week last year (if available)
 *   - trend:       'rising' | 'falling' | 'stable'
 *
 * Used by SituationBrief to add context: "Today's AQI is 34% above
 * last week's average."
 */
import { cachedFetch } from './cached-fetch'

const TTL = 60 * 60_000  // 1 hour — historical data doesn't change

export interface AQIHistory {
  weekAvg:    number
  yesterday:  number
  vsYesterday: number   // % change (positive = worse)
  trend:      'rising' | 'falling' | 'stable'
  hours:      number[]  // last 168 hourly readings (7 days)
}

function dateString(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

export async function fetchAQIHistory(
  lat: number,
  lng: number,
  timezone = 'Asia/Bangkok',
): Promise<AQIHistory> {
  const key       = `hist/aqi/${lat.toFixed(2)},${lng.toFixed(2)}`
  const startDate = dateString(8)   // 8 days back to ensure 7 full days
  const endDate   = dateString(1)   // yesterday (today still being written)

  return cachedFetch(key, async () => {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=us_aqi` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&timezone=${encodeURIComponent(timezone)}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Historical AQI ${res.status}`)
    const data = await res.json() as { hourly?: { us_aqi?: (number | null)[] } }

    const raw = data.hourly?.us_aqi ?? []
    const hours = raw
      .filter((v): v is number => v !== null && v !== undefined)
      .slice(-168)  // last 7 days = 168 hours

    if (hours.length < 24) throw new Error('Insufficient historical data')

    const weekAvg   = Math.round(hours.reduce((s, v) => s + v, 0) / hours.length)
    const yesterday = Math.round(hours.slice(-24).reduce((s, v) => s + v, 0) / 24)
    const twoDaysAgo = Math.round(hours.slice(-48, -24).reduce((s, v) => s + v, 0) / 24)

    const vsYesterday = twoDaysAgo > 0
      ? Math.round(((yesterday - twoDaysAgo) / twoDaysAgo) * 100)
      : 0

    const trend: AQIHistory['trend'] =
      vsYesterday > 10  ? 'rising'  :
      vsYesterday < -10 ? 'falling' : 'stable'

    return { weekAvg, yesterday, vsYesterday, trend, hours }
  }, TTL)
}
