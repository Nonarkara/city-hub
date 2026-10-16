/**
 * Overpass client: mirror fallback, per-attempt timeout, backoff-and-retry on
 * backpressure (429/500/502/503/504), and an in-memory cache. A custom
 * User-Agent is sent for runtimes that allow it (Workers, Node). Browsers strip
 * that header, so a 406 on the primary mirror falls through to the next one.
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

/**
 * Per-attempt budget.
 *
 * Measured 2026-10-15 with the real Bangkok city-image query against
 * overpass-api.de:
 *
 *   upstream [timeout:12]  → HTTP 502 (gateway gives up at 12s)
 *   upstream [timeout:25]  → HTTP 200 in 52s, 791 elements
 *   upstream [timeout:60]  → HTTP 200 in 55s, 1200 elements (all five elements)
 *
 * So the previous 12s client budget could not succeed against the public
 * mirrors: the request is genuinely 40–60 seconds of work, not a hang. The
 * budget has to clear the real cost, and the query in `city-image.ts` carries
 * `[timeout:60]` to match.
 *
 * This is safe because the request is made at most once per city per 24h — the
 * client caches, and the CDN caches the proxy response behind it. The user
 * waits once, behind a visible pending state, and nobody waits twice.
 */
export const OVERPASS_TIMEOUT_MS = 90_000
export const OVERPASS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function overpassBackoffMs(attempt: number): number {
  return Math.min(8_000, 500 * 2 ** attempt)
}

/**
 * Statuses that mean "busy right now, ask again", not "this query is wrong".
 *
 * Measured 2026-10-15 against the real mirrors while they were saturated, with
 * the exact city-image query the app sends:
 *
 *   overpass-api.de  → 502, body: "This Overpass API server is currently at
 *                      capacity. All query workers are busy and the request queue
 *                      is full. … Retry your request using exponential backoff"
 *   kumi.systems     → 500
 *   no User-Agent    → 429
 *
 * 502 was the missing one and it is the one that actually happens. The previous
 * condition treated only 429/504 as retryable, so a merely-busy primary mirror
 * ended the whole sweep in ~2s and the user was shown "map data unavailable" for
 * a service that answers the identical query in ~24s once the queue drains.
 * 406 stays out of this set on purpose: that means the request was rejected, and
 * repeating it unchanged would just repeat the rejection.
 */
export const OVERPASS_RETRYABLE_STATUS: ReadonlySet<number> = new Set([429, 500, 502, 503, 504])

/**
 * Full passes over the mirror list before giving up.
 *
 * The old loop made exactly one pass: `index` only ever moved forward, so a
 * transient "all workers busy" could never be retried even though the upstream
 * asks for exactly that. Three rounds is the most we will ever send to a free
 * public service in one request — 9 attempts at absolute worst — and the CDN
 * cache means a given city is really only asked once a day.
 */
export const OVERPASS_MAX_ROUNDS = 3

/**
 * Ceiling on the *whole* request, across every mirror and every retry.
 *
 * `OVERPASS_TIMEOUT_MS` (90s) is the budget the browser gives us and the budget
 * it enforces on itself. If retries could outlive it, the client would abort
 * mid-flight and the user would sit watching "Reading OpenStreetMap… 89s" and
 * then get a failure they never learn the reason for — which is exactly what
 * adding retries did before this constant existed: a saturated mirror answered
 * 503 in ~43s for Kranj, but Bangkok burned the full 90s and was cut off by
 * the client rather than answered by us.
 *
 * So the server always finishes first and answers in its own words — 200 with
 * data, or 503 that means something. 75s leaves headroom under the 90s client
 * budget while still covering a measured 55s cold read plus one retry.
 */
export const OVERPASS_DEADLINE_MS = 75_000

/** Spread retries out so concurrent clients do not resynchronise on one mirror. */
export function overpassRetryDelayMs(attempt: number, random: () => number = Math.random): number {
  return overpassBackoffMs(attempt) + Math.floor(random() * 250)
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
  /** Jitter source for retry delays. Tests pass a constant to stay deterministic. */
  random?: () => number
  maxRounds?: number
  /** Ceiling on the whole request, across all mirrors and retries. */
  deadlineMs?: number
}

export class OverpassClient {
  private readonly fetchImpl: FetchImpl
  private readonly clock: Clock
  private readonly mirrors: readonly string[]
  private readonly timeoutMs: number
  private readonly cacheTtlMs: number
  private readonly random: () => number
  private readonly maxRounds: number
  private readonly deadlineMs: number
  private readonly cache = new Map<string, { at: number; data: unknown }>()

