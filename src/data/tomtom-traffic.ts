/**
 * TomTom Traffic API — Real-time traffic flow and incidents for Bangkok.
 *
 * This is the most impactful missing data source. The dashboard has Traffy
 * complaints ABOUT traffic, but no actual traffic speed/congestion data.
 * TomTom provides: current speed, free-flow speed, confidence, road closures,
 * accidents, construction.
 *
 * Free tier: 2,500 transactions/day
 * Get key: https://developer.tomtom.com/
 *
 * We use a grid of sample points across Bangkok to approximate city-wide
 * traffic flow, since TomTom's flowSegmentData is point-based.
 */
import { cachedFetch } from '../lib/cached-fetch'

const API_KEY = import.meta.env.VITE_TOMTOM_KEY as string | undefined

const TTL_FLOW = 2 * 60 * 1000   // 2 min — traffic changes fast
const TTL_INCIDENT = 3 * 60 * 1000 // 3 min

export interface TrafficFlowPoint {
  lat: number
  lng: number
  currentSpeed: number
  freeFlowSpeed: number
  confidence: number
  roadClosure: boolean
  congestionLevel: number // 0-1, derived from current/freeFlow
}

export interface TrafficIncident {
  id: string
  type: string
  severity: 'minor' | 'moderate' | 'major' | 'unknown'
  lat: number
  lng: number
  roadName: string
  description: string
  startTime: string
  endTime?: string
  delaySeconds?: number
}

/** Grid of sample points across Bangkok metro for flow data */
const BKK_FLOW_GRID: Array<{ lat: number; lng: number }> = [
  { lat: 13.7563, lng: 100.5018 }, // Victory Monument
  { lat: 13.7230, lng: 100.5292 }, // Silom
  { lat: 13.7442, lng: 100.5400 }, // Sathorn
  { lat: 13.7688, lng: 100.5377 }, // Ratchathewi
  { lat: 13.7456, lng: 100.5623 }, // Rama III
  { lat: 13.8031, lng: 100.5998 }, // Ladprao
  { lat: 13.7179, lng: 100.4859 }, // Thonburi
  { lat: 13.7739, lng: 100.4774 }, // Bang Sue
  { lat: 13.7034, lng: 100.5590 }, // Khlong Toey
  { lat: 13.8591, lng: 100.5217 }, // Don Mueang
  { lat: 13.6900, lng: 100.7500 }, // Suvarnabhumi area
  { lat: 13.9100, lng: 100.5500 }, // Rangsit
  { lat: 13.6500, lng: 100.4800 }, // Bang Bon
]

export function tomtomKeyAvailable(): boolean {
  return !!API_KEY
}

