import { expect, test } from '@playwright/test'

test('comparison is the primary view and never blanks the application', async ({ page }, testInfo) => {
  await page.goto('/?city=bangkok&lens=esri-imagery')

  await expect(page.locator('.topbar')).toBeVisible()
  await expect(page.locator('.topbar-brand-mark')).toBeVisible()
  await expect(page.locator('.split-compare')).toBeVisible()
  await expect(page.locator('.split-pane')).toHaveCount(2)
  await expect(page.locator('.split-pane').nth(0).locator('select').first()).toHaveValue('bangkok')
  await expect(page.locator('.split-pane').nth(1).locator('select').first()).toHaveValue('kranj')
  await expect(page.locator('.maplibregl-map')).toHaveCount(2)

  const viewportWidth = page.viewportSize()!.width
  const layout = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    visibleText: document.body.innerText.trim().length,
  }))
  expect(layout.visibleText).toBeGreaterThan(100)
  expect(layout.bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  expect(layout.documentWidth).toBeLessThanOrEqual(viewportWidth + 1)

  // The relationship model lives in the notes rail, which PR #6 made
  // deliberately responsive: open on wide screens, tucked away on phones
  // ("map-first"). It is still there on a phone, so open the rail rather than
  // asserting it is always visible.
  const notes = page.locator('.split-notes-btn')
  if (await notes.getAttribute('aria-pressed') !== 'true') await notes.click()

  const relationship = await page.locator('.split-analysis-bar').boundingBox()
  expect(relationship).not.toBeNull()
  expect(relationship!.x).toBeGreaterThanOrEqual(0)
  expect(relationship!.x + relationship!.width).toBeLessThanOrEqual(viewportWidth + 1)

  const metricSelects = await page.locator('.split-analysis-field select').evaluateAll((nodes) => (
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { left: rect.left, right: rect.right }
    })
  ))
  for (const rect of metricSelects) {
    expect(rect.left).toBeGreaterThanOrEqual(0)
    expect(rect.right).toBeLessThanOrEqual(viewportWidth + 1)
  }

  await page.getByRole('button', { name: 'Explore Bangkok', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Bangkok city twin' })).toBeVisible()
  await page.getByRole('tab', { name: 'What if?' }).click()
  await page.getByRole('slider', { name: 'Population change', exact: true }).fill('20')
  await expect(page.locator('.twin-scenario-result')).toContainText('Scenario calculation')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download scenario & evidence' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('bangkok-scenario.json')
  await page.screenshot({ path: testInfo.outputPath('twin-scenario.png') })
  await page.getByRole('button', { name: 'Close city explorer' }).click()
  await expect(page.locator('.twin-workbench')).toHaveCount(0)

})

test('a shared city URL becomes the first comparison pane', async ({ page }) => {
  await page.goto('/?city=kranj&lens=esri-imagery')

  await expect(page.locator('.split-compare')).toBeVisible()
  await expect(page.locator('.split-pane').nth(0).locator('select').first()).toHaveValue('kranj')
  await expect(page.locator('.split-pane').nth(1).locator('select').first()).toHaveValue('bangkok')
})

test('city search returns real basics before a city is opened', async ({ page }, testInfo) => {
  // Desktop only, and that is a gap rather than a preference. On the mobile
  // viewport the compare view renders full-screen with no city selector and no
  // bottom navigation reachable from it, so there is no path to this dialog to
  // test. The surface itself is viewport-independent; what is missing is the
  // route to it on a phone, and that is tracked rather than papered over.
  test.skip(testInfo.project.name.includes('mobile'), 'no reachable city selector on the mobile compare view');

  // The old generated config carried `populationMillions: 1.0, // placeholder`.
  // A search that answers "how big is this place" with a constant is worse than
  // one that admits it does not know — and the admission has to reach the user.
  await page.route('**/geocoding-api.open-meteo.com/**', async (route) => {
    await route.fulfill({ json: { results: [
      { id: 1, name: 'Ulaanbaatar', latitude: 47.8864, longitude: 106.9057, elevation: 1350,
        country: 'Mongolia', country_code: 'mn', admin1: 'Ulaanbaatar', timezone: 'Asia/Ulaanbaatar', population: 1_400_000, feature_code: 'PPLC' },
      { id: 2, name: 'Khatgal', latitude: 50.44, longitude: 100.16, elevation: 1670,
        country: 'Mongolia', country_code: 'mn', admin1: 'Bulgan', timezone: 'Asia/Ulaanbaatar', population: 4_000, feature_code: 'PPL' },
      { id: 3, name: 'Nameless Hollow', latitude: 48.1, longitude: 105.0,
        country: 'Mongolia', country_code: 'mn', admin1: 'Selenge', timezone: 'Asia/Ulaanbaatar', feature_code: 'PPL' },
    ] } })
  })
  await page.goto('/')
  // "SEARCH ANY CITY" lives in the city dropdown footer, which is closed.
  await page.locator('.topbar-city-select-btn').first().click()
  await page.getByRole('button', { name: 'SEARCH ANY CITY' }).first().click()
  await page.getByRole('textbox').fill('Ulaanbaatar')

  const rows = page.locator('.onboarding-result')
  await expect(rows.first()).toContainText('Ulaanbaatar')
  // Basics ride with the result — visible before the click, not after it.
  await expect(rows.first()).toContainText('1.40M')
  await expect(rows.first()).toContainText('1350 m')
  // A source with no figure says so rather than showing a blank or a zero.
  await expect(rows.nth(2)).toContainText('Not published')
  // And the preview attributes the figure rather than implying a metro area.
  await expect(page.locator('.onboarding-preview')).toContainText('settlement, Open-Meteo')
  await expect(page.locator('.onboarding-honest-note')).toContainText('hand-built')
})
