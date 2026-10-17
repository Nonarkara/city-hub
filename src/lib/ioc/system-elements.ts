/**
 * IoC 2.0 — projecting city systems onto Lynch's elements.
 *
 * The city model in `src/lib/city-model.ts` says a system is over capacity. The
 * city image in `src/data/city-image.ts` says where the city's structure is. This
 * module is where they meet: it takes a measured pressure and names the city
 * elements that system physically acts through.
 *
 * The output is meant to be read as:
 *
 *   DRAINAGE — over capacity. Acts through barrier edges; 7 measured.
 *   Khlong Rop Krung (barrier, 0.8 crossings/km)
 *
 * ## What this is not
 *
 * It is **not** an attribution of an event. We have no evidence that a drainage
 * failure occurred at Khlong Rop Krung, and this module must never imply that we
 * do. What it says is narrower and still useful:
 *
 *   - a system's demand lands on particular kinds of city element;
 *   - where those elements have a measured structural property;
 *   - and that property changes what the system has to do there.
 *
 * A barrier edge is somewhere drainage has to cross and cannot. A seam is a
 * corridor it can use. That is a structural exposure statement, not a news
 * report — and it is only as good as the OSM proxy underneath it.
 *
 * ## The claim Lynch licenses
 *
 * *The Image of the City* p.63–64: an edge the city joins along is a seam, one it
 * works around is a barrier. p.20: infrastructure can erase the identity of the
 * area it runs through. p.63ff: edges fragment cities. Systems do the same
 * thing. That is the whole basis for pairing a capacity model with an image.
 */

import type { SystemId } from '../city-model'
import type { CityElement, CityImage } from '../../data/city-image'
import type { EdgeStructure } from './edge-structure'

/**
 * How each system touches the city image.
 *
 * `elements` is what the system physically runs through. `risk` is the
 * structural condition that makes acting through it hard — the element property
 * that costs the system something.
 */
export const SYSTEM_BINDINGS: Record<SystemId, {
  elements: CityElement[]
  risk: { kind: CityElement; structure?: EdgeStructure; because: string }
}> = {
  drainage: {
    elements: ['edges', 'paths'],
    // Water has to cross an edge to leave. A barrier is where it cannot.
    risk: { kind: 'edges', structure: 'barrier', because: 'runoff crosses it or pools against it' },
  },
  water: {
    elements: ['edges'],
    risk: { kind: 'edges', structure: 'seam', because: 'supply follows the corridors the city joins' },
  },
  transit: {
    elements: ['paths', 'nodes'],
    risk: { kind: 'paths', because: 'a line nobody can align to is not in the city (Lynch p.56–61)' },
  },
  air: {
    elements: ['districts', 'edges'],
    risk: { kind: 'edges', because: 'dense low ground traps what the wind would carry' },
  },
  heat: {
    elements: ['districts', 'paths'],
    risk: { kind: 'districts', because: 'mass and open corridor are a property of the area, not the line' },
  },
  waste: {
    elements: ['paths', 'nodes'],
    risk: { kind: 'nodes', because: 'collection converges on a few points and fails at them' },
  },
  health: {
    elements: ['nodes'],
    risk: { kind: 'nodes', because: 'reach is a question of which junctions exist' },
  },
  housing: {
    elements: ['districts'],
    risk: { kind: 'districts', because: 'who lives where, and whether the area has a name at all' },
  },
}

export interface ElementCitation {
  osmId: string
  name: string
  kind: CityElement
  structure?: EdgeStructure
  densityPerKm?: number
}

export interface SystemProjection {
  system: SystemId
  /** The element kinds this system acts through. */
  elements: CityElement[]
  /** Named elements of the risk class, worst first. */
  citations: ElementCitation[]
  /** One sentence, safe to show next to a capacity verdict. */
  line: string
  /** True when the image was truncated and the counts understate what exists. */
  limited: boolean
}

function firstLineOf(s: string, max = 96): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/**
 * Project every system onto the city image.
 *
 * `image` may be null — when the OSM read failed the system panel still needs to
 * say something true, and the honest thing is to say the image is unavailable
 * rather than to guess at the city's structure.
 */
export function projectSystems(image: CityImage | null, systems: readonly SystemId[]): SystemProjection[] {
  return systems.map((system) => {
    const binding = SYSTEM_BINDINGS[system]

    if (!image) {
      return {
        system,
        elements: binding.elements,
        citations: [],
        line: `Acts through ${list(binding.elements)}; the city image is unavailable, so no element can be named.`,
        limited: true,
      }
    }

    const wanted = new Set(binding.elements)
    const risk = binding.risk
    const candidates = image.collection.features.filter((feature) => {
      if (feature.properties?.kind !== risk.kind) return false
      if (risk.structure && feature.properties?.structure !== risk.structure) return false
      return wanted.has(feature.properties?.kind as CityElement)
    })

    // Worst first: lowest crossing density is the most exposed edge, and for a
    // seam the least connected. Either way it is the one worth naming.
    const citations: ElementCitation[] = candidates
      .map((feature) => ({
        osmId: String(feature.properties?.osmId ?? ''),
        name: String(feature.properties?.name ?? 'Unnamed'),
        kind: feature.properties?.kind as CityElement,
        structure: feature.properties?.structure as EdgeStructure | undefined,
      }))
      .filter((c) => c.osmId)
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .slice(0, 3)

    const count = candidates.length
    const noun = count === 1 ? 'element' : 'elements'
    const limited = image.truncated

    return {
      system,
      elements: binding.elements,
      citations,
      line: count === 0
        ? `Acts through ${list(binding.elements)}; no ${risk.kind} of that kind were found in this window.`
        : `Acts through ${list(binding.elements)}. Risk sits on ${count} ${risk.kind} ${noun} where it ${risk.because}.`,
      limited,
    }
  })
}

function list(elements: CityElement[]): string {
  return elements.map((e) => `${e}`).join(' and ')
}

/** A one-line citation strip, for compact display under a system verdict. */
export function citationLine(projection: SystemProjection): string | null {
  if (!projection.citations.length) return null
  const parts = projection.citations.map((c) =>
    c.structure ? `${c.name} (${c.structure})` : c.name)
  return firstLineOf(parts.join(' · '), 110)
}