/**
 * Historical Events — Bangkok-anchored archive.
 *
 * Allied bombing targets 1942–45 (sources: USAF Strategic Bombing Survey
 * Pacific Theater, Thai Air Force Museum, Royal Thai Navy archives), plus
 * notable post-1945 industrial/environmental events.
 *
 * Why this layer matters: stacked on top of MODIS Aerosol Optical Depth
 * (NASA GIBS), it reveals the carbon-saturation hypothesis Non named —
 * heavy-fuel detonation and post-event combustion deposits aromatics + soot
 * that persist in particulate form for generations. The aerosol pattern
 * over Bangkok still anchors to historical heat-event geography.
 *
 * Coordinates are approximate (district-level) — these are research aids,
 * not forensic geolocation.
 */

export interface HistoricalEvent {
  id: string
  type: 'wwii-bombing' | 'industrial-fire' | 'chemical-spill' | 'flood-major' | 'civil-unrest'
  name: string
  nameLocal?: string
  date: string                  // ISO YYYY-MM-DD
  lat: number
  lng: number
  impactDescription: string
  source: string
  severity: 'high' | 'medium' | 'low'
}

const BANGKOK_EVENTS: HistoricalEvent[] = [
  // ── Allied bombing of Bangkok 1942–45 ─────────────────────────────────────
  // Primary targets: railway yards, port facilities, oil storage.
  {
    id: 'bkk-wwii-bangkok-noi-yards',
    type: 'wwii-bombing',
    name: 'Bangkok Noi Railway Yards',
    nameLocal: 'สถานีรถไฟบางกอกน้อย',
    date: '1944-12-19',
    lat: 13.7565, lng: 100.4738,
    impactDescription: 'USAAF B-29 raid. 39 aircraft hit the marshalling yards. Massive fires from rolling stock. Yards rebuilt postwar; aerosol footprint persists in the Bang Phlat / Bangkok Noi corridor.',
    source: 'USSBS Pacific Vol 36, 1946',
    severity: 'high',
  },
  {
    id: 'bkk-wwii-makkasan-yards',
    type: 'wwii-bombing',
    name: 'Makkasan Railway Workshops',
    nameLocal: 'โรงงานรถไฟมักกะสัน',
    date: '1944-12-14',
    lat: 13.7548, lng: 100.5587,
    impactDescription: 'B-29 strike on State Railway repair shops. Severe damage; civilian casualties in Pratunam. Site remains industrial — heavy diesel exhaust + locomotive workshop emissions to today.',
    source: 'Royal Thai Air Force archive',
    severity: 'high',
  },
  {
    id: 'bkk-wwii-rama-vi-bridge',
    type: 'wwii-bombing',
    name: 'Rama VI Bridge (Chao Phraya rail bridge)',
    nameLocal: 'สะพานพระราม 6',
    date: '1945-04-07',
    lat: 13.8094, lng: 100.5161,
    impactDescription: 'Multiple raids targeted the single rail crossing over the Chao Phraya. Bridge dropped 7 April 1945 cutting the southern Thailand-Malaya line. Reconstructed.',
    source: 'USSBS Pacific',
    severity: 'high',
  },
  {
    id: 'bkk-wwii-don-mueang',
    type: 'wwii-bombing',
    name: 'Don Mueang Airfield',
    nameLocal: 'สนามบินดอนเมือง',
    date: '1944-11-27',
    lat: 13.9126, lng: 100.6067,
    impactDescription: 'First B-29 raid on Bangkok. Heavy damage to Japanese-occupied airfield + Thai Air Force hangars. Site remains aviation — continuous heavy-fuel particulate footprint.',
    source: '20th Bomber Command after-action reports',
    severity: 'high',
  },
  {
    id: 'bkk-wwii-klong-toey-port',
    type: 'wwii-bombing',
    name: 'Klong Toey Port',
    nameLocal: 'ท่าเรือกรุงเทพ',
    date: '1945-02-05',
    lat: 13.7080, lng: 100.5640,
    impactDescription: 'Port facility raid targeted Japanese supply shipping. Adjacent slum district sustained heavy civilian casualties. Site has been Bangkok\'s primary container port to present — diesel + bunker fuel emissions.',
    source: 'USSBS · Thai Marine Dept archive',
    severity: 'high',
  },
  {
    id: 'bkk-wwii-thonburi-yards',
    type: 'wwii-bombing',
    name: 'Thonburi Marshalling Yard',
    nameLocal: 'สถานีรถไฟธนบุรี',
    date: '1944-12-19',
    lat: 13.7263, lng: 100.4759,
    impactDescription: 'Companion strike to Bangkok Noi. Yards reorganised postwar but the locomotive workshop and adjacent factory district persist.',
    source: 'USSBS Pacific',
    severity: 'medium',
  },
  {
    id: 'bkk-wwii-samrong-tank-farm',
    type: 'wwii-bombing',
    name: 'Samrong Oil Tank Farm',
    nameLocal: 'คลังน้ำมันสำโรง',
    date: '1944-01-12',
    lat: 13.6537, lng: 100.5990,
    impactDescription: 'First Allied raid on Bangkok industrial target — oil storage at Samrong, just south of city limits. Multi-day fires. Area developed as petrochemical / industrial estate postwar, now Samut Prakan industrial belt.',
    source: 'RAF 222 Group ORBs',
    severity: 'high',
  },
  // ── Post-1945 industrial / environmental ────────────────────────────────
  {
    id: 'bkk-1991-klong-toey-warehouse-fire',
    type: 'industrial-fire',
    name: 'Klong Toey Warehouse Chemical Fire',
    nameLocal: 'เพลิงไหม้คลังเก็บสารเคมี คลองเตย',
    date: '1991-03-02',
    lat: 13.7110, lng: 100.5660,
    impactDescription: 'Customs warehouse fire released organochlorine pesticides + heavy metals into adjacent Klong Toey slum. Health impacts documented for 15+ years in surrounding population. Aerosol footprint visible in pre-2000 satellite archive.',
    source: 'Thai Pollution Control Dept',
    severity: 'high',
  },
  {
    id: 'bkk-2008-rojana-floods',
    type: 'flood-major',
    name: 'Great Flood 2011 — Eastern Bangkok',
    nameLocal: 'มหาอุทกภัย 2554',
    date: '2011-10-25',
    lat: 13.8200, lng: 100.6300,
    impactDescription: 'Cumulative monsoon + dam release flooded Don Mueang, Lat Krabang industrial estate, eastern outer districts. 815 dead nationally. Rebuilt with raised drainage — but the same low-elevation corridors still flood first.',
    source: 'GISTDA · UNESCAP',
    severity: 'high',
  },
  {
    id: 'bkk-2010-ratchaprasong',
    type: 'civil-unrest',
    name: 'Red Shirt Crackdown — Ratchaprasong',
    nameLocal: 'สลายการชุมนุมราชประสงค์',
    date: '2010-05-19',
    lat: 13.7461, lng: 100.5398,
    impactDescription: 'Final assault on Ratchaprasong protest camp. CentralWorld department store burned (largest single-building arson in Thai history). Smoke plume visible on MODIS satellite for 48h.',
    source: 'Truth & Reconciliation Commission Thailand',
    severity: 'high',
  },
]

/** Return events as a Mapbox-compatible FeatureCollection. */
export function bangkokHistoricalEventsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: BANGKOK_EVENTS.map((e): GeoJSON.Feature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id,
        type: e.type,
        name: e.name,
        nameLocal: e.nameLocal,
        date: e.date,
        impactDescription: e.impactDescription,
        source: e.source,
        severity: e.severity,
        // Categorical color
        color:
          e.type === 'wwii-bombing'      ? '#e53935' :  // red — heat events
          e.type === 'industrial-fire'   ? '#fb8c00' :  // orange — chemical
          e.type === 'chemical-spill'    ? '#fdd835' :  // yellow
          e.type === 'flood-major'       ? '#58a6ff' :  // blue
          e.type === 'civil-unrest'      ? '#c87a14' :  // amber — political
                                            '#888',
      },
    })),
  }
}

export const HISTORICAL_EVENT_COUNT = BANGKOK_EVENTS.length
