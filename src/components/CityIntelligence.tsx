/**
 * CityIntelligence — registry-driven dispatcher for per-city digital twins.
 *
 * Pattern: each city can declare `hasDigitalTwin: true` on its config. This
 * component reads `activeCity.id` and returns the matching `*Intelligence`
 * twin brief (BangkokIntelligence · KranjIntelligence · …). Cities without
 * a twin return null — the calling surface (LiteCityPanel · AlertPanel)
 * simply skips the section.
 *
 * Why a dispatcher instead of inlining the conditional:
 *   - One place to add a new city twin (drop a case below + a `hasDigitalTwin`
 *     flag in cities.ts). No more scattered `if (activeCity.id === 'kranj')`
 *     blocks in the right-side panel.
 *   - Single import line in the call sites.
 *   - The topbar TWIN button reads the same source of truth to decide whether
 *     to render.
 *
 * AXIOM DNA: this is the structural-intelligence layer — economic, civic,
 * digital — that sensors and news cannot cover. It earns the first slot
 * in the alert panel above the live brief.
 */
import { memo } from 'react'
import type { CityConfig } from '../config/cities'
import { BangkokIntelligence } from './BangkokIntelligence'
import { KranjIntelligence } from './KranjIntelligence'

interface Props {
  activeCity: CityConfig
}

/** Cities that have a digital twin brief shipped. The dispatcher below must
 *  list every id present here, otherwise the twin is silently dropped. */
const TWIN_REGISTRY: Record<string, 'bangkok' | 'kranj'> = {
  bangkok: 'bangkok',
  kranj:   'kranj',
}

export const CityIntelligence = memo(function CityIntelligence({ activeCity }: Props) {
  const twin = TWIN_REGISTRY[activeCity.id]
  if (!twin) return null

  switch (twin) {
    case 'bangkok': return <BangkokIntelligence />
    case 'kranj':   return <KranjIntelligence activeCity={activeCity} />
    default:        return null
  }
})

/** Single source of truth: which cities have a twin shipped. Use this for
 *  the city-picker "TWIN" badge and the topbar "TWIN" button enable-state. */
export function cityHasTwin(id: string): boolean {
  return id in TWIN_REGISTRY
}

/** Stable list of twin city IDs — used by the city picker to surface the
 *  TWIN filter / group, and by the "DIGITAL TWIN" filter chip. */
export const TWIN_CITY_IDS: string[] = Object.keys(TWIN_REGISTRY)
