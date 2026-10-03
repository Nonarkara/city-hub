/** Create an abort signal without coupling data fetchers to the source registry. */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  globalThis.setTimeout(() => controller.abort(), ms)
  return controller.signal
}
