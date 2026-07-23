/**
 * RainViewer — global precipitation radar, keyless.
 * The index lists recent radar frames; we build a MapLibre raster tile
 * template for the latest one. Colour scheme 2 (universal blue→green→
 * yellow→red), smooth + snow rendering.
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

interface RainViewerIndex {
  host: string
  radar?: { past?: { time: number; path: string }[] }
}

const INDEX = 'https://api.rainviewer.com/public/weather-maps.json'
const TTL = 8 * 60 * 1000

/** Returns a `{z}/{x}/{y}` tile template for the latest radar frame, or null. */
export async function fetchRadarTileTemplate(): Promise<string | null> {
  return cachedFetch('rainviewer/latest', async () => {
    const res = await fetch(INDEX, { signal: timeoutSignal(15_000) })
    // Throw so cachedFetch can serve stale instead of caching a null result.
    if (!res.ok) throw new Error(`RainViewer ${res.status}`)
    const data = await res.json() as RainViewerIndex
    const frames = data.radar?.past ?? []
    const latest = frames[frames.length - 1]
    if (!latest) return null
    return `${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`
  }, TTL)
}
