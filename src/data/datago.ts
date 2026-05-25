/**
 * data.go.th — Thai government open data portal (CKAN).
 * Search for recent Bangkok-relevant datasets.
 */
import { cachedFetch } from '../lib/cached-fetch'

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
      'https://data.go.th/api/3/action/package_search?q=' +
      encodeURIComponent('กรุงเทพ') +
      '&rows=12&sort=' +
      encodeURIComponent('metadata_modified desc')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`data.go.th ${res.status}`)
      const json = await res.json()
      const results = json?.result?.results ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (results as any[]).map((r): DataGoItem => ({
        id: r.id,
        title: r.title ?? '(untitled)',
        organization: r.organization?.title ?? '—',
        notes: (r.notes ?? '').slice(0, 220),
        url: `https://data.go.th/dataset/${r.name ?? r.id}`,
        format: r.resources?.[0]?.format ?? '',
        modified: r.metadata_modified ?? '',
      }))
    } catch {
      return []
    }
  }, TTL)
}
