/**
 * "Captured Xm ago" — borrowed from the Phuket dashboard freshnessLabel pattern.
 */
export function freshnessLabel(timestampMs: number): string {
  if (!timestampMs) return '—'
  const ageMs = Date.now() - timestampMs
  const m = Math.floor(ageMs / 60_000)
  if (m < 1) return 'NOW'
  if (m < 60) return `${m}M AGO`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}H AGO`
  const d = Math.floor(h / 24)
  return `${d}D AGO`
}
