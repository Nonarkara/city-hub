/**
 * BMA (Bangkok Metropolitan Administration) data bundle.
 *
 * Wave 1: BTS/MRT/ARL static snapshot + central district overlay.
 * Wave 2: direct BMA Open Data API (CCTV, drainage, citizen reports) — pending DEPA contact.
 */
import { cachedFetch } from '../lib/cached-fetch'

const TTL_STATIC = 24 * 60 * 60 * 1000

export async function loadBangkokRail(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('bma/rail', async () => {
    const res = await fetch('/geo/bkk-rail.json')
    return res.json()
  }, TTL_STATIC)
}

export async function loadBangkokKhet(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('bma/khet', async () => {
    const res = await fetch('/geo/bangkok-khet.geojson')
    return res.json()
  }, TTL_STATIC)
}
