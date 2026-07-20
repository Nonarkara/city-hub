/**
 * Cross-ASEAN air-quality snapshot — current US AQI + PM2.5 for peer cities,
 * via Open-Meteo (zero auth). Used by the ASEAN strip to give regional
 * context: where does Bangkok sit relative to its peers right now?
 */
import { cachedFetch } from '../lib/cached-fetch'

const TTL = 10 * 60_000

export interface ASEANCity {
  id: string
  name: string
  country: string
  flag: string
  lat: number
  lng: number
}

export const ASEAN_PEERS: ASEANCity[] = [
  { id: 'bangkok',   name: 'BANGKOK',   country: 'TH', flag: '🇹🇭', lat: 13.7563, lng: 100.5018 },
  { id: 'singapore', name: 'SINGAPORE', country: 'SG', flag: '🇸🇬', lat: 1.3521,  lng: 103.8198 },
  { id: 'kl',        name: 'KUALA LUMPUR', country: 'MY', flag: '🇲🇾', lat: 3.1390,  lng: 101.6869 },
  { id: 'manila',    name: 'MANILA',    country: 'PH', flag: '🇵🇭', lat: 14.5995, lng: 120.9842 },
  { id: 'jakarta',   name: 'JAKARTA',   country: 'ID', flag: '🇮🇩', lat: -6.2088, lng: 106.8456 },
]

export interface CityAQI {
  city: ASEANCity
  usAqi: number
  pm25: number
}

async function fetchCityAQI(city: ASEANCity): Promise<CityAQI | null> {
  return cachedFetch(`openmeteo/aqi-${city.id}`, async () => {
    try {
      const url =
        `https://air-quality-api.open-meteo.com/v1/air-quality` +
        `?latitude=${city.lat}&longitude=${city.lng}` +
        `&current=us_aqi,pm2_5`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Open-Meteo AQ ${res.status}`)
      const d = await res.json()
      const c = d.current as { us_aqi: number; pm2_5: number }
      return {
        city,
        usAqi: Math.round(c.us_aqi),
        pm25: Math.round(c.pm2_5 * 10) / 10,
      }
    } catch (err) {
      // Throw so cachedFetch can serve stale instead of caching a null result.
      console.warn(`[asean-aqi] ${city.id} fetch failed:`, err)
      throw err
    }
  }, TTL)
}

export async function fetchAllASEAN(): Promise<CityAQI[]> {
  // allSettled so one city's failure (with no stale cache) doesn't sink the rest
  const results = await Promise.allSettled(ASEAN_PEERS.map((c) => fetchCityAQI(c)))
  return results
    .filter((r): r is PromiseFulfilledResult<CityAQI | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r): r is CityAQI => r !== null)
}
