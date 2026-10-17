import { expect, test } from '@playwright/test'

// The browser cannot call the Overpass mirrors directly — `User-Agent` is a
// forbidden header name — so it goes through the same-origin proxy at
// `/api/overpass` (see src/lib/osm/overpass-http.ts). These mocks have to
// intercept the path the browser actually requests, not the upstream path:
// mocking `**/api/interpreter` left these tests green while the real journey
// hit the network and failed, because `npm test` does not run tests-e2e.
const OVERPASS_PROXY = '**/api/overpass'

test('Lynch elements change both maps and preserve return to satellite', async ({ page }, testInfo) => {
  await page.route(OVERPASS_PROXY, async (route) => {
    const query = decodeURIComponent(route.request().postData() ?? '')
    const kranj = query.includes('46.')
    const lat = kranj ? 46.24 : 13.756
    const lon = kranj ? 14.355 : 100.501
    await route.fulfill({ json: { osm3s: { timestamp_osm_base: '2026-10-15T00:00:00Z' }, elements: [
      { type: 'way', id: 1, tags: { highway: 'primary', name: 'Test route' }, geometry: [{lat, lon}, {lat: lat + 0.01, lon: lon + 0.01}] },
      { type: 'node', id: 2, tags: { place: 'neighbourhood', name: 'Test neighbourhood' }, lat, lon },
      { type: 'node', id: 3, tags: { historic: 'monument', name: 'Test landmark' }, lat: lat + 0.005, lon },
    ] } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'City image', exact: true }).click()
  // Paths is the opening lens, and it reports measured structure rather than a
  // raw feature count: one named route, nothing joining it, so detached.
  await expect(page.locator('.city-image-caption').first()).toContainText('1 named path · 0 linked, 0 sparse, 1 detached')
  await expect(page.locator('.city-image-caption').nth(1)).toContainText('1 named path')
  await page.getByRole('button', { name: 'Districts', exact: true }).click()
  await expect(page.locator('.city-image-caption').first()).toContainText('1 mapped place location')
  await expect(page.locator('.city-image-reading')).toContainText('not perceived boundaries')
  await page.getByRole('button', { name: 'Landmarks', exact: true }).click()
  await expect(page.locator('.city-image-caption').first()).toContainText('Test landmark')
  const width = page.viewportSize()!.width
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: testInfo.outputPath('city-image.png') })
  await page.getByRole('button', { name: 'City image', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Satellite lens' })).toHaveCount(2)
  await expect(page.locator('.split-pane-stats')).toHaveCount(2)
})

test('city image provides retry when public data fails', async ({ page }) => {
  await page.route(OVERPASS_PROXY, (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'City image', exact: true }).click()
  await expect(page.locator('.city-image-caption').first()).toContainText('Public map data unavailable', { timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Retry', exact: true }).first()).toBeVisible()
})

function isTileRequest(url: string): boolean {
  return /\.(webp|png|jpe?g|pbf)(\?|$)/i.test(url) || /tiles?|arcgis|mapbox/i.test(url)
}

// City image used to swap the entire map style for a single flat background
// layer, on the theory that OSM proxies should be read without a basemap
// "cladding". The result was not honesty, it was an unreadable pane — and a
// blank half-screen whenever a read failed, directly under copy that promised
// "the satellite view underneath is unaffected".
//
// The proxies still need somewhere to sit, and the basemap is real, labelled
// context rather than a claim about the city image. So the basemap stays and
// the OSM evidence is drawn over it with a casing for legibility.
test('city image keeps the basemap instead of blanking the pane', async ({ page }) => {
  await page.route(OVERPASS_PROXY, (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  let tiles = 0
  page.on('request', (r) => { if (isTileRequest(r.url())) tiles += 1 })

  await page.goto('/')
  await page.getByRole('button', { name: 'City image', exact: true }).click()
  await expect(page.locator('.city-image-caption').first()).toContainText('Public map data unavailable', { timeout: 20_000 })
  // Fitting the study window moves the camera, so a surviving basemap keeps
  // asking for tiles. A stripped style asks for none.
  await expect.poll(() => tiles, { timeout: 10_000 }).toBeGreaterThan(0)

  // And the copy must be true: it cannot promise an unaffected basemap over a
  // pane that no longer has one.
  await expect(page.locator('.city-image-caption').first()).toContainText('basemap unchanged')
})

test('the paths lens separates a linked street from a detached one', async ({ page }) => {
  // The finding the lens exists for: a long line that the city does not join.
  // Geometry is built so the verdict is determined by the junctions and cannot
  // be passed by a change of copy — one isolated spine, one well-crossed street.
  const spine = Array.from({ length: 120 }, (_, i) => ({
    type: 'way', id: 2_000 + i, tags: { highway: 'secondary', name: 'Isolated Spine' },
    geometry: [{ lat: 13.740 + i * 1e-4, lon: 100.480 }, { lat: 13.740 + (i + 1) * 1e-4, lon: 100.480 }],
  }))
  const crossed: Record<string, unknown>[] = [{
    type: 'way', id: 5_000, tags: { highway: 'secondary', name: 'Main Street' },
    geometry: [{ lat: 13.760, lon: 100.490 }, { lat: 13.760, lon: 100.500 }],
  }]
  // 102m apart, so eight distinct junction places rather than one merged blob.
  for (let i = 0; i < 8; i += 1) {
    crossed.push({
      type: 'way', id: 5_100 + i, tags: { highway: 'tertiary', name: `Cross ${i}` },
      geometry: [{ lat: 13.759, lon: 100.4905 + i * 1e-3 }, { lat: 13.761, lon: 100.4905 + i * 1e-3 }],
    })
  }
  await page.route(OVERPASS_PROXY, async (route) => {
    await route.fulfill({ json: {
      osm3s: { timestamp_osm_base: '2026-10-15T00:00:00Z' },
      elements: [...spine, ...crossed],
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'City image', exact: true }).click()
  await page.getByRole('button', { name: 'Paths', exact: true }).click()
  const caption = page.locator('.city-image-caption').first()
  await expect(caption).toContainText('10 named paths · 1 linked, 8 sparse, 1 detached')
  // The evidence travels with the verdict, and the citation is Lynch's own.
  await expect(caption).toContainText('Junctions of four branches or more are marked in red')
  await expect(caption).toContainText('Lynch 1960, p.56–61')
})

test('the nodes lens separates a junction that works from one you could find', async ({ page }) => {
  // Scollay Square against Copley Square, built from geometry so the verdict is
  // determined by junctions and surrounding names, not by copy.
  const hub = { lat: 13.756, lon: 100.501 }
  const star = [
    { type: 'way', id: 3_000, tags: { highway: 'secondary', name: 'Alpha Road' }, geometry: [{ lat: hub.lat, lon: hub.lon - 0.01 }, hub] },
    { type: 'way', id: 3_001, tags: { highway: 'secondary', name: 'Beta Road' }, geometry: [hub, { lat: hub.lat, lon: hub.lon + 0.01 }] },
    { type: 'way', id: 3_002, tags: { highway: 'tertiary', name: 'Gamma Road' }, geometry: [hub, { lat: hub.lat + 0.01, lon: hub.lon }] },
  ]
  // A plain two-way crossing with nothing nameable near it. Placed clear of the
  // star's Gamma arm, which otherwise crosses it and makes a third junction.
  const plainCross = [
    { type: 'way', id: 3_100, tags: { highway: 'secondary', name: 'Delta Road' }, geometry: [{ lat: 13.769, lon: 100.488 }, { lat: 13.769, lon: 100.494 }] },
    { type: 'way', id: 3_101, tags: { highway: 'secondary', name: 'Epsilon Road' }, geometry: [{ lat: 13.763, lon: 100.491 }, { lat: 13.775, lon: 100.491 }] },
  ]
  await page.route(OVERPASS_PROXY, async (route) => {
    await route.fulfill({ json: {
      osm3s: { timestamp_osm_base: '2026-10-15T00:00:00Z' },
      elements: [...star, ...plainCross],
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'City image', exact: true }).click()
  await page.getByRole('button', { name: 'Nodes', exact: true }).click()
  const caption = page.locator('.city-image-caption').first()
  await expect(caption).toContainText('2 junctions · 1 do work with nothing to recognise')
  // The citation is Lynch's, and the inversion is stated rather than implied.
  await expect(caption).toContainText('Scollay Square')
  await expect(caption).toContainText('Functional importance and image strength are different quantities')
})
