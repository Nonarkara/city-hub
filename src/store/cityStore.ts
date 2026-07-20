import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CityConfig } from '../config/cities'
import { CITIES } from '../config/cities'

interface CityStore {
  activeCity: CityConfig
  customCities: CityConfig[]
  compareMode: boolean
  compareSet: string[]

  setActiveCity: (city: CityConfig) => void
  toggleCompareCity: (cityId: string) => void
  clearCompareSet: () => void
  addCustomCity: (city: CityConfig) => void
  removeCustomCity: (cityId: string) => void

  /** All cities = built-ins + user-added */
  allCities: () => CityConfig[]
}

export const useCityStore = create<CityStore>()(
  persist(
    (set, get) => ({
      activeCity: CITIES[0],
      customCities: [],
      compareMode: false,
      compareSet: [],

      setActiveCity: (city) => set({ activeCity: city }),

      toggleCompareCity: (cityId) => {
        const { compareSet } = get()
        const has = compareSet.includes(cityId)
        const next = has
          ? compareSet.filter((id) => id !== cityId)
          : compareSet.length >= 8
            ? compareSet
            : [...compareSet, cityId]
        set({ compareSet: next, compareMode: next.length >= 2 })
      },

      clearCompareSet: () => set({ compareSet: [], compareMode: false }),

      addCustomCity: (city) => {
        const { customCities } = get()
        const existing = CITIES.find((c) => c.id === city.id) ?? customCities.find((c) => c.id === city.id)
        if (existing) {
          set({ activeCity: existing })
          return
        }
        set({ customCities: [...customCities, city], activeCity: city })
      },

      removeCustomCity: (cityId) => {
        const { customCities, activeCity, compareSet } = get()
        const next = customCities.filter((c) => c.id !== cityId)
        const updates: Partial<CityStore> = { customCities: next }
        if (activeCity.id === cityId) {
          updates.activeCity = CITIES[0]
        }
        if (compareSet.includes(cityId)) {
          updates.compareSet = compareSet.filter((id) => id !== cityId)
        }
        set(updates)
      },

      allCities: () => {
        const { customCities } = get()
        return [...CITIES, ...customCities]
      },
    }),
    {
      name: 'city-hub-city-store',
      // customCities no longer persisted — typed cities are viewed ephemerally
      // (active for the session, never saved) so the picker never accumulates.
      // Only compare pins survive reload.
      partialize: (state) => ({
        compareSet: state.compareSet,
      }),
    },
  ),
)
