/**
 * Settings Panel — user-configurable preferences.
 *
 * Anomaly sensitivity, benchmark baselines, units, notifications.
 */
import { useState } from 'react'
import { useSelectionStore } from '../store/selectionStore'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const activeBenchmarks = useSelectionStore((s) => s.activeBenchmarks)
  const setActiveBenchmarks = useSelectionStore((s) => s.setActiveBenchmarks)
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium')
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">OPERATOR SETTINGS</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-section">
          <span className="settings-section-title">Anomaly Sensitivity</span>
          <div className="settings-segmented">
            {(['low', 'medium', 'high'] as const).map((s) => (
              <button
                key={s}
                className={`settings-segment ${sensitivity === s ? 'active' : ''}`}
                onClick={() => setSensitivity(s)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <span className="settings-section-title">Benchmark Lines</span>
          <div className="settings-checks">
            <label className="settings-check">
              <input
                type="checkbox"
                checked={activeBenchmarks.who}
                onChange={(e) => setActiveBenchmarks({ ...activeBenchmarks, who: e.target.checked })}
              />
              <span>WHO Guideline (25 µg/m³)</span>
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={activeBenchmarks.national}
                onChange={(e) => setActiveBenchmarks({ ...activeBenchmarks, national: e.target.checked })}
              />
              <span>Thai National Average</span>
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={activeBenchmarks.seasonal}
                onChange={(e) => setActiveBenchmarks({ ...activeBenchmarks, seasonal: e.target.checked })}
              />
              <span>Seasonal Average</span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <span className="settings-section-title">Units</span>
          <div className="settings-segmented">
            {(['metric', 'imperial'] as const).map((u) => (
              <button
                key={u}
                className={`settings-segment ${units === u ? 'active' : ''}`}
                onClick={() => setUnits(u)}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-footer">
          <span className="settings-hint">Shift-click districts to compare</span>
          <span className="settings-hint">Press ? for keyboard shortcuts</span>
        </div>
      </div>
    </div>
  )
}
