/**
 * data.go.th — Thai government open data portal (CKAN).
 * Search for recent Bangkok-relevant datasets.
 * Proxied through Cloudflare Worker to bypass CORS.
 */
import { cachedFetch } from '../lib/cached-fetch'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/data-go-th` : 'https://data.go.th/api/3/action'

const TTL = 30 * 60 * 1000

export interface DataGoItem {
  id: string
  title: string
  organization: string
  notes: string
  url: string
  format: string
  modified: string
}

export async function searchBangkokDatasets(): Promise<DataGoItem[]> {
  return cachedFetch('datago/bkk', async () => {
    const url =
      `${BASE}/package_search?q=` +
      encodeURIComponent('กรุงเทพ') +
      '&rows=12&sort=' +
      encodeURIComponent('metadata_modified desc')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`data.go.th ${res.status}`)
      const json = await res.json()
      const results = json?.result?.results ?? []
      return (results as Array<Record<string, unknown>>).map((r): DataGoItem => ({
        id: String(r.id ?? ''),
        title: String(r.title ?? '(untitled)'),
        organization: String((r.organization as Record<string, unknown>)?.title ?? '—'),
        notes: String(r.notes ?? '').slice(0, 220),
        url: `https://data.go.th/dataset/${String(r.name ?? r.id ?? '')}`,
        format: String((r.resources as Array<Record<string, unknown>>)?.[0]?.format ?? ''),
        modified: String(r.metadata_modified ?? ''),
      }))
    } catch {
      return []
    }
  }, TTL)
}
