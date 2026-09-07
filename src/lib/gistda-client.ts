/**
 * GISTDA ArcGIS helpers — previously imported from a sibling `_shared` package
 * that is not in this repository. Reconstructed from the production bundle so
 * a standalone clone builds. Endpoints are public GISTDA MapServer queries.
 */
const PORTAL = 'https://gistdaportal.gistda.or.th/data/rest/services'

export type Pm25Band = 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'hazardous' | '—'

export function pm25Level(n: unknown): Pm25Band {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '—'
  if (v <= 25) return 'good'
  if (v <= 37) return 'moderate'
  if (v <= 50) return 'sensitive'
  if (v <= 90) return 'unhealthy'
  return 'hazardous'
}

async function queryJson(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ f: 'json', returnGeometry: 'false', ...params })
  const res = await fetch(`${PORTAL}/${path}?${qs}`)
  if (!res.ok) throw new Error(`GISTDA ${path} ${res.status}`)
  const data = await res.json() as { error?: { message?: string } }
  if (data?.error) throw new Error(`GISTDA ${path}: ${data.error.message ?? 'error'}`)
  return data
}

async function queryGeoJSON(path: string, params: Record<string, string>): Promise<GeoJSON.FeatureCollection> {
  const qs = new URLSearchParams({ f: 'geojson', ...params })
  const res = await fetch(`${PORTAL}/${path}?${qs}`)
  if (!res.ok) throw new Error(`GISTDA ${path} ${res.status}`)
  const data = await res.json() as GeoJSON.FeatureCollection & { error?: { message?: string } }
  if (data?.error) throw new Error(`GISTDA ${path}: ${data.error.message ?? 'error'}`)
  return data?.type === 'FeatureCollection' ? data : { type: 'FeatureCollection', features: [] }
}

export async function fetchAQIStationsByProvince(province: string) {
  const where = `pv_tn='${String(province).replace(/'/g, "''")}'`
  return queryJson('FR_Fire/AirQuality_hourly/MapServer/0/query', {
    where,
    outFields: 'st_id,st_name,pm25,pm10,longitude,latitude,pv_tn,ap_tn,tb_tn,acq_date,acq_time',
  })
}

/** Nearest GISTDA hourly station to a point. History graph is not on this layer. */
export async function fetchPm25ByLocation(lat: number, lng: number) {
  const resp = await fetchAQIStationsByProvince('กรุงเทพมหานคร') as {
    features?: Array<{ attributes?: Record<string, unknown> }>
  }
  const features = Array.isArray(resp?.features) ? resp.features : []
  let best: Record<string, unknown> | null = null
  let bestD = Infinity
  for (const f of features) {
    const a = f.attributes ?? {}
    const y = Number(a.latitude)
    const x = Number(a.longitude)
    if (!Number.isFinite(y) || !Number.isFinite(x)) continue
    const d = (y - lat) ** 2 + (x - lng) ** 2
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  return { pm25: Number(best?.pm25 ?? 0), graphHistory24hrs: [] as Array<[number, string]> }
}

export async function fetchPm25AllProvinces(): Promise<Array<{ pv_tn: string; pm25: number }>> {
  const resp = await queryJson('FR_Fire/AirQuality_hourly/MapServer/0/query', {
    where: '1=1',
    outFields: 'pv_tn,pm25',
  }) as { features?: Array<{ attributes?: Record<string, unknown> }> }
  const maxByProvince = new Map<string, number>()
  for (const f of resp?.features ?? []) {
    const a = f.attributes ?? {}
    const name = String(a.pv_tn ?? '')
    const pm25 = Number(a.pm25)
    if (!name || !Number.isFinite(pm25)) continue
    const prev = maxByProvince.get(name)
    if (prev === undefined || pm25 > prev) maxByProvince.set(name, pm25)
  }
  return [...maxByProvince.entries()]
    .map(([pv_tn, pm25]) => ({ pv_tn, pm25 }))
    .sort((a, b) => b.pm25 - a.pm25)
}

export async function fetchFloodPolygonsGeoJSON(region = 'central') {
  const path = region === 'central'
    ? 'FL_Flood/flood_freq_central/MapServer/0/query'
    : 'FL_Flood/flood_daily/MapServer/0/query'
  return queryGeoJSON(path, { where: '1=1', outFields: '*' })
}

export async function fetchRecurringFloodZones() {
  return queryGeoJSON('FL_Flood/FL_RepeatedFlooding_GISTDA_50k_Y2005_Y2016/MapServer/0/query', {
    where: '1=1',
    outFields: '*',
  })
}

/** No public province-boundary layer is wired in this repo. Callers must tolerate empty. */
export async function fetchProvincePolygons(): Promise<GeoJSON.FeatureCollection> {
  return { type: 'FeatureCollection', features: [] }
}
