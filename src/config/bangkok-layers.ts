/**
 * Bangkok layer catalog — the single source of truth for the toggle rail.
 * Each layer is loaded lazily on first activation and toggled via visibility.
 */
export type SourceKey = 'GISTDA' | 'NASA' | 'BMA' | 'data.go.th' | 'JAXA' | 'Traffy' | 'Open-Meteo' | 'WAQI' | 'TMD' | 'Longdo'

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
  { id: 'waqi-stations',   label: 'AQI · WAQI',      description: 'World Air Quality Index global sensor network — different stations from GISTDA. Free token from aqicn.org/data-platform/token; set VITE_WAQI_TOKEN. Without token the layer renders empty.', source: 'WAQI', defaultOn: false, status: 'live', category: 'air' },
  { id: 'gibs-aod',        label: 'AEROSOL (GIBS)',  description: 'NASA MODIS aerosol optical depth, max zoom 6 — best viewed zoomed-out over Thailand', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'fires-gistda',    label: 'FIRES · GISTDA',  description: 'VIIRS hotspots from GISTDA. Service last refreshed Apr 2023 — historical 2023 fire-season snapshot, not live.', source: 'GISTDA', defaultOn: false, status: 'live', category: 'fire' },
  { id: 'fires-firms',     label: 'FIRES · FIRMS',   description: 'NASA FIRMS live hotspots via Cloudflare Worker proxy.', source: 'NASA', defaultOn: false, status: 'live', category: 'fire' },
  { id: 'floods',          label: 'FLOODS · LIVE',   description: 'GISTDA real-time flood polygons, central region',       source: 'GISTDA',     defaultOn: false, status: 'live',    category: 'water' },
  { id: 'floods-historical', label: 'FLOOD RISK HISTORY', description: 'GISTDA recurring flood zones 2005–2016 — areas that flood every year. Context layer for risk vs. unusual event.', source: 'GISTDA', defaultOn: false, status: 'live', category: 'water' },
  { id: 'traffy-issues',   label: 'CIVIC ISSUES',    description: 'Traffy Fondue real-time citizen reports: roads, floods, broken lights, garbage, buildings. 1.3M+ tickets.', source: 'Traffy', defaultOn: false, status: 'live', category: 'civic' },
  { id: 'districts',       label: 'DISTRICTS',       description: 'All 50 Bangkok khet colored by composite risk: Traffy civic density + PM2.5 air quality per district.', source: 'BMA', defaultOn: true, status: 'live', category: 'admin' },
  { id: 'rail',            label: 'BTS / MRT / ARL', description: 'Curated key stations and simplified line geometry',      source: 'BMA',        defaultOn: true,  status: 'live',    category: 'transit' },
  { id: 'sat-true-color',  label: 'SAT · TRUE COLOR',description: 'MODIS Terra Corrected Reflectance — daily 250m natural-color satellite. The ground, today, from orbit. NASA GIBS, zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-night-lights',label: 'NIGHT LIGHTS',    description: 'VIIRS Black Marble — annual nighttime light composite at 500m. Bangkok lit from orbit. NASA GIBS, zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-surface-temp',label: 'SURFACE TEMP',    description: 'MODIS Land Surface Temperature monthly at 1km — direct satellite measurement of urban heat island. AlphaEarth-class thermal embedding proxy. NASA GIBS.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-ndvi',        label: 'NDVI VEGETATION', description: 'MODIS NDVI 8-day at 250m — vegetation health embeddings. AlphaEarth-class spectral proxy. NASA GIBS.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-esri',        label: 'WORLD IMAGERY',   description: 'Esri World Imagery — high-resolution aerial (up to 30cm/pixel in Bangkok). Individual buildings and vehicles visible. Zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'sat-sentinel2',   label: 'SENTINEL-2 · 2023', description: 'ESA Sentinel-2 cloudless 2023 mosaic at 10m. True-color, no clouds, continuous coverage. Via EOX (eox.at). Zero auth.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'alphaearth-embeddings', label: 'ALPHAEARTH', description: 'Google AlphaEarth Foundations — 64-dim annual satellite embeddings via Earth Engine. First 3 PCA bands as RGB. Activate by setting GCP_SERVICE_ACCOUNT_JSON Worker secret. Renders empty until configured.', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'longdo-basemap',  label: 'LONGDO BASEMAP',  description: 'Thai-native cartography from longdo.com — soi-level street detail, Thai POIs, Thai-language labels that global basemaps miss. Alt basemap for Bangkok-specific work.', source: 'Longdo', defaultOn: false, status: 'live', category: 'admin' },
  { id: 'longdo-traffic',  label: 'LONGDO TRAFFIC',  description: 'Real-time Bangkok traffic congestion from Longdo. Verified pending: Longdo serves traffic only through their JS SDK at runtime, not as standalone tile URLs. Requires embedding their proprietary map widget.', source: 'Longdo', defaultOn: false, status: 'pending', category: 'transit' },
  { id: 'jaxa-himawari',   label: 'HIMAWARI-9',      description: 'JAXA geostationary weather imagery — needs free Earth API registration', source: 'JAXA', defaultOn: false, status: 'pending', category: 'satellite' },
  { id: 'bma-open',        label: 'BMA OPEN DATA',   description: '1,431 BMA datasets via data.bangkok.go.th — drainage, traffic, public works, parks, citizen services, budget. Browse in the Data Feed panel (Analyst mode).', source: 'BMA', defaultOn: false, status: 'live', category: 'admin' },
]

export const ALL_SOURCES: SourceKey[] = ['GISTDA', 'NASA', 'BMA', 'data.go.th', 'JAXA', 'Traffy', 'Open-Meteo', 'WAQI', 'TMD', 'Longdo']

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
