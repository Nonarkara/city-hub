/**
 * Sanzo Wada colour maths.
 *
 * Kept apart from the catalogue and from the DOM, because this is the part
 * that has to be right: a plate is a RELATIONSHIP between two colours, and a
 * relationship is only meaningful if both colours can be read against the
 * ground they are painted on.
 *
 * No imports. The unit tests run this in Node, where a JSON import would
 * need an import attribute the test runner does not accept.
 */

export type Rgb = [number, number, number]

/** WCAG 2.1 contrast for normal text. */
export const AA = 4.5

/**
 * AA, with headroom.
 *
 * A colour found by search lands exactly on the line it was given, and a
 * value that sits on the line is one rounding step away from failing it.
 * The extra tenth costs nothing you can see and cannot fail a check.
 */
export const AA_SAFE = 4.6

/** Relative luminance formula according to WCAG 2.1 */
export function relativeLuminance(rgb: Rgb): number {
  const channels = rgb.map((val) => {
    const channel = val / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** WCAG 2.1 contrast ratio between two sRGB colours. 1 = identical, 21 = max. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ]
}

export function rgbToHex(rgb: Rgb): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

/**
 * Measures contrast against a light ink and a dark ink and returns the one
 * that reads better on this colour.
 *
 * The warm pair (#f7f5ef / #101010) is preferred because it belongs to the
 * interface. But at the crossover, where light and dark are equally good,
 * the warm pair bottoms out at 4.48:1 — just under AA. So when it cannot
 * clear the bar, the extremes take over: the better of pure black and pure
 * white is never worse than 4.58:1, on any ground at all.
 */
export function readableInk(rgb: Rgb): '#101010' | '#f7f5ef' | '#000000' | '#ffffff' {
  const warmLight = contrastRatio(hexToRgb('#f7f5ef'), rgb)
  const warmDark = contrastRatio(hexToRgb('#101010'), rgb)
  if (Math.max(warmLight, warmDark) >= AA) {
    return warmLight >= warmDark ? '#f7f5ef' : '#101010'
  }
  const pureLight = contrastRatio([255, 255, 255], rgb)
  const pureDark = contrastRatio([0, 0, 0], rgb)
  return pureLight >= pureDark ? '#ffffff' : '#000000'
}

/**
 * A colour that can be read on a given ground.
 *
 * If the colour already clears the minimum it is returned untouched — the
 * plate keeps its own colour. If it does not, it moves toward the end of the
 * range that separates it from the ground: darkened on a light ground,
 * lightened on a dark one. The hue is preserved; only the light changes.
 */
export function inkOnGround(rgb: Rgb, ground: Rgb, min = AA): string {
  if (contrastRatio(rgb, ground) >= min) return rgbToHex(rgb)
  const toward = relativeLuminance(ground) > 0.35 ? 0 : 255
  const scale = (t: number): Rgb =>
    [0, 1, 2].map((i) => Math.round(rgb[i] + (toward - rgb[i]) * t)) as Rgb
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (contrastRatio(scale(mid), ground) >= min) hi = mid
    else lo = mid
  }
  return rgbToHex(scale(hi))
}
