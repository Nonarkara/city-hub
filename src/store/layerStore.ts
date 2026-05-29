import { create } from 'zustand'
import type { LayerSpec } from '../config/bangkok-layers'
import { BANGKOK_LAYERS } from '../config/bangkok-layers'

interface LayerStore {
  activeLayers: Set<string>
  layerSpecs: LayerSpec[]

  toggleLayer: (id: string) => void
  setActiveLayers: (layers: Set<string>) => void
  setLayerSpecs: (specs: LayerSpec[]) => void
  resetToDefaults: () => void
}

const DEFAULT_ACTIVE = new Set(
  BANGKOK_LAYERS.filter((l) => l.defaultOn && l.status === 'live').map((l) => l.id),
)

export const useLayerStore = create<LayerStore>()((set) => ({
  activeLayers: DEFAULT_ACTIVE,
  layerSpecs: BANGKOK_LAYERS,

  toggleLayer: (id) =>
    set((state) => {
      const next = new Set(state.activeLayers)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { activeLayers: next }
    }),

  setActiveLayers: (layers) => set({ activeLayers: layers }),

  setLayerSpecs: (specs) => set({ layerSpecs: specs }),

  resetToDefaults: () => set({ activeLayers: DEFAULT_ACTIVE }),
}))
