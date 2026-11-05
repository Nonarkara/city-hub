import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CITY_DEFAULT_PLATES, DEFAULT_PLATE_ID } from '../src/lib/wada-cities'
import {
  AA,
  contrastRatio,
  hexToRgb,
  inkOnGround,
  readableInk,
  relativeLuminance,
  rgbToHex,
} from '../src/lib/wada-contrast'

/**
 * The plate engine claims to compute contrast. These tests are the claim.
 *
 * A plate is a PAIR of colours, and the pair has three jobs in the reading
 * room: the header sits ON the dominant, the footer ON the counter, the body
 * ON the paper. Before the engine grew a verified ink per role, one token
 * (`--deep`) was asked to do all three, and five of the six curated cities
 * had an unreadable room — Cerulian Blue on English Red is 1.03:1, Pompeian
 * Red on Mineral Gray is 3.07:1, and Mineral Gray on the paper is 2.05:1.
 *
 * The catalogue is read from disk rather than imported: the engine's JSON
 * import needs an import attribute the test runner does not accept, and a
 * colour rule that cannot be tested is a claim, not a guarantee.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const CATALOGUE = JSON.parse(
  readFileSync(join(HERE, '..', 'src', 'data', 'wada', 'wada-plates.json'), 'utf8'),
) as { totalPlates: number; plates: Array<{ id: number; plateNumber: string; dominant: string; counter: string; colors: unknown[] }> }

const PAPER = '#fff4d8'

test('the catalogue is whole and every plate carries a usable pair', () => {
  expect(CATALOGUE.plates.length).toBe(348)
  expect(CATALOGUE.totalPlates).toBe(348)
  for (const plate of CATALOGUE.plates) {
    expect(plate.dominant).toMatch(/^#[0-9a-f]{6}$/i)
    expect(plate.counter).toMatch(/^#[0-9a-f]{6}$/i)
    expect(plate.colors.length).toBeGreaterThanOrEqual(2)
    // The dominant and the counter must be different colours, or the plate
    // has no relationship in it.
    expect(plate.dominant.toLowerCase()).not.toBe(plate.counter.toLowerCase())
  }
})

test('every curated city points at a plate that exists', () => {
  for (const [cityId, plateId] of Object.entries(CITY_DEFAULT_PLATES)) {
    const plate = CATALOGUE.plates.find((p) => p.id === plateId)
    expect(plate, `${cityId} has no plate ${plateId}`).toBeTruthy()
  }
  // The fallback is a real plate, never nothing.
  expect(CATALOGUE.plates.some((p) => p.id === DEFAULT_PLATE_ID)).toBe(true)
})

test('contrast is measured, not asserted', () => {
  expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1)
  expect(contrastRatio([10, 10, 10], [10, 10, 10])).toBeCloseTo(1, 3)
  // Relative luminance of white is 1, of black is 0.
  expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5)
  expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5)
  // And the ratio is symmetric.
  const a = hexToRgb('#12354e')
  const b = hexToRgb('#f99d1b')
  expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
})

test('the computed ink always clears AA on the colour it is used on', () => {
  // The worst case for any background is the crossover, where light and dark
  // text are equally good. There, the better of the two still clears AA.
  for (let v = 0; v <= 255; v += 1) {
    const ink = readableInk([v, v, v])
    expect(contrastRatio(hexToRgb(ink), [v, v, v])).toBeGreaterThanOrEqual(AA)
  }
})

test('a colour that cannot be read on a ground is moved until it can', () => {
  const ground = hexToRgb(PAPER)
  // Already readable: returned untouched, so the plate keeps its own colour.
  expect(inkOnGround(hexToRgb('#12354e'), ground)).toBe('#12354e')
  // Not readable: moved, and now it reads.
  const moved = inkOnGround(hexToRgb('#a2b0ad'), ground)
  expect(moved).not.toBe('#a2b0ad')
  expect(contrastRatio(hexToRgb(moved), ground)).toBeGreaterThanOrEqual(AA)
  // On a dark ground the ink moves the other way.
  const dark = hexToRgb('#101010')
  const lifted = inkOnGround(hexToRgb('#2a2f33'), dark)
  expect(contrastRatio(hexToRgb(lifted), dark)).toBeGreaterThanOrEqual(AA)
  expect(rgbToHex(hexToRgb(lifted))).toBe(lifted)
})

test('the reading room is readable in every curated city', () => {
  const paper = hexToRgb(PAPER)
  for (const [cityId, plateId] of Object.entries(CITY_DEFAULT_PLATES)) {
    const plate = CATALOGUE.plates.find((p) => p.id === plateId)!
    const dominant = hexToRgb(plate.dominant)
    const counter = hexToRgb(plate.counter)

    // The header: its ink on the dominant. The plate's own counter is used
    // where the pair reads; otherwise the computed ink takes over.
    const headerInk = contrastRatio(counter, dominant) >= AA
      ? plate.counter
      : readableInk(dominant)
    expect(
      contrastRatio(hexToRgb(headerInk), dominant),
      `${cityId}: header ink on the dominant`,
    ).toBeGreaterThanOrEqual(AA)

    // The body: the counter on the paper, moved until it reads.
    const plateInk = inkOnGround(counter, paper)
    expect(
      contrastRatio(hexToRgb(plateInk), paper),
      `${cityId}: body ink on the paper`,
    ).toBeGreaterThanOrEqual(AA)

    // The footer: the paper on that ink. Contrast is symmetric, so this is
    // the same number read the other way round.
    expect(
      contrastRatio(paper, hexToRgb(plateInk)),
      `${cityId}: paper on the footer ink`,
    ).toBeGreaterThanOrEqual(AA)
  }
})

test('Plate 002 is unchanged by the verified inks', () => {
  // Bangkok's room is the one the design was drawn around. The engine must
  // not quietly restyle it: Dark Tyrian Blue on Yellow Orange is 6.00:1 and
  // on the paper 11.66:1, so both inks stay exactly as they were.
  const plate = CATALOGUE.plates.find((p) => p.id === 2)!
  const paper = hexToRgb(PAPER)
  const dominant = hexToRgb(plate.dominant)
  const counter = hexToRgb(plate.counter)
  expect(contrastRatio(counter, dominant)).toBeGreaterThanOrEqual(AA)
  expect(inkOnGround(counter, paper)).toBe('#12354e')
})
