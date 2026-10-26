import { expect, test, type Page } from '@playwright/test'

/**
 * MSH §6 — the plan card (More → Plan).
 *
 * The card used to be a fixed 760px wide with 704px of inner column while the
 * content demanded about 460px: every prose block sat under a ch-cap of
 * 62-74ch (356-472px at these type sizes), and the CAPACITY/DEMAND figure row
 * wanted 510px inline — the Waste system of Bangkok, Singapore and Brasília.
 * Two width constraints on one column is what produced the dead strip: 46% of
 * the measurement-debt section was empty, the section rules ran 82-91% wider
 * than their own text, and each step's utilisation figure sat 602px from the
 * label it belongs to.
 *
 * These specs pin the repair as behaviour, not as a claim:
 *   1. the card is sized to the column its content demands, not wider
 *   2. the column is the ONLY measure — no second width constraint
 *   3. every section uses the column; no dead strip beside the prose
 *   4. a step's utilisation figure is adjacent to its system label
 *   5. a rule is no wider than the content it rules
 *   6. the figure pair reads as a pair, and never spills out of its column
 */

const OVERPASS_PROXY = '**/api/overpass'

const openPlan = async (page: Page) => {
  // The city-image read is not what this spec measures. Waiting on a public
  // Overpass mirror turns a geometry spec into a network spec — and a mirror
  // under load is how this spec would fail for a reason that has nothing to do
  // with the layout. Answer it locally: an empty read, so the panel says the
  // image is unavailable rather than inventing evidence for it.
  await page.route(OVERPASS_PROXY, (route) => route.fulfill({
    json: { osm3s: { timestamp_osm_base: '2026-10-15T00:00:00Z' }, elements: [] },
  }))
  await page.goto('/?city=bangkok&lens=esri-imagery', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.topbar')).toBeVisible()
  await page.locator('[aria-label="More"]').first().click()
  await page.getByRole('menuitem', { name: 'Plan', exact: true }).click()
  await expect(page.locator('.plan-card')).toBeVisible()
  await expect(page.locator('.cm-panel')).toBeVisible()
}

/** What the plan card's geometry actually is, measured from text ink. */
type PlanMetrics = {
  innerW: number
  cardW: number
  columnRight: number
  sections: Record<string, { voidPx: number }>
  steps: { sys: string; util: string; gap: number }[]
  rules: { cls: string; ruleW: number; ownTextW: number }[]
  proseCaps: { cls: string; maxWidth: string }[]
  figs: { sideBySide: boolean; overflow: boolean; rowW: number }[]
  figsOverflow: boolean
  figsSideBySide: boolean
  overflowX: boolean
  scrolls: boolean
  scrollH: number
  clientH: number
  closeVisible: boolean
  closeFocusable: boolean
}

const measurePlan = (page: Page): Promise<PlanMetrics> =>
  page.evaluate(() => {
    // True text line boxes: the width of the ink, not the width of the box.
    const lineRects = (root: Node) => {
      const out: DOMRect[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        if (node.textContent && node.textContent.trim()) {
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const rect of range.getClientRects()) {
            if (rect.width > 1 && rect.height > 1) out.push(rect)
          }
        }
        node = walker.nextNode()
      }
      return out
    }
    const inkOf = (root: Node) => {
      const rects = lineRects(root)
      if (!rects.length) return null
      let maxRight = -Infinity
      for (const rect of rects) if (rect.right > maxRight) maxRight = rect.right
      return maxRight
    }

    const card = document.querySelector('.plan-card') as HTMLElement
    const panel = document.querySelector('.cm-panel') as HTMLElement
    const cr = card.getBoundingClientRect()
    const cs = getComputedStyle(card)
    const padLeft = parseFloat(cs.paddingLeft)
    const innerW = cr.width - padLeft * 2
    const columnRight = cr.left + padLeft + innerW

    const voidOf = (sel: string) => {
      const el = panel.querySelector(sel)
      if (!el) return null
      const right = inkOf(el)
      if (right == null) return null
      return { voidPx: Math.round(columnRight - right) }
    }

    const sections: Record<string, { voidPx: number }> = {}
    for (const sel of ['.cm-head', '.cm-sys-list', '.cm-plan', '.cm-debt', '.cm-foot']) {
      const v = voidOf(sel)
      if (v) sections[sel] = v
    }

    const steps = [...panel.querySelectorAll('.cm-step-head')].map((head) => {
      const sys = head.querySelector('.cm-step-sys') as HTMLElement
      const util = head.querySelector('.cm-step-util') as HTMLElement
      return {
        sys: (sys.textContent || '').trim(),
        util: (util.textContent || '').trim(),
        gap: Math.round(util.getBoundingClientRect().left - sys.getBoundingClientRect().right),
      }
    })

    const rules = [...panel.querySelectorAll('.cm-plan-h, .cm-debt-h, .cm-foot, .cm-head')].map((el) => {
      const right = inkOf(el)
      return {
        cls: (el.className || '').toString().split(' ').slice(-1)[0],
        ruleW: Math.round(el.getBoundingClientRect().width),
        ownTextW: right == null ? 0 : Math.round(right - el.getBoundingClientRect().left),
      }
    })

    const proseCaps = [
      '.cm-opening', '.cm-sys-verdict', '.cm-sys-where', '.cm-sys-caveat',
      '.cm-plan-empty', '.cm-iv-mech', '.cm-iv-why', '.cm-debt-lead',
      '.cm-debt-item', '.cm-foot',
    ].map((sel) => {
      const el = panel.querySelector(sel) as HTMLElement
      return { cls: sel, maxWidth: el ? getComputedStyle(el).maxWidth : 'missing' }
    })

    const figs = [...panel.querySelectorAll('.cm-sys-figures')].map((row) => {
      const kids = [...row.querySelectorAll('.cm-fig')].map((k) => Math.round(k.getBoundingClientRect().top))
      return {
        sideBySide: new Set(kids).size === 1,
        overflow: row.scrollWidth > row.clientWidth + 1,
        rowW: Math.round(row.getBoundingClientRect().width),
      }
    })

    const close = card.querySelector('.about-close') as HTMLElement
    close.focus()

    card.scrollTop = 0
    const before = card.scrollTop
    card.scrollTop = 99999
    const after = card.scrollTop
    card.scrollTop = 0

    return {
      innerW: Math.round(innerW),
      cardW: Math.round(cr.width),
      columnRight: Math.round(columnRight),
      sections,
      steps,
      rules,
      proseCaps,
      figs,
      figsOverflow: figs.some((f) => f.overflow),
      figsSideBySide: figs.length > 0 && figs.every((f) => f.sideBySide),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      scrolls: after > before,
      scrollH: card.scrollHeight,
      clientH: Math.round(cr.height),
      closeVisible: cr.top <= close.getBoundingClientRect().top && close.getBoundingClientRect().bottom <= cr.bottom,
      closeFocusable: document.activeElement === close,
    }
  })

