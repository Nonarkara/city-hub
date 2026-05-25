/**
 * Inline SVG sparkline — Tufte minimal.
 * No library. Pass an array of numbers; renders a hairline path with optional max marker.
 */
interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  showMax?: boolean
}

export function Sparkline({
  values,
  width = 80,
  height = 22,
  color = '#f59e0b',
  showMax = true,
}: SparklineProps) {
  if (!values.length) return <svg width={width} height={height} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(0.0001, max - min)
  const dx = values.length > 1 ? width / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = i * dx
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const path = `M${points.join(' L')}`
  // Max marker position
  const maxIdx = values.indexOf(max)
  const maxX = maxIdx * dx
  const maxY = 1
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <path d={path} stroke={color} strokeWidth="1" fill="none" />
      {showMax && (
        <>
          <circle cx={maxX} cy={maxY + (height - ((max - min) / range) * (height - 2) - 1 - 1)} r="1.6" fill={color} />
        </>
      )}
    </svg>
  )
}