  constructor(options: OverpassClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.clock = options.clock ?? systemClock()
    this.mirrors = options.mirrors ?? OVERPASS_MIRRORS
    this.timeoutMs = options.timeoutMs ?? OVERPASS_TIMEOUT_MS
    this.cacheTtlMs = options.cacheTtlMs ?? OVERPASS_CACHE_TTL_MS
    this.random = options.random ?? Math.random
    this.maxRounds = Math.max(1, options.maxRounds ?? OVERPASS_MAX_ROUNDS)
    this.deadlineMs = options.deadlineMs ?? OVERPASS_DEADLINE_MS
  }

  async query(query: string): Promise<unknown> {
    const hit = this.cache.get(query)
    if (hit && this.clock.now() - hit.at < this.cacheTtlMs) return hit.data

    // Every attempt, backoff and retry shares this one budget so the answer
    // always lands inside the caller's own timeout.
    const deadline = this.clock.now() + this.deadlineMs
    let attempt = 0
    for (let round = 0; round < this.maxRounds; round += 1) {
      // Did this pass end in backpressure (busy), or in a verdict (rejected /
      // timed out / partial)? Only backpressure is worth another pass.
      let sawBackpressure = false

      for (let index = 0; index < this.mirrors.length; index += 1) {
        const mirror = this.mirrors[index]
        const remaining = deadline - this.clock.now()
        if (remaining <= 0) break
        try {
          const res = await this.fetchImpl(mirror, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
              'User-Agent': OVERPASS_USER_AGENT,
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: timeoutSignal(Math.min(this.timeoutMs, remaining)),
          })
          if (res.ok) {
            const data = await res.json() as unknown
            // Overpass can return HTTP 200 with a runtime error and partial data.
            if (!data || typeof data !== 'object' || !Array.isArray((data as { elements?: unknown }).elements) || (data as { remark?: unknown }).remark) continue
            this.cache.set(query, { at: this.clock.now(), data })
            return data
          }
          if (OVERPASS_RETRYABLE_STATUS.has(res.status)) {
            sawBackpressure = true
            if (index < this.mirrors.length - 1) {
              await this.clock.sleep(overpassRetryDelayMs(attempt, this.random))
              attempt += 1
            }
          }
        } catch {
          // Timeout or network failure: try the next mirror immediately.
        }
      }

      // Nothing said "busy" — the mirrors gave a final answer. Repeating the
      // request would only repeat that answer, so do not spend budget on it.
      if (!sawBackpressure) break
      if (round >= this.maxRounds - 1) break
      // Never sleep past the deadline: a backoff that outlives the budget would
      // hand the caller a timeout instead of an answer.
      const delay = overpassRetryDelayMs(attempt, this.random)
      if (this.clock.now() + delay >= deadline) break
      await this.clock.sleep(delay)
      attempt += 1
    }
    throw new OverpassUnavailableError()
  }
}

/**
 * Same-origin proxy. The Worker / Pages function forwards to the mirrors with a
 * User-Agent it is actually allowed to set; see `overpass-http.ts` for the
 * measurements behind that.
 */
export const OVERPASS_PROXY_PATH = '/api/overpass'

/**
 * True when Overpass is being called from a browser.
 *
 * Browser: route through the proxy. The mirrors reject a browser UA (measured:
 * overpass-api.de returns 406 to Chrome's UA) and rate-limit one that looks
 * like a script, and JavaScript cannot set User-Agent to fix either.
 * Node / Worker: talk to the mirrors directly — no pointless round-trip.
 */
function inBrowser(): boolean {
  return typeof window !== 'undefined'
}

let active = new OverpassClient()

function defaultClient(): OverpassClient {
  // A single-element mirror list: in the browser the "mirror" is our own
  // function, which does its own fallback server-side. The loop and its
  // backoff logic stay identical on both transports.
  //
  // `maxRounds: 1` matters. The proxy has *already* spent its own retry budget
  // on the mirrors before it answers, so retrying it would mean paying the wait
  // twice for one question. The browser's job here is to make one request and
  // report honestly what came back; the deadline is its own fetch budget.
  return inBrowser()
    ? new OverpassClient({ mirrors: [OVERPASS_PROXY_PATH], maxRounds: 1, deadlineMs: OVERPASS_TIMEOUT_MS })
    : new OverpassClient()
}

export function queryOverpass(query: string): Promise<unknown> {
  return active.query(query)
}

/** Test hook. Pass nothing to restore a fresh default client. */
export function installOverpassClient(client?: OverpassClient) {
  active = client ?? defaultClient()
}

active = defaultClient()
