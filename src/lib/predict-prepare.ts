/**
 * predict-prepare — turn the dashboard's forecasts into PREPARATION ADVICE
 * rather than after-the-fact reports.
 *
 * Non's framing: "Rather than being hit by problems and then faced with
 * death and regrets." So instead of "AQI is 21" we need "AQI will breach
 * 100 within 36 hours with 80% confidence. Last time this happened: 18 March.
 * School advisory was issued 4 hours late. Recommend issuing now."
 *
 * Build a simple probability + recommendation engine from the current
 * Open-Meteo 24h forecast + a lookup of canonical thresholds + the SLIC
 * structural weakness for that city.
 */
import type { CityConfig } from '../config/cities'
import type { AQIForecast } from '../data/openmeteo-forecast'
import { getCityScore, weakestPillar } from './slic'

export interface PreparePrediction {
  metric: 'aqi' | 'rainfall' | 'temp'
  threshold: number
  thresholdLabel: string                  // human-readable threshold ("unhealthy", "extreme heat")
  probabilityNext24h: number              // 0..1
  forecastPeak: number
  forecastPeakTime: string
  windowDescription: string               // "within 36 hours", "in 4 hours", etc.
  recommendation: string                  // concrete preparation action
  groundedIn: string                      // what's structurally weak about this city per SLIC
  urgency: 'low' | 'medium' | 'high'
}

const AQI_UNHEALTHY = 100
const AQI_VERY_UNHEALTHY = 200

/**
 * Build a preparation prediction from a 24h forecast.
 * Returns null if the forecast is missing or shows nothing notable.
 */
export function predictAndPrepare(
  activeCity: CityConfig,
  forecast: AQIForecast | null,
): PreparePrediction | null {
  if (!forecast || forecast.hours.length < 6) return null

  const peak = forecast.peakAqi
  // No prediction if the forecast peak isn't actionable
  if (peak < AQI_UNHEALTHY) return null

  // Probability heuristic: how strongly does the forecast cross the threshold
  // and for how many hours? More crossings = higher confidence.
  const breachCount = forecast.hours.filter((h) => h.usAqi >= AQI_UNHEALTHY).length
  const probability = Math.min(0.95, 0.4 + breachCount * 0.06)

  // When does the breach happen?
  const firstBreach = forecast.hours.find((h) => h.usAqi >= AQI_UNHEALTHY)
  if (!firstBreach) return null
  const breachTime = new Date(firstBreach.time)
  const hoursAhead = Math.max(1, Math.round((breachTime.getTime() - Date.now()) / 3_600_000))
  const windowDescription =
    hoursAhead <= 2 ? `within ${hoursAhead}h — imminent`
    : hoursAhead <= 6 ? `in ${hoursAhead}h`
    : hoursAhead <= 12 ? `${hoursAhead}h out — half a day`
    : `${hoursAhead}h out — overnight or next day`

  const urgency: PreparePrediction['urgency'] =
    hoursAhead <= 4 ? 'high' :
    hoursAhead <= 12 ? 'medium' : 'low'

  // Pull SLIC structural context for this city — recommendation is grounded
  // in where the city is structurally weak.
  const slic = getCityScore(activeCity.id)
  const weak = slic ? weakestPillar(slic) : null
  const groundedIn = weak
    ? `${activeCity.name}'s weakest SLIC pillar is ${weak.label.toLowerCase()} (${weak.value}/100).`
    : ''

  // Recommendation tailored by metric + city tier
  let recommendation: string
  const peakLevel = peak >= AQI_VERY_UNHEALTHY ? 'very unhealthy' : 'unhealthy'
  if (activeCity.tier === 'full') {
    recommendation =
      `Issue school + outdoor-activity advisory ${hoursAhead}h ahead. Coordinate with BMA + Ministry of Public Health. ` +
      `Pre-stage masks at the ${weak?.label.toLowerCase() ?? 'most vulnerable'} districts.`
  } else {
    recommendation =
      `Forecast crosses ${peakLevel} levels at AQI ${peak} at ${forecast.peakHour}. ` +
      `Brief schools, hospitals, and at-risk populations now while there's time to act.`
  }

  return {
    metric: 'aqi',
    threshold: AQI_UNHEALTHY,
    thresholdLabel: peakLevel.toUpperCase(),
    probabilityNext24h: probability,
    forecastPeak: peak,
    forecastPeakTime: forecast.peakHour,
    windowDescription,
    recommendation,
    groundedIn,
    urgency,
  }
}
