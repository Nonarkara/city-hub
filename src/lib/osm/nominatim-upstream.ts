/**
 * Server-side Nominatim client.
 *
 * The public Nominatim service requires an identifying User-Agent, at most
 * one request per second, and caching. Browsers cannot set User-Agent, so
 * this module must run only on the Worker, the Pages function, or the Vite
 * dev server — never in the SPA bundle.
 */
import { createRateLimiter, systemClock, type Clock } from './rate-limit'

export const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
export const NOMINATIM_USER_AGENT =
  'CityHub/0.9 (https://city-hub.pages.dev; civic city search)'
export const NOMINATIM_MIN_INTERVAL_MS = 1000
export const NOMINATIM_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const NOMINATIM_TIMEOUT_MS = 10_000
export const NOMINATIM_MAX_QUEUED = 8

export interface NominatimUpstreamResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string]
  type: string
  class: string
  addresstype?: string
  importance?: number
  address?: Record<string, string | undefined>
}

export class NominatimUpstreamError extends Error {
  constructor(message = 'Nominatim upstream failed') {
    super(message)
    this.name = 'NominatimUpstreamError'
  }
}

export function nominatimCacheKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export interface NominatimUpstreamOptions {
  fetchImpl?: FetchImpl
  clock?: Clock
  cacheTtlMs?: number
  minIntervalMs?: number
  timeoutMs?: number
  maxQueued?: number
}

export class NominatimUpstream {
  private readonly fetchImpl: FetchImpl
  private readonly clock: Clock
  private readonly cacheTtlMs: number
  private readonly timeoutMs: number
  private readonly maxQueued: number
  private readonly limit: <T>(task: () => Promise<T>) => Promise<T>
  private readonly cache = new Map<string, { at: number; data: NominatimUpstreamResult[] }>()
  private queued = 0

  constructor(options: NominatimUpstreamOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.clock = options.clock ?? systemClock()
    this.cacheTtlMs = options.cacheTtlMs ?? NOMINATIM_CACHE_TTL_MS
    this.timeoutMs = options.timeoutMs ?? NOMINATIM_TIMEOUT_MS
    this.maxQueued = options.maxQueued ?? NOMINATIM_MAX_QUEUED
    this.limit = createRateLimiter(options.minIntervalMs ?? NOMINATIM_MIN_INTERVAL_MS, this.clock)
  }

  async search(query: string): Promise<NominatimUpstreamResult[]> {
    const key = nominatimCacheKey(query)
    if (key.length < 2) return []
    const cached = this.read(key)
    if (cached) return cached
    if (this.queued >= this.maxQueued) {
      throw new NominatimUpstreamError('Nominatim queue full')
    }
    this.queued += 1
    try {
      return await this.limit(async () => {
        const again = this.read(key)
        if (again) return again
        const data = await this.fetchUpstream(key)
        this.cache.set(key, { at: this.clock.now(), data })
        return data
      })
    } finally {
      this.queued -= 1
    }
  }

  private read(key: string): NominatimUpstreamResult[] | null {
    const hit = this.cache.get(key)
    if (!hit) return null
    if (this.clock.now() - hit.at >= this.cacheTtlMs) {
      this.cache.delete(key)
      return null
    }
    return hit.data
  }

  private async fetchUpstream(key: string): Promise<NominatimUpstreamResult[]> {
    const url =
      `${NOMINATIM_ENDPOINT}?q=${encodeURIComponent(key)}` +
      '&format=jsonv2&limit=8&addressdetails=1&dedupe=1&accept-language=en'
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': NOMINATIM_USER_AGENT,
          Referer: 'https://city-hub.pages.dev/',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (err) {
      throw new NominatimUpstreamError(err instanceof Error ? err.message : 'Nominatim request failed')
    }
    if (!res.ok) throw new NominatimUpstreamError(`Nominatim ${res.status}`)
    const body = await res.json() as unknown
    if (!Array.isArray(body)) throw new NominatimUpstreamError('Nominatim payload')
    return body as NominatimUpstreamResult[]
  }
}

let shared: NominatimUpstream | null = null

export function nominatimUpstream(): NominatimUpstream {
  if (!shared) shared = new NominatimUpstream()
  return shared
}

/** Test hook. Pass null to restore a fresh process-wide client. */
export function setNominatimUpstreamForTests(next: NominatimUpstream | null) {
  shared = next
}
