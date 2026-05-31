import { create } from 'zustand'
import type { BasemapId } from '../config/cities'
import { defaultBasemap } from '../components/MapView'
import type { InsightTemplate } from '../components/InsightPanel'
import type { DistrictSummary } from '../hooks/useDistrictData'

interface UIStore {
  governorMode: boolean
  cmdkOpen: boolean
  insightOpen: boolean
  basemap: BasemapId
  mobileSheetOpen: boolean
  selectedDistrict: DistrictSummary | null
  appDraft: string | null
  basemapMenuOpen: boolean
  activeInsight: InsightTemplate | null
  activeDate: string
  splitOpen: boolean
  chatOpen: boolean
  actionCenterOpen: boolean
  activeOverlays: Set<string>
  globeView: boolean
  forecastOpen: boolean

  setGovernorMode: (v: boolean) => void
  toggleGovernorMode: () => void
  setCmdkOpen: (v: boolean) => void
  setInsightOpen: (v: boolean) => void
  setBasemap: (v: BasemapId) => void
  setMobileSheetOpen: (v: boolean) => void
  setSelectedDistrict: (d: DistrictSummary | null) => void
  setAppDraft: (d: string | null) => void
  setBasemapMenuOpen: (v: boolean) => void
  setActiveInsight: (i: InsightTemplate | null) => void
  setActiveDate: (d: string) => void
  setSplitOpen: (v: boolean) => void
  setChatOpen: (v: boolean) => void
  setActionCenterOpen: (v: boolean) => void
  toggleOverlay: (id: string) => void
  setGlobeView: (v: boolean) => void
  setForecastOpen: (v: boolean) => void
}

export const useUIStore = create<UIStore>()((set) => ({
  governorMode: true,
  cmdkOpen: false,
  insightOpen: false,
  basemap: defaultBasemap(),
  mobileSheetOpen: false,
  selectedDistrict: null,
  appDraft: null,
  basemapMenuOpen: false,
  activeInsight: null,
  activeDate: new Date().toISOString().split('T')[0],
  splitOpen: false,
  chatOpen: false,
  actionCenterOpen: false,
  activeOverlays: new Set<string>(),
  globeView: false,
  forecastOpen: false,

  setGovernorMode: (v) => set({ governorMode: v }),
  toggleGovernorMode: () => set((s) => ({ governorMode: !s.governorMode })),
  setCmdkOpen: (v) => set({ cmdkOpen: v }),
  setInsightOpen: (v) => set({ insightOpen: v }),
  setBasemap: (v) => set({ basemap: v }),
  setMobileSheetOpen: (v) => set({ mobileSheetOpen: v }),
  setSelectedDistrict: (d) => set({ selectedDistrict: d }),
  setAppDraft: (d) => set({ appDraft: d }),
  setBasemapMenuOpen: (v) => set({ basemapMenuOpen: v }),
  setActiveInsight: (i) => set({ activeInsight: i }),
  setActiveDate: (d) => set({ activeDate: d }),
  setSplitOpen: (v) => set({ splitOpen: v }),
  setChatOpen: (v) => set({ chatOpen: v }),
  setActionCenterOpen: (v) => set({ actionCenterOpen: v }),
  toggleOverlay: (id) => set((s) => {
    const next = new Set(s.activeOverlays)
    if (next.has(id)) next.delete(id); else next.add(id)
    return { activeOverlays: next }
  }),
  setGlobeView: (v) => set({ globeView: v }),
  setForecastOpen: (v) => set({ forecastOpen: v }),
}))
