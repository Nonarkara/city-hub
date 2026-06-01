/**
 * SituationBrief — the intelligence layer.
 *
 * Synthesises current conditions across ALL monitored cities into 3–4
 * sentences every 30 minutes. This is what separates an IOC from a viewer:
 * the operator shouldn't have to interpret five separate data sources —
 * the brief does it.
 *
 * Data sources ingested per cycle:
 *   - AQI + PM2.5 for every city
 *   - Weather (temp, condition, wind) for every city
 *   - GDELT news sentiment per city
 *   - Cross-city AQI pattern correlations
 *
 * Output: Gemini-narrated paragraph (via /narrate endpoint) with a
 * deterministic template fallback when the AI endpoint is unavailable.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import type { CityConfig } from '../config/cities'
import { CITIES } from '../config/cities'
import { fetchAQI } from '../data/openmeteo-aq'
import { fetchWeather } from '../data/openmeteo'
import { fetchCityNews } from '../data/gdelt'
import { detectCrossCityPatterns } from '../lib/cross-city-patterns'
import { cachedFetch } from '../lib/cached-fetch'
import { pm25ToRisk, aqiToRisk, RISK_COLOR, type RiskLevel } from '../lib/risk'
import { narrate } from '../lib/narrate'
import { generateText, ollamaReachable } from '../lib/ollama'

const REFRESH_MS = 30 * 60_000

interface CitySnapshot {
  city:        CityConfig
  aqi:         number | null
  pm25:        number | null
  risk:        RiskLevel | null
  temp:        number | null
  condition:   string | null
  windSpeed:   number | null
  windDir:     string | null
  newsAvgTone: number | null
}

// ── Build a deterministic brief from snapshots (fallback — always works) ──────
function templateBrief(snaps: CitySnapshot[], patterns: string[]): string {
  if (snaps.length === 0) return 'No city data available.'

  // Air quality summary
  const aqiLines = snaps
    .filter((s) => s.risk)
    .map((s) => `${s.city.hudClockLabel} ${s.risk?.toUpperCase()}${s.aqi ? ` (AQI ${s.aqi})` : ''}`)
  const aqiText = aqiLines.length
    ? `Air quality: ${aqiLines.join(' · ')}.`
    : ''

  // Weather for the first city with data
  const wx = snaps.find((s) => s.temp !== null)
  const wxText = wx
    ? `${wx.city.hudClockLabel} ${wx.temp}°C${wx.condition ? ` ${wx.condition}` : ''}${wx.windSpeed ? `, ${wx.windSpeed} km/h ${wx.windDir ?? ''}` : ''}.`
    : ''

  // News sentiment — flag cities with markedly negative tone
  const negCities = snaps
    .filter((s) => s.newsAvgTone !== null && s.newsAvgTone < -4)
    .map((s) => s.city.hudClockLabel)
  const newsText = negCities.length
    ? `Negative news sentiment: ${negCities.join(', ')}.`
    : ''

  // Cross-city pattern
  const patternText = patterns[0] ?? ''

  return [aqiText, wxText, newsText, patternText].filter(Boolean).join(' ')
}

export function SituationBrief({ allCities }: { allCities?: CityConfig[] }) {
  const cities = useMemo(() => allCities ?? CITIES, [allCities])

  const [brief, setBrief]           = useState<string>('')
  const [model, setModel]           = useState<string>('')
  const [loading, setLoading]       = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [collapsed, setCollapsed]   = useState(false)
  const [dismissed, setDismissed]   = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // Gather snapshots in parallel
      const [snapshotResults, patterns] = await Promise.all([
        Promise.allSettled(cities.map(async (city): Promise<CitySnapshot> => {
          const [lng, lat] = city.center
          const [aqiData, wxData, newsData] = await Promise.allSettled([
            cachedFetch(`brief/aqi/${city.id}`, () => fetchAQI(lng, lat, city.timezone), REFRESH_MS),
            cachedFetch(`brief/wx/${city.id}`,  () => fetchWeather(lng, lat, city.timezone), REFRESH_MS),
            cachedFetch(`brief/news/${city.id}`, () => fetchCityNews(city.gdeltQuery, 6), REFRESH_MS),
          ])
          const aqi  = aqiData.status  === 'fulfilled' ? aqiData.value  : null
          const wx   = wxData.status   === 'fulfilled' ? wxData.value   : null
          const news = newsData.status === 'fulfilled' ? newsData.value : null
          const aqiVal  = aqi?.usAqi ?? null
          const pm25Val = aqi?.pm25   ?? null
          return {
            city,
            aqi:         aqiVal,
            pm25:        pm25Val,
            risk:        pm25Val !== null ? pm25ToRisk(pm25Val) : aqiVal !== null ? aqiToRisk(aqiVal) : null,
            temp:        wx?.temp        ?? null,
            condition:   wx?.condition   ?? null,
            windSpeed:   wx?.windSpeed   ?? null,
            windDir:     wx?.windCardinal ?? null,
            newsAvgTone: news?.avgTone   ?? null,
          }
        })),
        detectCrossCityPatterns(cities[0]).catch(() => []),
      ])

      const snaps = snapshotResults
        .filter((r): r is PromiseFulfilledResult<CitySnapshot> => r.status === 'fulfilled')
        .map((r) => r.value)

      const patternTexts = patterns.map((p) => p.message + ' ' + p.prediction)

      // Build structured context for Gemini
      const context = {
        timestamp: new Date().toISOString(),
        cities: snaps.map((s) => ({
          name:        s.city.name,
          code:        s.city.hudClockLabel,
          aqiIndex:    s.aqi,
          pm25:        s.pm25,
          riskLevel:   s.risk,
          temp:        s.temp,
          condition:   s.condition,
          windSpeed:   s.windSpeed,
          newsAvgTone: s.newsAvgTone,
        })),
        crossCityPatterns: patternTexts,
      }

      const fallback = templateBrief(snaps, patternTexts)

      // Tier 1: Gemini via Worker
      let text = ''
      let modelLabel = 'TEMPLATE'

      try {
        const result = await narrate(
          'Give a 3-sentence operational situation brief for a city intelligence operator. Cover: overall air quality status across all cities, notable weather or environmental conditions, and any cross-city intelligence patterns. Be factual and precise. No greetings or sign-off.',
          context,
          { style: 'brief', maxWords: 80 },
        )
        const narration = result.narration ?? ''
        if (result.model === 'gemini-2.5' && narration.length > 40 && !narration.startsWith('Set GEMINI')) {
          text = narration
          modelLabel = 'GEMINI'
        }
      } catch { /* fall through */ }

      // Tier 2: local Ollama (phi4-mini / deepseek-r1)
      if (!text) {
        const reachable = await ollamaReachable()
        if (reachable) {
          try {
            const prompt = [
              'You are a city intelligence operator. Write exactly 3 sentences as a factual operational brief.',
              'Cover: (1) air quality across monitored cities, (2) notable weather or environmental conditions, (3) any cross-city patterns.',
              'Be specific with numbers. No greetings. No markdown.',
              '',
              'Current data:',
              JSON.stringify(context, null, 0),
            ].join('\n')
            const ollamaText = await generateText(prompt, {
              model:     'phi4-mini',
              maxTokens: 120,
            })
            if (ollamaText.length > 40) {
              text = ollamaText
              modelLabel = 'OLLAMA · PHI4'
            }
          } catch { /* fall through */ }
        }
      }

      // Tier 3: deterministic template (always works)
      setBrief(text || fallback)
      setModel(modelLabel)
      setLastUpdated(new Date())
    } catch {
      setBrief('Brief unavailable — data sources offline.')
      setModel('ERROR')
    } finally {
      setLoading(false)
    }
  }, [cities])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])

  if (dismissed) return null

  // Overall risk colour — worst city
  const worstRisk: RiskLevel = brief.toLowerCase().includes('critical') ? 'critical'
    : brief.toLowerCase().includes(' high') ? 'high'
    : brief.toLowerCase().includes('moderate') ? 'moderate'
    : 'good'
  const accentColor = RISK_COLOR[worstRisk]

  return (
    <div className={`sit-brief ${collapsed ? 'sit-brief--collapsed' : ''}`}>
      <div className="sit-brief-header" onClick={() => setCollapsed((c) => !c)}>
        <span className="sit-brief-pulse" style={{ background: accentColor }} />
        <span className="sit-brief-title">SITUATION BRIEF</span>
        {lastUpdated && (
          <span className="sit-brief-age">
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          className="sit-brief-refresh"
          onClick={(e) => { e.stopPropagation(); refresh() }}
          disabled={loading}
          title="Refresh brief"
          aria-label="Refresh situation brief"
        >↺</button>
        <button
          className="sit-brief-dismiss"
          onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
          title="Dismiss"
          aria-label="Dismiss brief"
        >✕</button>
        <span className="sit-brief-toggle" aria-hidden>{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <div className="sit-brief-body">
          {loading && !brief ? (
            <span className="sit-brief-loading">Compiling intelligence…</span>
          ) : (
            <p className="sit-brief-text">{brief}</p>
          )}
          <div className="sit-brief-footer">
            <span className="sit-brief-model">{model}</span>
            <span className="sit-brief-sep">·</span>
            <span className="sit-brief-hint">Updates every 30 min</span>
          </div>
        </div>
      )}
    </div>
  )
}
