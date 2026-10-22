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

  // Opening a city has to show that city. It used to set the active city and
  // leave the reader in a comparison of Bangkok and Kranj, so the button said
  // "View city" and the screen did not change.
  await page.getByRole('button', { name: 'View city' }).click()
  await expect(page.locator('.topbar-city-select-name')).toHaveText('Ulaanbaatar')
  // Opened on its own, not left behind a comparison of Bangkok and Kranj.
  await expect(page.locator('.split-compare')).toHaveCount(1)
  // Case-insensitively: the label is uppercased by CSS, not by the text node.
  await expect(page.locator('.split-pane').first()).toContainText(/ulaanbaatar/i)
  // …and the city image, which is the part that needs no curation and so
  // works for any city on earth, is one click away.
  await expect(page.getByRole('button', { name: 'City image', exact: true })).toBeVisible()
})

test('every metric says where its number came from, at every width', async ({ page }) => {
  // The envelope under each value — "REFERENCE · MIXED YRS", "FEED · NOW" — is
  // the only thing telling a reader whether a figure is live or a mixed-year
  // reference. It was clipped to "REFERENCE · MIXED YEA…" at 1024 and 390, so
  // the caveat is exactly what got cut. Asserted on rendered geometry, because
  // "the text is in the DOM" proves nothing about whether anyone can read it.
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/?city=bangkok&lens=esri-imagery')
    await page.waitForTimeout(2500)

    const envelopes = await page.evaluate(() =>
      [...document.querySelectorAll('.split-pane-stat-envelope')].map((el) => ({
        text: el.textContent ?? '',
        clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2,
      })),
    )
    expect(envelopes.length).toBeGreaterThan(0)
    for (const env of envelopes) {
      expect(env.text.trim().length).toBeGreaterThan(0)
      expect(env.clipped, `clipped at ${width}px: ${env.text}`).toBe(false)
    }
  }
})

test('the city explorer scrolls, so every action is reachable on a phone', async ({ page }) => {
  // The workbench panel is a column flex box whose content region had no flex
  // contract, so it sized to its content and never scrolled. The panel's own
  // `overflow: hidden` then cut the last action 49.7px below the fold on a
  // 390x844 phone — present in the DOM, focusable, and unreachable by any
  // gesture. Asserted by reachability, because "the element exists" is exactly
  // what was true while it was unreachable.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?city=bangkok&lens=esri-imagery')
  await page.waitForTimeout(3000)
  const explore = page.getByRole('button', { name: /^Explore / }).first()
  await explore.click()

  const target = page.getByRole('button', { name: /City systems/ }).first()
  await expect(target).toBeVisible()

  // The content region is a real scroll container when its content overflows.
  const scroll = await page.evaluate(() => {
    const el = document.querySelector('.twin-content')!
    return { scrolls: el.scrollHeight > el.clientHeight, overflow: el.scrollHeight - el.clientHeight }
  })
  expect(scroll.overflow).toBeGreaterThan(0)
  expect(scroll.scrolls).toBe(true)

  // Focusing it must bring it into view — the gesture a keyboard user relies on.
  await target.focus()
  await page.waitForTimeout(300)
  const reachable = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const r = el.getBoundingClientRect()
    const box = document.querySelector('.twin-content')!.getBoundingClientRect()
    return {
      isTarget: /City systems/.test(el.textContent || ''),
      inViewport: r.bottom <= window.innerHeight + 1 && r.top >= 0,
      withinPanel: r.top >= box.top - 1 && r.bottom <= box.bottom + 1,
      height: Math.round(r.height),
    }
  })
  expect(reachable.isTarget).toBe(true)
  expect(reachable.inViewport).toBe(true)
  expect(reachable.withinPanel).toBe(true)
  // A 44px target, so a thumb can hit it.
  expect(reachable.height).toBeGreaterThanOrEqual(44)
})

test('a long menu admits that it scrolls', async ({ page }) => {
  // The Look menu is 869px of 38 lenses in a 560px box. It scrolled, but with a
  // bare `overflow-y: auto`: no scrollbar, no fade, no hint. 311px of options —
  // including whole sensor groups — sat below a cut that read as the end of the
  // list. Asserted because "it is scrollable" was already true and not the
  // defect; the defect is that the layout denied it.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?city=bangkok&lens=esri-imagery')
  await page.waitForTimeout(3000)
  await page.locator('[aria-label="Choose how you\'re looking"]').first().click()

  const menu = page.locator('.basemap-menu').first()
  await expect(menu).toBeVisible()
  const m = await menu.evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      overflows: el.scrollHeight > el.clientHeight,
      hiddenPx: el.scrollHeight - el.clientHeight,
      scrollbarWidth: cs.scrollbarWidth,
      hasAffordance: cs.backgroundImage !== 'none',
    }
  })
  expect(m.overflows).toBe(true)
  expect(m.hiddenPx).toBeGreaterThan(0)
  // A styled scrollbar, so the scroll is visible rather than inferred.
  expect(m.scrollbarWidth).toBe('thin')
  // And a fade anchored to the scrollport, which only appears when more exists.
  expect(m.hasAffordance).toBe(true)
})

test('a phone can still reach Plan, Ask, About — the More menu is not desktop-only', async ({ page }) => {
  // The phone topbar hid every child except the wordmark and Compare, on the
  // reasoning that each pane already owns its city and lens. True for those two
  // and false for everything else: Plan, This view, the next 48 hours, Ask,
  // Patterns, Sources, Search and About exist nowhere else on the screen, so
  // hiding the menu removed them from the product on a phone entirely.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?city=bangkok&lens=esri-imagery')
  await page.waitForTimeout(3500)

  const more = page.locator('[aria-label="More"]').first()
  await expect(more).toBeVisible()
  // It must cost a phone target's width, not a desktop label's.
  const box = await more.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(60)
  expect(box!.height).toBeGreaterThanOrEqual(44)

  await more.click()
  const menu = page.locator('.topbar-more-menu')
  await expect(menu).toBeVisible()

  // Every item in it is a feature with no other route on the screen.
  for (const label of ['Plan', 'This view', 'Next 48 hours', 'Ask', 'Patterns', 'Search', 'About']) {
    await expect(menu.getByText(label, { exact: true }).first()).toBeAttached()
  }

  // And the menu itself stays inside a 390px viewport.
  const fit = await menu.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight }
  })
  expect(fit.right).toBeLessThanOrEqual(fit.vw)
  expect(fit.left).toBeGreaterThanOrEqual(0)
  expect(fit.bottom).toBeLessThanOrEqual(fit.vh)
  expect(fit.top).toBeGreaterThanOrEqual(0)
})
