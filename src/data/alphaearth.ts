/**
 * Google AlphaEarth Foundations — 64-dim annual satellite embeddings,
 * served via Google Earth Engine. Our Worker mints OAuth tokens from a
 * service-account JSON and proxies EE's getMapId, returning a tile URL
 * template MapLibre can consume directly.
 *
 * Activation:
 *   1. Create GCP project, enable Earth Engine API
 *   2. Create service account, grant "Earth Engine Resource Admin" role
 *   3. Download JSON key
 *   4. `wrangler secret put GCP_SERVICE_ACCOUNT_JSON < /path/to/key.json`
 *   5. The /ee/mapid endpoint flips from 503 → real tile URL
 *
 * Until then, the layer toggle is harmless — failed fetches throw, cachedFetch
 * serves stale when available, and the layer loaders catch otherwise.
 */
import { cachedFetch } from '../lib/cached-fetch'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/ee/mapid` : null

const TTL = 50 * 60 * 1000  // Match Worker's token cache window

export type EEPreset = 'alphaearth' | 'sentinel2-rgb' | 'modis-ndvi' | 's5p-no2' | 's5p-co' | 's5p-so2' | 'ghsl-pop' | 'dynamic-world' | 'sentinel1-sar' | 'landsat-thermal'

export interface EEMapResult {
  tiles: string         // {z}/{x}/{y} template
  attribution: string
}

export async function fetchEETiles(preset: EEPreset = 'alphaearth', startDate?: string, endDate?: string): Promise<EEMapResult | null> {
  if (!BASE) return null
  const cacheKey = `ee/mapid-${preset}-${startDate ?? 'default'}-${endDate ?? 'default'}`
  return cachedFetch(cacheKey, async () => {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, startDate, endDate }),
    })
    // Throw so cachedFetch can serve stale instead of caching a null result.
    if (!res.ok) throw new Error(`EE mapid ${res.status}`)
    const data = await res.json() as EEMapResult
    return data
  }, TTL)
}
