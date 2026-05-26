/**
 * GTFS-Realtime (Mock) Integration for Bangkok
 * Since Bangkok does not have a public GTFS-RT feed for the BTS/MRT,
 * this provides a simulated realtime feed of trains moving along the major lines.
 * This architectural placeholder can be swapped for a real feed once available.
 */

// Approximate coordinates for the BTS Sukhumvit line (Mo Chit to Bearing)
const BTS_SUKHUMVIT_LINE = [
  [100.5538, 13.8022], // Mo Chit
  [100.5484, 13.7915], // Saphan Khwai
  [100.5404, 13.7730], // Ari
  [100.5376, 13.7645], // Sanam Pao
  [100.5362, 13.7527], // Phaya Thai
  [100.5348, 13.7454], // Siam
  [100.5401, 13.7441], // Chit Lom
  [100.5480, 13.7431], // Phloen Chit
  [100.5595, 13.7368], // Asok
  [100.5702, 13.7297], // Phrom Phong
  [100.5794, 13.7226], // Thong Lo
  [100.5847, 13.7188], // Ekkamai
  [100.5960, 13.7100], // Phra Khanong
  [100.5997, 13.7042], // On Nut
  [100.6094, 13.6896], // Punnawithi
  [100.6139, 13.6784], // Udom Suk
  [100.6176, 13.6698], // Bang Na
  [100.6212, 13.6606], // Bearing
]

// Interpolate a point between two coordinates given a fraction (0-1)
function interpolate(p1: number[], p2: number[], t: number) {
  return [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t,
  ]
}

/**
 * Returns a GeoJSON FeatureCollection of simulated train positions.
 */
export async function fetchMockGTFSRealtime(): Promise<GeoJSON.FeatureCollection> {
  const time = Date.now()
  const features: GeoJSON.Feature[] = []

  // Simulate 10 trains moving back and forth on the BTS Sukhumvit line
  const numTrains = 10
  const lineLength = BTS_SUKHUMVIT_LINE.length - 1
  
  for (let i = 0; i < numTrains; i++) {
    // Determine position based on time and train index
    // Cycle time: 60 seconds (simulated fast speed)
    const cycle = 60000 
    const phase = (time + i * (cycle / numTrains)) % (cycle * 2)
    const isForward = phase < cycle
    const progress = isForward ? phase / cycle : (phase - cycle) / cycle
    const actualProgress = isForward ? progress : 1 - progress

    const exactIndex = actualProgress * lineLength
    const startIndex = Math.floor(exactIndex)
    const endIndex = Math.min(startIndex + 1, lineLength)
    const segmentProgress = exactIndex - startIndex

    const coords = interpolate(
      BTS_SUKHUMVIT_LINE[startIndex],
      BTS_SUKHUMVIT_LINE[endIndex],
      segmentProgress
    )

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: `bts-train-${i}`,
        route: 'BTS Sukhumvit Line',
        direction: isForward ? 'Outbound' : 'Inbound',
        status: 'IN_TRANSIT_TO',
        speed: Math.round(30 + Math.random() * 20), // km/h
      }
    })
  }

  return { type: 'FeatureCollection', features }
}
