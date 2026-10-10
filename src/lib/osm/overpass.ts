/**
 * Overpass client: mirror fallback, per-attempt timeout, backoff on 429/504,
 * and an in-memory cache. A custom User-Agent is sent for runtimes that allow
 * it (Workers, Node). Browsers strip that header, so a 406 on the primary
 * mirror falls through to the next one.
 */
import { timeoutSignal } from '../request-timeout'
import { systemClock, type Clock } from './rate-limit'

export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const

export const OVERPASS_USER_AGENT =
  'CityHub/0.9 (https://city-hub.pages.dev; civic place overlay)'
export const OVERPASS_TIMEOUT_MS = 12_000
export const OVERPASS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function overpassBackoffMs(attempt: number): number {
  return Math.min(8_000, 500 * 2 ** attempt)
}

export class OverpassUnavailableError extends Error {
  constructor() {
    super('Overpass unavailable')
    this.name = 'OverpassUnavailableError'
  }
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

export interface OverpassClientOptions {
  fetchImpl?: FetchImpl
  clock?: Clock
  mirrors?: readonly string[]
  timeoutMs?: number
  cacheTtlMs?: number
}

export class OverpassClient {
  private readonly fetchImpl: FetchImpl
  private readonly clock: Clock
  private readonly mirrors: readonly string[]
  private readonly timeoutMs: number
  private readonly cacheTtlMs: number
  private readonly cache = new Map<string, { at: number; data: unknown }>()

  constructor(options: OverpassClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.clock = options.clock ?? systemClock()
    this.mirrors = options.mirrors ?? OVERPASS_MIRRORS
    this.timeoutMs = options.timeoutMs ?? OVERPASS_TIMEOUT_MS
    this.cacheTtlMs = options.cacheTtlMs ?? OVERPASS_CACHE_TTL_MS
  }

  async query(query: string): Promise<unknown> {
    const hit = this.cache.get(query)
    if (hit && this.clock.now() - hit.at < this.cacheTtlMs) return hit.data

    let attempt = 0
    for (let index = 0; index < this.mirrors.length; index += 1) {
      const mirror = this.mirrors[index]
      try {
        const res = await this.fetchImpl(mirror, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': OVERPASS_USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: timeoutSignal(this.timeoutMs),
        })
        if (res.ok) {
          const data = await res.json() as unknown
          this.cache.set(query, { at: this.clock.now(), data })
          return data
        }
        if ((res.status === 429 || res.status === 504) && index < this.mirrors.length - 1) {
          await this.clock.sleep(overpassBackoffMs(attempt))
          attempt += 1
        }
      } catch {
        // Timeout or network failure: try the next mirror immediately.
      }
    }
    throw new OverpassUnavailableError()
  }
}

let active = new OverpassClient()

export function queryOverpass(query: string): Promise<unknown> {
  return active.query(query)
}

/** Test hook. Pass nothing to restore a fresh default client. */
export function installOverpassClient(client?: OverpassClient) {
  active = client ?? new OverpassClient()
}
