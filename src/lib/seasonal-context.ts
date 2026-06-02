/**
 * Seasonal hazard context — Thailand and SE Asia.
 *
 * Returns the current hazard season for a given city and month.
 * Used in the Situation Brief to add proactive context without an API.
 *
 * Sources:
 * - Thailand DMH burning season calendar (Jan–Apr, Northern Thailand)
 * - BMA flood risk calendar (May–Oct, Chao Phraya basin)
 * - Singapore NEA haze advisory calendar (June–Oct, Sumatra fires)
 * - Malaysia SEOC flood seasons (Nov–Feb, East coast)
 */

export interface SeasonalHazard {
  id:      string
  type:    'fire' | 'flood' | 'haze' | 'heat' | 'storm' | 'drought' | 'clear'
  label:   string
  urgency: 'active' | 'approaching' | 'receding' | 'clear'
  detail:  string
}

type MonthlyCalendar = Record<number, SeasonalHazard[]>  // 1–12

const BANGKOK_CALENDAR: MonthlyCalendar = {
  1:  [
    { id: 'burning-season-start', type: 'fire',  label: 'BURNING SEASON BEGINS', urgency: 'approaching', detail: 'Agricultural burning in Chiang Rai, Chiang Mai, Mae Hong Son. PM2.5 will track northeast winds. Expect haze to reach Bangkok by Feb.' },
  ],
  2:  [
    { id: 'burning-peak',         type: 'fire',  label: 'BURNING SEASON ACTIVE', urgency: 'active',      detail: 'Peak burning season. Northern provinces under Air Quality Action Plans. PM2.5 transported south by NE-to-SW wind shift. Monitor Bangkok AQI closely.' },
    { id: 'hot-season-start',     type: 'heat',  label: 'HOT SEASON APPROACHING', urgency: 'approaching', detail: 'Heat stress builds through Feb–Apr. Feels-like temperatures >40°C expected by March. Health advisory for outdoor workers + elderly.' },
  ],
  3:  [
    { id: 'burning-peak-2',       type: 'fire',  label: 'BURNING SEASON PEAK',   urgency: 'active',      detail: 'Highest fire activity of the year. Chiang Mai frequently exceeds WHO PM2.5 annual guidance in a single day. Bangkok receives transported smoke.' },
    { id: 'hot-season',           type: 'heat',  label: 'HOT SEASON',            urgency: 'active',      detail: 'Hottest months Mar–May. Heatwave risk for outdoor activities. UHI effect adds 3–5°C in dense Bangkok districts. Waterborne illness risk rises.' },
  ],
  4:  [
    { id: 'burning-end',          type: 'fire',  label: 'BURNING SEASON ENDING', urgency: 'receding',    detail: 'Burning season winding down by mid-April (Songkran rains). PM2.5 levels will begin to recover. Northern provinces transition to monsoon.' },
    { id: 'hot-season-peak',      type: 'heat',  label: 'HOT SEASON PEAK',       urgency: 'active',      detail: 'Peak heat: April is Bangkok\'s hottest month. Pre-monsoon thunderstorms bring flash flooding risk in low-lying districts.' },
  ],
  5:  [
    { id: 'monsoon-onset',        type: 'flood', label: 'MONSOON ONSET',         urgency: 'approaching', detail: 'Southwest monsoon begins mid-May. BMA\'s drainage system under pressure from first heavy rains. Pre-position flood response resources.' },
  ],
  6:  [
    { id: 'monsoon-active',       type: 'flood', label: 'MONSOON ACTIVE',        urgency: 'active',      detail: 'Active southwest monsoon. Monitor Bhumibol and Sirikit dam levels — storage >80% signals elevated Bangkok flood risk.' },
    { id: 'haze-sg',              type: 'haze',  label: 'SE ASIA HAZE SEASON',   urgency: 'approaching', detail: 'Sumatra/Kalimantan dry season begins. Singapore and southern Thailand vulnerable to transboundary haze from peatland fires.' },
  ],
  7:  [
    { id: 'monsoon-active-2',     type: 'flood', label: 'FLOOD RISK ELEVATED',   urgency: 'active',      detail: 'July–September: peak rainfall. Watch dam levels and Chao Phraya river gauge at Nakhon Sawan (3–5 day lead time for Bangkok).' },
  ],
  8:  [
    { id: 'flood-risk-peak',      type: 'flood', label: 'FLOOD RISK PEAK',       urgency: 'active',      detail: 'Historically most flood-prone months. 2011 Great Flood peaked in October but water began accumulating August. Dam levels are the critical indicator.' },
  ],
  9:  [
    { id: 'flood-risk-high',      type: 'flood', label: 'FLOOD RISK HIGH',       urgency: 'active',      detail: 'Continued high rainfall. Tropical cyclone formation season (Gulf of Thailand). Traffy Fondue flooding reports will spike.' },
    { id: 'haze-sg-peak',         type: 'haze',  label: 'SE ASIA HAZE PEAK',     urgency: 'active',      detail: 'Peak transboundary haze. Singapore PSI and air quality in southern Thailand at annual worst. Sumatra fire season.' },
  ],
  10: [
    { id: 'monsoon-end',          type: 'flood', label: 'MONSOON ENDING',        urgency: 'receding',    detail: 'Monsoon withdrawal begins. Flood risk remains if dam levels are still high. Release schedules from Bhumibol/Sirikit critical.' },
    { id: 'northeast-monsoon',    type: 'storm', label: 'NE MONSOON BEGINS',     urgency: 'approaching', detail: 'Northeast monsoon brings heavy rain to East Gulf coast (Pattaya, Chonburi) and Southern Thailand. Bangkok transitions to cool-dry season.' },
  ],
  11: [
    { id: 'cool-season',          type: 'clear', label: 'COOL-DRY SEASON',       urgency: 'clear',       detail: 'Bangkok\'s best air quality and temperatures. AQI typically lowest of the year. Outdoor events, marathons, tourism peak.' },
  ],
  12: [
    { id: 'cool-season-2',        type: 'clear', label: 'COOL-DRY SEASON',       urgency: 'clear',       detail: 'Cool and dry. PM2.5 still worth monitoring — surface-level inversions during cold nights can trap local emissions.' },
    { id: 'burning-approaching',  type: 'fire',  label: 'BURNING SEASON IN 6W',  urgency: 'approaching', detail: 'Agricultural burning season begins January in northern provinces. PM2.5 monitoring season starts.' },
  ],
}

