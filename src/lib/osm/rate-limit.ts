/** Serialize async work so starts are at least `minIntervalMs` apart. */

export interface Clock {
  now: () => number
  sleep: (ms: number) => Promise<void>
}

export function systemClock(): Clock {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => {
      setTimeout(resolve, ms)
    }),
  }
}

export function createRateLimiter(minIntervalMs: number, clock: Clock) {
  let tail: Promise<unknown> = Promise.resolve()
  let lastStart = Number.NEGATIVE_INFINITY

  return function limit<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(async () => {
      const wait = lastStart + minIntervalMs - clock.now()
      if (wait > 0) await clock.sleep(wait)
      lastStart = clock.now()
      return task()
    })
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
