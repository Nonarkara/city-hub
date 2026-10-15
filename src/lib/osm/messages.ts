/** User-facing copy for a failed city search. No upstream hostnames. */
export const CITY_SEARCH_UNAVAILABLE =
  'City search is temporarily unavailable. Try again in a moment.'

/**
 * User-facing copy for a failed Lynch city-image fetch.
 *
 * Distinct from CITY_SEARCH_UNAVAILABLE on purpose: the city is known, we are
 * reading its structure. Saying "search is unavailable" would send the user
 * looking for a typo in a city name that is spelled correctly.
 */
export const CITY_IMAGE_UNAVAILABLE =
  'The map’s own record of this city is temporarily unavailable. Compare the satellite view instead.'
