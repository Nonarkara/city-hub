/**
 * IoC 2.0 — node image strength against functional importance.
 *
 * Lynch, *The Image of the City* (1960), p.72–76. This is the one finding in
 * the book that a planning dashboard is actively likely to get backwards.
 *
 * The obvious assumption, stated by Lynch himself:
 *
 * > "elements located at junctions may automatically be assumed to derive
 * > special prominence from their location… Because decisions must be made at
 * > junctions, people heighten their attention at such places."
 *
 * Then the two squares that together dismantle it:
 *
 * > "A strong physical form is not absolutely essential to the recognition of a
 * > node: witness Journal Square and Scollay Square. But where the space has
 * > some form, the impact is much stronger… In its present form [Scollay Square]
 * > could not be remembered in any concrete way… Seven out of thirty subjects
 * > remembered that it had a subway station; nothing else could be agreed upon."
 *
 * > "A node like Copley Square, on the contrary, which is of less functional
 * > importance… was very sharply imaged… It was easily identified, principally
 * > in terms of its unique individual buildings."
 *
 * **Functional importance and image strength are different quantities.** A node
 * can be the most important junction in the city and still be invisible in it.
 * For a transit dashboard that is not a footnote — it means "success at a node
 * nobody can name" is a finding, not a win.
 *
 * ## How this is measured
 *
 * Two axes, and the whole point is that they do not move together.
 *
 * - **Function** — how many *named* paths meet there. Lynch calls a junction a
 *   "place of a break in transportation" and notes that ordinary crossings are
 *   "not of sufficient prominence to be imaged as more than the incidental
 *   crossing of paths". Degree carries that.
 * - **Image** — how many *distinctly nameable* things stand within a short walk.
 *   This is Copley Square's own mechanism: not a spatial whole, but a
 *   concentration of contrasting, individually identifiable content.
 *
 * ## The verdict, and why "shapeless" is the one that matters
 *
 * - `anchored` — functional and imaged. A real node: South Station's description.
 * - `shapeless` — **functional, not imaged.** The Scollay Square pattern, and
 *   the only one of the four that should make a planner stop.
 * - `memorable` — imaged, not functional. The Copley Square pattern: less work
 *   done, seen anyway.
 * - `quiet` — neither. The ordinary crossing, which Lynch says is not a node at
 *   all despite being one on the drawing.
 *
 * ## Three limits, stated rather than buried
 *
 * 1. **Coverage is not the same as absence.** "Nothing nameable within 200m" is
 *    what this measures, not "nothing there". OpenStreetMap's landmark coverage
 *    is very uneven — 181 of 272 nameable features in the central Bangkok
 *    window are building *ways*, while whole areas simply are not mapped. A
 *    `shapeless` verdict in a poorly mapped district is a statement about OSM.
 * 2. **Named paths only.** Degree counts named streets, so a junction is scored
 *    on what people have named, not on what moves there.
 * 3. **Thresholds are ours.** Lynch gave a judgement, not a number. See the
 *    constants below — they are a design decision, stated openly, and they should
 *    be calibrated against Scollay Square and Copley Square before anyone quotes
 *    a verdict as though Lynch had endorsed it.
 */

import { pointToPolylineM } from './edge-structure'

export type NodeVerdict = 'anchored' | 'shapeless' | 'memorable' | 'quiet'

export interface NodeImageReading {
  /** Named paths meeting here. Lynch's "break in transportation". */
  degree: number
  /** Distinctly nameable elements within `NODE_IMAGE_RADIUS_M`. */
  content: number
  /** The strongest few, for a citation. */
  contentNames: string[]
  verdict: NodeVerdict
}

/**
 * How far you can see something worth naming from where you are standing.
 *
 * 200m is a short walk's worth of a street frontage — close enough that the
 * buildings are part of the place rather than a different place. Measured on
 * central Bangkok: at 150m only 16 of 196 junctions have two or more nameable
 * elements, at 300m it is 65, and the gap between function and image stays wide
 * at every radius, so the finding does not depend on this number being exactly
 * right.
 */
export const NODE_IMAGE_RADIUS_M = 200

/**
 * Paths that must meet before a junction counts as functionally important.
 *
 * Two is the floor — two streets crossing is the incidental crossing Lynch
 * explicitly excludes from the image. Three named paths meeting is a switch
 * point, and Lynch's own rule is that crossings of *more* than four give people
 * trouble, so the interesting band is 3 and up.
 */
export const NODE_FUNCTION_DEGREE = 3

/**
 * Distinctly nameable elements needed before a place is called imaged.
 *
 * Two, not one. Lynch insists on redundancy: "a certain amount of repetition,
 * redundancy, and reinforcement seems to be necessary", and he attributes
 * Copley's image to buildings *plural*. A single item is a feature, not a place
 * you could find again.
 */
export const NODE_CONTENT_MIN = 2

/** How many names a citation carries. */
const CITATION_LIMIT = 3

type LngLat = [number, number]

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LON_AT_EQ = 111_320

