/**
 * Bangkok layer catalog — the single source of truth for the toggle rail.
 * Each layer is loaded lazily on first activation and toggled via visibility.
 */
export type SourceKey = 'GISTDA' | 'NASA' | 'BMA' | 'data.go.th' | 'JAXA' | 'Traffy' | 'Open-Meteo' | 'WAQI' | 'TMD' | 'Longdo' | 'PCD' | 'OSM' | 'Thaiwater' | 'TomTom' | 'InsideAirbnb' | 'OpenAQ' | 'OpenWeatherMap' | 'GTFS' | 'Historical' | 'data.gov.sg' | 'LTA-SG' | 'NEA-SG' | 'DOSM' | 'CMUCCDC' | 'DEQP-TH'

export interface LayerSpec {
  id: string
  label: string                  // Short uppercase label for the rail
  description: string            // Tooltip / detail
  source: SourceKey
  defaultOn: boolean
  status: 'live' | 'pending'     // pending = disabled tile, no fetch
  category: 'air' | 'fire' | 'water' | 'admin' | 'transit' | 'satellite' | 'civic'
}

export const BANGKOK_LAYERS: LayerSpec[] = [
  { id: 'pm25-stations',   label: 'PM2.5 STATIONS',  description: 'PCD air-quality monitoring stations. GISTDA hourly endpoint is intermittently empty — KPI panel uses a separate live by-location feed that always works.', source: 'GISTDA', defaultOn: true,  status: 'live',    category: 'air' },
  { id: 'pm25-heatmap',    label: 'PM2.5 HEATMAP',   description: 'Continuous air-quality surface interpolated from PCD monitoring stations. Shows the PM2.5 gradient across Bangkok as a smooth field — where pollution accumulates, where it disperses.', source: 'GISTDA', defaultOn: false, status: 'live', category: 'air' },
  { id: 'aqi-live',        label: 'AQI · OPEN-METEO', description: 'Real-time US AQI from Open-Meteo air-quality API: PM2.5, PM10, NO₂, O₃, SO₂, CO', source: 'Open-Meteo', defaultOn: false, status: 'live', category: 'air' },
  { id: 'air4thai-stations', label: 'AIR4THAI · OFFICIAL', description: 'Pollution Control Department (PCD) official air quality stations — the source Bangkok Metropolitan Administration and Ministry of Public Health actually use. Shows all 6 pollutants: PM2.5, PM10, NO₂, SO₂, CO, O₃.', source: 'PCD', defaultOn: true, status: 'live', category: 'air' },
  { id: 'waqi-stations',   label: 'AQI · WAQI',      description: 'World Air Quality Index global sensor network — different stations from GISTDA. Free token from aqicn.org/data-platform/token; set VITE_WAQI_TOKEN. Without token the layer renders empty.', source: 'WAQI', defaultOn: false, status: 'live', category: 'air' },
  { id: 'openaq-stations', label: 'OPENAQ GLOBAL',   description: 'OpenAQ v3 harmonized global air quality platform. Aggregates multiple sensors. Set VITE_OPENAQ_KEY.', source: 'OpenAQ', defaultOn: false, status: 'live', category: 'air' },
  { id: 'gibs-aod',        label: 'AEROSOL (GIBS)',  description: 'NASA MODIS aerosol optical depth, max zoom 6 — best viewed zoomed-out over Thailand', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'fires-gistda',    label: 'FIRES · GISTDA',  description: 'VIIRS hotspots from GISTDA. Service last refreshed Apr 2023 — historical 2023 fire-season snapshot, not live.', source: 'GISTDA', defaultOn: false, status: 'live', category: 'fire' },
  { id: 'fires-firms',     label: 'FIRES · FIRMS',   description: 'NASA FIRMS live hotspots via Cloudflare Worker proxy.', source: 'NASA', defaultOn: false, status: 'live', category: 'fire' },
  { id: 'floods',          label: 'FLOODS · LIVE',   description: 'GISTDA real-time flood polygons, central region',       source: 'GISTDA',     defaultOn: false, status: 'live',    category: 'water' },
  { id: 'floods-historical', label: 'FLOOD RISK HISTORY', description: 'GISTDA recurring flood zones 2005–2016 — areas that flood every year. Context layer for risk vs. unusual event.', source: 'GISTDA', defaultOn: false, status: 'live', category: 'water' },
  { id: 'traffy-issues',   label: 'CIVIC ISSUES',    description: 'Traffy Fondue real-time citizen reports: roads, floods, broken lights, garbage, buildings. 1.3M+ tickets.', source: 'Traffy', defaultOn: false, status: 'live', category: 'civic' },
  { id: 'traffy-heatmap',  label: 'CIVIC HEATMAP',   description: 'Continuous density field of Traffy citizen reports — shows where complaints concentrate as a smooth gradient, not point markers. Where the city is loudest.', source: 'Traffy', defaultOn: false, status: 'live', category: 'civic' },
  { id: 'districts',       label: 'DISTRICTS',       description: 'All 50 Bangkok khet colored by composite risk: Traffy civic density + PM2.5 air quality per district.', source: 'BMA', defaultOn: true, status: 'live', category: 'admin' },
  { id: 'owm-weather',     label: 'WEATHER · OWM',   description: 'Current weather from OpenWeatherMap One Call 3.0 API. Set VITE_OPENWEATHERMAP_KEY.', source: 'OpenWeatherMap', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'rail',            label: 'BTS / MRT / ARL', description: 'Curated key stations and simplified line geometry',      source: 'BMA',        defaultOn: true,  status: 'live',    category: 'transit' },
  { id: 'gtfs-transit-live', label: 'LIVE TRANSIT (GTFS-RT)', description: 'Mock GTFS-Realtime feed showing simulated train movements along the BTS Sukhumvit line.', source: 'GTFS', defaultOn: false, status: 'live', category: 'transit' },
  { id: 'buildings-3d',    label: '3D BUILDINGS',    description: 'Extrude Bangkok buildings to their actual heights with cinematic 50° camera tilt. Color-graded by height: low buildings dark, high-rise warmer.', source: 'BMA', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'sat-true-color',  label: 'SAT · TRUE COLOR',description: 'MODIS Terra Corrected Reflectance — daily 250m natural-color satellite. The ground, today, from orbit. NASA GIBS, zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-night-lights',label: 'NIGHT LIGHTS',    description: 'VIIRS Black Marble — annual nighttime light composite at 500m. Bangkok lit from orbit. NASA GIBS, zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-surface-temp',label: 'SURFACE TEMP',    description: 'MODIS Land Surface Temperature monthly at 1km — direct satellite measurement of urban heat island. AlphaEarth-class thermal embedding proxy. NASA GIBS.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-ndvi',        label: 'NDVI VEGETATION', description: 'MODIS NDVI 8-day at 250m — vegetation health embeddings. AlphaEarth-class spectral proxy. NASA GIBS.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-esri',        label: 'WORLD IMAGERY',   description: 'Esri World Imagery — high-resolution aerial (up to 30cm/pixel in Bangkok). Individual buildings and vehicles visible. Zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-sentinel2',   label: 'SENTINEL-2 · 2023', description: 'ESA Sentinel-2 cloudless 2023 mosaic at 10m. True-color, no clouds, continuous coverage. Via EOX (eox.at). Zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'alphaearth-embeddings', label: 'ALPHAEARTH', description: 'Google AlphaEarth Foundations — 64-dim annual satellite embeddings via Earth Engine. First 3 PCA bands as RGB. Activate by setting GCP_SERVICE_ACCOUNT_JSON Worker secret. Renders empty until configured.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-s5p-no2',      label: 'S5P · NO₂',       description: 'Copernicus Sentinel-5P Nitrogen Dioxide — city-wide satellite-derived NO₂ column density. Traffic and industrial pollution source indicator. Requires GCP_SERVICE_ACCOUNT_JSON.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-s5p-co',       label: 'S5P · CO',        description: 'Copernicus Sentinel-5P Carbon Monoxide — city-wide satellite-derived CO. Burning and vehicle emission indicator. Requires GCP_SERVICE_ACCOUNT_JSON.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-s5p-so2',      label: 'S5P · SO₂',       description: 'Copernicus Sentinel-5P Sulfur Dioxide — city-wide satellite-derived SO₂. Industrial and power plant emission indicator. Requires GCP_SERVICE_ACCOUNT_JSON.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-ghsl-pop',     label: 'POP DENSITY',     description: 'GHSL Global Human Settlement Layer — population density at 100m resolution. Contextualizes all environmental metrics per capita. "PM2.5 × population = people affected." Requires GCP_SERVICE_ACCOUNT_JSON.', source: 'NASA', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'dynamic-world',    label: 'DYNAMIC WORLD',   description: 'Google Dynamic World — 10m near real-time land cover classification (Water, Trees, Built Area, Crops). Requires GCP_SERVICE_ACCOUNT_JSON.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sentinel1-sar',    label: 'SENTINEL-1 SAR',  description: 'Copernicus Sentinel-1 Synthetic Aperture Radar (SAR) — pierces clouds to map flooding and urban structures. Requires GCP_SERVICE_ACCOUNT_JSON.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'landsat-thermal',  label: 'LANDSAT THERMAL', description: 'Landsat 8/9 Thermal Infrared Sensor — high-resolution (30m) surface temperature for urban heat islands. Requires GCP_SERVICE_ACCOUNT_JSON.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'longdo-basemap',  label: 'LONGDO BASEMAP',  description: 'Thai-native cartography from longdo.com — soi-level street detail, Thai POIs, Thai-language labels that global basemaps miss. Alt basemap for Bangkok-specific work.', source: 'Longdo', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'longdo-traffic',  label: 'LONGDO TRAFFIC',  description: 'Real-time Bangkok traffic congestion from Longdo. Verified pending: Longdo serves traffic only through their JS SDK at runtime, not as standalone tile URLs. Requires embedding their proprietary map widget.', source: 'Longdo', defaultOn: false, status: 'pending', category: 'transit' },
  { id: 'jaxa-himawari',   label: 'HIMAWARI-9',      description: 'JAXA geostationary weather imagery — needs free Earth API registration', source: 'JAXA', defaultOn: false, status: 'pending', category: 'satellite' },
  { id: 'osm-emergency',   label: 'EMERGENCY SVCS',  description: 'Hospitals, clinics, fire stations, and police stations from OpenStreetMap. Critical infrastructure overlay for emergency response planning. Shows nearest facilities to any incident.', source: 'OSM', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'osm-education',   label: 'SCHOOLS & UNIV',  description: 'Schools, universities, and kindergartens from OpenStreetMap. Education density by district. Useful for evacuation planning, air quality vulnerability assessment, and demographic analysis.', source: 'OSM', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'water-quality',   label: 'WATER QUALITY',   description: 'Canal and river water quality from Thaiwater.net — pH, dissolved oxygen, conductivity, turbidity, temperature. Water Quality Index (WQI) per station. Critical for understanding Chao Phraya and canal pollution.', source: 'Thaiwater', defaultOn: false, status: 'live', category: 'water' },
  { id: 'water-level',     label: 'WATER LEVELS',    description: 'Real-time canal and river water levels from Thaiwater.net. Flood risk indicators: current level vs. bank level, rainfall, and flow rate. Essential for predictive flood modeling during monsoon season.', source: 'Thaiwater', defaultOn: false, status: 'live', category: 'water' },
  { id: 'earthquake-tmd',  label: 'EARTHQUAKES',     description: 'Seismic events from Thai Meteorological Department. Magnitude, depth, and location for Thailand and surrounding region. Recent relevance: 2025 Myanmar earthquake was felt in Bangkok. "Felt in Bangkok" filter highlights nearby significant events.', source: 'TMD', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'tomtom-traffic',  label: 'TRAFFIC FLOW',    description: 'Real-time traffic congestion from TomTom Traffic API — current speed vs. free-flow speed at 13 points across Bangkok. Shows actual congestion, not just complaints. Set VITE_TOMTOM_KEY for live data.', source: 'TomTom', defaultOn: false, status: 'live', category: 'transit' },
  { id: 'tomtom-incidents', label: 'TRAFFIC INCIDENTS', description: 'Accidents, road closures, and construction from TomTom. Major incidents highlighted in red. Set VITE_TOMTOM_KEY for live data.', source: 'TomTom', defaultOn: false, status: 'live', category: 'transit' },
  { id: 'airbnb-density',  label: 'AIRBNB DENSITY',  description: 'Inside Airbnb quarterly data — ~20,000 short-term rental listings across Bangkok. Tourism pressure indicator: where visitors concentrate, where housing is commodified.', source: 'InsideAirbnb', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'bma-open',        label: 'BMA OPEN DATA',   description: '1,431 BMA datasets via data.bangkok.go.th — drainage, traffic, public works, parks, citizen services, budget. Browse in the Data Feed panel (Analyst mode).', source: 'BMA', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'historical-events', label: 'HISTORICAL EVENTS', description: 'Curated archive: WWII Allied bombing targets (1942–45, USSBS Pacific), post-1945 industrial fires, major floods, civil-unrest sites. Stack with MODIS Aerosol Optical Depth to test the carbon-saturation hypothesis — does the aerosol pattern still anchor to historical heat-event geography?', source: 'Historical', defaultOn: false, status: 'live', category: 'admin' },
]

export const ALL_SOURCES: SourceKey[] = ['GISTDA', 'NASA', 'BMA', 'data.go.th', 'JAXA', 'Traffy', 'Open-Meteo', 'WAQI', 'TMD', 'Longdo', 'PCD', 'OSM', 'Thaiwater', 'TomTom', 'InsideAirbnb', 'OpenAQ', 'OpenWeatherMap', 'GTFS', 'Historical']

/** PM2.5 → color (Thai PCD bands) */
export const PM25_COLORS: Record<string, string> = {
  good:       '#8bc34a',
  moderate:   '#fdd835',
  sensitive:  '#fb8c00',
  unhealthy:  '#e53935',
  hazardous:  '#7e0023',
  '—':        '#666666',
}

/** US AQI → color */
export const AQI_COLORS: Record<string, string> = {
  good:                '#8bc34a',
  moderate:            '#fdd835',
  'unhealthy-sensitive':'#fb8c00',
  unhealthy:           '#e53935',
  'very-unhealthy':    '#7e0023',
  hazardous:           '#4a0000',
  '—':                 '#666666',
}
