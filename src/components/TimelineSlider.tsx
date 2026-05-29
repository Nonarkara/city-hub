import { useEffect, useState } from 'react'

interface TimelineSliderProps {
  activeDate: string
  onChange: (dateStr: string) => void
  visible: boolean
}

export function TimelineSlider({ activeDate, onChange, visible }: TimelineSliderProps) {
  const maxDays = 30
  const [offset, setOffset] = useState(maxDays)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const active = new Date(activeDate)
    active.setHours(0, 0, 0, 0)
    
    // Days difference
    const diff = Math.floor((today.getTime() - active.getTime()) / 86400000)
    const newOffset = maxDays - Math.max(0, Math.min(maxDays, diff))
    setOffset(newOffset)
  }, [activeDate])

  const handleScrub = (val: number) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(today.getTime() - (maxDays - val) * 86400000)
    onChange(target.toISOString().split('T')[0])
  }

  if (!visible) return null

  const displayDate = new Date(activeDate).toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })

  return (
    <div className="timeline-slider-container">
      <div className="timeline-header">
        <span className="timeline-label">TEMPORAL ENGINE</span>
        <span className="timeline-date">{displayDate}</span>
      </div>
      <input
        type="range"
        min={0}
        max={maxDays}
        value={offset}
        onChange={(e) => handleScrub(Number(e.target.value))}
        className="timeline-range"
        aria-label="Timeline date"
      />
      <div className="timeline-ticks">
        <button onClick={() => handleScrub(0)}>-30D</button>
        <button onClick={() => handleScrub(maxDays - 14)}>-14D</button>
        <button onClick={() => handleScrub(maxDays - 7)}>-7D</button>
        <button onClick={() => handleScrub(maxDays)}>NOW</button>
      </div>
    </div>
  )
}
