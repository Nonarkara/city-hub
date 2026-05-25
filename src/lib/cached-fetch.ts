/**
 * In-memory TTL cache + concurrent request coalescing.
 *
 * Ported from /Users/nonarkara/Projects/dashboards/geopolitics/src/lib/request-coalesce.ts
 * (Dr Non playbook §02 — Illusion of Real-Time).
 *
 * - Serves cached data while fresh
 * - Coalesces concurrent calls into one fetch
 * - Falls back to stale data on error (stale-while-error)
 */

interface CacheEntry<T> {
  data: T
  ts: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined
  if (cached && Date.now() - cached.ts < ttlMs) {
    return cached.data
  }

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, ts: Date.now() })
      inflight.delete(key)
      return data
    })
    .catch((err) => {
      inflight.delete(key)
      const stale = cache.get(key) as CacheEntry<T> | undefined
      if (stale) return stale.data
      throw err
    })

  inflight.set(key, promise)
  return promise
}

/** Get the timestamp (ms) when a key was last fetched. Returns 0 if never. */
export function cacheTimestamp(key: string): number {
  const entry = cache.get(key)
  return entry?.ts ?? 0
}

export function invalidateCache(key: string) {
  cache.delete(key)
}

export function clearCache() {
  cache.clear()
  inflight.clear()
}
