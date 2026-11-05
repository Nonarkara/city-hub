/**
 * Sanzo Wada Design Token Integration & Plate Engine
 * Source: https://github.com/Nonarkara/palette
 *
 * Implements the Bauhaus Human Design laws & Wada 348 combination catalog:
 * - Color is a relationship, not a style sticker.
 * - Measured contrast and accessible foreground text.
 * - Dynamic plate orchestration for city atmospheres.
 *
 * The colour maths lives in `wada-contrast.ts` and the curated city pairings
 * in `wada-cities.ts`, so both can be tested without a DOM and without the
 * JSON catalogue.
 */
import platesData from '../data/wada/wada-plates.json'
import { CITY_DEFAULT_PLATES, DEFAULT_PLATE_ID } from './wada-cities'
import {
  AA,
  AA_SAFE,
  contrastRatio,
  hexToRgb,
  inkOnGround,
  readableInk,
  relativeLuminance,
  rgbToHex,
  type Rgb,
} from './wada-contrast'

export { CITY_DEFAULT_PLATES, contrastRatio, hexToRgb, inkOnGround, readableInk, relativeLuminance, rgbToHex }
export type { Rgb }

export interface WadaColor {
  name: string
  hex: string
  rgb: [number, number, number]
  cmyk?: [number, number, number, number]
  lab?: [number, number, number]
}

export interface WadaPlate {
  id: number
  plateNumber: string
  colors: WadaColor[]
  dominant: string
  counter: string
  support?: string
  signal?: string
}

export const WADA_PLATES: WadaPlate[] = (platesData as unknown as { plates: WadaPlate[] }).plates

export function getPlate(id: number): WadaPlate {
  const found = WADA_PLATES.find((p) => p.id === id)
  return found ?? WADA_PLATES.find((p) => p.id === DEFAULT_PLATE_ID)!
}

export function getPlateForCity(cityId: string): WadaPlate {
  const plateId = CITY_DEFAULT_PLATES[cityId] ?? DEFAULT_PLATE_ID
  return getPlate(plateId)
}

/** The reading room's ground. The stylesheet owns it; the engine reads it. */
const FALLBACK_PAPER = '#fff4d8'

function readPaper(root: HTMLElement): string {
  if (typeof window === 'undefined') return FALLBACK_PAPER
  const value = getComputedStyle(root).getPropertyValue('--paper').trim()
  return value || FALLBACK_PAPER
}

/**
 * Applies a Wada plate to the document :root dynamically.
 * Updates CSS custom properties without breaking cockpit operational constraints.
 *
 * A plate is a pair of colours, and a pair has three jobs in the reading
 * room: the header sits ON the dominant, the footer ON the counter, and the
 * body ON the paper. One colour cannot do all three — Pompeian Red on
 * Mineral Gray is 3.07:1, and Cerulian Blue on English Red is 1.03:1, so a
 * single "counter" token paints an unreadable room for five of the six
 * curated cities. Each role therefore gets its own verified ink:
 *
 *   --header-ink  the counter where the pair reads, else the computed ink
 *   --plate-ink   the counter on paper, darkened until it reads on paper
 *
 * Because contrast is symmetric, `--paper` on `--plate-ink` clears the same
 * ratio the other way round. Plate 002 is unchanged by this, which is the
 * point: the token follows the plate, it does not restate it.
 */
export function applyWadaPlate(plate: WadaPlate) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Set active plate attribute for CSS targeting
  root.setAttribute('data-wada-plate', plate.plateNumber)

  // Primary chord tokens
  // Navigation keeps one meaning across cities; the plate belongs to atmosphere.
  root.style.setProperty('--amber', '#f99d1b')
  root.style.setProperty('--chord', plate.dominant)
  root.style.setProperty('--deep', plate.counter)

  if (plate.support) {
    root.style.setProperty('--wada-support', plate.support)
  } else {
    root.style.removeProperty('--wada-support')
  }

  if (plate.signal) {
    root.style.setProperty('--wada-signal', plate.signal)
  } else {
    root.style.removeProperty('--wada-signal')
  }

  const paperRgb = hexToRgb(readPaper(root))
  const dominantRgb: Rgb = hexToRgb(plate.dominant)
  const counterRgb: Rgb = hexToRgb(plate.counter)

  // The reading room's ink: the plate's own counter where it can be read on
  // the paper, and the same colour darkened where it cannot.
  root.style.setProperty('--plate-ink', inkOnGround(counterRgb, paperRgb, AA_SAFE))

  // The header sits on the dominant. The counter is its natural ink; where
  // the pair cannot be read, the computed ink takes its place.
  root.style.setProperty(
    '--header-ink',
    contrastRatio(counterRgb, dominantRgb) >= AA ? plate.counter : readableInk(dominantRgb),
  )

  // Set contrast-verified ink for dominant & counter fields
  root.style.setProperty('--dominant-ink', readableInk(dominantRgb))
  root.style.setProperty('--counter-ink', readableInk(counterRgb))
}