const CHIANG_MAI_CALENDAR: MonthlyCalendar = {
  1:  [{ id: 'cnx-burn', type: 'fire', label: 'BURNING SEASON BEGINS', urgency: 'active', detail: 'Chiang Mai enters burning season. Valley topography traps smoke. Air quality can reach hazardous levels for multiple consecutive days.' }],
  2:  [{ id: 'cnx-burn-peak', type: 'fire', label: 'BURNING SEASON PEAK', urgency: 'active', detail: 'Peak smoke accumulation in Chiang Mai valley. Hotspot counts tracked by GISTDA. AQI routinely >200 (Very Unhealthy).' }],
  3:  [{ id: 'cnx-burn-worst', type: 'fire', label: 'BURNING SEASON WORST', urgency: 'active', detail: 'Historically worst month for Chiang Mai air quality. March records frequently break national and global PM2.5 records.' }],
  4:  [{ id: 'cnx-burn-end', type: 'fire', label: 'BURNING SEASON ENDING', urgency: 'receding', detail: 'Songkran rains begin to clear smoke. April typically shows sharp improvement in second half.' }],
}

const SINGAPORE_CALENDAR: MonthlyCalendar = {
  6:  [{ id: 'sin-haze', type: 'haze', label: 'HAZE SEASON APPROACHING', urgency: 'approaching', detail: 'Sumatra peatland fire season begins. PSI may spike with SW wind events. NEA activates haze monitoring protocols.' }],
  7:  [{ id: 'sin-haze-active', type: 'haze', label: 'HAZE SEASON', urgency: 'active', detail: 'Transboundary haze risk. PSI > 100 events possible. Outdoor activity advisories may be issued.' }],
  8:  [{ id: 'sin-haze-peak', type: 'haze', label: 'HAZE SEASON PEAK', urgency: 'active', detail: 'Peak haze risk. 2015 Singapore PSI exceeded 300 in August. NEA/MAS coordination with Indonesia on fire suppression.' }],
  9:  [{ id: 'sin-haze-recede', type: 'haze', label: 'HAZE SEASON ENDING', urgency: 'receding', detail: 'Northeast monsoon shift typically clears haze by late September.' }],
  11: [{ id: 'sin-flood', type: 'flood', label: 'NE MONSOON RAIN', urgency: 'approaching', detail: 'Northeast monsoon brings heavy rain to Singapore. Flash flood risk in low-lying areas. Buona Vista and Orchard Road monitoring.' }],
  12: [{ id: 'sin-flood-active', type: 'flood', label: 'NE MONSOON ACTIVE', urgency: 'active', detail: 'Heaviest rainfall month. Flash flood risk. NEA issues advisories.' }],
}

const CITY_CALENDARS: Record<string, MonthlyCalendar> = {
  'bangkok':   BANGKOK_CALENDAR,
  'chiang-mai': CHIANG_MAI_CALENDAR,
  'singapore': SINGAPORE_CALENDAR,
}

/** Returns active hazards for the given city + current month. */
export function getSeasonalHazards(cityId: string): SeasonalHazard[] {
  const month = new Date().getMonth() + 1  // 1–12
  const calendar = CITY_CALENDARS[cityId] ?? CITY_CALENDARS['bangkok']
  return calendar[month] ?? []
}

/** Returns the most urgent hazard (active > approaching > receding). */
export function getPrimaryHazard(cityId: string): SeasonalHazard | null {
  const hazards = getSeasonalHazards(cityId)
  if (hazards.length === 0) return null
  const priority = { active: 0, approaching: 1, receding: 2, clear: 3 }
  return [...hazards].sort((a, b) => priority[a.urgency] - priority[b.urgency])[0]
}
