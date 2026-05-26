/**
 * OpenAQ v3 API Integration
 * Harmonized global air quality data.
 */

// Bounding box for Bangkok Metro (approximate)
const BKK_BBOX = '100.3,13.5,100.9,14.0'
const PROXY = import.meta.env.VITE_PROXY_URL ?? 'http://127.0.0.1:8787'

export interface OpenAQLocation {
  id: number
  name: string
  coordinates: { latitude: number; longitude: number }
  sensors: Array<{
    parameter: { name: string; units: string }
    latest: { value: number; datetime: string }
  }>
}

/**
 * Fetches latest measurements for all sensors in the Bangkok bounding box.
 */
export async function fetchOpenAQLatest(): Promise<GeoJSON.FeatureCollection> {
  const key = import.meta.env.VITE_OPENAQ_KEY
  if (!key) {
    console.warn('VITE_OPENAQ_KEY not set. OpenAQ layer will be empty.')
    return { type: 'FeatureCollection', features: [] }
  }

  // Fetch locations within Bangkok bbox
  const res = await fetch(`${PROXY}/openaq/locations?bbox=${BKK_BBOX}&limit=100`, {
    headers: { 'X-API-Key': key }
  })
  
  if (!res.ok) throw new Error(`OpenAQ error: ${res.status}`)
  
  const data = await res.json() as { results: OpenAQLocation[] }
  
  const features: GeoJSON.Feature[] = data.results.map((loc) => {
    // Find PM2.5 if available, else first sensor
    const pm25Sensor = loc.sensors.find(s => s.parameter.name.toLowerCase() === 'pm25')
    const primary = pm25Sensor ?? loc.sensors[0]
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [loc.coordinates.longitude, loc.coordinates.latitude]
      },
      properties: {
        id: loc.id,
        name: loc.name,
        parameter: primary?.parameter.name ?? 'unknown',
        value: primary?.latest.value ?? 0,
        unit: primary?.parameter.units ?? '',
        updatedAt: primary?.latest.datetime ?? ''
      }
    }
  })

  return { type: 'FeatureCollection', features }
}
