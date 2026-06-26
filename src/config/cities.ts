export interface KpiItem {
  label: string
  value: string
  unit?: string
}

export interface SocioEconomics {
  gdpBillionUsd:        number
  gdpPerCapitaUsd:      number
  birthRatePer1k:       number
  lifeExpectancyYears:  number
  greenSpacePct:        number   // % city area covered by parks/green

  // Extended comparison dimensions
  greenSpaceM2PerPerson?: number  // m² of green space per resident
  giniCoefficient?:       number  // 0–1 wealth inequality (0=equal, 1=extreme)
  trafficCongestionPct?:  number  // TomTom index: % longer than free-flow
  walkabilityScore?:      number  // 0–100 (Walk Score methodology)
  urbanPlanningYear?:     number  // year of major urban plan (e.g. 1960 for Brasilia)
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
  populationMillions: number                            // metro / city-region population
  founded?: string                                      // year, era, or "ancient"
  climate: string                                       // e.g. "Tropical monsoon", "Tropical rainforest"
  distinctiveness: string                               // 1-line "what's special about this city"

  demographics?: SocioEconomics
}

/** Basemap variant IDs. Defined here for type sharing with MapView. */
export type BasemapId =
  | 'dark-vector'           // Mapbox composite — requires token
  | 'mapbox-sat-streets'    // Mapbox satellite-streets-v12 — requires token
  | 'esri-imagery'          // ESRI World Imagery — no token
  | 'sentinel-cloudless'    // EOX Sentinel-2 cloudless — no token
  | 'nasa-true-color'       // NASA GIBS MODIS Terra true color — no token, daily
  | 'nasa-aerosol'          // NASA GIBS aerosol optical depth — no token, daily
  | 'nasa-co'               // NASA GIBS AIRS carbon monoxide — no token, daily
  | 'nasa-so2'              // NASA GIBS OMPS sulphur dioxide — no token, daily
  | 'nasa-ndvi'             // NASA GIBS MODIS NDVI vegetation — no token, 8-day
  | 'nasa-surface-temp'     // NASA GIBS MODIS land surface temp — no token, monthly
  | 'nasa-nightlights'      // NASA GIBS VIIRS Black Marble — no token, annual

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
    populationMillions: 10.5,
    founded: '1782',
    climate: 'Tropical savanna · monsoon-driven',
    distinctiveness: 'Thailand\'s capital and largest city. Founded by Rama I after Ayutthaya\'s fall. Sits on the Chao Phraya delta — flat, river-veined, sinking ~2cm per year.',
    kpis: [
      { label: 'POPULATION', value: '10.5', unit: 'M' },
      { label: 'SMART SCORE', value: '71.2' },
      { label: 'IOC STATUS', value: 'ACTIVE' },
    ],
    demographics: {
      gdpBillionUsd: 175,
      gdpPerCapitaUsd: 16000,
      birthRatePer1k: 9.0,
      lifeExpectancyYears: 77,
      greenSpacePct: 6.0,
      greenSpaceM2PerPerson: 4.2,
      giniCoefficient: 0.45,
      trafficCongestionPct: 47,
      walkabilityScore: 52,
    }
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
    populationMillions: 1.7,
    founded: '1296',
    climate: 'Tropical savanna · burning season Jan–Apr',
    distinctiveness: 'Northern Thailand\'s cultural capital. Lanna kingdom seat from 1296. Sits in a valley bowl that traps haze from agricultural burning every February–April.',
    kpis: [
      { label: 'POPULATION', value: '1.7', unit: 'M' },
      { label: 'BURNING RISK', value: 'HIGH' },
      { label: 'SMART SCORE', value: '64.5' },
    ],
    demographics: {
      gdpBillionUsd: 8,
      gdpPerCapitaUsd: 6000,
      birthRatePer1k: 10.0,
      lifeExpectancyYears: 75,
      greenSpacePct: 15.0,
      greenSpaceM2PerPerson: 18,
      giniCoefficient: 0.40,
      trafficCongestionPct: 22,
      walkabilityScore: 38,
    }
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
    populationMillions: 0.42,
    founded: 'Tin-mining colony, 1700s',
    climate: 'Tropical rainforest · two monsoons',
    distinctiveness: 'Thailand\'s largest island and busiest tourist economy — 9.9M international visitors a year for a permanent population of 416K. Tin-mining past, Sino-Portuguese old town.',
    kpis: [
      { label: 'POPULATION', value: '416K' },
      { label: 'TOURISM/YR', value: '9.9', unit: 'M' },
      { label: 'SMART SCORE', value: '68.4' },
    ],
    demographics: {
      gdpBillionUsd: 4,
      gdpPerCapitaUsd: 9000,
      birthRatePer1k: 11.0,
      lifeExpectancyYears: 76,
      greenSpacePct: 25.0,
      greenSpaceM2PerPerson: 32,
      giniCoefficient: 0.40,
      trafficCongestionPct: 15,
      walkabilityScore: 42,
    }
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
    populationMillions: 5.9,
    founded: '1819',
    climate: 'Tropical rainforest · equatorial',
    distinctiveness: 'Southeast Asia\'s reference city for smart-city ambition. 1m residents on reclaimed land. data.gov.sg publishes more public datasets than any other ASEAN city.',
    kpis: [
      { label: 'POPULATION', value: '5.9', unit: 'M' },
      { label: 'SMART SCORE', value: '91.4' },
      { label: 'IOC STATUS', value: 'LIVE' },
    ],
    demographics: {
      gdpBillionUsd: 466,
      gdpPerCapitaUsd: 82800,
      birthRatePer1k: 8.5,
      lifeExpectancyYears: 83,
      greenSpacePct: 46.0,
      greenSpaceM2PerPerson: 66,
      giniCoefficient: 0.45,
      trafficCongestionPct: 37,
      walkabilityScore: 55,
    }
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
    populationMillions: 0.75,
    founded: '1827',
    climate: 'Tropical rainforest · equatorial',
    distinctiveness: 'Sarawak\'s capital, on the south bank of the Sarawak River. Cat-named in Malay. Multicultural by design — Iban, Bidayuh, Malay, Chinese, Indian — and the only Malaysian city where Mandarin signage rivals Malay.',
    kpis: [
      { label: 'POPULATION', value: '750K' },
      { label: 'IOC STATUS', value: 'LIVE' },
      { label: 'SMART SCORE', value: '63.1' },
    ],
    demographics: {
      gdpBillionUsd: 5,
      gdpPerCapitaUsd: 7000,
      birthRatePer1k: 14.0,
      lifeExpectancyYears: 75,
      greenSpacePct: 35.0,
      greenSpaceM2PerPerson: 850,
      giniCoefficient: 0.38,
      trafficCongestionPct: 8,
      walkabilityScore: 30,
    }
  },

  // ── Global expansion cities ─────────────────────────────────────────────
  {
    id: 'barcelona',
    name: 'Barcelona',
    nameLocal: 'Barcelona',
    country: 'ES',
    center: [2.1734, 41.3851],
    zoom: 12,
    bbox: [-2.5, 41.0, 2.5, 41.8],
    timezone: 'Europe/Madrid',
    hudClockLabel: 'BCN',
    countryName: 'Spain',
    gdeltQuery: 'barcelona spain',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 101,
    populationMillions: 1.62,
    founded: '15 BC',
    climate: 'Mediterranean · dry summers, mild winters',
    distinctiveness: 'The densest livable city in Europe. Cerda\'s revolutionary Eixample grid. Superilles urban innovation. Gaudí. 4.8M metro but only 6.5 m²/person green space — the urban paradox.',
    kpis: [
      { label: 'POPULATION', value: '1.62', unit: 'M' },
      { label: 'WALKABILITY', value: '98', unit: '/100' },
      { label: 'GREEN', value: '6.5', unit: 'm²/p' },
    ],
    demographics: {
      gdpBillionUsd: 75,
      gdpPerCapitaUsd: 46_000,
      birthRatePer1k: 9.1,
      lifeExpectancyYears: 83.5,
      greenSpacePct: 6.5,
      greenSpaceM2PerPerson: 6.5,
      giniCoefficient: 0.31,
      trafficCongestionPct: 21,
      walkabilityScore: 98,
      urbanPlanningYear: 1859,
    }
  },
  {
    id: 'canberra',
    name: 'Canberra',
    country: 'AU',
    center: [149.1300, -35.2809],
    zoom: 11,
    bbox: [148.5, -35.8, 149.8, -34.8],
    timezone: 'Australia/Sydney',
    hudClockLabel: 'CBR',
    countryName: 'Australia',
    gdeltQuery: 'canberra australia',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 814,
    populationMillions: 0.46,
    founded: '1913',
    climate: 'Oceanic · four seasons, cold winters, dry summers',
    distinctiveness: 'World\'s most deliberate capital — designed by Walter Burley Griffin. 58% open space. Lowest congestion of any world capital. What happens when a city is planned from scratch and funded properly.',
    kpis: [
      { label: 'POPULATION', value: '460K' },
      { label: 'GREEN', value: '2,000', unit: 'm²/p' },
      { label: 'CONGESTION', value: '8', unit: '%' },
    ],
    demographics: {
      gdpBillionUsd: 25,
      gdpPerCapitaUsd: 55_000,
      birthRatePer1k: 12.0,
      lifeExpectancyYears: 83.0,
      greenSpacePct: 58.0,
      greenSpaceM2PerPerson: 2_000,
      giniCoefficient: 0.33,
      trafficCongestionPct: 8,
      walkabilityScore: 43,
      urbanPlanningYear: 1912,
    }
  },
  {
    id: 'brasilia',
    name: 'Brasília',
    nameLocal: 'Brasília',
    country: 'BR',
    center: [-47.9292, -15.7801],
    zoom: 11,
    bbox: [-48.5, -16.5, -47.0, -14.5],
    timezone: 'America/Sao_Paulo',
    hudClockLabel: 'BSB',
    countryName: 'Brazil',
    gdeltQuery: 'brasilia brazil federal district',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 5760,
    populationMillions: 3.1,
    founded: '1960',
    climate: 'Tropical savanna · dry season May–Sep, wet season Oct–Apr',
    distinctiveness: 'UNESCO World Heritage modernist masterplan — with the highest Gini of Brazil\'s major cities (0.60). Designed for cars, built for inequality. The most beautiful city that failed its social brief.',
    kpis: [
      { label: 'POPULATION', value: '3.1', unit: 'M' },
      { label: 'GINI', value: '0.60' },
      { label: 'UNESCO', value: 'WH 1987' },
    ],
    demographics: {
      gdpBillionUsd: 77,
      gdpPerCapitaUsd: 25_000,
      birthRatePer1k: 12.0,
      lifeExpectancyYears: 76.0,
      greenSpacePct: 30.0,
      greenSpaceM2PerPerson: 30,
      giniCoefficient: 0.60,
      trafficCongestionPct: 28,
      walkabilityScore: 28,
      urbanPlanningYear: 1960,
    }
  },
  {
    id: 'yala',
    name: 'Yala',
    nameLocal: 'ยะลา',
    country: 'TH',
    center: [101.2847, 6.5359],
    zoom: 12,
    bbox: [100.8, 6.2, 101.7, 6.9],
    timezone: 'Asia/Bangkok',
    hudClockLabel: 'YAL',
    countryName: 'Thailand',
    gdeltQuery: 'yala thailand deep south',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 23,
    populationMillions: 0.07,
    founded: 'Ancient — Malay sultanate era',
    climate: 'Tropical rainforest · equatorial, high rainfall year-round',
    distinctiveness: 'Thailand\'s southernmost major city, 30 km from Malaysia. Predominantly Muslim Malay culture in a Buddhist-majority nation. Ongoing low-level conflict since 2004. A city that occupies two worlds.',
    kpis: [
      { label: 'POPULATION', value: '70K' },
      { label: 'TO MALAYSIA', value: '30 km' },
      { label: 'REGION', value: 'DEEP SOUTH' },
    ],
    demographics: {
      gdpBillionUsd: 2,
      gdpPerCapitaUsd: 3_500,
      birthRatePer1k: 16.0,
      lifeExpectancyYears: 74.0,
      greenSpacePct: 15.0,
      greenSpaceM2PerPerson: 15,
      giniCoefficient: 0.42,
      trafficCongestionPct: 12,
      walkabilityScore: 35,
    }
  },

  // ── Eastern Europe ──────────────────────────────────────────────────────
  // Lite tier — global sources only (Open-Meteo weather + AQ, GDELT, NASA GIBS).
  // Demographics seeded from public figures (Eurostat, TomTom Traffic Index,
  // World Bank, city green-space audits) so cross-city comparison is real, not faked.
  {
    id: 'warsaw',
    name: 'Warsaw',
    nameLocal: 'Warszawa',
    country: 'PL',
    center: [21.0122, 52.2297],
    zoom: 11,
    bbox: [20.85, 52.10, 21.27, 52.37],
    timezone: 'Europe/Warsaw',
    hudClockLabel: 'WAW',
    countryName: 'Poland',
    gdeltQuery: 'warsaw poland',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 517,
    populationMillions: 1.86,
    founded: 'c. 1300 · capital 1596',
    climate: 'Humid continental · cold winters',
    distinctiveness: 'Poland\'s capital — 85% destroyed in WWII and rebuilt from rubble; the Old Town is a UNESCO-listed reconstruction. Now the fastest-growing major financial hub east of Frankfurt.',
    kpis: [
      { label: 'POPULATION', value: '1.86', unit: 'M' },
      { label: 'GREEN SPACE', value: '40%' },
      { label: 'REGION', value: 'CENTRAL EU' },
    ],
    demographics: {
      gdpBillionUsd: 160,
      gdpPerCapitaUsd: 45_000,
      birthRatePer1k: 9.2,
      lifeExpectancyYears: 78,
      greenSpacePct: 40.0,
      greenSpaceM2PerPerson: 78,
      giniCoefficient: 0.30,
      trafficCongestionPct: 38,
      walkabilityScore: 65,
    }
  },
  {
    id: 'prague',
    name: 'Prague',
    nameLocal: 'Praha',
    country: 'CZ',
    center: [14.4378, 50.0755],
    zoom: 11,
    bbox: [14.25, 49.94, 14.71, 50.18],
    timezone: 'Europe/Prague',
    hudClockLabel: 'PRG',
    countryName: 'Czech Republic',
    gdeltQuery: 'prague czech republic',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 496,
    populationMillions: 1.36,
    founded: 'c. 880 · Prague Castle',
    climate: 'Oceanic / humid continental transition',
    distinctiveness: 'The "City of a Hundred Spires." One of the few major European capitals to survive WWII almost intact — a thousand years of Gothic, Baroque and Art Nouveau on the Vltava.',
    kpis: [
      { label: 'POPULATION', value: '1.36', unit: 'M' },
      { label: 'GREEN SPACE', value: '30%' },
      { label: 'REGION', value: 'CENTRAL EU' },
    ],
    demographics: {
      gdpBillionUsd: 95,
      gdpPerCapitaUsd: 53_000,
      birthRatePer1k: 9.5,
      lifeExpectancyYears: 80,
      greenSpacePct: 30.0,
      greenSpaceM2PerPerson: 100,
      giniCoefficient: 0.25,
      trafficCongestionPct: 34,
      walkabilityScore: 70,
    }
  },
  {
    id: 'budapest',
    name: 'Budapest',
    nameLocal: 'Budapest',
    country: 'HU',
    center: [19.0402, 47.4979],
    zoom: 11,
    bbox: [18.92, 47.35, 19.33, 47.61],
    timezone: 'Europe/Budapest',
    hudClockLabel: 'BUD',
    countryName: 'Hungary',
    gdeltQuery: 'budapest hungary',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 525,
    populationMillions: 1.75,
    founded: '1873 · Roman Aquincum',
    climate: 'Humid continental · hot summers',
    distinctiveness: 'Two cities — hilly Buda and flat Pest — joined across the Danube in 1873. Sits on a fault line of 120+ thermal springs; the only capital that is also a certified spa town.',
    kpis: [
      { label: 'POPULATION', value: '1.75', unit: 'M' },
      { label: 'GREEN SPACE', value: '27%' },
      { label: 'REGION', value: 'CENTRAL EU' },
    ],
    demographics: {
      gdpBillionUsd: 90,
      gdpPerCapitaUsd: 38_000,
      birthRatePer1k: 9.0,
      lifeExpectancyYears: 77,
      greenSpacePct: 27.0,
      greenSpaceM2PerPerson: 70,
      giniCoefficient: 0.30,
      trafficCongestionPct: 38,
      walkabilityScore: 68,
    }
  },
  {
    id: 'bucharest',
    name: 'Bucharest',
    nameLocal: 'București',
    country: 'RO',
    center: [26.1025, 44.4268],
    zoom: 11,
    bbox: [25.97, 44.33, 26.24, 44.54],
    timezone: 'Europe/Bucharest',
    hudClockLabel: 'BUH',
    countryName: 'Romania',
    gdeltQuery: 'bucharest romania',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 240,
    populationMillions: 1.72,
    founded: '1459 · first attested',
    climate: 'Humid continental · continental extremes',
    distinctiveness: 'Romania\'s capital, once "Little Paris of the East." Home to the Palace of the Parliament — the heaviest building on Earth. Among the EU\'s most traffic-congested capitals.',
    kpis: [
      { label: 'POPULATION', value: '1.72', unit: 'M' },
      { label: 'GREEN SPACE', value: '23%' },
      { label: 'REGION', value: 'SE EUROPE' },
    ],
    demographics: {
      gdpBillionUsd: 70,
      gdpPerCapitaUsd: 35_000,
      birthRatePer1k: 9.0,
      lifeExpectancyYears: 75,
      greenSpacePct: 23.0,
      greenSpaceM2PerPerson: 24,
      giniCoefficient: 0.35,
      trafficCongestionPct: 48,
      walkabilityScore: 60,
    }
  },
  {
    id: 'tallinn',
    name: 'Tallinn',
    nameLocal: 'Tallinn',
    country: 'EE',
    center: [24.7536, 59.4370],
    zoom: 11,
    bbox: [24.55, 59.35, 24.95, 59.50],
    timezone: 'Europe/Tallinn',
    hudClockLabel: 'TLL',
    countryName: 'Estonia',
    gdeltQuery: 'tallinn estonia',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 159,
    populationMillions: 0.46,
    founded: '1248 · Lübeck rights',
    climate: 'Humid continental · Baltic maritime',
    distinctiveness: 'The world\'s most digital capital — 99% of public services online, e-residency invented here, government run on a blockchain backbone. A medieval Hanseatic Old Town wired to the cloud. European Green Capital 2023.',
    kpis: [
      { label: 'POPULATION', value: '0.46', unit: 'M' },
      { label: 'E-GOV', value: '99%' },
      { label: 'REGION', value: 'BALTIC' },
    ],
    demographics: {
      gdpBillionUsd: 25,
      gdpPerCapitaUsd: 35_000,
      birthRatePer1k: 10.0,
      lifeExpectancyYears: 78,
      greenSpacePct: 20.0,
      greenSpaceM2PerPerson: 110,
      giniCoefficient: 0.31,
      trafficCongestionPct: 25,
      walkabilityScore: 66,
    }
  },
  {
    id: 'vilnius',
    name: 'Vilnius',
    nameLocal: 'Vilnius',
    country: 'LT',
    center: [25.2797, 54.6872],
    zoom: 11,
    bbox: [25.10, 54.58, 25.46, 54.78],
    timezone: 'Europe/Vilnius',
    hudClockLabel: 'VNO',
    countryName: 'Lithuania',
    gdeltQuery: 'vilnius lithuania',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 401,
    populationMillions: 0.60,
    founded: '1323 · first mentioned',
    climate: 'Humid continental · Baltic',
    distinctiveness: 'Lithuania\'s baroque capital with one of Europe\'s largest surviving medieval old towns. Half the city is green space; a fast-rising fintech and laser-optics hub.',
    kpis: [
      { label: 'POPULATION', value: '0.60', unit: 'M' },
      { label: 'GREEN SPACE', value: '50%' },
      { label: 'REGION', value: 'BALTIC' },
    ],
    demographics: {
      gdpBillionUsd: 22,
      gdpPerCapitaUsd: 33_000,
      birthRatePer1k: 10.0,
      lifeExpectancyYears: 76,
      greenSpacePct: 50.0,
      greenSpaceM2PerPerson: 120,
      giniCoefficient: 0.35,
      trafficCongestionPct: 28,
      walkabilityScore: 64,
    }
  },
  {
    id: 'riga',
    name: 'Riga',
    nameLocal: 'Rīga',
    country: 'LV',
    center: [24.1052, 56.9496],
    zoom: 11,
    bbox: [23.95, 56.85, 24.33, 57.06],
    timezone: 'Europe/Riga',
    hudClockLabel: 'RIX',
    countryName: 'Latvia',
    gdeltQuery: 'riga latvia',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 304,
    populationMillions: 0.61,
    founded: '1201 · Bishop Albert',
    climate: 'Humid continental · Baltic maritime',
    distinctiveness: 'The Baltic\'s largest city and the world capital of Art Nouveau — 800+ Jugendstil facades, a UNESCO density found nowhere else. A Hanseatic port at the mouth of the Daugava.',
    kpis: [
      { label: 'POPULATION', value: '0.61', unit: 'M' },
      { label: 'GREEN SPACE', value: '30%' },
      { label: 'REGION', value: 'BALTIC' },
    ],
    demographics: {
      gdpBillionUsd: 22,
      gdpPerCapitaUsd: 30_000,
      birthRatePer1k: 9.0,
      lifeExpectancyYears: 75,
      greenSpacePct: 30.0,
      greenSpaceM2PerPerson: 60,
      giniCoefficient: 0.35,
      trafficCongestionPct: 30,
      walkabilityScore: 62,
    }
  },
  {
    id: 'sofia',
    name: 'Sofia',
    nameLocal: 'София',
    country: 'BG',
    center: [23.3219, 42.6977],
    zoom: 11,
    bbox: [23.18, 42.60, 23.46, 42.78],
    timezone: 'Europe/Sofia',
    hudClockLabel: 'SOF',
    countryName: 'Bulgaria',
    gdeltQuery: 'sofia bulgaria',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 492,
    populationMillions: 1.28,
    founded: 'Ancient · Serdica, 8th c. BC',
    climate: 'Humid continental · mountain-shadowed',
    distinctiveness: 'One of Europe\'s oldest capitals — Thracian Serdica, lived-in for 7,000 years. Sits at 550 m below Mount Vitosha. A rising EU IT and outsourcing centre with the bloc\'s lowest costs.',
    kpis: [
      { label: 'POPULATION', value: '1.28', unit: 'M' },
      { label: 'ELEVATION', value: '550 m' },
      { label: 'REGION', value: 'SE EUROPE' },
    ],
    demographics: {
      gdpBillionUsd: 35,
      gdpPerCapitaUsd: 30_000,
      birthRatePer1k: 9.0,
      lifeExpectancyYears: 74,
      greenSpacePct: 22.0,
      greenSpaceM2PerPerson: 30,
      giniCoefficient: 0.40,
      trafficCongestionPct: 38,
      walkabilityScore: 60,
    }
  },
  {
    id: 'belgrade',
    name: 'Belgrade',
    nameLocal: 'Београд',
    country: 'RS',
    center: [20.4489, 44.7866],
    zoom: 11,
    bbox: [20.30, 44.68, 20.61, 44.89],
    timezone: 'Europe/Belgrade',
    hudClockLabel: 'BEG',
    countryName: 'Serbia',
    gdeltQuery: 'belgrade serbia',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 360,
    populationMillions: 1.40,
    founded: 'Ancient · Singidunum, 3rd c. BC',
    climate: 'Humid subtropical / continental',
    distinctiveness: 'Where the Sava meets the Danube — fought over in 115 wars, razed 44 times, always rebuilt. The Balkans\' largest nightlife capital, lived on splavovi river barges.',
    kpis: [
      { label: 'POPULATION', value: '1.40', unit: 'M' },
      { label: 'RIVERS', value: '2' },
      { label: 'REGION', value: 'BALKANS' },
    ],
    demographics: {
      gdpBillionUsd: 35,
      gdpPerCapitaUsd: 22_000,
      birthRatePer1k: 9.0,
      lifeExpectancyYears: 75,
      greenSpacePct: 20.0,
      greenSpaceM2PerPerson: 25,
      giniCoefficient: 0.35,
      trafficCongestionPct: 40,
      walkabilityScore: 58,
    }
  },
  {
    id: 'ljubljana',
    name: 'Ljubljana',
    nameLocal: 'Ljubljana',
    country: 'SI',
    center: [14.5058, 46.0569],
    zoom: 11,
    bbox: [14.40, 45.98, 14.62, 46.13],
    timezone: 'Europe/Ljubljana',
    hudClockLabel: 'LJU',
    countryName: 'Slovenia',
    gdeltQuery: 'ljubljana slovenia',
    tier: 'lite',
    availableLayers: LITE_LAYERS,
    area_km2: 164,
    populationMillions: 0.29,
    founded: 'Roman Emona · 14 AD',
    climate: 'Oceanic / humid continental · alpine-influenced',
    distinctiveness: 'European Green Capital 2016. A car-free medieval centre on the Ljubljanica, shaped by architect Jože Plečnik. One of the greenest, smallest and most walkable EU capitals.',
    kpis: [
      { label: 'POPULATION', value: '0.29', unit: 'M' },
      { label: 'GREEN SPACE', value: '75%' },
      { label: 'REGION', value: 'CENTRAL EU' },
    ],
    demographics: {
      gdpBillionUsd: 25,
      gdpPerCapitaUsd: 42_000,
      birthRatePer1k: 9.0,
      lifeExpectancyYears: 81,
      greenSpacePct: 75.0,
      greenSpaceM2PerPerson: 542,
      giniCoefficient: 0.24,
      trafficCongestionPct: 28,
      walkabilityScore: 72,
    }
  },
]

