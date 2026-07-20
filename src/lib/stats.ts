/**
 * Statistical Primitives — real algorithms, not hardcoded confidence.
 *
 * All functions are pure, work on small arrays (< 500 pts), and
 * return honest statistical results with confidence where applicable.
 */

export interface PearsonResult {
  r: number
  p: number // two-tailed p-value (approximate)
  n: number
  lag: number // hours shifted; 0 = synchronous
}

/** Mean of an array */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** Standard deviation (population) */
export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

/** Z-score for a value against an array's distribution */
export function zScore(value: number, arr: number[]): number {
  const m = mean(arr)
  const s = stdDev(arr)
  if (s === 0) return 0
  return (value - m) / s
}

/** Detect outliers using Z-score threshold */
export function zScoreOutliers(arr: number[], threshold = 2): number[] {
  return arr.map((v, i) => (Math.abs(zScore(v, arr)) > threshold ? i : -1)).filter((i) => i >= 0)
}

/** Detect outliers using IQR method */
export function iqrOutliers(arr: number[]): number[] {
  if (arr.length < 4) return []
  const sorted = [...arr].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr
  return arr.map((v, i) => (v < lower || v > upper ? i : -1)).filter((i) => i >= 0)
}

/** Pearson correlation coefficient with optional lag */
export function pearson(x: number[], y: number[], lag = 0): PearsonResult {
  const n = Math.min(x.length, y.length)
  if (n < 4) return { r: 0, p: 1, n: 0, lag }

  let xx: number[]
  let yy: number[]

  if (lag === 0) {
    xx = x.slice(0, n)
    yy = y.slice(0, n)
  } else if (lag > 0) {
    xx = x.slice(0, n - lag)
    yy = y.slice(lag, n)
  } else {
    xx = x.slice(-lag, n)
    yy = y.slice(0, n + lag)
  }

  const m = Math.min(xx.length, yy.length)
  if (m < 4) return { r: 0, p: 1, n: 0, lag }

  const mx = mean(xx)
  const my = mean(yy)
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < m; i++) {
    const dx = xx[i] - mx
    const dy = yy[i] - my
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  const r = den === 0 ? 0 : num / den

  // Approximate two-tailed p-value using Fisher z-transform
  const z = Math.atanh(r) * Math.sqrt(m - 3)
  const p = 2 * (1 - normalCDF(Math.abs(z)))

  return { r, p, n: m, lag }
}

/** Find best lag correlation between two series */
export function bestLagCorrelation(x: number[], y: number[], maxLag = 12): PearsonResult {
  let best: PearsonResult = { r: 0, p: 1, n: 0, lag: 0 }
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const res = pearson(x, y, lag)
    if (res.n >= 4 && Math.abs(res.r) > Math.abs(best.r)) {
      best = res
    }
  }
  return best
}

/** Spearman rank correlation (non-linear relationships) */
export function spearman(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 4) return 0
  const rank = (arr: number[]) => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const ranks = new Array<number>(arr.length)
    // Average ranks for ties: equal values share the mean of their rank span
    let j = 0
    while (j < sorted.length) {
      let k = j
      while (k + 1 < sorted.length && sorted[k + 1].v === sorted[j].v) k++
      const avgRank = (j + k) / 2 + 1
      for (let m = j; m <= k; m++) ranks[sorted[m].i] = avgRank
      j = k + 1
    }
    return ranks
  }
  const rx = rank(x.slice(0, n))
  const ry = rank(y.slice(0, n))
  return pearson(rx, ry).r
}

/** Simple CUSUM change-point detection */
export function cusumChangePoints(arr: number[], threshold = 2): number[] {
  if (arr.length < 10) return []
  const m = mean(arr)
  const s = stdDev(arr) || 1
  let pos = 0
  let neg = 0
  const points: number[] = []
  for (let i = 0; i < arr.length; i++) {
    const z = (arr[i] - m) / s
    pos = Math.max(0, pos + z - 0.5)
    neg = Math.max(0, neg - z - 0.5)
    if (pos > threshold || neg > threshold) {
      points.push(i)
      pos = 0
      neg = 0
    }
  }
  return points
}

/** Linear regression slope and intercept */
export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = Math.min(x.length, y.length)
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 }
  const mx = mean(x.slice(0, n))
  const my = mean(y.slice(0, n))
  let num = 0
  let den = 0
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    num += dx * dy
    den += dx * dx
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  for (let i = 0; i < n; i++) {
    const pred = slope * x[i] + intercept
    ssRes += (y[i] - pred) ** 2
    ssTot += (y[i] - my) ** 2
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  return { slope, intercept, r2 }
}

/** Exponential moving average */
export function ema(arr: number[], alpha = 0.3): number[] {
  if (arr.length === 0) return []
  const out = [arr[0]]
  for (let i = 1; i < arr.length; i++) {
    out.push(alpha * arr[i] + (1 - alpha) * out[i - 1])
  }
  return out
}

/** Rolling mean with window size */
export function rollingMean(arr: number[], window: number): number[] {
  if (window <= 1 || arr.length < window) return arr
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
    if (i >= window) sum -= arr[i - window]
    out.push(i >= window - 1 ? sum / window : sum / (i + 1))
  }
  return out
}

/** Seasonal average for same-hour comparisons (expects 24h cyclic data) */
export function seasonalAverage(history: number[], cycle = 24): number[] {
  if (history.length < cycle * 2) return []
  const buckets: number[][] = Array.from({ length: cycle }, () => [])
  for (let i = 0; i < history.length; i++) {
    buckets[i % cycle].push(history[i])
  }
  return buckets.map((b) => (b.length ? b.reduce((a, v) => a + v, 0) / b.length : 0))
}

/** Normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + p * absX)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX)
  return 0.5 * (1 + sign * y)
}
