/**
 * data.bangkok.go.th — Bangkok Metropolitan Administration's open data portal.
 * Distinct from the national data.go.th. ~1,431 BMA-specific datasets:
 * drainage, traffic, public works, citizen services, budget, parks, etc.
 *
 * Full CKAN API, zero auth. Proxied through Worker for CORS.
 */
import { cachedFetch } from '../lib/cached-fetch'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/data-bma` : 'https://data.bangkok.go.th/api/3/action'

const TTL = 30 * 60 * 1000

export interface BMADataItem {
  id: string
  title: string
  organization: string
  notes: string
  url: string
  format: string
  modified: string
  numResources: number
}

/**
 * Search recent BMA datasets. Default: most recently modified, all topics.
 * Pass a topic query (Thai or English) to filter — e.g. 'น้ำท่วม', 'จราจร', 'สาธารณะ'.
 */
export async function searchBMADatasets(topic?: string): Promise<BMADataItem[]> {
  const cacheKey = topic ? `data-bma/q-${topic}` : 'data-bma/recent'
  return cachedFetch(cacheKey, async () => {
    const q = topic ? encodeURIComponent(topic) : '*'
    const url =
      `${BASE}/package_search?q=${q}&rows=12&sort=` +
      encodeURIComponent('metadata_modified desc')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`data.bangkok.go.th ${res.status}`)
      const json = await res.json()
      const results = json?.result?.results ?? []
      return (results as Array<Record<string, unknown>>).map((r): BMADataItem => {
        const resources = (r.resources as Array<Record<string, unknown>>) ?? []
        return {
          id: String(r.id ?? ''),
          title: String(r.title ?? '(untitled)'),
          organization: String((r.organization as Record<string, unknown>)?.title ?? '—'),
          notes: String(r.notes ?? '').slice(0, 220),
          url: `https://data.bangkok.go.th/dataset/${String(r.name ?? r.id ?? '')}`,
          format: String(resources[0]?.format ?? ''),
          modified: String(r.metadata_modified ?? ''),
          numResources: resources.length,
        }
      })
    } catch {
      return []
    }
  }, TTL)
}

/** Aggregate count — total BMA datasets available. Useful for KPI display. */
export async function bmaDatasetCount(): Promise<number> {
  return cachedFetch('data-bma/total-count', async () => {
    try {
      const res = await fetch(`${BASE}/package_search?q=*&rows=0`)
      if (!res.ok) return 0
      const json = await res.json()
      return Number(json?.result?.count ?? 0)
    } catch {
      return 0
    }
  }, TTL)
}
