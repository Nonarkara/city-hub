/**
 * Bangkok layer catalog — the single source of truth for the toggle rail.
 * Each layer is loaded lazily on first activation and toggled via visibility.
 */
export type SourceKey = 'GISTDA' | 'NASA' | 'BMA' | 'data.go.th' | 'JAXA'

export interface LayerSpec {
  id: string
  label: string                  // Short uppercase label for the rail
  description: string            // Tooltip / detail
  source: SourceKey
  defaultOn: boolean
  status: 'live' | 'pending'     // pending = disabled tile, no fetch
  category: 'air' | 'fire' | 'water' | 'admin' | 'transit' | 'satellite'
}

export const BANGKOK_LAYERS: LayerSpec[] = [
  { id: 'pm25-stations',   label: 'PM2.5 STATIONS',  description: 'PCD air-quality monitoring stations. GISTDA hourly endpoint is intermittently empty — KPI panel uses a separate live by-location feed that always works.', source: 'GISTDA', defaultOn: true,  status: 'live',    category: 'air' },
  { id: 'gibs-aod',        label: 'AEROSOL (GIBS)',  description: 'NASA MODIS aerosol optical depth, max zoom 6 — best viewed zoomed-out over Thailand', source: 'NASA', defaultOn: false, status: 'live', category: 'satellite' },
  { id: 'fires-gistda',    label: 'FIRES · GISTDA',  description: 'VIIRS hotspots from GISTDA. Service last refreshed Apr 2023 — historical 2023 fire-season snapshot, not live.', source: 'GISTDA', defaultOn: false, status: 'live', category: 'fire' },
  { id: 'fires-firms',     label: 'FIRES · FIRMS',   description: 'NASA FIRMS live hotspots — CORS-blocked from browser. Wave 2 will proxy via Cloudflare Worker.', source: 'NASA', defaultOn: false, status: 'live', category: 'fire' },
  { id: 'floods',          label: 'FLOODS',          description: 'GISTDA current flood polygons, central region',          source: 'GISTDA',     defaultOn: false, status: 'live',    category: 'water' },
  { id: 'districts',       label: 'DISTRICTS',       description: 'Central BMA district overlay (6 of 50, sample)',          source: 'BMA',        defaultOn: true,  status: 'live',    category: 'admin' },
  { id: 'rail',            label: 'BTS / MRT / ARL', description: 'Curated key stations and simplified line geometry',      source: 'BMA',        defaultOn: true,  status: 'live',    category: 'transit' },
  { id: 'jaxa-himawari',   label: 'HIMAWARI-9',      description: 'JAXA geostationary weather imagery — needs free Earth API registration', source: 'JAXA', defaultOn: false, status: 'pending', category: 'satellite' },
  { id: 'bma-open',        label: 'BMA OPEN DATA',   description: 'Drainage, CCTV, citizen reports — pending DEPA contact for API access', source: 'BMA', defaultOn: false, status: 'pending', category: 'admin' },
]

export const ALL_SOURCES: SourceKey[] = ['GISTDA', 'NASA', 'BMA', 'data.go.th', 'JAXA']

/** PM2.5 → color (Thai PCD bands) */
export const PM25_COLORS: Record<string, string> = {
  good:       '#8bc34a',
  moderate:   '#fdd835',
  sensitive:  '#fb8c00',
  unhealthy:  '#e53935',
  hazardous:  '#7e0023',
  '—':        '#666666',
}
