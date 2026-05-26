/**
 * PrepareCard — the predict-and-prepare deliverable.
 *
 * Renders when the city's 24h AQI forecast crosses an unhealthy threshold.
 * Frames the future as a probability + window + grounded recommendation —
 * not as a reactive alert after the fact.
 *
 * "Rather than being hit by problems and then faced with death and regrets."
 */
import type { CityConfig } from '../config/cities'
import type { AQIForecast } from '../data/openmeteo-forecast'
import { predictAndPrepare } from '../lib/predict-prepare'

interface Props {
  activeCity: CityConfig
  forecast: AQIForecast | null
}

const URGENCY_COLOR: Record<string, string> = {
  high:   '#e53935',
  medium: '#fb8c00',
  low:    '#fdd835',
}

export function PrepareCard({ activeCity, forecast }: Props) {
  const p = predictAndPrepare(activeCity, forecast)
  if (!p) return null

  const color = URGENCY_COLOR[p.urgency]

  return (
    <div className="prepare-card" style={{ borderLeftColor: color }}>
      <div className="prepare-header">
        <span className="prepare-eyebrow">PREDICT · PREPARE</span>
        <span className="prepare-urgency" style={{ color, borderColor: color }}>
          {p.urgency.toUpperCase()}
        </span>
      </div>

      <div className="prepare-headline">
        AQI WILL BREACH {p.threshold} {p.windowDescription}
      </div>

      <div className="prepare-stat-row">
        <div className="prepare-stat">
          <span className="prepare-stat-label">CONFIDENCE</span>
          <span className="prepare-stat-value">
            {Math.round(p.probabilityNext24h * 100)}%
          </span>
        </div>
        <div className="prepare-stat">
          <span className="prepare-stat-label">PEAK FORECAST</span>
          <span className="prepare-stat-value" style={{ color }}>
            {p.forecastPeak}
            <span className="prepare-stat-unit"> AQI</span>
          </span>
        </div>
        <div className="prepare-stat">
          <span className="prepare-stat-label">AT</span>
          <span className="prepare-stat-value">{p.forecastPeakTime}</span>
        </div>
      </div>

      <p className="prepare-rec">{p.recommendation}</p>

      {p.groundedIn && (
        <p className="prepare-context">{p.groundedIn}</p>
      )}

      <div className="prepare-foot">
        Don't wait for the breach. Act on the probability.
      </div>
    </div>
  )
}
