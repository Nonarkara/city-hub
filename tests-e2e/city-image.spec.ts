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
  await expect(page.locator('.city-image-caption').first()).toContainText('1 mapped feature')
  await expect(page.locator('.city-image-caption').nth(1)).toContainText('1 mapped feature')
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
