/**
 * Traffy Fondue — Bangkok civic complaint data.
 * Two endpoints:
 *   1. /share/teamchadchart/search — paginated tickets (for map layer + vitals)
 *   2. /teamchadchart-stat-api/geojson/v1 — pre-aggregated GeoJSON (for map dots)
 *
 * Proxied through Cloudflare Worker for CORS.
 */
import { cachedFetch } from '../lib/cached-fetch'

const PROXY = import.meta.env.VITE_PROXY_URL as string | undefined
const BASE = PROXY ? `${PROXY}/traffy` : 'https://publicapi.traffy.in.th'

const TTL_STATS = 5 * 60 * 1000
const TTL_GEOJSON = 5 * 60 * 1000

export interface TraffyTicket {
  ticket_id: string
  type: string | null
  description: string
  coords: [number, number] // [lng, lat]
  state: string
  address: string
  district: string
  timestamp: string
  photo_url?: string
  problem_type_fondue: string[]
  ai_summary?: string
  ai_sentiment?: number
}

export interface TraffyStats {
  total: number
  active: number // inprogress + start + follow + forward
  finished: number
  byType: Record<string, number>
}

const TRAFFY_COLORS: Record<string, string> = {
  'น้ำท่วม': '#2962ff',
  'ถนน': '#ff7043',
  'ทางเท้า': '#8d6e63',
  'อาคารสถานที่ชำรุด': '#e53935',
  'ไฟฟ้า': '#fdd835',
  'ประปา': '#29b6f6',
  'ความสะอาด': '#795548',
  'ขยะ': '#795548',
  'ต้นไม้': '#66bb6a',
  'จุดเสี่ยง': '#ab47bc',
  'ควันดำ': '#78909c',
  'ฝุ่นควัน&กลิ่น&PM2.5': '#78909c',
  'สัตว์': '#ff8a65',
  'เสียง': '#9e9e9e',
  'อื่นๆ': '#9e9e9e',
}

export function traffyColorForTypes(types: string[]): string {
  for (const t of types) {
    if (TRAFFY_COLORS[t]) return TRAFFY_COLORS[t]
  }
  return '#9e9e9e'
}

/** Fetch recent tickets and convert to GeoJSON for the map */
export async function fetchTraffyGeoJSON(limit = 500): Promise<GeoJSON.FeatureCollection> {
  return cachedFetch('traffy/geojson', async () => {
    const url = `${BASE}/teamchadchart-stat-api/geojson/v1`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Traffy ${res.status}`)
    const data = await res.json()
    const features = (data?.features ?? []) as GeoJSON.Feature[]
    // Add color property for map rendering
    const colored = features.map((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>
      const types = (props.problem_type_fondue as string[]) ?? []
      return {
        ...f,
        properties: {
          ...props,
          color: traffyColorForTypes(types),
          types: types.join(', '),
        },
      }
    })
    return {
      type: 'FeatureCollection' as const,
      features: colored.slice(0, limit),
    }
  }, TTL_GEOJSON)
}

/** Fetch summary statistics for the vitals bar */
export async function fetchTraffyStats(): Promise<TraffyStats> {
  return cachedFetch('traffy/stats', async () => {
    const url = `${BASE}/teamchadchart-stat-api/geojson/v1`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Traffy ${res.status}`)
    const data = await res.json()
    const sum = (data?.sum_state ?? {}) as Record<string, number>
    const total = Number(data?.total ?? 0)
    const active = (sum.inprogress ?? 0) + (sum.start ?? 0) + (sum.follow ?? 0) + (sum.forward ?? 0)
    const finished = sum.finish ?? 0

    // Count by problem type from features
    const byType: Record<string, number> = {}
    const features = (data?.features ?? []) as GeoJSON.Feature[]
    for (const f of features) {
      const props = (f.properties ?? {}) as Record<string, unknown>
      const types = (props.problem_type_fondue as string[]) ?? []
      for (const t of types) {
        byType[t] = (byType[t] ?? 0) + 1
      }
    }

    return { total, active, finished, byType }
  }, TTL_STATS)
}

/** Fetch recent flood-specific tickets for the alert panel */
export async function fetchTraffyFloods(limit = 50): Promise<TraffyTicket[]> {
  return cachedFetch('traffy/floods', async () => {
    const url = `${BASE}/share/teamchadchart/search?offset=0&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Traffy ${res.status}`)
    const data = await res.json()
    const results = (data?.results ?? []) as Array<Record<string, unknown>>

    return results
      .filter((r) => {
        const desc = String(r.description ?? '')
        const types = (r.problem_type_fondue as string[]) ?? []
        return types.includes('น้ำท่วม') || desc.includes('น้ำท่วม') || desc.includes(' flooding')
      })
      .map((r) => toTicket(r))
  }, TTL_STATS)
}

function toTicket(r: Record<string, unknown>): TraffyTicket {
  const coords = (r.coords as string[]) ?? ['0', '0']
  const props = (r as Record<string, unknown>)
  const ai = (props.ai as Record<string, unknown>) ?? {}
  return {
    ticket_id: String(r.ticket_id ?? ''),
    type: (r.type as string) ?? null,
    description: String(r.description ?? ''),
    coords: [Number(coords[0]), Number(coords[1])] as [number, number],
    state: String(r.state ?? ''),
    address: String(r.address ?? ''),
    district: String(r.district ?? ''),
    timestamp: String(r.timestamp ?? ''),
    photo_url: (r.photo_url as string) || undefined,
    problem_type_fondue: (r.problem_type_fondue as string[]) ?? [],
    ai_summary: (ai.summary as string) || undefined,
    ai_sentiment: (ai.sentimental_percent as number) || undefined,
  }
}
