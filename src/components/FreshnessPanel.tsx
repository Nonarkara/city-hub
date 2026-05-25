/**
 * Live Data Freshness panel — fixed widget showing every data feed and the
 * age of its last successful fetch. Color-coded by staleness:
 *
 *   < 2min  → green (live)
 *   < 10min → amber (recent)
 *   < 30min → orange (stale)
 *   ≥ 30min → red (cold)
 *
 * The widget is collapsible — click the header to expand. Default: collapsed
 * to a single pulsing dot + "FEEDS · N/N" line so it doesn't compete with
 * the map. Expanded: every source listed with its age.
 *
 * Data plumbing: the cached-fetch layer already tracks fetch timestamps per
 * key. We expose `getFetchAge(key)` from cached-fetch and poll every 5 s.
 */
import { useEffect, useState } from 'react'
import { getFetchAge } from '../lib/cached-fetch'

interface FeedDescriptor {
  key: string       // cached-fetch key
  label: string     // display label
  source: string    // upstream system
}

// Order matters — most-important feeds first
const FEEDS: FeedDescriptor[] = [
  { key: 'gistda/pm25-bkk-live',          label: 'PM2.5 LIVE',      source: 'GISTDA'      },
  { key: 'gistda/aqi-stations-bkk',       label: 'AQI STATIONS',    source: 'GISTDA'      },
  { key: 'gistda/floods-central',         label: 'FLOODS LIVE',     source: 'GISTDA'      },
  { key: 'gistda/pm25-province-rank-bkk', label: 'PROVINCIAL RANK', source: 'GISTDA'      },
  { key: 'gistda/fires-th-24h',           label: 'FIRES · GISTDA',  source: 'GISTDA'      },
  { key: 'openmeteo/bkk-aqi',             label: 'AIR QUALITY',     source: 'Open-Meteo'  },
  { key: 'openmeteo/bkk-aqi-forecast',    label: 'AQI FORECAST',    source: 'Open-Meteo'  },
  { key: 'openmeteo/bkk-weather',         label: 'WEATHER',         source: 'Open-Meteo'  },
  { key: 'traffy/geojson',                label: 'CIVIC ISSUES',    source: 'Traffy'      },
  { key: 'traffy/floods',                 label: 'FLOOD REPORTS',   source: 'Traffy'      },
  { key: 'nasa/firms-th-24h',             label: 'FIRES · FIRMS',   source: 'NASA'        },
  { key: 'gdelt/bkk-news',                label: 'NEWS PULSE',      source: 'GDELT'       },
  { key: 'datago/bkk',                    label: 'OPEN DATASETS',   source: 'data.go.th'  },
  { key: 'bma/khet',                      label: 'DISTRICTS GEO',   source: 'BMA'         },
]

function ageColor(ms: number | null): string {
  if (ms === null) return '#666'
  if (ms < 2 * 60_000)  return '#8bc34a'
  if (ms < 10 * 60_000) return '#fdd835'
  if (ms < 30 * 60_000) return '#fb8c00'
  return '#e53935'
}

function fmtAge(ms: number | null): string {
  if (ms === null) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}

export function FreshnessPanel() {
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)

  // Re-render every 5s so ages update
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000)
    return () => clearInterval(t)
  }, [])

  // Compute per-feed ages
  const ages = FEEDS.map((f) => ({ ...f, ageMs: getFetchAge(f.key) }))
  const live = ages.filter((f) => f.ageMs !== null && f.ageMs < 10 * 60_000).length
  const total = ages.filter((f) => f.ageMs !== null).length
  const summaryColor = live === total && total > 0 ? '#8bc34a' :
                       live > 0 ? '#fdd835' : '#666'

  // Suppress unused-tick warning — tick is the re-render trigger
  void tick

  return (
    <div className={`freshness-panel ${open ? 'open' : ''}`}>
      <button className="freshness-header" onClick={() => setOpen((v) => !v)}>
        <span className="freshness-dot" style={{ background: summaryColor }} />
        <span className="freshness-summary">
          FEEDS · {live.toString().padStart(2, '0')}/{ages.length.toString().padStart(2, '0')}
        </span>
        <span className="freshness-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="freshness-list">
          {ages.map((f) => (
            <div key={f.key} className="freshness-row">
              <span className="freshness-row-dot" style={{ background: ageColor(f.ageMs) }} />
              <span className="freshness-row-label">{f.label}</span>
              <span className="freshness-row-src">{f.source}</span>
              <span className="freshness-row-age" style={{ color: ageColor(f.ageMs) }}>
                {fmtAge(f.ageMs)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
