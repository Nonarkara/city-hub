/**
 * Selection Store — the nervous system of the analytical surface.
 *
 * Cross-links every view: map, charts, panels, and insights share
 * a single selection state so the operator never loses context.
 */
import { create } from 'zustand'

export type ComparisonMode = 'none' | 'previous_period' | 'year_ago' | 'peer_city'

export interface BenchmarkSet {
  who: boolean
  national: boolean
  seasonal: boolean
  custom?: number
}

interface SelectionStore {
  selectedDistrictId: string | null
  hoveredFeatureId: string | null
  brushedTimeRange: [number, number] | null
  activeBenchmarks: BenchmarkSet
  comparisonMode: ComparisonMode
  pinnedInsights: string[]
  districtComparePair: [string, string] | null

  setSelectedDistrictId: (id: string | null) => void
  setHoveredFeatureId: (id: string | null) => void
  setBrushedTimeRange: (range: [number, number] | null) => void
  setActiveBenchmarks: (b: BenchmarkSet) => void
  setComparisonMode: (m: ComparisonMode) => void
  togglePinnedInsight: (id: string) => void
  setDistrictComparePair: (pair: [string, string] | null) => void
  clearSelection: () => void
}

export const useSelectionStore = create<SelectionStore>()((set) => ({
  selectedDistrictId: null,
  hoveredFeatureId: null,
  brushedTimeRange: null,
  activeBenchmarks: { who: true, national: true, seasonal: false },
  comparisonMode: 'none',
  pinnedInsights: [],
  districtComparePair: null,

  setSelectedDistrictId: (id) => set({ selectedDistrictId: id }),
  setHoveredFeatureId: (id) => set({ hoveredFeatureId: id }),
  setBrushedTimeRange: (range) => set({ brushedTimeRange: range }),
  setActiveBenchmarks: (b) => set({ activeBenchmarks: b }),
  setComparisonMode: (m) => set({ comparisonMode: m }),
  togglePinnedInsight: (id) => set((s) => {
    const next = new Set(s.pinnedInsights)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { pinnedInsights: [...next] }
  }),
  setDistrictComparePair: (pair) => set({ districtComparePair: pair }),
  clearSelection: () => set({
    selectedDistrictId: null,
    hoveredFeatureId: null,
    brushedTimeRange: null,
    districtComparePair: null,
  }),
}))
