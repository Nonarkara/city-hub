/**
 * Intel drawer — live frame math, an open-web dossier, and a peer comparison.
 *
 * The bar itself stays one line tall so the map stays usable. Numbers on the
 * bar update while the camera moves. Wikipedia places and crosshair air update
 * once the camera settles. The panel above the bar is opt-in.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { CityConfig } from '../config/cities'
import { cityRegion } from '../config/cities'
import { useCityStore } from '../store/cityStore'
import {
  frameFromBounds,
  fmtGsd,
  fmtKm2,
  fmtPeople,
  fmtSpanKm,
  wikiRadiusMeters,
  type FrameStats,
} from '../lib/viewport-math'
import { fetchAQI, type CityAQI } from '../data/openmeteo-aq'
import { fetchWeather } from '../data/openmeteo'
import { fetchCityNews } from '../data/gdelt'
import { fetchCityDossier, fetchWikiNearby, type CityDossier, type WikiPlace } from '../data/osint'
import { cachedFetch } from '../lib/cached-fetch'

type Tab = 'frame' | 'dossier' | 'study'

interface Props {
  map: MapLibreMap | null
  activeCity: CityConfig
  allCities: CityConfig[]
  open: boolean
  onToggle: () => void
}

interface StudyRow {
  city: CityConfig
  aqi: number | null
  temp: number | null
  tone: number | null
  density: number
}

type SortKey = 'name' | 'aqi' | 'temp' | 'tone' | 'density'

function studySet(active: CityConfig, all: CityConfig[], compareSet: string[]): { cities: CityConfig[]; pinned: boolean } {
  const byId = new Map(all.map((c) => [c.id, c]))
  if (compareSet.length >= 1) {
    const pinned = compareSet.map((id) => byId.get(id)).filter((c): c is CityConfig => !!c)
    const withActive = pinned.some((c) => c.id === active.id) ? pinned : [active, ...pinned]
    return { cities: withActive.slice(0, 8), pinned: true }
  }
  const region = cityRegion(active)
  const regional = all.filter((c) => cityRegion(c) === region && c.id !== active.id)
  const ordered = [active, ...regional]
  if (ordered.length >= 3) return { cities: ordered.slice(0, 8), pinned: false }
  const anchors = ['bangkok', 'singapore', 'kranj', 'ljubljana', 'warsaw', 'prague', 'budapest', 'tallinn']
  for (const id of anchors) {
    if (ordered.length >= 6) break
    const c = byId.get(id)
    if (c && !ordered.some((x) => x.id === c.id)) ordered.push(c)
  }
  return { cities: ordered, pinned: false }
}

function aqiColor(aqi: number | null): string {
  if (aqi === null) return 'rgba(245,245,240,0.45)'
  if (aqi <= 50) return '#8bc34a'
  if (aqi <= 100) return '#fdd835'
  if (aqi <= 150) return '#fb8c00'
  return '#e53935'
}

function toneColor(tone: number | null): string {
  if (tone === null) return 'rgba(245,245,240,0.45)'
  if (tone <= -3) return '#fb8c00'
  if (tone >= 3) return '#8bc34a'
  return 'rgba(245,245,240,0.75)'
}

function studyFinding(rows: StudyRow[]): string {
  const withAqi = rows.filter((r) => r.aqi !== null)
  const parts: string[] = []
  if (withAqi.length >= 2) {
    const worst = [...withAqi].sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0))[0]
    const best = [...withAqi].sort((a, b) => (a.aqi ?? 0) - (b.aqi ?? 0))[0]
    if (worst.city.id !== best.city.id) {
      parts.push(`${worst.city.name} has the dirtiest air in this set (AQI ${worst.aqi}); ${best.city.name} the cleanest (${best.aqi}).`)
    }
  }
  const withTone = rows.filter((r) => r.tone !== null)
  if (withTone.length >= 2) {
    const sourest = [...withTone].sort((a, b) => (a.tone ?? 0) - (b.tone ?? 0))[0]
    if ((sourest.tone ?? 0) < -2) {
      parts.push(`Sour news tone sits on ${sourest.city.name} (${sourest.tone!.toFixed(1)}).`)
    }
  }
  return parts.join(' ')
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}

export function IntelDrawer({ map, activeCity, allCities, open, onToggle }: Props) {
  const compareSet = useCityStore((s) => s.compareSet)
  const setActiveCity = useCityStore((s) => s.setActiveCity)

  const [tab, setTab] = useState<Tab>('frame')
  const [frame, setFrame] = useState<FrameStats | null>(null)
  const [places, setPlaces] = useState<WikiPlace[]>([])
  const [radiusM, setRadiusM] = useState(1000)
  const [aqi, setAqi] = useState<CityAQI | null>(null)
  const [settling, setSettling] = useState(false)

  const [dossier, setDossier] = useState<CityDossier | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierError, setDossierError] = useState(false)

  const [rows, setRows] = useState<StudyRow[]>([])
  const [studyLoading, setStudyLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('aqi')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const peers = useMemo(
    () => studySet(activeCity, allCities, compareSet),
    [activeCity, allCities, compareSet],
  )

  // ── Local frame math, every camera move ──────────────────────────────────
  useEffect(() => {
    if (!map) return
    let raf = 0
    const publish = () => {
      let b
      try { b = map.getBounds() } catch { return }
      const c = map.getCenter()
      const next = frameFromBounds(
        b.getWest(), b.getSouth(), b.getEast(), b.getNorth(),
        map.getZoom(), map.getBearing(), c.lng, c.lat, activeCity,
      )
      setFrame((prev) => {
        if (!prev) return next
        const same =
          Math.abs(prev.areaKm2 - next.areaKm2) < Math.max(0.05, prev.areaKm2 * 0.01) &&
          Math.abs(prev.metersPerPixel - next.metersPerPixel) < 0.05 &&
          prev.peopleEst === next.peopleEst &&
          Math.abs(prev.lng - next.lng) < 0.0008 &&
          Math.abs(prev.lat - next.lat) < 0.0008
        return same ? prev : next
      })
    }
    const onMove = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; publish() })
    }
    publish()
    map.on('move', onMove)
    return () => {
      map.off('move', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [map, activeCity])

  // ── Network settle: nearby articles + air at the crosshair ───────────────
  useEffect(() => {
    if (!map) return
    let timer = 0
    let seq = 0
    const last = { lng: Number.NaN, lat: Number.NaN, zoom: Number.NaN }

    const settle = () => {
      window.clearTimeout(timer)
      setSettling(true)
      timer = window.setTimeout(async () => {
        const id = ++seq
        let b
        try { b = map.getBounds() } catch { setSettling(false); return }
        const c = map.getCenter()
        const zoom = map.getZoom()
        const first = !Number.isFinite(last.lng)
        const moved = first
          || Math.hypot(c.lng - last.lng, c.lat - last.lat) > 0.008
          || Math.abs(zoom - last.zoom) > 0.7
        if (!moved) { setSettling(false); return }
        last.lng = c.lng
        last.lat = c.lat
        last.zoom = zoom

        const box = frameFromBounds(
          b.getWest(), b.getSouth(), b.getEast(), b.getNorth(),
          zoom, map.getBearing(), c.lng, c.lat, activeCity,
        )
        const radius = wikiRadiusMeters(box.widthKm, box.heightKm)
        const [near, air] = await Promise.allSettled([
          box.wide ? Promise.resolve([] as WikiPlace[]) : fetchWikiNearby(c.lat, c.lng, radius),
          fetchAQI(c.lng, c.lat, activeCity.timezone),
        ])
        if (id !== seq) return
        if (near.status === 'fulfilled') {
          setPlaces(near.value)
          setRadiusM(radius)
        }
        if (air.status === 'fulfilled') setAqi(air.value)
        setSettling(false)
      }, 650)
    }

    settle()
    map.on('moveend', settle)
    return () => {
      map.off('moveend', settle)
      window.clearTimeout(timer)
      seq += 1
    }
  }, [map, activeCity])

  // ── Dossier, only once the tab is open ────────────────────────────────────
  useEffect(() => {
    if (!open || tab !== 'dossier') return
    let cancel = false
    setDossier(null)
    setDossierLoading(true)
    setDossierError(false)
    fetchCityDossier(activeCity)
      .then((d) => { if (!cancel) setDossier(d) })
      .catch(() => { if (!cancel) setDossierError(true) })
      .finally(() => { if (!cancel) setDossierLoading(false) })
    return () => { cancel = true }
  }, [open, tab, activeCity])

  // ── Peer study, only once the tab is open ─────────────────────────────────
  useEffect(() => {
    if (!open || tab !== 'study') return
    let cancel = false
    setRows([])
    setStudyLoading(true)
    const cities = peers.cities
    Promise.all(cities.map(async (city): Promise<StudyRow> => {
      const [lng, lat] = city.center
      const density = city.area_km2 > 0 ? Math.round((city.populationMillions * 1_000_000) / city.area_km2) : 0
      const [air, wx, news] = await Promise.allSettled([
        cachedFetch(`study/aqi/${city.id}`, () => fetchAQI(lng, lat, city.timezone), 10 * 60_000),
        cachedFetch(`study/wx/${city.id}`, () => fetchWeather(lng, lat, city.timezone), 10 * 60_000),
        cachedFetch(`study/news/${city.id}`, () => fetchCityNews(city.gdeltQuery, 8), 10 * 60_000),
      ])
      return {
        city,
        aqi: air.status === 'fulfilled' ? air.value.usAqi : null,
        temp: wx.status === 'fulfilled' ? wx.value.temp : null,
        tone: news.status === 'fulfilled' ? news.value.avgTone : null,
        density,
      }
    })).then((next) => {
      if (!cancel) { setRows(next); setStudyLoading(false) }
    })
    return () => { cancel = true }
  }, [open, tab, peers])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') return a.city.name.localeCompare(b.city.name) * dir
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return (av - bv) * dir
    })
    return copy
  }, [rows, sortKey, sortDir])

  const finding = useMemo(() => studyFinding(rows), [rows])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const nearest = places[0]
  const barPeople = frame?.wide ? 'WIDE' : fmtPeople(frame?.peopleEst ?? null)

  return (
    <div className={`intel-dock ${open ? 'intel-dock--open' : ''}`}>
      {open && (
        <section className="intel-panel" aria-label="City intelligence">
          <div className="intel-tabs" role="tablist">
            {([
              ['frame', 'Frame'],
              ['dossier', 'Dossier'],
              ['study', 'Study'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`intel-tab ${tab === id ? 'intel-tab--on' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'frame' && frame && (
            <div className="intel-body" role="tabpanel">
              <div className="intel-grid">
                <Stat k="Frame" v={frame.wide ? 'wide' : fmtKm2(frame.areaKm2)} />
                <Stat k="Span" v={frame.wide ? '—' : `${fmtSpanKm(frame.widthKm)} × ${fmtSpanKm(frame.heightKm)} km`} />
                <Stat k="Ground" v={fmtGsd(frame.metersPerPixel)} />
                <Stat k="Residents" v={frame.wide ? '—' : fmtPeople(frame.peopleEst)} />
                <Stat k="In city box" v={frame.wide ? '—' : fmtKm2(frame.overlapKm2)} />
                <Stat k="Bearing" v={`${Math.round(((frame.bearing % 360) + 360) % 360)}°`} />
                <Stat k="Crosshair AQI" v={aqi ? String(aqi.usAqi) : settling ? '…' : '—'} accent={aqiColor(aqi?.usAqi ?? null)} />
                <Stat k="PM2.5" v={aqi ? `${aqi.pm25}` : '—'} />
              </div>
              <p className="intel-note">
                Residents are {activeCity.name}’s average density
                {' '}({activeCity.area_km2 > 0 ? Math.round((activeCity.populationMillions * 1e6) / activeCity.area_km2).toLocaleString('en-US') : '—'} / km²)
                applied only where the frame overlaps the city box. Parks and towers are not separated.
              </p>
              <div className="intel-subhead">Wikipedia within {(radiusM / 1000).toFixed(radiusM >= 1000 ? 0 : 1)} km of the crosshair</div>
              {places.length === 0 ? (
                <p className="intel-note">{settling ? 'Looking…' : frame.wide ? 'Zoom in — the frame is too wide for a nearby search.' : 'Nothing tagged nearby.'}</p>
              ) : (
                <ul className="intel-places">
                  {places.map((p) => (
                    <li key={p.title}>
                      <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`} target="_blank" rel="noopener noreferrer">
                        {p.title}
                      </a>
                      <span>{fmtDist(p.distM)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'dossier' && (
            <div className="intel-body" role="tabpanel">
              {dossierLoading && !dossier && <p className="intel-note">Reading Wikipedia and GDELT for {activeCity.name}…</p>}
              {dossierError && <p className="intel-note">The open-web read failed. Try again in a moment.</p>}
              {dossier && (
                <>
                  <p className="intel-lead">{dossier.lead}</p>
                  {dossier.wiki && (
                    <div className="intel-wiki">
                      {dossier.wiki.thumbnail && (
                        <img src={dossier.wiki.thumbnail} alt="" className="intel-thumb" />
                      )}
                      <div>
                        <div className="intel-wiki-title">{dossier.wiki.title}</div>
                        <p className="intel-extract">{dossier.wiki.extract}</p>
                        <a className="intel-link" href={dossier.wiki.url} target="_blank" rel="noopener noreferrer">Wikipedia</a>
                      </div>
                    </div>
                  )}
                  {dossier.themes.length > 0 && (
                    <div className="intel-chips">
                      {dossier.themes.map((t) => (
                        <span key={t.id} className="intel-chip">{t.label} {t.count}</span>
                      ))}
                    </div>
                  )}
                  {dossier.domains.length > 0 && (
                    <p className="intel-note">
                      Outlets: {dossier.domains.map((d) => `${d.domain} ${d.count}`).join(' · ')}
                      {dossier.languages.length > 0 && ` · Languages: ${dossier.languages.map((l) => `${l.language} ${l.count}`).join(' · ')}`}
                    </p>
                  )}
                  <ul className="intel-heads">
                    {dossier.articles.map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: toneColor(a.tone) }}>{a.title}</a>
                        <span>{a.domain} · {a.tone > 0 ? '+' : ''}{a.tone.toFixed(0)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="intel-note">Themes are keyword hits on headlines, not a poll. Tone is GDELT’s, from −100 to +100.</p>
                </>
              )}
            </div>
          )}

          {tab === 'study' && (
            <div className="intel-body" role="tabpanel">
              <p className="intel-note">
                {peers.pinned
                  ? 'Pinned cities from the picker, plus the city you are on.'
                  : `${cityRegion(activeCity)} peers. Pin cities in the picker to build your own set.`}
                {studyLoading ? ' Pulling live air, weather, and news tone…' : ''}
              </p>
              {finding && <p className="intel-lead">{finding}</p>}
              <div className="intel-table-wrap">
                <table className="intel-table">
                  <thead>
                    <tr>
                      <Th label="City" k="name" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <Th label="AQI" k="aqi" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <Th label="°C" k="temp" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <Th label="Tone" k="tone" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                      <Th label="/km²" k="density" sortKey={sortKey} dir={sortDir} onSort={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => {
                      const on = r.city.id === activeCity.id
                      return (
                        <tr key={r.city.id} className={on ? 'intel-row--on' : ''}>
                          <td>
                            <button type="button" className="intel-city" onClick={() => setActiveCity(r.city)}>
                              {r.city.name}
                            </button>
                          </td>
                          <td style={{ color: aqiColor(r.aqi) }}>{r.aqi ?? '—'}</td>
                          <td>{r.temp ?? '—'}</td>
                          <td style={{ color: toneColor(r.tone) }}>{r.tone === null ? '—' : `${r.tone > 0 ? '+' : ''}${r.tone.toFixed(1)}`}</td>
                          <td>{r.density ? r.density.toLocaleString('en-US') : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="intel-note">Density is registry population ÷ city area, not a live count. Click a name to fly there.</p>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        className="intel-bar"
        onClick={onToggle}
        aria-expanded={open}
        title="Live frame math, open-web dossier, city comparison"
      >
        <span className="intel-bar-k">FRAME</span>
        <span>{frame ? (frame.wide ? 'WIDE' : fmtKm2(frame.areaKm2)) : '—'}</span>
        <span className="intel-bar-dim">{barPeople}</span>
        <span>{frame ? fmtGsd(frame.metersPerPixel) : '—'}</span>
        {aqi && <span style={{ color: aqiColor(aqi.usAqi) }}>AQI {aqi.usAqi}</span>}
        {nearest && <span className="intel-bar-place">{nearest.title}</span>}
        {settling && !nearest && <span className="intel-bar-dim">settling</span>}
        <span className="intel-bar-chev" aria-hidden>{open ? '▾' : '▴'}</span>
      </button>
    </div>
  )
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="intel-stat">
      <div className="intel-stat-k">{k}</div>
      <div className="intel-stat-v" style={accent ? { color: accent } : undefined}>{v}</div>
    </div>
  )
}

function Th({ label, k, sortKey, dir, onSort }: {
  label: string
  k: SortKey
  sortKey: SortKey
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const on = sortKey === k
  return (
    <th>
      <button type="button" className={`intel-th ${on ? 'intel-th--on' : ''}`} onClick={() => onSort(k)}>
        {label}{on ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )
}
