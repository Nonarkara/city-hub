/**
 * iTIC-grade live Bangkok traffic + incidents (Longdo).
 *
 * live.iticfoundation.org is built on Longdo: its road colouring is Longdo's
 * traffic tile layer and its incident rail is the Longdo Events feed. Both are
 * openly reachable and consumed here directly, so the twin renders the same
 * live picture as iTIC — fresh on every visit:
 *
 *   • Traffic tiles — ms.longdo.com/mmmap/tile.php?mode=traffic (verified live:
 *     200 image/jpeg with real congestion rendering over Bangkok; the earlier
 *     "SDK-only" assumption was wrong — plain XYZ tiles work with our key).
 *   • Events feed  — event.longdo.com/feed/json (verified live: CORS `*`,
 *     Thai + English titles, lat/lng, type; contributors are itic.*).
 */
import { cachedFetch } from '../lib/cached-fetch'
import { timeoutSignal } from './source-registry'

const LONGDO_KEY = import.meta.env.VITE_LONGDO_KEY as string | undefined
const INDEX_URL  = 'https://traffic.longdo.com/api/json/traffic/index'
const EVENTS_URL = 'https://event.longdo.com/feed/json'
const INDEX_TTL  = 5 * 60_000
const EVENTS_TTL = 2 * 60_000

// ── Traffic tiles ────────────────────────────────────────────────────────────

/** Raster tile template for Longdo's live traffic map (basemap + congestion
 *  colouring — the exact rendering iTIC Live shows). The 5-minute time bucket
 *  busts MapLibre's per-URL tile cache so every page load pulls fresh state. */
export function longdoTrafficTiles(): string {
  if (!LONGDO_KEY) return ''
  const bucket = Math.floor(Date.now() / INDEX_TTL)
  return `https://ms.longdo.com/mmmap/tile.php?zoom={z}&x={x}&y={y}&mode=traffic&key=${LONGDO_KEY}&proj=epsg3857&HD=1&ts=${bucket}`
}

// ── Citywide congestion index ────────────────────────────────────────────────

export type TrafficLevel = 'free' | 'moderate' | 'heavy'

export interface LongdoTrafficIndex {
  index: number        // 0–10
  level: TrafficLevel
  observedAt: string
  fetchedAt: string
}

/** Longdo's live citywide congestion index (0–10) — the number iTIC shows in
 *  its top-right "ดัชนีรถติด" badge. Public, CORS-enabled. */
export async function fetchLongdoTrafficIndex(): Promise<LongdoTrafficIndex> {
  return cachedFetch('longdo/traffic-index', async () => {
    const bucket = Math.floor(Date.now() / INDEX_TTL)
    const res = await fetch(`${INDEX_URL}?time=${bucket}`, { signal: timeoutSignal(8000) })
    if (!res.ok) throw new Error(`Longdo traffic index ${res.status}`)
    const data = await res.json() as { index?: unknown; time?: unknown }
    const index = Number(data.index)
    const sourceTime = Number(data.time)
    if (!Number.isFinite(index) || index < 0 || index > 10) {
      throw new Error('Longdo traffic index returned an invalid value')
    }
    const observedAt = Number.isFinite(sourceTime) && sourceTime > 0
      ? new Date(sourceTime * 1000).toISOString()
      : new Date().toISOString()
    return {
      index,
      level: index < 4 ? 'free' as const : index < 7 ? 'moderate' as const : 'heavy' as const,
      observedAt,
      fetchedAt: new Date().toISOString(),
    }
  }, INDEX_TTL)
}

// ── Incident events (the iTIC left rail) ─────────────────────────────────────

export type IticEventKind =
  | 'accident' | 'carbreakdown' | 'roadclosed' | 'diversion'
  | 'warning' | 'information' | 'other'

export interface IticEvent {
  id: string
  title: string        // Thai — primary, as iTIC shows it
  titleEn: string
  description: string
  descriptionEn: string
  kind: IticEventKind
  lat: number
  lng: number
  start: string        // "YYYY-MM-DD HH:mm:ss" (Asia/Bangkok)
  stop: string
  contributor: string
}

/** iTIC-style colour per event kind (accident red, breakdown amber, …). */
export const ITIC_EVENT_COLOR: Record<IticEventKind, string> = {
  accident:     '#e3252c',
  roadclosed:   '#e3252c',
  carbreakdown: '#ffa800',
  warning:      '#ffa800',
  diversion:    '#fb8c00',
  information:  '#58a6ff',
  other:        '#9e9e9e',
}

export const ITIC_EVENT_LABEL_TH: Record<IticEventKind, string> = {
  accident:     'อุบัติเหตุ',
  carbreakdown: 'รถเสีย',
  roadclosed:   'ปิดถนน',
  diversion:    'เบี่ยงจราจร',
  warning:      'ระวัง',
  information:  'ประชาสัมพันธ์',
  other:        'เหตุการณ์',
}

function kindOf(icon: unknown): IticEventKind {
  const k = String(icon ?? '').toLowerCase()
  if (k in ITIC_EVENT_COLOR) return k as IticEventKind
  return 'other'
}

/** Live iTIC / Longdo incident feed (accidents, breakdowns, closures,
 *  diversions). Direct browser fetch — the endpoint serves ACAO `*`.
 *  Throws on failure so cachedFetch can serve stale-while-error. */
export async function fetchLongdoEvents(): Promise<IticEvent[]> {
  return cachedFetch('longdo/events', async () => {
    const res = await fetch(EVENTS_URL, { signal: timeoutSignal(10_000) })
    if (!res.ok) throw new Error(`Longdo events ${res.status}`)
    const raw = await res.json() as Array<Record<string, unknown>>
    if (!Array.isArray(raw)) throw new Error('Longdo events: unexpected shape')
    return raw
      .map((e): IticEvent | null => {
        const lat = Number(e.latitude)
        const lng = Number(e.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        return {
          id: String(e.eid ?? `${lat},${lng}`),
          title: String(e.title ?? ''),
          titleEn: String(e.title_en ?? ''),
          description: String(e.description ?? ''),
          descriptionEn: String(e.description_en ?? ''),
          kind: kindOf(e.icon),
          lat, lng,
          start: String(e.start ?? ''),
          stop: String(e.stop ?? ''),
          contributor: String(e.contributor ?? ''),
        }
      })
      .filter((e): e is IticEvent => e !== null)
  }, EVENTS_TTL)
}

/** Events as GeoJSON for the map layer. */
export function eventsToGeoJSON(events: IticEvent[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id, title: e.title, titleEn: e.titleEn,
        description: e.description, descriptionEn: e.descriptionEn,
        kind: e.kind, kindTh: ITIC_EVENT_LABEL_TH[e.kind],
        color: ITIC_EVENT_COLOR[e.kind],
        start: e.start, stop: e.stop, contributor: e.contributor,
      },
    })),
  }
}
