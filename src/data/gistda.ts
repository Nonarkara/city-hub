/**
 * GISTDA wrappers — thin Bangkok-focused shims over _shared/lib/gistda.js.
 * All fetches go through cachedFetch for TTL + concurrent dedup.
 */
// @ts-expect-error — _shared/lib/gistda.js has no .d.ts (ESM named exports)
import * as G from '@shared/lib/gistda.js'
import { cachedFetch } from '../lib/cached-fetch'

const BKK_PROVINCE = 'กรุงเทพมหานคร'
const BKK_LAT = 13.7563
const BKK_LNG = 100.5018

const TTL_LIVE = 5 * 60 * 1000     // 5 min
const TTL_STATIONS = 5 * 60 * 1000  // 5 min
const TTL_FIRES = 10 * 60 * 1000   // 10 min
const TTL_FLOOD = 60 * 60 * 1000   // 1 h
const TTL_STATIC = 24 * 60 * 60 * 1000 // 1 day for boundaries

export interface Pm25Live {
  pm25: number
  history24h: Array<[number, string]>
  level: 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'hazardous' | '—'
  max24h: number
}

export async function bangkokPm25Live(): Promise<Pm25Live> {
  return cachedFetch('gistda/pm25-bkk-live', async () => {
    const res = await G.fetchPm25ByLocation(BKK_LAT, BKK_LNG)
    const pm25 = Number(res?.pm25 ?? 0)
    const history24h = (res?.graphHistory24hrs ?? []) as Array<[number, string]>
    const max24h = history24h.length ? Math.max(...history24h.map((p) => p[0])) : pm25
    return { pm25, history24h, level: G.pm25Level(pm25), max24h }
  }, TTL_LIVE)
}

export async function bangkokAQIStations() {
  return cachedFetch('gistda/aqi-stations-bkk', async () => {
    // ArcGIS returns { features: [{ attributes: {...} }], fieldAliases, ... }
    const resp = await G.fetchAQIStationsByProvince(BKK_PROVINCE)
    const features = Array.isArray(resp?.features) ? resp.features : []
    return {
      type: 'FeatureCollection' as const,
      features: features
        .filter((f: { attributes?: Record<string, unknown> }) => {
          const a = f.attributes
          return a && Number.isFinite(Number(a.longitude)) && Number.isFinite(Number(a.latitude))
        })
        .map((f: { attributes: Record<string, unknown> }) => {
          const a = f.attributes
          const pm25 = Number(a.pm25 ?? 0)
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [Number(a.longitude), Number(a.latitude)] as [number, number],
            },
            properties: {
              st_name: a.st_name ?? a.ap_tn ?? 'Station',
              pm25,
              pm10: Number(a.pm10 ?? 0),
              acq_date: a.acq_date,
              acq_time: a.acq_time,
              level: G.pm25Level(pm25),
            },
          }
        }),
    }
  }, TTL_STATIONS)
}

export async function thailandFires24h(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('gistda/fires-th-24h', async () => {
    // The shared lib's filter `datetime > CURRENT_TIMESTAMP - 2` 400s on this endpoint —
    // the field is actually `date` (epoch ms), not `datetime`. Pagination is disabled, so
    // we fetch the unfiltered set (capped at 1000) and filter client-side to the last 7 days.
    const url =
      'https://gistdaportal.gistda.or.th/data/rest/services/FR_Fire/hotspot_npp_daily/MapServer/0/query' +
      '?f=geojson&where=1%3D1&outFields=date,latitude,longitude,satellite,confident,pv_tn'
    const res = await fetch(url)
    const fc = await res.json()
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const all = (fc?.features ?? []) as GeoJSON.Feature[]
    const recent = all.filter((f) => {
      const d = Number((f.properties as Record<string, unknown>)?.date ?? 0)
      return d >= cutoff
    })
    return {
      type: 'FeatureCollection' as const,
      features: recent.length ? recent : all, // fall back to all if nothing in last 7d
    }
  }, TTL_FIRES)
}

export async function centralFloods() {
  return cachedFetch('gistda/floods-central', async () => {
    const geojson = await G.fetchFloodPolygonsGeoJSON('central')
    return geojson as GeoJSON.FeatureCollection
  }, TTL_FLOOD)
}

export async function provincePolygons() {
  return cachedFetch('gistda/provinces', async () => {
    const geojson = await G.fetchProvincePolygons()
    return geojson as GeoJSON.FeatureCollection
  }, TTL_STATIC)
}
