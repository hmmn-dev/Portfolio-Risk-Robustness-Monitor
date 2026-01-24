import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { UnderlyingSeries } from '../engine/types'
import { idbStorage } from './idbStorage'

type UnderlyingState = {
  seriesBySymbol: Record<string, UnderlyingSeries>
  hasHydrated: boolean
  setUnderlying: (symbol: string, series: UnderlyingSeries) => void
  setAllUnderlying: (entries: Record<string, UnderlyingSeries>) => void
  clearUnderlying: () => void
  setHasHydrated: (value: boolean) => void
}

export const useUnderlyingStore = create<UnderlyingState>()(
  persist(
    (set) => ({
      seriesBySymbol: {},
      hasHydrated: false,
      setUnderlying: (symbol, series) =>
        set((state) => ({
          seriesBySymbol: {
            ...state.seriesBySymbol,
            [symbol]: series,
          },
        })),
      setAllUnderlying: (entries) => set({ seriesBySymbol: entries }),
      clearUnderlying: () => set({ seriesBySymbol: {} }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'healthreport.latestUnderlyingV2',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ seriesBySymbol: state.seriesBySymbol }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
