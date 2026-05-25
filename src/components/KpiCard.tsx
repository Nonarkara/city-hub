import type { KpiItem } from '../config/cities'

export function KpiCard({ kpi }: { kpi: KpiItem }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{kpi.label}</span>
      <span className="kpi-value">
        {kpi.value}
        {kpi.unit && <span className="kpi-unit">{kpi.unit}</span>}
      </span>
    </div>
  )
}
