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
