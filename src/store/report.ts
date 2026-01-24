import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DealRow, ReportModel } from '../engine/types'
import { idbStorage } from './idbStorage'

type ReportState = {
  report: ReportModel | null
  baseReport: ReportModel | null
  deals: DealRow[] | null
  baseDeals: DealRow[] | null
  marDegradationPct: number | null
  hasHydrated: boolean
  setReport: (report: ReportModel) => void
  setBaseReport: (report: ReportModel) => void
  setDeals: (deals: DealRow[]) => void
  setBaseDeals: (deals: DealRow[]) => void
  setMarDegradationPct: (value: number | null) => void
  clearReport: () => void
  setHasHydrated: (value: boolean) => void
}

type ReportPersistedState = Omit<
  ReportState,
  | 'setReport'
  | 'setBaseReport'
  | 'setDeals'
  | 'setBaseDeals'
  | 'setMarDegradationPct'
  | 'clearReport'
  | 'setHasHydrated'
>

export const useReportStore = create<ReportState>()(
  persist<ReportState, [], [], ReportPersistedState>(
    (set) => ({
      report: null,
      baseReport: null,
      deals: null,
      baseDeals: null,
      marDegradationPct: null,
      hasHydrated: false,
      setReport: (report) => set({ report }),
      setBaseReport: (baseReport) => set({ baseReport }),
      setDeals: (deals) => set({ deals }),
      setBaseDeals: (baseDeals) => set({ baseDeals }),
      setMarDegradationPct: (value) => set({ marDegradationPct: value }),
      clearReport: () =>
        set({ report: null, baseReport: null, deals: null, baseDeals: null, marDegradationPct: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'healthreport.latestReport',
      storage: createJSONStorage(() => idbStorage),
      version: 5,
      migrate: (state) => {
        const stored = state as Partial<ReportPersistedState> | undefined
        const report = stored?.report as ReportModel | null | undefined
        const baseReport = stored?.baseReport as ReportModel | null | undefined
        const deals = Array.isArray(stored?.deals) ? (stored?.deals as DealRow[]) : null
        const baseDeals = Array.isArray(stored?.baseDeals) ? (stored?.baseDeals as DealRow[]) : null
        const marDegradationPct =
          typeof stored?.marDegradationPct === 'number'
            ? (stored?.marDegradationPct as number)
            : null
        const isValid =
          !!report &&
          Array.isArray(report.contributions) &&
          report.contributions.length > 0 &&
          Array.isArray(report.portfolio?.days) &&
          report.portfolio.days.length > 0
        return {
          report: isValid ? report : null,
          baseReport: isValid ? baseReport ?? (report ?? null) : null,
          deals,
          baseDeals: baseDeals ?? deals,
          marDegradationPct,
          hasHydrated: stored?.hasHydrated ?? false,
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
