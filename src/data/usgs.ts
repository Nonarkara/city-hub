/**
 * USGS earthquakes — global, keyless, last 24 hours.
 * Public GeoJSON feed, refreshed by USGS every minute. No auth, CORS-open.
 */
import { cachedFetch } from '../lib/cached-fetch'

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const TTL = 5 * 60 * 1000

export async function fetchEarthquakes24h(): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('usgs/quakes-24h', async () => {
    const res = await fetch(FEED)
    if (!res.ok) throw new Error(`USGS ${res.status}`)
    return res.json() as Promise<GeoJSON.FeatureCollection>
  }, TTL)
}
