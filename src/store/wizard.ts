import { create } from 'zustand'

type WizardLoadingKey = 'parsingDeals' | 'parsingUnderlying' | 'computingReport'

type WizardState = {
  activeStep: number
  loading: Record<WizardLoadingKey, boolean>
  setActiveStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setLoading: (key: WizardLoadingKey, value: boolean) => void
  resetWizard: () => void
}

export const useWizardStore = create<WizardState>((set) => ({
  activeStep: 0,
  loading: {
    parsingDeals: false,
    parsingUnderlying: false,
    computingReport: false,
  },
  setActiveStep: (step) => set({ activeStep: step }),
  nextStep: () => set((state) => ({ activeStep: Math.min(state.activeStep + 1, 2) })),
  prevStep: () => set((state) => ({ activeStep: Math.max(state.activeStep - 1, 0) })),
  setLoading: (key, value) =>
    set((state) => ({
      loading: {
        ...state.loading,
        [key]: value,
      },
    })),
  resetWizard: () =>
    set({
      activeStep: 0,
      loading: {
        parsingDeals: false,
        parsingUnderlying: false,
        computingReport: false,
      },
    }),
}))
