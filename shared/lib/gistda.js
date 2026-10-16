/**
 * GISTDA Data Module — shared across all Dr Non projects
 * Full catalog: Projects/_reference/gistda-api-catalog.md
 * Obsidian: SecondBrain/Knowledge/Topics/gistda-api-catalog.md
 *
 * IMPORT: import { fetchPm25, fetchHotspots, fetchFloodPolygons, ... } from '../../_shared/lib/gistda.js';
 *
 * All public endpoints — no API key needed for environmental/disaster data.
 * Sphere key (saved in shared/.secrets-backup/gistda.env) only needed for:
 *   - Basemap tiles (sphere_streets, thailand_images, sphere_hybrid)
 *   - POI search / geocoding
 *
 * ArcGIS portal note: PAGINATION DISABLED. Always filter with where=, never resultRecordCount.
 * Field names for province/district are Thai: pv_tn, ap_tn, tb_tn (not pv_en).
 */

const ARCGIS = 'https://gistdaportal.gistda.or.th/data/rest/services';
const PM25   = 'https://pm25.gistda.or.th/rest';
const SPHERE = 'https://api.sphere.gistda.or.th/services';

// ── Province IDs (pv_idn) for common locations ──────────────────────────────
export const PROVINCE_ID = {
  bangkok:    10,
  phuket:     83,
  chiangmai:  50,
  chiangrai:  57,
  khonkaen:   40,
  nakornratchasima: 30,
  suratthani: 84,
};

// ── PM2.5 Air Quality (satellite-derived, hourly, no auth) ───────────────────

/**
 * Get PM2.5 at a specific lat/lon.
 * Returns: { pm25: number, graphHistory24hrs: [[val, isoTimestamp], ...] }
 */
export async function fetchPm25ByLocation(lat, lng) {
  const r = await fetch(`${PM25}/getPm25byLocation?lat=${lat}&lng=${lng}`);
  const d = await r.json();
  if (d.status !== 200) throw new Error(d.errMsg || 'GISTDA PM2.5 error');
  return d.data;
}

/**
 * Get PM2.5 for all 77 provinces, ranked descending.
 * Returns: [{ pv_en, pv_tn, pv_idn, pm25, pm25Avg24hr, dt }, ...]
 */
export async function fetchPm25AllProvinces() {
  const r = await fetch(`${PM25}/getPm25byProvince`);
  const d = await r.json();
  if (d.status !== 200) throw new Error(d.errMsg || 'GISTDA PM2.5 error');
  return d.data;
}

/**
 * Get 24-hr PM2.5 history for one province.
 * @param {number} pvIdn  Province ID (use PROVINCE_ID constants above)
 * Returns: [[pm25Value, isoTimestamp], ...]
 */
export async function fetchPm25History24h(pvIdn) {
  const r = await fetch(`${PM25}/getPm25byProvince24hrs?pv_idn=${pvIdn}`);
  const d = await r.json();
  if (d.status !== 200) throw new Error(d.errMsg || 'GISTDA PM2.5 error');
  return d.data;
}

/**
 * Convenience: get Bangkok + Phuket PM2.5 in parallel.
 * Returns: { bkk: number, phuket: number }
 */
export async function fetchPm25KeyCities() {
  const [bkk, phuket] = await Promise.all([
    fetchPm25ByLocation(13.7563, 100.5018).then(d => d.pm25).catch(() => null),
    fetchPm25ByLocation(7.8804,  98.3923).then(d => d.pm25).catch(() => null),
  ]);
  return { bkk, phuket };
}

/**
 * PM2.5 level label from µg/m³ (WHO/Thailand PCD standard)
 */
export function pm25Level(value) {
  if (value == null) return '—';
  if (value <= 12)   return 'good';
  if (value <= 35.4) return 'moderate';
  if (value <= 55.4) return 'sensitive';
  if (value <= 150.4) return 'unhealthy';
  return 'hazardous';
}

// ── Fire / Hotspots (MODIS + VIIRS, daily, no auth) ─────────────────────────

/**
 * Fetch fire hotspots for a given province (Thai name).
 * @param {string} provinceThai  e.g. 'ภูเก็ต', 'เชียงใหม่', 'กรุงเทพมหานคร'
 * Returns ArcGIS FeatureSet with features[].attributes: { longitude, latitude, datetime, satellite, confident, pv_tn, ap_tn, lu_name }
 */
export async function fetchHotspotsByProvince(provinceThai) {
  const where = encodeURIComponent(`pv_tn='${provinceThai}'`);
  const fields = 'longitude,latitude,datetime,satellite,confident,pv_tn,ap_tn,lu_name';
  const r = await fetch(
    `${ARCGIS}/FR_Fire/hotspot_npp_daily/MapServer/0/query?f=json&where=${where}&outFields=${fields}`
  );
  return r.json(); // { features: [{attributes: {...}}] }
}

/**
 * Fetch today's hotspots nationwide as GeoJSON (for Deck.gl / Mapbox / Leaflet).
 * Filters to recent 48h to keep payload small.
 */