/** Fetch traffic flow at a single point */
async function fetchFlowAtPoint(lat: number, lng: number): Promise<TrafficFlowPoint | null> {
  if (!API_KEY) return null
  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${API_KEY}&point=${lat},${lng}&unit=KMPH`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const f = data?.flowSegmentData
    if (!f) return null
    const current = f.currentSpeed ?? 0
    const freeFlow = f.freeFlowSpeed ?? 1
    return {
      lat,
      lng,
      currentSpeed: current,
      freeFlowSpeed: freeFlow,
      confidence: f.confidence ?? 0,
      roadClosure: f.roadClosure ?? false,
      congestionLevel: Math.min(1, Math.max(0, 1 - current / Math.max(freeFlow, 1))),
    }
  } catch {
    return null
  }
}

/** Fetch city-wide traffic flow summary */
export async function fetchBangkokTrafficFlow(): Promise<TrafficFlowPoint[]> {
  return cachedFetch('tomtom/bangkok-flow', async () => {
    if (!API_KEY) return []
    const results = await Promise.all(
      BKK_FLOW_GRID.map((p) => fetchFlowAtPoint(p.lat, p.lng))
    )
    return results.filter((r): r is TrafficFlowPoint => r !== null)
  }, TTL_FLOW)
}

/** Fetch traffic incidents within Bangkok bounding box */
export async function fetchBangkokTrafficIncidents(): Promise<TrafficIncident[]> {
  return cachedFetch('tomtom/bangkok-incidents', async () => {
    if (!API_KEY) return []
    // Bangkok bbox: 13.50,100.35:13.95,100.95
    const bbox = '13.50,100.35:13.95,100.95'
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${API_KEY}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity}}}&language=en-GB&t=1111&timezone=UTC`
    try {
      const res = await fetch(url)
      if (!res.ok) return []
      const data = await res.json()
      const incidents = data?.incidents ?? []
      return incidents.map((inc: Record<string, unknown>) => {
        const props = (inc.properties ?? {}) as Record<string, unknown>
        const geom = (inc.geometry ?? {}) as Record<string, unknown>
        const coords = (geom.coordinates as number[][]) ?? []
        const firstCoord = coords[0] ?? [0, 0]
        const events = (props.events as Array<{ description: string; code: number }>) ?? []
        const sevMap: Record<number, TrafficIncident['severity']> = {
          0: 'unknown',
          1: 'minor',
          2: 'moderate',
          3: 'major',
          4: 'major',
        }
        return {
          id: String(props.id ?? ''),
          type: events.map((e) => e.description).join(', ') || 'Traffic incident',
          severity: sevMap[Number(props.magnitudeOfDelay ?? 0)] ?? 'unknown',
          lat: firstCoord[1] ?? 0,
          lng: firstCoord[0] ?? 0,
          roadName: String(props.from ?? props.to ?? ''),
          description: events.map((e) => e.description).join(', '),
          startTime: String(props.startTime ?? ''),
          endTime: props.endTime ? String(props.endTime) : undefined,
          delaySeconds: props.delay ? Number(props.delay) : undefined,
        }
      })
    } catch {
      return []
    }
  }, TTL_INCIDENT)
}

/** Convert incidents to GeoJSON */
export async function fetchTrafficIncidentGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const incidents = await fetchBangkokTrafficIncidents()
  return {
    type: 'FeatureCollection',
    features: incidents.map((inc) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [inc.lng, inc.lat] as [number, number],
      },
      properties: {
        id: inc.id,
        type: inc.type,
        severity: inc.severity,
        roadName: inc.roadName,
        description: inc.description,
        startTime: inc.startTime,
        endTime: inc.endTime ?? null,
        delaySeconds: inc.delaySeconds ?? null,
        color: inc.severity === 'major' ? '#e53935'
          : inc.severity === 'moderate' ? '#fb8c00'
          : inc.severity === 'minor' ? '#fdd835'
          : '#9e9e9e',
      },
    })),
  }
}

/** Get traffic summary stats for the vitals bar */
export async function fetchTrafficSummary(): Promise<{
  avgCongestion: number
  incidentCount: number
  majorIncidents: number
  avgSpeed: number
  status: 'good' | 'moderate' | 'heavy' | 'severe'
}> {
  const [flow, incidents] = await Promise.all([
    fetchBangkokTrafficFlow(),
    fetchBangkokTrafficIncidents(),
  ])

  if (flow.length === 0) {
    return { avgCongestion: 0, incidentCount: 0, majorIncidents: 0, avgSpeed: 0, status: 'good' }
  }

  const avgCongestion = flow.reduce((s, f) => s + f.congestionLevel, 0) / flow.length
  const avgSpeed = flow.reduce((s, f) => s + f.currentSpeed, 0) / flow.length
  const majorIncidents = incidents.filter((i) => i.severity === 'major').length

  let status: 'good' | 'moderate' | 'heavy' | 'severe' = 'good'
  if (avgCongestion > 0.6 || majorIncidents >= 3) status = 'severe'
  else if (avgCongestion > 0.4 || majorIncidents >= 1) status = 'heavy'
  else if (avgCongestion > 0.2) status = 'moderate'

  return {
    avgCongestion: Math.round(avgCongestion * 100),
    incidentCount: incidents.length,
    majorIncidents,
    avgSpeed: Math.round(avgSpeed),
    status,
  }
}
