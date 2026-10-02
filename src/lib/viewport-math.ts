/**
 * Live frame math for the map viewport.
 *
 * Everything here is local geometry — no network. The resident figure is a
 * density estimate: city population ÷ city area, applied only to the part of
 * the city's bounding box that sits inside the frame. It is not a census of
 * whoever is standing in the view.
 */

export interface FrameCity {
  bbox: [number, number, number, number] // [west, south, east, north]
  populationMillions: number
  area_km2: number
}

export interface FrameStats {
  west: number
  south: number
  east: number
  north: number
  widthKm: number
  heightKm: number
  areaKm2: number
  metersPerPixel: number
  zoom: number
  bearing: number
  lng: number
  lat: number
  /** Null when the frame misses the city box, or the view is too wide to mean anything. */
  peopleEst: number | null
  overlapKm2: number
  /** True when the frame spans a continent-scale swath — area is only a sketch. */
  wide: boolean
}

const EARTH_R_KM = 6371.0088

function toRad(d: number): number {
  return (d * Math.PI) / 180
}

export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Spherical-rectangle area. Good enough inside a city; labelled approximate when `wide`. */
export function bboxAreaKm2(west: number, south: number, east: number, north: number): { area: number; widthKm: number; heightKm: number } {
  let dLng = east - west
  if (dLng < 0) dLng += 360
  const midLat = (south + north) / 2
  const heightKm = haversineKm(west, south, west, north)
  const widthKm = haversineKm(0, midLat, dLng, midLat)
  return { area: widthKm * heightKm, widthKm, heightKm }
}

function intersectBox(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] | null {
  const west = Math.max(a[0], b[0])
  const south = Math.max(a[1], b[1])
  const east = Math.min(a[2], b[2])
  const north = Math.min(a[3], b[3])
  if (east <= west || north <= south) return null
  return [west, south, east, north]
}

/** Web-Mercator ground sample distance at a latitude and zoom. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos(toRad(lat))) / 2 ** zoom
}

export function frameFromBounds(
  west: number,
  south: number,
  east: number,
  north: number,
  zoom: number,
  bearing: number,
  lng: number,
  lat: number,
  city: FrameCity,
): FrameStats {
  let dLng = east - west
  if (dLng < 0) dLng += 360
  const wide = dLng > 80 || north - south > 50
  const box = bboxAreaKm2(west, south, east, north)

  let peopleEst: number | null = null
  let overlapKm2 = 0
  if (!wide && city.area_km2 > 0 && city.populationMillions > 0) {
    const overlap = intersectBox([west, south, east, north], city.bbox)
    if (overlap) {
      overlapKm2 = bboxAreaKm2(overlap[0], overlap[1], overlap[2], overlap[3]).area
      const density = (city.populationMillions * 1_000_000) / city.area_km2
      const raw = density * overlapKm2
      peopleEst = Math.round(Math.min(city.populationMillions * 1_000_000, raw))
    }
  }

  return {
    west, south, east, north,
    widthKm: box.widthKm,
    heightKm: box.heightKm,
    areaKm2: box.area,
    metersPerPixel: metersPerPixel(lat, zoom),
    zoom, bearing, lng, lat,
    peopleEst,
    overlapKm2,
    wide,
  }
}

/** Wikipedia geosearch radius, capped at the API maximum of 10 km. */
export function wikiRadiusMeters(widthKm: number, heightKm: number): number {
  const halfDiag = Math.hypot(widthKm, heightKm) * 500
  return Math.round(Math.min(10_000, Math.max(300, halfDiag)))
}

export function fmtKm2(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M km²`
  if (n >= 100) return `${Math.round(n).toLocaleString('en-US')} km²`
  if (n >= 10) return `${n.toFixed(1)} km²`
  return `${n.toFixed(2)} km²`
}

export function fmtSpanKm(km: number): string {
  if (!Number.isFinite(km)) return '—'
  if (km >= 100) return `${Math.round(km)}`
  if (km >= 10) return km.toFixed(1)
  return km.toFixed(2)
}

export function fmtPeople(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `~${Math.round(n / 1000)}k`
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k`
  return `~${n}`
}

export function fmtGsd(m: number): string {
  if (!Number.isFinite(m)) return '—'
  if (m < 1) return `${Math.round(m * 100)} cm/px`
  if (m < 10) return `${m.toFixed(1)} m/px`
  if (m < 1000) return `${Math.round(m)} m/px`
  return `${(m / 1000).toFixed(1)} km/px`
}