export async function fetchHotspotsGeoJSON() {
  const where = encodeURIComponent("datetime > CURRENT_TIMESTAMP - 2");
  const r = await fetch(
    `${ARCGIS}/FR_Fire/hotspot_npp_daily/MapServer/0/query?f=geojson&where=${where}&outFields=longitude,latitude,datetime,satellite,confident,pv_tn`
  );
  return r.json(); // GeoJSON FeatureCollection
}

// ── AQI Monitoring Stations (PCD, hourly points, no auth) ───────────────────

/**
 * Fetch air quality monitoring station readings for a province.
 * @param {string} provinceThai  Thai province name
 * Returns features with: { st_name, pm25, pm10, pm25_str, pm10_str, acq_date, acq_time, longitude, latitude }
 */
export async function fetchAQIStationsByProvince(provinceThai) {
  const where = encodeURIComponent(`pv_tn='${provinceThai}'`);
  const fields = 'st_name,pm25,pm10,pm25_str,pm10_str,acq_date,acq_time,longitude,latitude,ap_tn';
  const r = await fetch(
    `${ARCGIS}/FR_Fire/AirQuality_hourly/MapServer/0/query?f=json&where=${where}&outFields=${fields}`
  );
  return r.json();
}

// ── Flood Polygons (daily, no auth) ─────────────────────────────────────────

/**
 * Fetch current flood polygons as GeoJSON.
 * @param {'all'|'central'|'northeast'} region
 * Note: flood_daily updates by adding new layers. This queries layer 0 (national overview).
 * During active flood events, returns polygons; between events may be empty.
 */
export async function fetchFloodPolygonsGeoJSON(region = 'all') {
  const svc = region === 'central'   ? 'flood_daily_c'
            : region === 'northeast' ? 'flood_daily_ne'
            : 'flood_daily';
  const r = await fetch(
    `${ARCGIS}/FL_Flood/${svc}/MapServer/0/query?f=geojson&where=1%3D1`
  );
  return r.json();
}

/**
 * Fetch historical recurring flood zones (2005–2016 static layer).
 * Use for risk overlay on maps — shows areas that flood repeatedly.
 * Returns GeoJSON FeatureCollection with polygon geometries.
 */
export async function fetchRecurringFloodZones() {
  const r = await fetch(
    `${ARCGIS}/FL_Flood/FL_RepeatedFlooding_GISTDA_50k_Y2005_Y2016/FeatureServer/0/query?f=geojson&where=1%3D1`
  );
  return r.json();
}

// ── Administrative Boundaries (static, no auth) ──────────────────────────────

/**
 * Fetch all 77 province polygons as GeoJSON.
 * Use for choropleth maps, geofence boundaries, admin overlays.
 * ~77 features — safe to load without filter (no pagination issue).
 */
export async function fetchProvincePolygons() {
  const r = await fetch(
    `${ARCGIS}/L05_AdminBoundary/L05_Province_GISTDA_50k/MapServer/0/query?f=geojson&where=1%3D1&outFields=*`
  );
  return r.json();
}

/**
 * Fetch district (amphoe) polygons for a province.
 * @param {string} provinceThai  Thai province name
 */
export async function fetchDistrictPolygons(provinceThai) {
  const where = encodeURIComponent(`pv_tn='${provinceThai}'`);
  const r = await fetch(
    `${ARCGIS}/L05_AdminBoundary/L05_Amphoe_GISTDA_50k/MapServer/0/query?f=geojson&where=${where}&outFields=*`
  );
  return r.json();
}

// ── Sphere POI Search (requires API key) ────────────────────────────────────

/**
 * Search Thai POIs by keyword.
 * @param {string} keyword  Search term (English or Thai)
 * @param {string} apiKey   GISTDA Sphere API key
 * Returns: { meta: { hasmore, start, end }, data: [{ id, name, lat, lon, icon, tag[], address }] }
 */
export async function searchPOI(keyword, apiKey) {
  const r = await fetch(
    `${SPHERE}/search/search?keyword=${encodeURIComponent(keyword)}&key=${apiKey}`
  );
  return r.json();
}

/**
 * Get autocomplete suggestions.
 * @param {string} keyword  Partial search term
 * @param {string} apiKey   GISTDA Sphere API key
 */
export async function suggestPOI(keyword, apiKey) {
  const r = await fetch(
    `${SPHERE}/search/suggest?keyword=${encodeURIComponent(keyword)}&key=${apiKey}`
  );
  return r.json();
}

// ── Sphere Basemap Tile URLs (requires key + domain whitelist) ───────────────
// Register domains at sphere.gistda.or.th → account settings before using.

export function sphereTileUrl(style, apiKey) {
  const styles = {
    streets:   'sphere_streets',
    satellite: 'thailand_images',
    hybrid:    'sphere_hybrid',
  };
  const s = styles[style] || styles.streets;
  const ext = style === 'streets' ? 'png' : 'jpeg';
  return `https://basemap.sphere.gistda.or.th/tiles/${s}/EPSG3857/{z}/{x}/{y}.${ext}?key=${apiKey}`;
}

// Example Leaflet usage:
// L.tileLayer(sphereTileUrl('satellite', GISTDA_KEY), { attribution: '© GISTDA' }).addTo(map);

// Example Mapbox/MapLibre usage:
// sources: { gistda: { type: 'raster', tiles: [sphereTileUrl('streets', GISTDA_KEY)], tileSize: 256 } }
