import { expect, test, type Page } from '@playwright/test'

/**
 * The Wada reading room, as rendered.
 *
 * The unit test proves the engine's arithmetic. This proves the CSS consumes
 * it: a token can be computed correctly and still be ignored by the
 * stylesheet, and then the room is still unreadable. Measured before the
 * fix, the reading room failed AA in five of the six curated cities —
 * Cerulian Blue on English Red read 1.03:1.
 */

const PAPER = '#fff4d8'

const toRgb = (value: string): [number, number, number] => {
  // A custom property returns the text it was authored with — `#fff4d8` — not
  // a resolved rgb(). Both forms have to be readable here.
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const m = value.match(/(\d+(?:\.\d+)?)/g)
  if (!m || m.length < 3) throw new Error(`cannot read colour: ${value}`)
  return [Number(m[0]), Number(m[1]), Number(m[2])]
}

const luminance = (rgb: [number, number, number]): number => {
  const c = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

const ratio = (a: string, b: string): number => {
  const la = luminance(toRgb(a))
  const lb = luminance(toRgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const readRoom = (page: Page) =>
  page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      return { color: cs.color, background: cs.backgroundColor }
    }
    return {
      card: pick('.research-card'),
      header: pick('.research-header'),
      eyebrow: pick('.research-eyebrow'),
      standfirst: pick('.research-standfirst'),
      heading: pick('.research-heading'),
      footer: pick('.research-footer'),
      plate: document.documentElement.getAttribute('data-wada-plate'),
      plateInk: getComputedStyle(document.documentElement).getPropertyValue('--plate-ink').trim(),
      headerInk: getComputedStyle(document.documentElement).getPropertyValue('--header-ink').trim(),
    }
  })

/**
 * Open the reading room by whichever route this viewport has.
 *
 * On a desktop the topbar carries a Research button. On a phone the topbar
 * keeps only the wordmark, Compare and More, so the room is reached through
 * More. The room has to be readable on a phone too — a document that only a
 * desktop can open is a document the product does not have.
 */
const openResearch = async (page: Page) => {
  const topbar = page.getByRole('button', { name: 'Research', exact: true })
  if (await topbar.isVisible()) {
    await topbar.click()
    return
  }
  await page.locator('[aria-label="More"]').first().click()
  await page.getByRole('menuitem', { name: 'Research', exact: true }).click()
}

test('the reading room is readable in every curated city', async ({ page }) => {
  const cities = ['bangkok', 'chiang-mai', 'phuket', 'singapore', 'ljubljana', 'kranj']

  for (const city of cities) {
    await page.goto(`/?city=${city}&lens=esri-imagery`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.topbar')).toBeVisible()
    await openResearch(page)
    await expect(page.locator('.research-card')).toBeVisible()
    await expect(page.locator('.research-heading').first()).toBeVisible()

    const room = await readRoom(page)
    expect(room.plate, `${city} has no plate applied`).toBeTruthy()
    expect(room.card, `${city} has no research card`).toBeTruthy()

    // The paper ground is the room's ground, whatever the plate is.
    expect(room.card!.background, `${city}: the ground is not the paper`).toBe('rgb(255, 244, 216)')

    // The header: its own ink on the plate's dominant.
    const headerContrast = ratio(room.eyebrow!.color, room.header!.background)
    expect(headerContrast, `${city}: header eyebrow on the dominant`).toBeGreaterThanOrEqual(4.5)
    // The title and the standfirst are the same ink.
    expect(room.standfirst!.color).toBe(room.eyebrow!.color)

    // The body: the plate's ink on the paper.
    const bodyContrast = ratio(room.heading!.color, room.card!.background)
    expect(bodyContrast, `${city}: section heading on the paper`).toBeGreaterThanOrEqual(4.5)

    // The footer: the paper on the plate's ink.
    const footerContrast = ratio(room.footer!.color, room.footer!.background)
    expect(footerContrast, `${city}: footer text on its ground`).toBeGreaterThanOrEqual(4.5)

    // And the engine's tokens are the ones being used, not a leftover.
    expect(room.plateInk).toBeTruthy()
    expect(room.headerInk).toBeTruthy()

    await page.keyboard.press('Escape')
    await expect(page.locator('.research-card')).toHaveCount(0)
  }
})

test('the plate ground is never painted with a colour that cannot be read on it', async ({ page }) => {
  // The same rule, asserted through the engine's own tokens rather than
  // through the stylesheet: whatever the plate, the paper and the plate's
  // ink must be mutually readable.
  await page.goto('/?city=bangkok&lens=esri-imagery', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.topbar')).toBeVisible()
  // The tokens are published by the stylesheet, so WAIT for the sheet rather
  // than assuming it has been parsed: at `domcontentloaded` the dev server's
  // injected CSS can still be on its way, and a token read too early returns
  // an empty string — which reads as "no paper" and fails for the wrong reason.
  await expect.poll(async () => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim())).toBe(PAPER)
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    return {
      paper: cs.getPropertyValue('--paper').trim(),
      plateInk: cs.getPropertyValue('--plate-ink').trim(),
      headerInk: cs.getPropertyValue('--header-ink').trim(),
      chord: cs.getPropertyValue('--chord').trim(),
    }
  })
  expect(tokens.paper).toBe(PAPER)
  expect(ratio(tokens.paper, tokens.plateInk)).toBeGreaterThanOrEqual(4.5)
  expect(ratio(tokens.headerInk, tokens.chord)).toBeGreaterThanOrEqual(4.5)
})
