/**
 * Thai Meteorological Department (TMD) — official Thai gov weather forecast.
 * Endpoint: data.tmd.go.th/api/WeatherForecast7Days/V2
 *
 * Demo credentials in the URL work for the 7-day forecast endpoint (returns
 * real data for all 81 provinces). The hourly and today-observation endpoints
 * are gated behind real registration; we expose those routes via Worker
 * secrets if the user upgrades.
 *
 * Distinct from Open-Meteo: TMD is the official authoritative Thai source,
 * Open-Meteo is a global model. We display both — citizens trust TMD.
 */
import { cachedFetch } from '../lib/cached-fetch'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/tmd` : 'https://data.tmd.go.th/api'

const TTL = 60 * 60 * 1000   // 1h — TMD updates daily

export interface TMDForecastDay {
  date: string                  // dd/mm/yyyy
  tempMaxC: number
  tempMinC: number
  rainCoverPct: number          // 0–100
  windDirDeg: number
  windSpeedKmh: number
  descriptionThai: string
  descriptionEnglish: string
}

export interface TMDForecast {
  province: string              // 'Bangkok'
  provinceThai: string          // 'กรุงเทพมหานคร'
  buildDate: string             // ISO string
  days: TMDForecastDay[]        // up to 7
}

export async function bangkokTMDForecast(): Promise<TMDForecast | null> {
  return cachedFetch('tmd/bangkok-forecast-7d', async () => {
    const url =
      `${BASE}/WeatherForecast7Days/V2/?uid=api&ukey=api12345&format=json` +
      `&province=${encodeURIComponent('กรุงเทพมหานคร')}`
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const text = await res.text()
      // Some TMD endpoints return HTML redirects when query is wrong — guard
      if (text.trim().startsWith('<')) return null
      const data = JSON.parse(text)
      let provinces = data?.Provinces?.Province
      if (!provinces) return null
      if (!Array.isArray(provinces)) provinces = [provinces]
      const bkk = (provinces as Array<Record<string, unknown>>).find((p) => {
        const en = String(p.ProvinceNameEnglish ?? '')
        const th = String(p.ProvinceNameThai ?? '')
        return en.includes('Bangkok') || th.includes('กรุงเทพ')
      })
      if (!bkk) return null
      const fc = (bkk.SevenDaysForecast ?? {}) as Record<string, string[]>
      const len = Math.min(
        7,
        (fc.ForecastDate ?? []).length,
        (fc.MaximumTemperature ?? []).length,
      )
      const days: TMDForecastDay[] = []
      for (let i = 0; i < len; i++) {
        days.push({
          date: String(fc.ForecastDate?.[i] ?? ''),
          tempMaxC: Number(fc.MaximumTemperature?.[i] ?? 0),
          tempMinC: Number(fc.MinimumTemperature?.[i] ?? 0),
          rainCoverPct: Number(fc.PercentRainCover?.[i] ?? 0),
          windDirDeg: Number(fc.WindDirection?.[i] ?? 0),
          windSpeedKmh: Number(fc.WindSpeed?.[i] ?? 0),
          descriptionThai: String(fc.DescriptionThai?.[i] ?? ''),
          descriptionEnglish: String(fc.DescriptionEnglish?.[i] ?? ''),
        })
      }
      // TMD returns most-recent date first; sort ascending so [0] = today
      days.sort((a, b) => {
        const pa = a.date.split('/').reverse().join('-')
        const pb = b.date.split('/').reverse().join('-')
        return pa.localeCompare(pb)
      })
      return {
        province: String(bkk.ProvinceNameEnglish ?? 'Bangkok'),
        provinceThai: String(bkk.ProvinceNameThai ?? 'กรุงเทพมหานคร'),
        buildDate: String(data?.header?.LastBuildDate ?? ''),
        days,
      }
    } catch {
      return null
    }
  }, TTL)
}
