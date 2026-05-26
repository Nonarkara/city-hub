/**
 * Insight Templates — pre-configured layer stacks that reveal hidden patterns
 * when layered together. The core of the dashboard's intelligence move:
 * any single layer is just data; stacking the right layers in the right
 * order is where the insight lives.
 *
 * Each template activates a curated set of layers, optionally suggests a
 * basemap, and explains in plain language what the user should look for
 * once the layers stack.
 */
import type { BasemapId } from './cities'

export interface InsightTemplate {
  id: string
  title: string                  // short, scan-friendly
  question: string               // the question this stack answers
  hypothesis: string             // what to look for once layers stack
  layers: string[]               // layer IDs to enable
  basemap?: BasemapId            // optional override
  zoom?: number                  // optional zoom override — match the scale the stack reads at
  cityScope: 'bangkok' | 'all'   // which cities this works on
  category: 'forensic' | 'predictive' | 'accountability' | 'introduction'
  difficulty: 'easy' | 'medium' | 'hard'
}

export const INSIGHTS: InsightTemplate[] = [
  {
    id: 'aerosol-as-witness',
    title: 'AEROSOL AS WITNESS',
    question: 'Does the carbon-saturation pattern in MODIS aerosol still anchor to historical bombing targets and industrial-fire sites from 80 years ago?',
    hypothesis: 'Stack MODIS aerosol on top of WWII bombing markers. If the hypothesis holds, the aerosol concentration should still cluster around the 1942–45 strike geography — railway yards, port, oil tank farms. The atoms moved; the geography didn\'t.',
    layers: ['gibs-aod', 'historical-events'],
    basemap: 'nasa-true-color',
    zoom: 8,   // aerosol resolves at low zoom; bombings still visible
    cityScope: 'bangkok',
    category: 'forensic',
    difficulty: 'hard',
  },
  {
    id: 'why-this-flood',
    title: 'WHY THIS FLOOD HAPPENED',
    question: 'When citizens report flooding, does official GISTDA monitoring agree? Or are we missing where the city is actually drowning?',
    hypothesis: 'Stack GISTDA real-time flood polygons + GISTDA historical flood zones + Traffy citizen flood reports + water levels. The gap between the official polygon and the citizen-report cluster is where official monitoring fails — and where lives are lost first.',
    layers: ['floods', 'floods-historical', 'traffy-issues', 'water-level'],
    basemap: 'esri-imagery',
    zoom: 10,
    cityScope: 'bangkok',
    category: 'accountability',
    difficulty: 'medium',
  },
  {
    id: 'night-lights-wealth',
    title: 'NIGHT LIGHTS = WEALTH GRADIENT',
    question: 'Which districts are dark on the satellite at night despite holding people?',
    hypothesis: 'VIIRS Black Marble night lights + GHSL population. Districts that are dark but populated are under-electrified or under-served. Districts that are bright but empty are commercial cores. The ratio reveals the city\'s wealth gradient at 500m resolution.',
    layers: ['sat-night-lights', 'sat-ghsl-pop', 'districts'],
    basemap: 'esri-imagery',
    zoom: 9,
    cityScope: 'bangkok',
    category: 'accountability',
    difficulty: 'medium',
  },
  {
    id: 'narrative-vs-reality',
    title: 'NARRATIVE VS REALITY',
    question: 'Where are citizens loudest and the press is silent — and where is the press loud but citizens quiet?',
    hypothesis: 'Stack Traffy civic heatmap (where citizens report problems) + PM2.5 stations (measured reality). The Governor brief already pulls GDELT tone. The map gap is where civic noise rises without official measurement matching — early-warning territory.',
    layers: ['traffy-heatmap', 'pm25-stations', 'air4thai-stations'],
    zoom: 10,
    cityScope: 'bangkok',
    category: 'accountability',
    difficulty: 'easy',
  },
  {
    id: 'fires-downwind',
    title: 'FIRES + DOWNWIND POPULATION',
    question: 'Whose lungs are downwind of today\'s fires?',
    hypothesis: 'NASA FIRMS active fires + GHSL population density + current wind direction (in the Governor brief). The arrow from fire-point through wind-vector to populated areas is the smoke pathway. This is the public-health forecast nobody puts on a single map.',
    layers: ['fires-firms', 'sat-ghsl-pop', 'districts'],
    zoom: 8,    // see fires beyond city limits + wind catchment
    cityScope: 'bangkok',
    category: 'predictive',
    difficulty: 'medium',
  },
  {
    id: 'heat-islands',
    title: 'HEAT ISLANDS',
    question: 'Where does Bangkok physically retain heat the worst — and who lives there?',
    hypothesis: 'MODIS Land Surface Temperature + 3D buildings + population density. The hottest pixels are dense, low-albedo, low-vegetation. Stack reveals which districts will feel the next heat wave first and most.',
    layers: ['sat-surface-temp', 'buildings-3d', 'sat-ghsl-pop'],
    basemap: 'esri-imagery',
    zoom: 11,   // city scale — heat patterns + 3D buildings
    cityScope: 'bangkok',
    category: 'predictive',
    difficulty: 'easy',
  },
]

/** Filter templates by current city's scope. */
export function insightsForCity(cityId: string): InsightTemplate[] {
  return INSIGHTS.filter((t) => t.cityScope === 'all' || t.cityScope === cityId)
}