test('the plan card is sized to the column its content demands', async ({ page }, testInfo) => {
  await openPlan(page)
  const m = await measurePlan(page)

  // The defect: a fixed 760px card with 704px of inner column around content
  // that never needed more than ~460px. The card must not be wider than the
  // content demands.
  expect(m.cardW).toBeLessThanOrEqual(520)

  // ...and not narrower than the widest thing that must not wrap: the
  // CAPACITY/DEMAND figure row, which is 414px wide in its stacked form for
  // the widest of the nineteen cities.
  if (!testInfo.project.name.includes('mobile')) {
    expect(m.innerW).toBeGreaterThanOrEqual(410)
    // Capacity and demand read as a pair, side by side, on any width that can
    // hold them. Inline, the Waste row wanted 510px and wrapped in a 434px
    // box — an accidental wrap in the middle of a comparison.
    expect(m.figsSideBySide).toBe(true)
  }
  // And no figure row may spill out of its column at any width.
  expect(m.figsOverflow).toBe(false)

  // The column is the only measure. A ch-cap on a prose block is a second
  // width constraint on one column, and that is the mechanism that produced
  // the dead strip in the first place.
  for (const cap of m.proseCaps) {
    expect(cap.maxWidth, `${cap.cls} has a second width constraint`).not.toMatch(/ch$/)
  }

  // Every section uses the column. Before the repair the measurement-debt
  // section left 323px (46%) empty beside the prose that ends the card.
  for (const [sel, s] of Object.entries(m.sections)) {
    expect(s.voidPx, `${sel} leaves a dead strip beside its text`).toBeLessThanOrEqual(40)
  }
})

test('a step keeps its utilisation figure beside its system label', async ({ page }) => {
  await openPlan(page)
  const m = await measurePlan(page)

  expect(m.steps.length).toBeGreaterThan(0)
  for (const step of m.steps) {
    // `flex: 1` on the system label used to strand the figure 602px away.
    expect(step.gap, `${step.sys} utilisation is stranded from its label`).toBeLessThanOrEqual(24)
  }
})

test('a rule is no wider than the content it rules', async ({ page }) => {
  await openPlan(page)
  const m = await measurePlan(page)

  expect(m.rules.length).toBeGreaterThan(0)
  for (const rule of m.rules) {
    // 702px of hairline under 63px of text was the worst of it; 82-91% of the
    // rule was over space nothing occupied.
    expect(rule.ruleW - rule.ownTextW, `${rule.cls} rule overruns its content`).toBeLessThanOrEqual(120)
  }
})

test('the plan card still scrolls, still closes, and still fits', async ({ page }) => {
  await openPlan(page)
  const m = await measurePlan(page)

  // The card is a long document; it must admit that it scrolls.
  expect(m.scrollH).toBeGreaterThan(m.clientH)
  expect(m.scrolls).toBe(true)
  expect(m.overflowX).toBe(false)

  // The close control must stay reachable and focusable.
  expect(m.closeVisible).toBe(true)
  expect(m.closeFocusable).toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.locator('.plan-card')).toHaveCount(0)
})