/**
 * Does this name let a person recognise the place?
 *
 * Two classes of OSM name fail. Purely numeric names — measured on central
 * Bangkok: `61`, `54`, `165`, `2480`, `537` — are record identifiers on
 * memorials, not anything a resident would use. And the city's own name
 * distinguishes nothing; `Bangkok` as a landmark near a junction tells you where
 * you already are, which is the opposite of what image strength means.
 */
export function isNameable(name: string, cityName: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || trimmed === 'Mapped feature') return false
  if (/^\d+$/.test(trimmed)) return false
  if (trimmed === cityName.trim()) return false
  return true
}

/**
 * Distance from a point to a feature's whole geometry.
 *
 * Deliberately not the centroid. 181 of 272 nameable features in the central
 * Bangkok window are mapped as building *ways*, and placing a polygon at an
 * invented centre point would both invent a location and measure the wrong
 * distance — a long riverside building would appear to be far from the junction
 * it faces.
 */
function distanceToFeatureM(point: LngLat, geometry: GeoJSON.Geometry, toM: (p: LngLat) => [number, number]): number {
  if (geometry.type === 'Point') {
    const [px, py] = toM(geometry.coordinates as LngLat)
    return Math.hypot(px - point[0], py - point[1])
  }
  if (geometry.type === 'LineString') return pointToPolylineM(point, geometry.coordinates as LngLat[])
  return Infinity
}

export interface NodeImageAnnotation {
  /** Keyed by junction id, matching the junction features in the collection. */
  readings: Map<string, NodeImageReading>
  summary: Record<NodeVerdict, number>
  /**
   * How many places are imaged at once.
   *
   * Lynch warns the image cannot carry too many nodal centres, so this is
   * reported rather than hidden: a window where most junctions are `memorable`
   * is not a legible city, it is a city with no focal point.
   */
  imagedCount: number
}

function toFrame(origin: LngLat): (p: LngLat) => [number, number] {
  const [lon0, lat0] = origin
  const kx = M_PER_DEG_LON_AT_EQ * Math.cos((lat0 * Math.PI) / 180)
  return ([lon, lat]: LngLat) => [(lon - lon0) * kx, (lat - lat0) * M_PER_DEG_LAT]
}

/**
 * Score every junction in a city image on both axes.
 *
 * `cityName` is only used to reject the city's own name as un-nameable content;
 * pass the city's display name.
 */
export function annotateNodeImage(
  collection: GeoJSON.FeatureCollection,
  cityName: string,
): NodeImageAnnotation {
  const junctions = collection.features.filter((f) => f.properties?.kind === 'junctions')
  const content = collection.features.filter((f) =>
    (f.properties?.kind === 'landmarks' || f.properties?.kind === 'nodes') && f.geometry &&
    isNameable(String(f.properties?.name ?? ''), cityName))

  const summary: Record<NodeVerdict, number> = { anchored: 0, shapeless: 0, memorable: 0, quiet: 0 }
  const readings = new Map<string, NodeImageReading>()

  const first = junctions[0]?.geometry
  const origin: LngLat = first?.type === 'Point' ? first.coordinates as LngLat : [0, 0]
  const toM = toFrame(origin)

  for (const junction of junctions) {
    if (junction.geometry?.type !== 'Point') continue
    const at = junction.geometry.coordinates as LngLat
    const degree = Number(junction.properties?.degree ?? 0)
    // Count each distinct name once. OSM maps the same gate twice under two
    // ways, and a duplicated name is not a second thing to recognise a place by.
    const names = new Set<string>()
    for (const feature of content) {
      if (distanceToFeatureM(at, feature.geometry!, toM) <= NODE_IMAGE_RADIUS_M) {
        names.add(String(feature.properties?.name))
      }
    }

    const functional = degree >= NODE_FUNCTION_DEGREE
    const imaged = names.size >= NODE_CONTENT_MIN
    const verdict: NodeVerdict =
      functional && imaged ? 'anchored'
        : functional && !imaged ? 'shapeless'
          : !functional && imaged ? 'memorable'
            : 'quiet'

    const id = String(junction.properties?.junctionId ?? junction.geometry.coordinates.join(','))
    readings.set(id, {
      degree,
      content: names.size,
      contentNames: [...names].sort().slice(0, CITATION_LIMIT),
      verdict,
    })
    summary[verdict] += 1
    // Stamped back so the map can colour each junction without a side table.
    //
    // Also written as `structure`, which is the name the system→element
    // projection already filters on for edges and paths. Junctions previously
    // carried only `verdict`, so a system bound to shapeless junctions found
    // none of them while the summary reported one — the two halves of the same
    // measurement disagreeing because they used different property names.
    junction.properties = { ...junction.properties, verdict, structure: verdict, content: names.size }
  }

  return { readings, summary, imagedCount: summary.anchored + summary.memorable }
}

/** Lynch's own caution, as a sentence the UI can show or withhold. */
export function nodeDensityWarning(summary: Record<NodeVerdict, number>, imagedCount: number): string | null {
  const total = summary.anchored + summary.shapeless + summary.memorable + summary.quiet
  if (total === 0 || imagedCount === 0) return null
  if (imagedCount / total < 0.5) return null
  return `${imagedCount} of ${total} junctions have something distinct to name. Lynch warned the image cannot carry too many nodal centres — a city where everywhere is a node has nowhere to orient by.`
}