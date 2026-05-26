export interface KpiItem {
  label: string
  value: string
  unit?: string
}

/**
 * CityConfig — the per-city manifest. One row per city in CITIES below.
 * `tier: 'full'` means the city has dedicated APIs (Bangkok). `tier: 'lite'`
 * means the city relies on global sources only (Open-Meteo, WAQI, OpenAQ,
 * NASA FIRMS, GDELT, satellite layers).
 */
export interface CityConfig {
  id: string
  name: string
  nameLocal?: string
  country: string
  center: [number, number]                              // [lng, lat]
  zoom: number
  kpis: KpiItem[]

  // Manifest fields used by data fetchers, HUD, GDELT, basemap defaults
  bbox: [number, number, number, number]                // [west, south, east, north]
  timezone: string                                      // IANA TZ
  hudClockLabel: string                                 // 3-letter code for HUD ribbon
  countryName: string                                   // display name (for narration)
  gdeltQuery: string                                    // GDELT search query
  tier: 'full' | 'lite'
  availableLayers: string[]                             // layer IDs available for this city
  basemapDefault?: BasemapId                            // optional per-city default basemap

  // City onboarding — these fields power the CityFactsCard that introduces
  // a newcomer to the city in ~30 seconds. Static, curated facts.
  area_km2: number
  founded?: string                                      // year, era, or "ancient"
  climate: string                                       // e.g. "Tropical monsoon", "Tropical rainforest"
  distinctiveness: string                               // 1-line "what's special about this city"
}

/** Basemap variant IDs. Defined here for type sharing with MapView. */
export type BasemapId =
  | 'dark-vector'           // Mapbox composite — requires token
  | 'mapbox-sat-streets'    // Mapbox satellite-streets-v12 — requires token
  | 'esri-imagery'          // ESRI World Imagery — no token
  | 'sentinel-cloudless'    // EOX Sentinel-2 cloudless — no token
  | 'nasa-true-color'       // NASA GIBS MODIS Terra — no token

// Layer IDs that lite-tier cities know how to load. Subset of BANGKOK_LAYERS.
// Lite cities pull only from sources that are global (WAQI, OpenAQ, NASA, GIBS,
// OpenWeatherMap, GDELT, AlphaEarth) — no Thai-only endpoints.
const LITE_LAYERS = [
  'pm25-waqi',
  'pm25-openaq',
  'fires-firms',
  'aerosol-gibs',
  'weather-owm',
  'sat-true-color',
  'sat-night-lights',
  'sat-esri',
  'sat-sentinel2',
  'sat-ndvi',
]

