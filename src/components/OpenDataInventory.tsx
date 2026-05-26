/**
 * OpenDataInventory — per-city catalog of open-data sources.
 *
 * Shows the user how much is already public when someone bothers to
 * integrate it. For each city, lists the local-language government open
 * data portals + which are currently active in this dashboard.
 *
 * This is the answer to: "Show me deep open data, in all languages, from
 * each city's own portal."
 */
import type { CityConfig } from '../config/cities'

interface DataSource {
  name: string
  org: string
  url: string
  language: string
  status: 'active' | 'available' | 'discovery'
  notes?: string
}

const CITY_SOURCES: Record<string, DataSource[]> = {
  bangkok: [
    { name: 'GISTDA',         org: 'Geo-Informatics & Space Tech Agency',  url: 'https://www.gistda.or.th',         language: 'EN/TH', status: 'active',     notes: 'PM2.5, floods, fires, AQI stations' },
    { name: 'Air4Thai',       org: 'Pollution Control Department',          url: 'http://air4thai.pcd.go.th/webV3',  language: 'EN/TH', status: 'active',     notes: 'PCD official AQ network' },
    { name: 'Traffy Fondue',  org: 'NECTEC',                                url: 'https://www.traffy.in.th',         language: 'TH',    status: 'active',     notes: '1.3M+ citizen reports' },
    { name: 'BMA Open Data',  org: 'Bangkok Metropolitan Admin',            url: 'https://data.bangkok.go.th',       language: 'TH',    status: 'active',     notes: '1,431 datasets' },
    { name: 'TMD',            org: 'Thai Meteorological Department',        url: 'https://www.tmd.go.th',            language: 'EN/TH', status: 'active',     notes: '7-day forecast, earthquakes' },
    { name: 'Thaiwater',      org: 'Hydro-Informatics Institute',           url: 'https://www.thaiwater.net',        language: 'EN/TH', status: 'active',     notes: 'Canal water quality + levels' },
    { name: 'data.go.th',     org: 'Digital Government Development Agency', url: 'https://data.go.th',               language: 'EN/TH', status: 'active',     notes: 'National open-data portal' },
    { name: 'DEQP',           org: 'Department of Environmental Quality',   url: 'https://www.deqp.go.th',           language: 'TH',    status: 'available',  notes: 'Burning-season alerts (seasonal)' },
  ],
  'chiang-mai': [
    { name: 'CMU CCDC',       org: 'Chiang Mai Univ. Climate Change Centre', url: 'https://cmuccdc.org',             language: 'EN/TH', status: 'available',  notes: 'Local AQ network, burning-season research' },
    { name: 'GISTDA',         org: 'GISTDA',                                url: 'https://www.gistda.or.th',         language: 'EN/TH', status: 'active',     notes: 'Same Thailand-wide coverage as Bangkok' },
    { name: 'Air4Thai',       org: 'PCD',                                   url: 'http://air4thai.pcd.go.th',        language: 'EN/TH', status: 'available',  notes: 'PCD station #36 in Chiang Mai' },
    { name: 'TMD',            org: 'Thai Meteorological Department',        url: 'https://www.tmd.go.th',            language: 'EN/TH', status: 'available',  notes: 'Chiang Mai 7-day forecast endpoint' },
    { name: 'Traffy Fondue',  org: 'NECTEC',                                url: 'https://www.traffy.in.th',         language: 'TH',    status: 'available',  notes: 'Citizen platform — Chiang Mai municipal coverage' },
    { name: 'DEQP',           org: 'Dept of Environmental Quality',         url: 'https://www.deqp.go.th',           language: 'TH',    status: 'available',  notes: 'Northern burning-season hotspot alerts' },
  ],
  phuket: [
    { name: 'GISTDA',         org: 'GISTDA',                                url: 'https://www.gistda.or.th',         language: 'EN/TH', status: 'active',     notes: 'Thailand-wide coverage' },
    { name: 'Air4Thai',       org: 'PCD',                                   url: 'http://air4thai.pcd.go.th',        language: 'EN/TH', status: 'available',  notes: 'PCD station #29 in Phuket' },
    { name: 'PPAO',           org: 'Phuket Provincial Admin Office',        url: 'http://www.phuketcity.info',       language: 'TH',    status: 'discovery',  notes: 'Municipal portal — limited public API' },
    { name: 'TAT Statistics', org: 'Tourism Authority of Thailand',         url: 'https://intelligencecenter.tat.or.th', language: 'EN/TH', status: 'discovery', notes: '9.9M visitor arrivals — quarterly published' },
    { name: 'Marine Traffic', org: 'marinetraffic.com',                     url: 'https://www.marinetraffic.com',    language: 'EN',    status: 'discovery',  notes: 'Vessel positions — Phuket port, Phang-Nga Bay' },
  ],
  singapore: [
    { name: 'data.gov.sg',    org: 'Government Technology Agency',          url: 'https://data.gov.sg',              language: 'EN',    status: 'active',     notes: 'PSI air, rainfall, UV, taxi — no key, CORS-friendly' },
    { name: 'NEA',            org: 'National Environment Agency',           url: 'https://www.nea.gov.sg',           language: 'EN',    status: 'active',     notes: 'PSI 24h regional via data.gov.sg' },
    { name: 'LTA DataMall',   org: 'Land Transport Authority',              url: 'https://datamall.lta.gov.sg',      language: 'EN',    status: 'discovery',  notes: 'MRT, bus, taxi, traffic — requires DataMall account' },
    { name: 'URA',            org: 'Urban Redevelopment Authority',         url: 'https://www.ura.gov.sg/maps',      language: 'EN',    status: 'discovery',  notes: 'Planning zones, master plan, parking' },
    { name: 'OneMap',         org: 'Singapore Land Authority',              url: 'https://www.onemap.gov.sg',        language: 'EN',    status: 'discovery',  notes: 'Authoritative basemap, postal codes, transport' },
    { name: 'PUB Floods',     org: 'Public Utilities Board',                url: 'https://www.pub.gov.sg',           language: 'EN',    status: 'discovery',  notes: 'Real-time flood alerts during heavy rain' },
  ],
  kuching: [
    { name: 'Sarawak DataKu',     org: 'Sarawak State Open Data',               url: 'https://data.sarawak.gov.my',       language: 'EN/MS', status: 'discovery',  notes: 'State-level open data — Kuching geography, demographics' },
    { name: 'DOSM',               org: 'Department of Statistics Malaysia',     url: 'https://www.dosm.gov.my',           language: 'EN/MS', status: 'discovery',  notes: 'National statistical office — Kuching district indicators' },
    { name: 'JUPEM',              org: 'Dept. of Survey & Mapping Malaysia',    url: 'https://www.jupem.gov.my',          language: 'EN/MS', status: 'discovery',  notes: 'Authoritative mapping — Sarawak parcels' },
    { name: 'Kuching City Hall',  org: 'Dewan Bandaraya Kuching Utara/Selatan', url: 'https://www.dbku.gov.my',           language: 'EN/MS', status: 'discovery',  notes: 'Municipal services — civic complaints, waste schedule' },
    { name: 'NASA FIRMS',         org: 'NASA',                                  url: 'https://firms.modaps.eosdis.nasa.gov', language: 'EN', status: 'active',     notes: 'Critical for Borneo fires & haze season' },
    { name: 'Open-Meteo',         org: 'Open-Meteo',                            url: 'https://open-meteo.com',            language: 'EN',    status: 'active',     notes: 'Global weather + AQI, 10k req/day free' },
  ],
}

