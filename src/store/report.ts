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

export const useReportStore = create<ReportState>()(
  persist(
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
        const report = state?.report as ReportModel | null | undefined
        const baseReport = state?.baseReport as ReportModel | null | undefined
        const deals = Array.isArray(state?.deals) ? (state?.deals as DealRow[]) : null
        const baseDeals = Array.isArray(state?.baseDeals) ? (state?.baseDeals as DealRow[]) : null
        const marDegradationPct =
          typeof state?.marDegradationPct === 'number'
            ? (state?.marDegradationPct as number)
            : null
        const isValid =
          !!report &&
          Array.isArray(report.contributions) &&
          report.contributions.length > 0 &&
          Array.isArray(report.portfolio?.days) &&
          report.portfolio.days.length > 0
        return {
          ...state,
          report: isValid ? report : null,
          baseReport: isValid ? baseReport ?? (report ?? null) : null,
          deals,
          baseDeals: baseDeals ?? deals,
          marDegradationPct,
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
