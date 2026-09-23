import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  setGeneratedReport: (report: ReportModel, deals: DealRow[]) => void
  setMarDegradationPct: (value: number | null) => void
  clearReport: () => void
}

type ReportPersistedState = Pick<
  ReportState,
  'report' | 'baseReport' | 'deals' | 'baseDeals' | 'marDegradationPct'
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
      setGeneratedReport: (report, deals) =>
        set({
          report,
          baseReport: report,
          deals,
          baseDeals: deals,
          marDegradationPct: null,
        }),
      setMarDegradationPct: (value) => set({ marDegradationPct: value }),
      clearReport: () =>
        set({
          report: null,
          baseReport: null,
          deals: null,
          baseDeals: null,
          marDegradationPct: null,
        }),
    }),
    {
      name: 'healthreport.latestReport',
      storage: idbStorage,
      partialize: ({ report, baseReport, deals, baseDeals, marDegradationPct }) => ({
        report,
        baseReport,
        deals,
        baseDeals,
        marDegradationPct,
      }),
      version: 6,
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
        const hasMarDegradation = marDegradationPct != null
        return {
          report: isValid ? report : null,
          baseReport: isValid ? (hasMarDegradation ? (baseReport ?? report) : report) : null,
          deals,
          baseDeals: hasMarDegradation ? (baseDeals ?? deals) : deals,
          marDegradationPct,
        }
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as ReportPersistedState | undefined),
        hasHydrated: true,
      }),
    },
  ),
)
