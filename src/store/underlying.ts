import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UnderlyingSeries } from '../engine/types'
import { idbStorage } from './idbStorage'

type UnderlyingState = {
  seriesBySymbol: Record<string, UnderlyingSeries>
  hasHydrated: boolean
  setUnderlying: (symbol: string, series: UnderlyingSeries) => void
  setAllUnderlying: (entries: Record<string, UnderlyingSeries>) => void
  clearUnderlying: () => void
}

type UnderlyingPersistedState = Pick<UnderlyingState, 'seriesBySymbol'>

export const useUnderlyingStore = create<UnderlyingState>()(
  persist<UnderlyingState, [], [], UnderlyingPersistedState>(
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
    }),
    {
      name: 'healthreport.latestUnderlyingV2',
      storage: idbStorage,
      partialize: (state) => ({ seriesBySymbol: state.seriesBySymbol }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as UnderlyingPersistedState | undefined),
        hasHydrated: true,
      }),
    },
  ),
)
