/**
 * Smoke trajectory estimator — uses FIRMS fire hotspots + ECMWF wind
 * to estimate where active fire smoke will be in 12/24/48 hours.
 *
 * Physics:
 *   Smoke transport is dominated by the 850 hPa wind (≈1500 m AGL),
 *   which Open-Meteo provides. A particle released at a fire hotspot
 *   travels downwind at approximately wind speed × 0.6–0.8 (boundary
 *   layer mixing reduces effective transport speed).
 *
 * Simplified model (no dispersion, no removal):
 *   position(t) = fire_origin + wind_vector × t × 0.7
 *
 * Returns: estimated smoke impact zone for a given city at T+hours.
 * "Impact" = smoke centroid within radius_km of the city center.
 *
 * Source: AAQR 2022 "Meteorological Conditions and Fire Hotspots on
 * PM0.1 in Northern Thailand" — confirms 500–700 km smoke transport
 * over 48h from Northern Thailand to Bangkok under NE flow conditions.
 */
import type { CityConfig } from '../config/cities'
import { fetchWeather } from '../data/openmeteo'

export interface SmokeSource {
  lat:        number
  lng:        number
  brightness: number   // FIRMS brightness temp — proxy for fire intensity
  acqDate:    string
  distKm:     number   // distance from target city
}

export interface SmokeForecast {
  city:           CityConfig
  sources:        SmokeSource[]    // active fire hotspots within range
  windSpeedKmh:   number
  windDir:        string           // cardinal
  windDegrees:    number
  impactHours:    number | null    // estimated hours until smoke reaches city
  impactLevel:    'none' | 'low' | 'moderate' | 'high'
  impactNote:     string
}

/** Great-circle distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

/** Wind direction degrees → bearing from source to city */
function isBearingToward(sourceToCity: number, windDeg: number): boolean {
  // Wind blows FROM windDeg direction (i.e. wind coming FROM north = 0° = blowing south)
  // Smoke moves IN the wind direction (downwind)
  // So smoke travels in direction (windDeg + 180) % 360
  const smokeDir = (windDeg + 180) % 360
  const diff = Math.abs(sourceToCity - smokeDir) % 360
  return diff <= 60  // within 60° = "toward the city"
}

/**
 * Estimate smoke trajectory impact on a city given current FIRMS hotspots.
 * Hotspots are passed as GeoJSON features (from the existing firms layer).
 */
export async function estimateSmokeImpact(
  city: CityConfig,
  firmsFeatures: GeoJSON.Feature[],
  maxRangeKm = 700,
): Promise<SmokeForecast> {
  const [cityLng, cityLat] = city.center

  // Get current wind at city location
  const wx = await fetchWeather(cityLng, cityLat, city.timezone).catch(() => null)
  const windSpeedKmh = wx?.windSpeed ?? 0
  const windDegrees  = wx?.windDir   ?? 0
  const windDir      = wx?.windCardinal ?? '—'

  // Find fires within range
  const sources: SmokeSource[] = firmsFeatures
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => {
      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates
      const distKm = haversineKm(cityLat, cityLng, lat, lng)
      return {
        lat,
        lng,
        brightness: Number((f.properties as Record<string, unknown>)?.brightness ?? 300),
        acqDate: String((f.properties as Record<string, unknown>)?.acq_date ?? ''),
        distKm,
      }
    })
    .filter((s) => s.distKm <= maxRangeKm)
    .sort((a, b) => b.brightness - a.brightness)
    .slice(0, 20)

  if (sources.length === 0 || windSpeedKmh < 2) {
    return {
      city, sources, windSpeedKmh, windDir, windDegrees,
      impactHours: null, impactLevel: 'none',
      impactNote: 'No nearby fires detected or wind insufficient for transport.',
    }
  }

  // Find the highest-intensity fire that is upwind of the city
  const upwindFires = sources.filter((s) => {
    // Bearing from fire source to city
    const dLat = cityLat - s.lat
    const dLon = cityLng - s.lng
    const bearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360
    return isBearingToward(bearing, windDegrees)
  })

  const primarySource = upwindFires[0] ?? sources[0]
  const effectiveSpeed = windSpeedKmh * 0.7   // boundary layer transport factor

  const impactHours = effectiveSpeed > 0
    ? Math.round(primarySource.distKm / effectiveSpeed)
    : null

  const intensity = upwindFires.reduce((s, f) => s + (f.brightness - 300), 0)
  const impactLevel: SmokeForecast['impactLevel'] =
    upwindFires.length === 0      ? 'none' :
    intensity < 50 || impactHours && impactHours > 48 ? 'low' :
    intensity < 200               ? 'moderate' : 'high'

  const note = upwindFires.length === 0
    ? `${sources.length} fires within ${maxRangeKm} km but wind carrying smoke away.`
    : impactHours
      ? `${upwindFires.length} upwind fire${upwindFires.length > 1 ? 's' : ''} ` +
        `${Math.round(primarySource.distKm)} km ${windDir}. ` +
        `Smoke est. arrival: ${impactHours < 24 ? impactHours + 'h' : Math.round(impactHours/24) + 'd'} ` +
        `at ${Math.round(effectiveSpeed)} km/h transport.`
      : 'Smoke transport calculation unavailable.'

  return {
    city, sources, windSpeedKmh, windDir, windDegrees,
    impactHours, impactLevel, impactNote: note,
  }
}
