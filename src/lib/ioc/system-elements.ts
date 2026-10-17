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
import type { PathStructure } from './path-structure'

/**
 * How each system touches the city image.
 *
 * `elements` is what the system physically runs through. `risk` is the
 * structural condition that makes acting through it hard — the element property
 * that costs the system something.
 */
export const SYSTEM_BINDINGS: Record<SystemId, {
  elements: CityElement[]
  /**
   * `structure` narrows to whichever band this system's risk sits in. Edges and
   * paths were measured by different evidence — road-node contacts versus named
   * junctions — so they carry different verdicts, and a system may be exposed by
   * either.
   */
  risk: { kind: CityElement; structure?: EdgeStructure | PathStructure; because: string }
  /** What one of these is called in a sentence — not the raw element id. */
  noun: { one: string; many: string }
}> = {
  drainage: {
    elements: ['edges', 'paths'],
    // Water has to cross an edge to leave. A barrier is where it cannot.
    risk: { kind: 'edges', structure: 'barrier', because: 'runoff has to cross it or pool against it' },
    noun: { one: 'barrier edge', many: 'barrier edges' },
  },
  water: {
    elements: ['edges'],
    risk: { kind: 'edges', structure: 'seam', because: 'supply follows the corridors the city joins' },
    noun: { one: 'seam', many: 'seams' },
  },
  transit: {
    elements: ['paths', 'nodes'],
    // Lynch's first finding and the one a transit system is most exposed to: a
    // line can be long, straight and heavily used and still not be in the city's
    // image, because nothing joins it along its length. High capacity, low
    // image value — and getting off it is the disorientation he describes at the
    // LA freeway exits.
    risk: { kind: 'paths', structure: 'detached', because: 'it is a line the city does not join (Lynch p.56–61)' },
    noun: { one: 'detached path', many: 'detached paths' },
  },
  air: {
    elements: ['districts', 'edges'],
    risk: { kind: 'edges', because: 'dense low ground traps what the wind would carry' },
    noun: { one: 'edge', many: 'edges' },
  },
  heat: {
    elements: ['districts', 'paths'],
    risk: { kind: 'districts', because: 'mass and open corridor belong to the area, not the line' },
    noun: { one: 'district', many: 'districts' },
  },
  waste: {
    elements: ['paths', 'nodes'],
    risk: { kind: 'nodes', because: 'collection converges on a few points and fails at them' },
    noun: { one: 'junction', many: 'junctions' },
  },
  health: {
    elements: ['nodes'],
    risk: { kind: 'nodes', because: 'reach is a question of which junctions exist' },
    noun: { one: 'junction', many: 'junctions' },
  },
  housing: {
    elements: ['districts'],
    risk: { kind: 'districts', because: 'the question is who lives there, and whether the area has a name at all' },
    noun: { one: 'district', many: 'districts' },
  },
}

export interface ElementCitation {
  osmId: string
  name: string
  kind: CityElement
  structure?: EdgeStructure | PathStructure
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
        // Not "limited" — a limited sample is a subset of something we read.
        // Here there is nothing at all, and saying otherwise would imply we
        // know how much we are missing.
        limited: false,
      }
    }

    const wanted = new Set(binding.elements)
    const risk = binding.risk
    const raw = image.collection.features.filter((feature) => {
      if (feature.properties?.kind !== risk.kind) return false
      if (risk.structure && feature.properties?.structure !== risk.structure) return false
      return wanted.has(feature.properties?.kind as CityElement)
    })

    // OSM splits one named place into many ways — measured on central Bangkok,
    // 28 ways collapsing to 7 edge groups. Counting features here reported
    // "89 edges" for a window whose Edges lens correctly said 37, and the
    // citation strip repeated one canal three times. Both are wrong in the same
    // way: a person means places, not the ways a place was drawn.
    const byName = new Map<string, ElementCitation>()
    for (const feature of raw) {
      const name = String(feature.properties?.name ?? 'Unnamed')
      if (!byName.has(name)) {
        byName.set(name, {
          osmId: String(feature.properties?.osmId ?? ''),
          name,
          kind: feature.properties?.kind as CityElement,
          structure: feature.properties?.structure as EdgeStructure | PathStructure | undefined,
        })
      }
    }

    const citations = [...byName.values()]
      .filter((c) => c.osmId)
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .slice(0, 3)

    const count = byName.size
    const noun = count === 1 ? binding.noun.one : binding.noun.many
    // Any cap that bit understates a count in this projection, so all three
    // count. The crossing cap matters most for the systems whose risk class is
    // an edge: dropping road-node witnesses does not shrink the seam/barrier
    // count, it skews it toward "barrier", because what is missing is evidence
    // that the city meets the edge.
    const limited = image.truncated || image.crossingsTruncated

    return {
      system,
      elements: binding.elements,
      citations,
      line: count === 0
        ? `Acts through ${list(binding.elements)}; no ${noun} were found in this window.`
        : `Acts through ${list(binding.elements)}. Risk sits on ${count} ${noun} where ${risk.because}.`,
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