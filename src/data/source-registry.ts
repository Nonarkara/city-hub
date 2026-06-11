import type { CityConfig } from '../config/cities'
import { fetchAQI } from './openmeteo-aq'
import { fetchWeather } from './openmeteo'
import { fetchCityNews } from './gdelt'
import { bangkokWAQIStations, waqiTokenIsReal } from './waqi'
import { cachedFetch, cacheTimestamp } from '../lib/cached-fetch'

export type SourceZone = 'DATA' | 'INTEL' | 'SATELLITE' | 'CIVIC'
export type SourceStatus = 'checking' | 'live' | 'stale' | 'offline'

export interface SourceHealthResult {
  status: Exclude<SourceStatus, 'checking'>
  note?: string
}

export interface SourceCheck {
  id: string
  label: string
  zone: SourceZone
  scope: 'global' | 'bangkok'
  refreshLabel: string
  timeoutMs: number
  check: () => Promise<SourceHealthResult>
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  globalThis.setTimeout(() => controller.abort(), ms)
  return controller.signal
}

function ok(ok: boolean, note?: string): SourceHealthResult {
  return ok ? { status: 'live', note } : { status: 'stale', note }
}

function cachedRecently(key: string, ttlMs: number): boolean {
  const ts = cacheTimestamp(key)
  return ts > 0 && Date.now() - ts < ttlMs
}

export const SOURCE_REGISTRY: SourceCheck[] = [
  {
    id: 'openmeteo-aq',
    label: 'Open-Meteo AQI',
    zone: 'DATA',
    scope: 'global',
    refreshLabel: '10 min',
    timeoutMs: 8000,
    check: async () => {
      if (cachedRecently('openmeteo/aqi/13.756,100.502', 10 * 60_000)) {
        return { status: 'live', note: 'Recent dashboard cache' }
      }
      const r = await fetchAQI(100.5018, 13.7563, 'Asia/Bangkok')
      return ok(Number.isFinite(r.usAqi) && r.usAqi > 0)
    },
  },
  {
    id: 'openmeteo-wx',
    label: 'Open-Meteo Weather',
    zone: 'DATA',
    scope: 'global',
    refreshLabel: '10 min',
    timeoutMs: 8000,
    check: async () => {
      if (cachedRecently('openmeteo/weather/13.756,100.502', 10 * 60_000)) {
        return { status: 'live', note: 'Recent dashboard cache' }
      }
      const r = await fetchWeather(100.5018, 13.7563, 'Asia/Bangkok')
      return ok(Number.isFinite(r.temp), 'Current weather')
    },
  },
  {
    id: 'waqi',
    label: 'WAQI Stations',
    zone: 'DATA',
    scope: 'global',
    refreshLabel: '5 min',
    timeoutMs: 10_000,
    check: async () => {
      const r = await cachedFetch('health/waqi', () => bangkokWAQIStations(), 10 * 60_000)
      if (r.features.length === 0) return { status: 'stale', note: 'No stations returned' }
      if (!import.meta.env.VITE_PROXY_URL && !waqiTokenIsReal()) {
        return { status: 'stale', note: 'Using WAQI demo token in direct dev mode' }
      }
      return { status: 'live', note: `${r.features.length} stations` }
    },
  },
  {
    id: 'gdelt',
    label: 'GDELT News',
    zone: 'INTEL',
    scope: 'global',
    refreshLabel: '5 min',
    timeoutMs: 8000,
    check: async () => {
      if (cachedRecently('gdelt/news/bangkok-thailand', 5 * 60_000)) {
        return { status: 'live', note: 'Recent dashboard cache' }
      }
      const r = await fetchCityNews('bangkok thailand', 3)
      return ok(r.articles.length > 0, `${r.articles.length} articles`)
    },
  },
  {
    id: 'usgs',
    label: 'USGS Earthquakes',
    zone: 'DATA',
    scope: 'global',
    refreshLabel: 'live',
    timeoutMs: 5000,
    check: async () => {
      const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', {
        signal: timeoutSignal(5000),
      })
      return ok(res.ok)
    },
  },
  {
    id: 'rainviewer',
    label: 'RainViewer Radar',
    zone: 'DATA',
    scope: 'global',
    refreshLabel: '5-10 min',
    timeoutMs: 5000,
    check: async () => {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
        signal: timeoutSignal(5000),
      })
      if (!res.ok) return { status: 'offline', note: `HTTP ${res.status}` }
      const data = await res.json() as { radar?: { past?: unknown[] } }
      return ok((data.radar?.past?.length ?? 0) > 0)
    },
  },
  {
    id: 'nasa-gibs',
    label: 'NASA GIBS',
    zone: 'SATELLITE',
    scope: 'global',
    refreshLabel: 'daily',
    timeoutMs: 8000,
    check: async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const date = yesterday.toISOString().split('T')[0]
      const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/250m/6/36/56.jpg`
      const res = await fetch(url, { signal: timeoutSignal(8000) })
      return ok(res.ok)
    },
  },
  {
    id: 'traffy',
    label: 'Traffy Fondue',
    zone: 'CIVIC',
    scope: 'bangkok',
    refreshLabel: '2 min',
    timeoutMs: 6000,
    check: async () => {
      const res = await fetch('https://publicapi.traffy.in.th/share/teamchadchart/getTicket?type=json&limit=1', {
        signal: timeoutSignal(6000),
      })
      return ok(res.ok)
    },
  },
]

export const CORE_SOURCE_IDS = ['openmeteo-aq', 'openmeteo-wx', 'waqi', 'gdelt'] as const

export function sourcesForCity(city: CityConfig): SourceCheck[] {
  return SOURCE_REGISTRY.filter((source) => source.scope === 'global' || city.tier === 'full')
}

export function sourceCountForCity(city: CityConfig): number {
  return sourcesForCity(city).length
}

export async function runSourceCheck(source: SourceCheck): Promise<SourceHealthResult> {
  return Promise.race([
    source.check(),
    new Promise<SourceHealthResult>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error('timeout')), source.timeoutMs)
    }),
  ])
}
