/**
 * city-prefetch — kicks off the lite-tier data fetches for a city ahead of
 * time, so when the user actually clicks the tab the panels are already warm.
 *
 * Idempotent: fires the same cached fetchers that the LiteCityPanel will
 * call on mount. The first call warms the cache; subsequent calls within
 * the cached-fetch TTL are free.
 *
 * UNL-fundamental-cant-do bonus: this works for all 5 cities in parallel
 * because every lite source is global. UNL's per-VPM model doesn't even
 * have a concept of "warm the next city."
 */
import type { CityConfig } from '../config/cities'
import { fetchAQI } from '../data/openmeteo-aq'
import { fetchAQIForecast } from '../data/openmeteo-forecast'
import { fetchWeather } from '../data/openmeteo'
import { fetchCityNews } from '../data/gdelt'

const prefetched = new Set<string>()

/** Fire and forget all lite-tier fetches for a city. Safe to call repeatedly. */
export function prefetchCity(city: CityConfig): void {
  if (prefetched.has(city.id)) return
  prefetched.add(city.id)
  const [lng, lat] = city.center
  // Don't await — let the cache fill in the background
  void fetchAQI(lng, lat, city.timezone).catch(() => null)
  void fetchAQIForecast(lng, lat, city.timezone).catch(() => null)
  void fetchWeather(lng, lat, city.timezone).catch(() => null)
  void fetchCityNews(city.gdeltQuery, 6).catch(() => null)
}
