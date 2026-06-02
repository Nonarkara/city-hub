/**
 * useCityStress — live 0–100 composite stress score per city.
 *
 * Combines:
 *   AQI (40%)     — PM2.5 or US AQI; 0=0pts, 200+=40pts
 *   News (20%)    — GDELT average tone; very negative = 20pts
 *   Weather (20%) — feels-like heat OR cold; extreme = 20pts
 *   Forecast (20%)— peak AQI in next 24h vs current; rising = 20pts
 *
 * Score 0–30 = NORMAL, 31–55 = WATCH, 56–75 = ELEVATED, 76+ = HIGH
 * Updates every 15 minutes.
 */
import { useEffect, useState, useMemo } from 'react'
import { CITIES } from '../config/cities'
import { fetchAQI } from '../data/openmeteo-aq'
import { fetchWeather } from '../data/openmeteo'
import { fetchCityNews } from '../data/gdelt'
import { fetchAQIForecast } from '../data/openmeteo-forecast'
import { cachedFetch } from '../lib/cached-fetch'
import { useCityStore } from '../store/cityStore'

const POLL_MS = 15 * 60_000

export type StressLevel = 'normal' | 'watch' | 'elevated' | 'high'

export interface CityStress {
  score:     number       // 0–100
  level:     StressLevel
  aqiPts:    number       // 0–40
  newsPts:   number       // 0–20
  wxPts:     number       // 0–20
  fcPts:     number       // 0–20
}

export type StressMap = Record<string, CityStress>

function scoreToLevel(s: number): StressLevel {
  if (s >= 76) return 'high'
  if (s >= 56) return 'elevated'
  if (s >= 31) return 'watch'
  return 'normal'
}

export const STRESS_COLOR: Record<StressLevel, string> = {
  normal:   'var(--emerald)',
  watch:    'var(--amber)',
  elevated: '#f97316',
  high:     '#ef4444',
}

export function useCityStress(): StressMap {
  const customCities = useCityStore((s) => s.customCities)
  const allCities    = useMemo(() => [...CITIES, ...customCities], [customCities])
  const [stressMap, setStressMap] = useState<StressMap>({})

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const results = await Promise.allSettled(
        allCities.map(async (city): Promise<[string, CityStress]> => {
          const [lng, lat] = city.center
          const [aqiData, wxData, newsData, fcData] = await Promise.allSettled([
            cachedFetch(`stress/aqi/${city.id}`,  () => fetchAQI(lng, lat, city.timezone), POLL_MS),
            cachedFetch(`stress/wx/${city.id}`,   () => fetchWeather(lng, lat, city.timezone), POLL_MS),
            cachedFetch(`stress/news/${city.id}`, () => fetchCityNews(city.gdeltQuery, 8), POLL_MS),
            cachedFetch(`stress/fc/${city.id}`,   () => fetchAQIForecast(lng, lat, city.timezone, 24), POLL_MS),
          ])

          // AQI component (0–40)
          const aqi   = aqiData.status  === 'fulfilled' ? aqiData.value : null
          const aqiVal = aqi?.usAqi ?? (aqi?.pm25 ?? 0)
          const aqiPts = Math.min(40, Math.round((aqiVal / 200) * 40))

          // News component (0–20) — very negative tone = high stress
          const news     = newsData.status === 'fulfilled' ? newsData.value : null
          const tone     = news?.avgTone ?? 0
          const newsPts  = tone < -8 ? 20 : tone < -5 ? 14 : tone < -2 ? 8 : 0

          // Weather component (0–20) — extreme heat/cold/storms
          const wx    = wxData.status  === 'fulfilled' ? wxData.value : null
          const feels = wx?.feelsLike ?? 0
          const cond  = wx?.condition ?? 'PRT'
          let wxPts = 0
          if (feels >= 42) wxPts = 20       // extreme heat
          else if (feels >= 38) wxPts = 12  // high heat
          else if (feels <= 10) wxPts = 15  // cold (unlikely in SEA but generic)
          if (cond === 'TSTM') wxPts = Math.max(wxPts, 18)
          if (cond === 'RAIN') wxPts = Math.max(wxPts, 8)

          // Forecast component (0–20) — rising AQI
          const fc      = fcData.status  === 'fulfilled' ? fcData.value : null
          const peakAqi = fc?.peakAqi ?? 0
          const fcPts   = peakAqi > aqiVal + 40 ? 20 : peakAqi > aqiVal + 20 ? 12 : peakAqi > aqiVal + 10 ? 6 : 0

          const score = aqiPts + newsPts + wxPts + fcPts
          return [city.id, { score, level: scoreToLevel(score), aqiPts, newsPts, wxPts, fcPts }]
        }),
      )

      if (cancelled) return
      const next: StressMap = {}
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const [id, stress] = r.value
          next[id] = stress
        }
      }
      setStressMap(next)
    }

    load()
    const timer = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [allCities.map((c) => c.id).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return stressMap
}
