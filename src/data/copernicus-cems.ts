/**
 * Copernicus Emergency Management Service (CEMS) — activation monitor.
 *
 * When a major flood, wildfire, or earthquake hits SE Asia, Copernicus
 * triggers an emergency satellite mapping activation within hours.
 * The resulting flood extent polygons / damage maps are the gold standard
 * for disaster response assessment.
 *
 * This fetcher monitors the CEMS activation list (via Worker proxy) and
 * surfaces any active Thailand / SE Asia activations as critical alerts.
 *
 * Reference: https://emergency.copernicus.eu/mapping/list-of-activations-rapid
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const PROXY = (import.meta.env.VITE_PROXY_URL as string | undefined) ?? 'http://127.0.0.1:8787'
const TTL   = 60 * 60_000  // 1 hour — activations are declared infrequently

export interface CEMSActivation {
  id:      string
  title:   string
  country: string
  type:    string
  date:    string
  status:  string
  url:     string
}

export async function fetchCEMSActivations(): Promise<CEMSActivation[]> {
  return cachedFetch('cems/sea-activations', async () => {
    const res = await fetch(`${PROXY}/cems/activations`, {
      signal: timeoutSignal(10_000),
    })
    if (!res.ok) return []
    const data = await res.json() as { activations: CEMSActivation[] }
    return data.activations ?? []
  }, TTL)
}
