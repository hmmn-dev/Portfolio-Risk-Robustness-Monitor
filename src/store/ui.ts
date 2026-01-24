import { create } from 'zustand'

type UIState = {
  colorMode: 'light' | 'dark'
  toggleColorMode: () => void
}

export const useUIStore = create<UIState>((set) => ({
  colorMode: 'light',
  toggleColorMode: () =>
    set((state) => ({ colorMode: state.colorMode === 'light' ? 'dark' : 'light' })),
}))
