/**
 * Command Palette — Cmd+K / Ctrl+K / "/" to invoke.
 *
 * Searches across:
 *   - 50 Bangkok districts (Thai + English names) — clicking selects the district
 *   - All toggleable layers — clicking toggles
 *   - Mode switches (Sit Room ↔ Analyst)
 *
 * Keyboard:
 *   ↑ ↓        navigate
 *   Enter      activate
 *   Esc / blur dismiss
 *
 * Aesthetic: floating panel centered upper-third, amber accent, mono labels,
 * hairline border, no shadow, no rounding (§14).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { BANGKOK_LAYERS } from '../config/bangkok-layers'
import { useDistrictData, type DistrictSummary } from '../hooks/useDistrictData'
import type { CityConfig, BasemapId } from '../config/cities'
import { BASEMAP_GROUPS, getBasemapDef } from './MapView'

type Item =
  | { kind: 'layer';    id: string; label: string; sub: string; active: boolean }
  | { kind: 'district'; id: string; label: string; sub: string; payload: DistrictSummary }
  | { kind: 'mode';     id: string; label: string; sub: string }
  | { kind: 'city';     id: string; label: string; sub: string; city: CityConfig }
  | { kind: 'lens';     id: string; label: string; sub: string; basemap: BasemapId }
  | { kind: 'action';   id: string; label: string; sub: string; exec: () => void }

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  activeLayers: Set<string>
  onToggleLayer: (id: string) => void
  onSelectDistrict: (d: DistrictSummary) => void
  governorMode: boolean
  onSetGovernorMode: (v: boolean) => void
  // Extended
  allCities:       CityConfig[]
  activeCity:      CityConfig
  onSelectCity:    (c: CityConfig) => void
  basemap:         BasemapId
  onSetBasemap:    (b: BasemapId) => void
  globeView:       boolean
  onSetGlobeView:  (v: boolean) => void
  forecastOpen:    boolean
  onSetForecast:   (v: boolean) => void
  splitOpen:       boolean
  onSetSplit:      (v: boolean) => void
  chatOpen:        boolean
  onSetChat:       (v: boolean) => void
}

function fmtDistrictName(en: string): string {
  return en.replace(/([A-Z])/g, ' $1').trim()
}

function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true
  const h = haystack.toLowerCase()
  const q = query.toLowerCase().trim()
  return h.includes(q)
}

export function CommandPalette({
  open, onClose,
  activeLayers, onToggleLayer, onSelectDistrict,
  governorMode, onSetGovernorMode,
  allCities, activeCity, onSelectCity,
  basemap, onSetBasemap,
  globeView, onSetGlobeView,
  forecastOpen, onSetForecast,
  splitOpen, onSetSplit,
  chatOpen, onSetChat,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { districts } = useDistrictData()

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // Defer to next tick so the input has mounted
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Build the full item list — layers + districts + modes
  const allItems = useMemo<Item[]>(() => {
    const layerItems: Item[] = BANGKOK_LAYERS
      .filter((l) => l.status === 'live')
      .map((l) => ({
        kind: 'layer' as const,
        id: l.id,
        label: l.label,
        sub: activeLayers.has(l.id) ? 'ON · ' + l.source : 'OFF · ' + l.source,
        active: activeLayers.has(l.id),
      }))

    const districtItems: Item[] = districts.map((d) => ({
      kind: 'district' as const,
      id: d.name_th,
      label: fmtDistrictName(d.name_en).toUpperCase(),
      sub: `${d.name_th} · ${d.complaint_count} ISSUES · ${d.risk_level.toUpperCase()}`,
      payload: d,
    }))

    const modeItems: Item[] = [
      { kind: 'mode' as const, id: governorMode ? 'analyst' : 'governor', label: governorMode ? 'SWITCH TO ANALYST' : 'SWITCH TO SIT ROOM', sub: 'MODE' },
    ]

    // City items
    const cityItems: Item[] = allCities.map((c) => ({
      kind: 'city' as const,
      id: c.id,
      label: c.name.toUpperCase(),
      sub: `${c.hudClockLabel} · ${c.countryName}${c.id === activeCity.id ? ' · ACTIVE' : ''}`,
      city: c,
    }))

    // Lens / basemap items
    const lensItems: Item[] = BASEMAP_GROUPS.flatMap((g) =>
      g.ids.map((id) => {
        const def = getBasemapDef(id)
        return {
          kind: 'lens' as const,
          id,
          label: def.label.toUpperCase(),
          sub: `LENS · ${g.label.toUpperCase()}${id === basemap ? ' · ACTIVE' : ''}`,
          basemap: id,
        }
      }),
    )

    // Global action items
    const actionItems: Item[] = [
      { kind: 'action' as const, id: 'globe',    label: globeView    ? 'EXIT GLOBE VIEW'    : 'ENTER GLOBE VIEW',    sub: 'VIEW · G',   exec: () => onSetGlobeView(!globeView)    },
      { kind: 'action' as const, id: 'forecast', label: forecastOpen ? 'CLOSE FORECAST'     : 'OPEN FORECAST',      sub: 'PANEL · F',  exec: () => onSetForecast(!forecastOpen)  },
      { kind: 'action' as const, id: 'split',    label: splitOpen    ? 'CLOSE SPLIT VIEW'   : 'OPEN SPLIT COMPARE', sub: 'PANEL · S',  exec: () => onSetSplit(!splitOpen)        },
      { kind: 'action' as const, id: 'chat',     label: chatOpen     ? 'CLOSE CITY CHAT'    : 'OPEN CITY CHAT',     sub: 'PANEL · A',  exec: () => onSetChat(!chatOpen)          },
    ]

    return [...modeItems, ...cityItems, ...actionItems, ...lensItems, ...layerItems, ...districtItems]
  }, [activeLayers, districts, governorMode])

  // Filter by query — district items match either Thai or English
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 40)
    return allItems.filter((it) => {
      const hay = it.kind === 'district'
        ? `${it.label} ${it.payload.name_th} ${it.payload.name_en}`
        : `${it.label} ${it.sub}`
      return matchesQuery(hay, query)
    }).slice(0, 40)
  }, [allItems, query])

  // Clamp cursor when filtered list changes
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Global keyboard shortcut — Cmd+K / Ctrl+K / "/"
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Open
      if (!open && ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        ;(window as unknown as { __openCmdK?: () => void }).__openCmdK?.()
        return
      }
      if (!open) return
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(filtered.length - 1, c + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(0, c - 1))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const it = filtered[cursor]
        if (it) activate(it)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, cursor])

  function activate(it: Item) {
    if (it.kind === 'layer')    { onToggleLayer(it.id) }
    else if (it.kind === 'district') { onSelectDistrict(it.payload) }
    else if (it.kind === 'mode')     { onSetGovernorMode(!governorMode) }
    else if (it.kind === 'city')     { onSelectCity(it.city) }
    else if (it.kind === 'lens')     { onSetBasemap(it.basemap) }
    else if (it.kind === 'action')   { it.exec() }
    onClose()
  }

  if (!open) return null
  return (
    <>
      <div className="cmdk-backdrop" onClick={onClose} />
      <div className="cmdk-panel" role="dialog" aria-label="Command Palette">
        <div className="cmdk-search">
          <span className="cmdk-prompt">›</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="CITIES · LENSES · LAYERS · DISTRICTS · ACTIONS…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="cmdk-hint">ESC</span>
        </div>
        <div className="cmdk-results">
          {filtered.length === 0 && (
            <div className="cmdk-empty">NO MATCH</div>
          )}
          {filtered.map((it, i) => (
            <button
              key={`${it.kind}-${it.id}`}
              className={`cmdk-row ${i === cursor ? 'active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => activate(it)}
            >
              <span className={`cmdk-kind cmdk-kind-${it.kind}`}>
                {it.kind === 'layer'    ? 'LYR'
                : it.kind === 'district' ? 'DST'
                : it.kind === 'city'     ? 'CTY'
                : it.kind === 'lens'     ? 'LNS'
                : it.kind === 'action'   ? 'ACT'
                : 'MOD'}
              </span>
              <span className="cmdk-label">{it.label}</span>
              <span className="cmdk-sub">{it.sub}</span>
            </button>
          ))}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ NAV</span>
          <span>↵ ACTIVATE</span>
          <span>ESC DISMISS</span>
        </div>
      </div>
    </>
  )
}
