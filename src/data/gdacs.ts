/**
 * GDACS — Global Disaster Alert and Coordination System.
 *
 * Free RSS/GeoJSON feeds for earthquakes, floods, tropical cyclones,
 * volcanic eruptions, and wildfires globally. Updated every 30 minutes.
 *
 * We filter for Southeast Asia / Pacific events and surface them as
 * critical alerts in the dashboard.
 *
 * API: https://www.gdacs.org/xml/rss.xml (RSS) or
 *      https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?
 *
 * For CORS we route through the Worker.
 */
import { cachedFetch } from '../lib/cached-fetch'

const PROXY = (import.meta.env.VITE_PROXY_URL as string | undefined) ?? 'http://127.0.0.1:8787'
const TTL   = 30 * 60_000   // 30 min — GDACS updates every 30 min

export type GDACSAlertLevel = 'Green' | 'Orange' | 'Red'
export type GDACSHazardType = 'EQ' | 'FL' | 'TC' | 'VO' | 'WF' | 'DR'

export interface GDACSEvent {
  eventId:     string
  hazardType:  GDACSHazardType
  hazardLabel: string
  alertLevel:  GDACSAlertLevel
  country:     string
  countryCode: string
  title:       string
  description: string
  date:        string
  lat:         number
  lng:         number
  url:         string
  affectedPop: number | null
  displaced:   number | null
  deaths:      number | null
}

const HAZARD_LABEL: Record<GDACSHazardType, string> = {
  EQ: 'EARTHQUAKE', FL: 'FLOOD', TC: 'TROPICAL CYCLONE',
  VO: 'VOLCANO', WF: 'WILDFIRE', DR: 'DROUGHT',
}

// SEA bounding box with generous padding for regional context
const SEA_BBOX = { minLat: -10, maxLat: 25, minLng: 95, maxLng: 140 }

function inSEA(lat: number, lng: number): boolean {
  return lat >= SEA_BBOX.minLat && lat <= SEA_BBOX.maxLat &&
         lng >= SEA_BBOX.minLng && lng <= SEA_BBOX.maxLng
}

export async function fetchGDACSAlerts(): Promise<GDACSEvent[]> {
  return cachedFetch('gdacs/sea-events', async () => {
    // GDACS GeoJSON API — all events from last 90 days
    const url = `${PROXY}/gdacs/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,FL,TC,VO,WF&alertlevel=Orange,Red&fromDate=&toDate=&country=&eventtype=&severity=&voluntary=false&geostring=`

    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) {
      // Fallback: try the public GeoJSON feed directly
      const fallback = await fetch(
        'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?' +
        'eventlist=EQ%2CFL%2CTC%2CVO%2CWF&alertlevel=Orange%2CRed',
        { signal: AbortSignal.timeout(10_000) }
      )
      if (!fallback.ok) return []
      const data = await fallback.json() as { features?: unknown[] }
      return parseGDACS(data.features ?? [])
    }

    const data = await res.json() as { features?: unknown[] }
    return parseGDACS(data.features ?? [])
  }, TTL)
}

function parseGDACS(features: unknown[]): GDACSEvent[] {
  return (features as Array<Record<string, unknown>>)
    .map((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>
      const geom  = (f.geometry ?? {}) as { coordinates?: [number, number] }
      const [lng, lat] = geom.coordinates ?? [0, 0]

      const hazardType = String(props.eventtype ?? props.eventType ?? 'EQ') as GDACSHazardType

      return {
        eventId:     String(props.eventid ?? props.eventId ?? ''),
        hazardType,
        hazardLabel: HAZARD_LABEL[hazardType] ?? hazardType,
        alertLevel:  (String(props.alertlevel ?? props.alertLevel ?? 'Green')) as GDACSAlertLevel,
        country:     String(props.countryname ?? props.country ?? ''),
        countryCode: String(props.iso3 ?? ''),
        title:       String(props.htmldescription ?? props.name ?? '').replace(/<[^>]+>/g, '').slice(0, 100),
        description: String(props.description ?? '').replace(/<[^>]+>/g, '').slice(0, 200),
        date:        String(props.fromdate ?? props.todate ?? ''),
        lat,
        lng,
        url:         `https://www.gdacs.org/report.aspx?eventid=${props.eventid}&eventtype=${hazardType}`,
        affectedPop: Number((props.severitydata as Record<string,unknown>)?.popaffected ?? 0) || null,
        displaced:   null,
        deaths:      Number((props.severitydata as Record<string,unknown>)?.deathsTotal ?? 0) || null,
      }
    })
    .filter((e) => inSEA(e.lat, e.lng) && e.eventId)
    .sort((a, b) => {
      const rank: Record<GDACSAlertLevel, number> = { Red: 0, Orange: 1, Green: 2 }
      return rank[a.alertLevel] - rank[b.alertLevel]
    })
    .slice(0, 15)
}
