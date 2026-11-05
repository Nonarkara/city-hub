import { expect, test, type Page } from '@playwright/test'

/**
 * The city explorer, as rendered.
 *
 * The explorer used to run on a surface of its own: a forest ground
 * (#101512), a mint accent (#9ad8bb) and a green-tinted grey (#b4bfb8) —
 * sixteen hardcoded values outside the Wada token system, and the reason the
 * panel read as a different product from the app around it.
 *
 * These assertions are on computed style, not on the stylesheet, because the
 * defect was never a missing declaration. It was colour that was declared
 * and then ignored by everything downstream of it.
 */

const AMBER = 'rgb(249, 157, 27)'
const MINT = 'rgb(154, 216, 187)'
const FOREST = 'rgb(16, 21, 18)'
const GRAY_GREEN = 'rgb(180, 191, 184)'

const openExplorer = async (page: Page) => {
  await page.goto('/?city=bangkok&lens=esri-imagery', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.topbar')).toBeVisible()
  // The panel's colours come from the stylesheet, so wait for it to be
  // applied. Read too early, every computed colour is still the initial
  // value and the assertion fails for the wrong reason.
  await expect.poll(async () => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--amber').trim())).not.toBe('')
  await page.getByRole('button', { name: 'Explore Bangkok', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Bangkok city twin' })
  await expect(panel).toBeVisible()
  return panel
}

test('the explorer runs on the palette tokens, not its own forest and mint', async ({ page }) => {
  const panel = await openExplorer(page)

  const read = await panel.evaluate((root) => {
    const cs = (el: Element) => getComputedStyle(el)
    const tab = root.querySelector('.twin-tabs button[aria-selected="true"]')!
    const action = root.querySelector('.twin-action:not(.twin-action--quiet)')!
    const quiet = root.querySelector('.twin-action--quiet')!
    const eyebrow = root.querySelector('.twin-heading small')!

    // Every colour the panel actually paints, so a returning hardcoded value
    // shows up wherever it is used — text, fill, rule or focus ring.
    const paints = new Set<string>()
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const s = cs(el)
      paints.add(s.color)
      paints.add(s.backgroundColor)
      paints.add(s.borderTopColor)
      paints.add(s.borderBottomColor)
      paints.add(s.outlineColor)
    }

    return {
      ground: cs(root).backgroundColor,
      // The ground the compare system defines, read from its own root — the
      // panel must stand on that, not on a value of its own.
      cmpPanel: getComputedStyle(root.closest('.split-compare')!).getPropertyValue('--cmp-panel').trim(),
      tabColor: cs(tab).color,
      tabBorder: cs(tab).borderBottomColor,
      actionBg: cs(action).backgroundColor,
      actionColor: cs(action).color,
      quietColor: cs(quiet).color,
      eyebrowColor: cs(eyebrow).color,
      eyebrowFont: cs(eyebrow).fontFamily,
      eyebrowTracking: cs(eyebrow).letterSpacing,
      paints: [...paints],
    }
  })

  // The ground is the compare system's panel token, not an invented forest.
  // The hardcoded #101512 was already inert — `.split-compare .twin-workbench`
  // outranked it — so this assertion pins the live value, not the dead one.
  expect(read.ground).toBe(read.cmpPanel)
  expect(read.ground).not.toBe(FOREST)

  // Amber owns selection.
  expect(read.tabColor).toBe(AMBER)
  expect(read.tabBorder).toBe(AMBER)

  // Amber owns action.
  expect(read.actionBg).toBe(AMBER)
  expect(read.quietColor).toBe(AMBER)

  // And the panel's own typographic idiom: a mono, tracked eyebrow, as the
  // other four eyebrows in the app already are.
  expect(read.eyebrowFont).toContain('JetBrains Mono')
  expect(parseFloat(read.eyebrowTracking)).toBeGreaterThan(1)

  // The three values that were outside the system are gone from every paint
  // in the panel — not just from the rules that used to hold them.
  expect(read.paints).not.toContain(MINT)
  expect(read.paints).not.toContain(FOREST)
  expect(read.paints).not.toContain(GRAY_GREEN)
})

test('every word in the explorer clears AA against the ground it sits on', async ({ page }) => {
  const panel = await openExplorer(page)

  const readings = await panel.evaluate((root) => {
    const parse = (value: string) => {
      const m = value.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat)
      if (p.length < 3) return null
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const over = (fg: RGB, bg: RGB): RGB => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    })
    const lum = (c: RGB) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const ratio = (a: RGB, b: RGB) => {
      const la = lum(a), lb = lum(b)
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
    }
    type RGB = { r: number; g: number; b: number; a: number }

    const ground = parse(getComputedStyle(root).backgroundColor)!
    const out: { text: string; ratio: number }[] = []

    for (const el of [...root.querySelectorAll('*')]) {
      const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0)
      if (!hasOwnText) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue

      // The ground this text actually sits on: the nearest painted ancestor,
      // with translucent layers composited over what is behind them.
      const layers: RGB[] = []
      let node: Element | null = el
      while (node) {
        const c = parse(getComputedStyle(node).backgroundColor)
        if (c && c.a > 0) {
          layers.push(c)
          if (c.a >= 1) break
        }
        if (node === root) break
        node = node.parentElement
      }
      let bg = ground
      for (let i = layers.length - 1; i >= 0; i -= 1) bg = layers[i].a >= 1 ? layers[i] : over(layers[i], bg)

      const ink = parse(cs.color)
      if (!ink) continue
      const effective = ink.a >= 1 ? ink : over(ink, bg)
      out.push({ text: (el.textContent || '').trim().slice(0, 40), ratio: ratio(effective, bg) })
    }
    return out
  })

  expect(readings.length).toBeGreaterThan(8)
  for (const r of readings) {
    expect(r.ratio, `"${r.text}" reads at ${r.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  }
})

test('the explorer focus ring is the accent, not a mint that no longer exists', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'keyboard focus ring is a desktop affordance')

  const panel = await openExplorer(page)

  // Tab until focus lands on the AMBER-FILLED primary action. Keyboard focus
  // is what makes :focus-visible match, and this is the one control where a
  // ring drawn inside its own fill cannot be seen.
  let landed = false
  for (let i = 0; i < 60; i += 1) {
    await page.keyboard.press('Tab')
    landed = await page.evaluate(() =>
      !!document.activeElement?.matches('.twin-action:not(.twin-action--quiet)'))
    if (landed) break
  }
  expect(landed, 'never reached the primary action by keyboard').toBe(true)

  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const cs = getComputedStyle(el)
    return {
      inside: !!el.closest('.twin-workbench'),
      color: cs.outlineColor,
      width: cs.outlineWidth,
      style: cs.outlineStyle,
      offset: cs.outlineOffset,
      fill: cs.backgroundColor,
    }
  })

  expect(ring.inside).toBe(true)
  expect(ring.style).not.toBe('none')
  expect(ring.color).toBe(AMBER)
  expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2)
  // It is the amber button, so the ring cannot be drawn inside it.
  expect(ring.fill).toBe(AMBER)
  // The ring must sit OUTSIDE the control's own box. The compare system's
  // shared ring is 1px inset (-2px), so on the amber fill of a .twin-action
  // button it drew amber on amber — a focus indicator nobody could see.
  expect(parseFloat(ring.offset)).toBeGreaterThanOrEqual(0)
})
