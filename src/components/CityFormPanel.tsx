import type { CityImage } from '../data/city-image'
import type { CityConfig } from '../config/cities'
import { CITY_IMAGE_UNAVAILABLE } from '../lib/osm/messages'

/**
 * The city's form, all five elements at once.
 *
 * ## Why this exists
 *
 * The five lenses each answer one question about one element, which is the right
 * way to look at a thing and the wrong way to *learn* one. Opened on Paths, the
 * reader sees paths; they cannot tell whether this city is seam-bound or
 * junction-blind until they go looking, and most never do.
 *
 * So this puts the whole profile on screen with Lynch's own vocabulary attached
 * to each row. It is the difference between showing someone a city and showing
 * someone how to read one.
 *
 * ## What each verdict is measuring
 *
 * Every row's third column is a *structural* finding, not a count, and each cites
 * the page it comes from. The counts alone would be a catalogue — which is what
 * this was before IoC 2.0, and which is honest but not useful.
 *
 * ## What it will not do
 *
 * It does not score the city. There is no number here that means "good city", and
 * adding one would be the single most misleading thing this panel could do:
 * every threshold underneath is ours, calibrated on nothing, and Lynch's study
 * cities are Boston, Jersey City and Los Angeles — not the four in the atlas and
 * certainly not the whole world reachable from the search. The panel says what
 * was measured and lets a reader compare two cities themselves.
 */

interface Props {
  city: CityConfig
  image: CityImage | null
  error: boolean
}

interface Row {
  id: string
  label: string
  /** What Lynch calls this element, in his words. */
  gloss: string
  count: number | null
  /** The structural finding, or null when nothing was measured. */
  verdict: string | null
  cite: string
}

export function CityFormPanel({ city, image, error }: Props) {
  if (error) {
    return (
      <div className="form-panel">
        <div className="form-panel-head">FORM · {city.name}</div>
        <p className="form-panel-empty">{CITY_IMAGE_UNAVAILABLE}</p>
      </div>
    )
  }
  if (!image) {
    return (
      <div className="form-panel">
        <div className="form-panel-head">FORM · {city.name}</div>
        <p className="form-panel-empty">Reading the city’s own record…</p>
      </div>
    )
  }

  const featureCount = (kind: string) =>
    image.collection.features.filter((f) => f.properties?.kind === kind).length

  const paths = image.pathSummary.linked + image.pathSummary.sparse + image.pathSummary.detached
  const edges = image.edgeSummary.seam + image.edgeSummary.partial + image.edgeSummary.barrier
  const junctions = image.nodeSummary.anchored + image.nodeSummary.shapeless + image.nodeSummary.memorable + image.nodeSummary.quiet

  const rows: Row[] = [
    {
      id: 'paths', label: 'PATHS', gloss: 'How people move through it',
      count: paths,
      verdict: image.pathSummary.detached > 0
        ? `${image.pathSummary.detached} detached — long, and nothing joins them`
        : image.pathSummary.linked > 0
          ? `${image.pathSummary.linked} well joined`
          : null,
      cite: 'Lynch p.56–61',
    },
    {
      id: 'edges', label: 'EDGES', gloss: 'What divides or connects parts',
      count: edges,
      verdict: image.edgeSummary.barrier > 0
        ? `${image.edgeSummary.barrier} barriers — the city works around them`
        : image.edgeSummary.seam > 0
          ? `${image.edgeSummary.seam} seams — the city joins along them`
          : null,
      cite: 'Lynch p.63–64',
    },
    {
      id: 'districts', label: 'DISTRICTS', gloss: 'Areas with a recognisable identity',
      count: featureCount('districts'),
      verdict: null,
      cite: 'Lynch p.66–71',
    },
    {
      id: 'nodes', label: 'NODES', gloss: 'Where routes and activity converge',
      count: junctions,
      verdict: image.nodeSummary.shapeless > 0
        ? `${image.nodeSummary.shapeless} do real work with nothing to name`
        : null,
      cite: 'Lynch p.72–76',
    },
    {
      id: 'landmarks', label: 'LANDMARKS', gloss: 'What helps you find your bearings',
      count: featureCount('landmarks'),
      verdict: null,
      cite: 'Lynch p.78–82',
    },
  ]

  return (
    <div className="form-panel">
      <div className="form-panel-head">FORM · {city.name}</div>
      <table className="form-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td className="form-count">{row.count?.toLocaleString() ?? '—'}</td>
              <td className="form-verdict">
                {row.verdict
                  ? <span title={row.gloss}>{row.verdict}</span>
                  : <span className="form-verdict--none" title={row.gloss}>{row.gloss}</span>}
              </td>
              <td className="form-cite">{row.cite}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {image.pathGrain.grained
        ? <p className="form-foot">Named network runs {Math.round(image.pathGrain.concentration * 100)}% along one direction — there is a grain here to align a street to.</p>
        : <p className="form-foot">No dominant direction in the named network — a street here has nothing to align to. The same problem Los Angeles has.</p>}
      {image.truncated && (
        <p className="form-foot form-foot--limit">Some counts are cut off: the read stopped before covering the whole window, so they understate the city.</p>
      )}
      {image.crossingsTruncated && (
        <p className="form-foot form-foot--limit">Road contacts were incomplete, so edge readings skew toward barrier.</p>
      )}
      <p className="form-foot form-foot--cite">
        OpenStreetMap candidates, not residents’ mental maps. No score is given:
        the thresholds behind each verdict are ours, not Lynch’s.
      </p>
    </div>
  )
}