// ── Region grouping for city pickers ──────────────────────────────────────────
// Thailand is split out of ASEAN (it's the home region); everything else maps by
// country code. Used to render <optgroup>s so the city dropdown stays scannable.
export const REGION_ORDER = [
  'Thailand', 'ASEAN', 'Eastern Europe', 'Western Europe', 'Asia-Pacific', 'Americas', 'Other',
] as const

const COUNTRY_REGION: Record<string, (typeof REGION_ORDER)[number]> = {
  TH: 'Thailand',
  SG: 'ASEAN', MY: 'ASEAN', ID: 'ASEAN', PH: 'ASEAN', VN: 'ASEAN', KH: 'ASEAN', LA: 'ASEAN', MM: 'ASEAN', BN: 'ASEAN',
  PL: 'Eastern Europe', CZ: 'Eastern Europe', HU: 'Eastern Europe', RO: 'Eastern Europe', EE: 'Eastern Europe',
  LT: 'Eastern Europe', LV: 'Eastern Europe', BG: 'Eastern Europe', RS: 'Eastern Europe', SI: 'Eastern Europe',
  SK: 'Eastern Europe', HR: 'Eastern Europe', UA: 'Eastern Europe',
  ES: 'Western Europe', FR: 'Western Europe', DE: 'Western Europe', IT: 'Western Europe', PT: 'Western Europe',
  NL: 'Western Europe', BE: 'Western Europe', GB: 'Western Europe', IE: 'Western Europe', AT: 'Western Europe', CH: 'Western Europe',
  AU: 'Asia-Pacific', NZ: 'Asia-Pacific', JP: 'Asia-Pacific', KR: 'Asia-Pacific', CN: 'Asia-Pacific',
  IN: 'Asia-Pacific', TW: 'Asia-Pacific', HK: 'Asia-Pacific',
  BR: 'Americas', US: 'Americas', CA: 'Americas', MX: 'Americas', AR: 'Americas', CL: 'Americas',
}

export function cityRegion(city: CityConfig): (typeof REGION_ORDER)[number] {
  return COUNTRY_REGION[city.country] ?? 'Other'
}

/** Group cities by region in REGION_ORDER; empty regions are dropped. */
export function groupCitiesByRegion(cities: CityConfig[]): Array<{ region: string; cities: CityConfig[] }> {
  const byRegion = new Map<string, CityConfig[]>()
  for (const c of cities) {
    const r = cityRegion(c)
    const bucket = byRegion.get(r) ?? []
    bucket.push(c)
    byRegion.set(r, bucket)
  }
  return REGION_ORDER
    .filter((r) => byRegion.has(r))
    .map((r) => ({ region: r, cities: byRegion.get(r)! }))
}
