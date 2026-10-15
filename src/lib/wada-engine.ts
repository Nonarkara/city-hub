/**
 * Sanzo Wada Design Token Integration & Plate Engine
 * Source: https://github.com/Nonarkara/palette
 *
 * Implements the Bauhaus Human Design laws & Wada 348 combination catalog:
 * - Color is a relationship, not a style sticker.
 * - Measured contrast and accessible foreground text.
 * - Dynamic plate orchestration for city atmospheres.
 */
import platesData from '../data/wada/wada-plates.json'

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

/**
 * Curated city plate pairings from Sanzo Wada's 348 combinations.
 * Maps city environmental character / tension to historic plates.
 * Defaults to Plate 002 (Yellow Orange / Dark Tyrian Blue).
 */
export const CITY_DEFAULT_PLATES: Record<string, number> = {
  bangkok: 2,       // Yellow Orange (#f99d1b) + Dark Tyrian Blue (#12354e) — Shadow population / electric contrast
  'chiang-mai': 30, // Pompeian Red (#ab2439) + Mineral Gray (#a2b0ad) — Mountain valley / seasonal haze
  phuket: 1,        // English Red (#d96629) + Cerulian Blue (#0093a5) — Island heat & deep sea pressure
  singapore: 5,     // Cossack Green (#437742) + Vandar Poel's Blue (#064f6e) — Garden city & maritime strait
  ljubljana: 12,    // Isabella Color (#c5a56e) + Green Blue (#00867a) — Alpine emerald & historic stone
  kranj: 23,        // Cinnamon Buff (#fdc57e) + Light Mauve (#9a72aa) — Sava riverbed & transitional economy
}

export function getPlate(id: number): WadaPlate {
  const found = WADA_PLATES.find((p) => p.id === id)
  return found ?? WADA_PLATES[1] // Plate 002 fallback
}

export function getPlateForCity(cityId: string): WadaPlate {
  const plateId = CITY_DEFAULT_PLATES[cityId] ?? 2
  return getPlate(plateId)
}

/**
 * Relative luminance formula according to WCAG 2.1
 */
export function relativeLuminance(rgb: [number, number, number]): number {
  const channels = rgb.map((val) => {
    const channel = val / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/**
 * Measures contrast against pure white vs pure black and returns the readable ink.
 */
export function readableInk(rgb: [number, number, number]): '#101010' | '#f7f5ef' {
  const lum = relativeLuminance(rgb)
  const whiteContrast = (1 + 0.05) / (lum + 0.05)
  const darkContrast = (lum + 0.05) / (0 + 0.05)
  return whiteContrast >= darkContrast ? '#f7f5ef' : '#101010'
}

/**
 * Applies a Wada plate to the document :root dynamically.
 * Updates CSS custom properties without breaking cockpit operational constraints.
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

  // Set contrast-verified ink for dominant & counter fields
  if (plate.colors[0]?.rgb) {
    root.style.setProperty('--dominant-ink', readableInk(plate.colors[0].rgb))
  }
  if (plate.colors[1]?.rgb) {
    root.style.setProperty('--counter-ink', readableInk(plate.colors[1].rgb))
  }
}
