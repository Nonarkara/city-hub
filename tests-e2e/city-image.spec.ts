import { expect, test } from '@playwright/test'

test('Lynch elements change both maps and preserve return to satellite', async ({ page }, testInfo) => {
  await page.route('**/api/interpreter', async (route) => {
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
  await page.route('**/api/interpreter', (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'City image', exact: true }).click()
  await expect(page.locator('.city-image-caption').first()).toContainText('Public map data unavailable', { timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Retry', exact: true }).first()).toBeVisible()
})