export const CITIES: CityConfig[] = [
  {
    id: 'bangkok',
    name: 'Bangkok',
    nameLocal: 'กรุงเทพฯ',
    country: 'TH',
    center: [100.5018, 13.7563],
    zoom: 11,
    bbox: [100.30, 13.50, 100.95, 14.00],
    timezone: 'Asia/Bangkok',
    hudClockLabel: 'BKK',
    countryName: 'Thailand',
    gdeltQuery: 'bangkok thailand',
    tier: 'full',
    availableLayers: ['pm25-stations', 'pm25-heatmap', 'aqi-live', 'air4thai-stations', 'waqi-stations', 'openaq-stations', 'fires-gistda', 'fires-firms', 'floods-historical', 'floods', 'districts', 'owm-weather', 'rail', 'gtfs-transit-live', 'gibs-aod', 'sat-true-color', 'sat-night-lights', 'sat-surface-temp', 'sat-ndvi', 'sat-esri', 'sat-sentinel2', 'alphaearth-embeddings', 'sat-s5p-no2', 'sat-s5p-co', 'sat-s5p-so2', 'sat-ghsl-pop', 'longdo-basemap', 'traffy-issues', 'traffy-heatmap', 'buildings-3d', 'osm-emergency', 'osm-education', 'water-quality', 'water-level', 'earthquake-tmd', 'tomtom-traffic', 'tomtom-incidents', 'airbnb-density', 'historical-events'],
    area_km2: 1568,
    founded: '1782',
    climate: 'Tropical savanna · monsoon-driven',
    distinctiveness: 'Thailand\'s capital and largest city. Founded by Rama I after Ayutthaya\'s fall. Sits on the Chao Phraya delta — flat, river-veined, sinking ~2cm per year.',
    kpis: [
      { label: 'POPULATION', value: '10.5', unit: 'M' },
      { label: 'SMART SCORE', value: '71.2' },
      { label: 'IOC STATUS', value: 'ACTIVE' },
    ],
  },
  {
    id: 'chiang-mai',
    name: 'Chiang Mai',
    nameLocal: 'เชียงใหม่',
    country: 'TH',
    center: [98.9853, 18.7883],
    zoom: 11,
    bbox: [98.85, 18.65, 99.15, 18.95],
    timezone: 'Asia/Bangkok',
    hudClockLabel: 'CNX',
    countryName: 'Thailand',
    gdeltQuery: 'chiang mai thailand',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 152,
    founded: '1296',
    climate: 'Tropical savanna · burning season Jan–Apr',
    distinctiveness: 'Northern Thailand\'s cultural capital. Lanna kingdom seat from 1296. Sits in a valley bowl that traps haze from agricultural burning every February–April.',
    kpis: [
      { label: 'POPULATION', value: '1.7', unit: 'M' },
      { label: 'BURNING RISK', value: 'HIGH' },
      { label: 'SMART SCORE', value: '64.5' },
    ],
  },
  {
    id: 'phuket',
    name: 'Phuket',
    nameLocal: 'ภูเก็ต',
    country: 'TH',
    center: [98.3923, 7.8804],
    zoom: 11,
    bbox: [98.20, 7.65, 98.55, 8.20],
    timezone: 'Asia/Bangkok',
    hudClockLabel: 'HKT',
    countryName: 'Thailand',
    gdeltQuery: 'phuket thailand',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 543,
    founded: 'Tin-mining colony, 1700s',
    climate: 'Tropical rainforest · two monsoons',
    distinctiveness: 'Thailand\'s largest island and busiest tourist economy — 9.9M international visitors a year for a permanent population of 416K. Tin-mining past, Sino-Portuguese old town.',
    kpis: [
      { label: 'POPULATION', value: '416K' },
      { label: 'TOURISM/YR', value: '9.9', unit: 'M' },
      { label: 'SMART SCORE', value: '68.4' },
    ],
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'SG',
    center: [103.8198, 1.3521],
    zoom: 11,
    bbox: [103.60, 1.20, 104.05, 1.48],
    timezone: 'Asia/Singapore',
    hudClockLabel: 'SIN',
    countryName: 'Singapore',
    gdeltQuery: 'singapore',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 728,
    founded: '1819',
    climate: 'Tropical rainforest · equatorial',
    distinctiveness: 'Southeast Asia\'s reference city for smart-city ambition. 1m residents on reclaimed land. data.gov.sg publishes more public datasets than any other ASEAN city.',
    kpis: [
      { label: 'POPULATION', value: '5.9', unit: 'M' },
      { label: 'SMART SCORE', value: '91.4' },
      { label: 'IOC STATUS', value: 'LIVE' },
    ],
  },
  {
    id: 'kuching',
    name: 'Kuching',
    country: 'MY',
    center: [110.3592, 1.5497],
    zoom: 11,
    bbox: [110.15, 1.40, 110.60, 1.70],
    timezone: 'Asia/Kuching',
    hudClockLabel: 'KCH',
    countryName: 'Malaysia',
    gdeltQuery: 'kuching malaysia',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 431,
    founded: '1827',
    climate: 'Tropical rainforest · equatorial',
    distinctiveness: 'Sarawak\'s capital, on the south bank of the Sarawak River. Cat-named in Malay. Multicultural by design — Iban, Bidayuh, Malay, Chinese, Indian — and the only Malaysian city where Mandarin signage rivals Malay.',
    kpis: [
      { label: 'POPULATION', value: '750K' },
      { label: 'IOC STATUS', value: 'LIVE' },
      { label: 'SMART SCORE', value: '63.1' },
    ],
  },
]