interface Props {
  activeCity: CityConfig
}

const STATUS_COLOR: Record<string, string> = {
  active:    '#8bc34a',   // green
  available: '#fb8c00',   // orange
  discovery: '#fdd835',   // yellow
}

const STATUS_LABEL: Record<string, string> = {
  active:    'LIVE',
  available: 'READY',
  discovery: 'KNOWN',
}

export function OpenDataInventory({ activeCity }: Props) {
  const sources = CITY_SOURCES[activeCity.id] ?? []
  if (sources.length === 0) return null

  const activeCount = sources.filter((s) => s.status === 'active').length

  return (
    <div className="odi-section">
      <div className="odi-header">
        <span className="odi-title">OPEN DATA · {activeCity.country}</span>
        <span className="odi-count">{activeCount}/{sources.length} LIVE</span>
      </div>

      <p className="odi-intro">
        Every source below is a public government or academic open-data portal.
        Nothing here requires a platform contract.
      </p>

      <ul className="odi-list">
        {sources.map((s) => (
          <li key={s.name} className="odi-row">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="odi-link" title={s.notes}>
              <span
                className="odi-status"
                style={{ color: STATUS_COLOR[s.status], borderColor: STATUS_COLOR[s.status] }}
              >
                {STATUS_LABEL[s.status]}
              </span>
              <span className="odi-name-block">
                <span className="odi-name">{s.name}</span>
                <span className="odi-org">{s.org}</span>
              </span>
              <span className="odi-lang">{s.language}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
