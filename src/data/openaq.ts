/**
 * OpenAQ v3 API Integration — harmonized global air quality data.
 */

// Bangkok Metro default bbox (kept for back-compat).
const BKK_BBOX: [number, number, number, number] = [100.3, 13.5, 100.9, 14.0]
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
 * Fetches latest measurements for all sensors in a bounding box.
 * bbox = [west, south, east, north]
 */
export async function fetchOpenAQLatest(
  bbox: [number, number, number, number] = BKK_BBOX,
): Promise<GeoJSON.FeatureCollection> {
  const key = import.meta.env.VITE_OPENAQ_KEY
  if (!key) {
    // OpenAQ requires an API key; without it the layer is empty by design.
    return { type: 'FeatureCollection', features: [] }
  }

  const bboxStr = bbox.join(',')
  const res = await fetch(`${PROXY}/openaq/locations?bbox=${bboxStr}&limit=100`, {
    headers: { 'X-API-Key': key },
  })

  if (!res.ok) throw new Error(`OpenAQ error: ${res.status}`)

  const data = await res.json() as { results: OpenAQLocation[] }

  const features: GeoJSON.Feature[] = data.results.map((loc) => {
    const pm25Sensor = loc.sensors.find((s) => s.parameter.name.toLowerCase() === 'pm25')
    const primary = pm25Sensor ?? loc.sensors[0]

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [loc.coordinates.longitude, loc.coordinates.latitude],
      },
      properties: {
        id: loc.id,
        name: loc.name,
        parameter: primary?.parameter.name ?? 'unknown',
        value: primary?.latest.value ?? 0,
        unit: primary?.parameter.units ?? '',
        updatedAt: primary?.latest.datetime ?? '',
      },
    }
  })

  return { type: 'FeatureCollection', features }
}
